/**
 * Authentication helpers: password hashing (bcryptjs) and JWT signing/verification.
 * JWT_SECRET must be a 64-character string set in process.env.
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const BCRYPT_ROUNDS = 12;
const JWT_ALG = 'HS256';
const JWT_EXPIRY = '7d';

function getSecret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET is not set');
  return s;
}

/**
 * Hash a plain-text password with bcrypt.
 * @param {string} plain
 * @returns {Promise<string>} bcrypt hash
 */
export async function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

/**
 * Compare a plain-text password against a bcrypt hash.
 * @param {string} plain
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

/**
 * Sign a JWT for a user.
 * @param {{ sub: string, instituteId: string, role: string }} payload
 * @returns {string} signed JWT
 */
export function signToken({ sub, instituteId, role }) {
  return jwt.sign(
    { sub, instituteId, role },
    getSecret(),
    { algorithm: JWT_ALG, expiresIn: JWT_EXPIRY }
  );
}

/**
 * Verify and decode a JWT.
 * @param {string} token
 * @returns {object} decoded payload
 * @throws if invalid or expired
 */
export function verifyToken(token) {
  return jwt.verify(token, getSecret(), { algorithms: [JWT_ALG] });
}
