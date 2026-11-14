import './env.js';
import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.LLM_API_KEY;
if (!apiKey) {
  console.error('LLM_API_KEY is empty. Put your AI Studio key in .env (never paste it in chat).');
  process.exit(1);
}

const CHAT_MODEL = process.env.LLM_CHAT_MODEL || 'gemini-3.5-flash-lite';
const EMBED_MODEL = process.env.LLM_EMBED_MODEL || 'gemini-embedding-001';
const EMBED_DIM = Number(process.env.EMBED_DIM || 1536);

const ai = new GoogleGenAI({ apiKey });
let failed = false;
const ok = (msg) => console.log(`  [ok]   ${msg}`);
const bad = (msg) => { failed = true; console.log(`  [FAIL] ${msg}`); };
const shortError = (err) => String(err?.message ?? err).replace(apiKey, '***').slice(0, 300);

console.log(`Cognify LLM check (chat: ${CHAT_MODEL}, embeddings: ${EMBED_MODEL}, EMBED_DIM: ${EMBED_DIM})\n`);

try {
  const res = await ai.models.generateContent({
    model: CHAT_MODEL,
    contents: 'In one short sentence, what is a vector database?',
  });
  const text = (res.text ?? '').trim();
  text ? ok(`text generation: "${text.slice(0, 120)}"`) : bad('text generation returned an empty reply');
} catch (err) {
  bad(`text generation failed: ${shortError(err)}`);
}

try {
  const res = await ai.models.embedContent({
    model: EMBED_MODEL,
    contents: "Newton's second law relates force, mass and acceleration.",
    config: { taskType: 'RETRIEVAL_DOCUMENT', outputDimensionality: EMBED_DIM },
  });
  const values = res.embeddings?.[0]?.values;
  if (!Array.isArray(values) || values.length === 0) {
    bad('embedding returned no values');
  } else if (!values.every(Number.isFinite)) {
    bad('embedding contains non-numeric values');
  } else if (values.length !== EMBED_DIM) {
    bad(`embedding has ${values.length} numbers but EMBED_DIM is ${EMBED_DIM}`);
  } else {
    ok(`embedding: ${values.length} numbers, first 3 = ${values.slice(0, 3).map((v) => v.toFixed(4)).join(', ')}`);
  }
} catch (err) {
  bad(`embedding failed: ${shortError(err)}`);
}

console.log(failed ? '\nLLM check FAILED.' : '\nLLM check passed.');
process.exitCode = failed ? 1 : 0;
