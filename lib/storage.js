/**
 * Storage helpers for Cognify using Supabase Storage.
 * Server-side secret key only — never exposed to client.
 */

import { createClient } from '@supabase/supabase-js';

const rawUrl = process.env.STORAGE_URL;
const key = process.env.STORAGE_KEY;
const bucketName = process.env.STORAGE_BUCKET || 'cognify-files';

let client = null;

export function getStorageClient() {
  if (client) return client;
  if (!rawUrl || !key) {
    throw new Error('STORAGE_URL or STORAGE_KEY is not set');
  }
  const url = new URL(rawUrl).origin;
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

export function getBucket() {
  return bucketName;
}

/**
 * Sanitize a filename to prevent path traversal and special characters.
 * @param {string} fileName
 * @returns {string}
 */
export function sanitizeFileName(fileName) {
  if (!fileName || typeof fileName !== 'string') return 'unnamed';
  // Strip paths, directory traversal, control chars
  const base = fileName.split(/[/\\]/).pop() || 'unnamed';
  const clean = base.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^\.+/, '');
  return clean || 'unnamed';
}

/**
 * Create a signed upload URL for browser-side upload.
 * @param {string} storagePath
 * @returns {Promise<{ signedUrl: string, token: string }>}
 */
export async function createSignedUploadUrl(storagePath) {
  const supabase = getStorageClient();
  const { data, error } = await supabase.storage.from(bucketName).createSignedUploadUrl(storagePath);
  if (error) throw error;
  return { signedUrl: data.signedUrl, token: data.token };
}

/**
 * Create a signed download URL.
 * @param {string} storagePath
 * @param {number} [expiresIn=300]
 * @returns {Promise<string>}
 */
export async function createSignedDownloadUrl(storagePath, expiresIn = 300) {
  const supabase = getStorageClient();
  const { data, error } = await supabase.storage.from(bucketName).createSignedUrl(storagePath, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

/**
 * Check if a file exists in storage and return its metadata.
 * @param {string} storagePath
 * @returns {Promise<{ size: number } | null>}
 */
export async function getFileInfo(storagePath) {
  const supabase = getStorageClient();
  const parts = storagePath.split('/');
  const fileName = parts.pop();
  const folder = parts.join('/');

  const { data, error } = await supabase.storage.from(bucketName).list(folder, {
    search: fileName,
  });

  if (error || !data) return null;
  const match = data.find((item) => item.name === fileName);
  if (!match) return null;

  return {
    size: match.metadata?.size ?? 0,
    mimetype: match.metadata?.mimetype,
  };
}

/**
 * Remove one or more files from storage.
 * @param {string|string[]} paths
 * @returns {Promise<void>}
 */
export async function removeFile(paths) {
  const supabase = getStorageClient();
  const list = Array.isArray(paths) ? paths : [paths];
  if (list.length === 0) return;
  const { error } = await supabase.storage.from(bucketName).remove(list);
  if (error) {
    console.error('Storage remove error:', error.message);
  }
}
