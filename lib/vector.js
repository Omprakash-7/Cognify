/**
 * pgvector helpers.
 */

/**
 * Convert a JavaScript number array to a pgvector literal string.
 * @param {number[]} arr - The embedding vector.
 * @returns {string} e.g. "[1,2,3]"
 */
export function toVectorLiteral(arr) {
  return '[' + arr.join(',') + ']';
}
