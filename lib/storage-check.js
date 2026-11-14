import './env.js';
import { createClient } from '@supabase/supabase-js';

const rawUrl = process.env.STORAGE_URL;
const key = process.env.STORAGE_KEY;
const bucket = process.env.STORAGE_BUCKET || 'cognify-files';

if (!rawUrl || !key) {
  console.error('STORAGE_URL or STORAGE_KEY is empty. Fill them in .env yourself (never paste them in chat).');
  process.exit(1);
}

const url = new URL(rawUrl).origin;
const urlWarning = rawUrl.replace(/\/+$/, '') !== url ? `STORAGE_URL had extra path parts; using ${url}` : null;

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const storage = supabase.storage;

let failed = false;
const ok = (msg) => console.log(`  [ok]   ${msg}`);
const bad = (msg) => { failed = true; console.log(`  [FAIL] ${msg}`); };
const msgOf = (err) => String(err?.message ?? err).replace(key, '***').slice(0, 300);

const stamp = Date.now();
const pathA = `_healthcheck/server-upload-${stamp}.txt`;
const pathB = `_healthcheck/signed-upload-${stamp}.txt`;
const bodyA = `cognify storage check A ${stamp}`;
const bodyB = `cognify storage check B ${stamp}`;
const uploaded = [];

console.log(`Cognify storage check (bucket: ${bucket}, project: ${url})\n`);
if (urlWarning) console.log(`  [note] ${urlWarning}`);

try {
  const { data: info, error: bucketErr } = await storage.getBucket(bucket);
  if (bucketErr) {
    bad(`bucket "${bucket}" not found or key rejected: ${msgOf(bucketErr)}`);
  } else {
    ok(`bucket "${bucket}" exists`);
    info.public ? bad('bucket is PUBLIC. Turn Public off in Supabase, Storage, bucket settings') : ok('bucket is private');
  }

  const { error: upErr } = await storage.from(bucket).upload(pathA, Buffer.from(bodyA), { contentType: 'text/plain', upsert: true });
  if (upErr) bad(`server upload failed: ${msgOf(upErr)}`);
  else { uploaded.push(pathA); ok('server-side upload works'); }

  if (uploaded.includes(pathA)) {
    const { data: signed, error: signErr } = await storage.from(bucket).createSignedUrl(pathA, 60);
    if (signErr) bad(`create signed download URL failed: ${msgOf(signErr)}`);
    else {
      const res = await fetch(signed.signedUrl);
      const text = res.ok ? await res.text() : '';
      res.ok && text === bodyA ? ok('signed download URL returns the uploaded file') : bad(`signed download URL fetch failed (HTTP ${res.status})`);
    }
  }

  const { data: upl, error: uplErr } = await storage.from(bucket).createSignedUploadUrl(pathB);
  if (uplErr) bad(`create signed upload URL failed: ${msgOf(uplErr)}`);
  else {
    const { error: putErr } = await storage.from(bucket).uploadToSignedUrl(pathB, upl.token, Buffer.from(bodyB), { contentType: 'text/plain' });
    if (putErr) bad(`upload through signed URL failed: ${msgOf(putErr)}`);
    else {
      uploaded.push(pathB);
      const { data: signedB } = await storage.from(bucket).createSignedUrl(pathB, 60);
      const res = signedB ? await fetch(signedB.signedUrl) : null;
      res?.ok && (await res.text()) === bodyB ? ok('signed upload URL flow works (browser-style upload)') : bad('file uploaded via signed URL could not be read back');
    }
  }

  if (uploaded.includes(pathA)) {
    const publicUrl = storage.from(bucket).getPublicUrl(pathA).data.publicUrl;
    const res = await fetch(publicUrl);
    res.ok ? bad('public URL returned the file: bucket is NOT private') : ok(`public URL is blocked (HTTP ${res.status}), bucket is private`);
  }
} catch (err) {
  bad(`unexpected error: ${msgOf(err)}`);
} finally {
  if (uploaded.length) {
    const { error } = await storage.from(bucket).remove(uploaded);
    error ? bad(`cleanup failed, delete _healthcheck/ files by hand: ${msgOf(error)}`) : ok('test files deleted');
  }
}

console.log(failed ? '\nStorage check FAILED.' : '\nStorage check passed.');
process.exitCode = failed ? 1 : 0;
