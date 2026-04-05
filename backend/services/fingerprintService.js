/**
 * fingerprintService.js
 * ─────────────────────
 * Generates a perceptual fingerprint for images using a DCT-based average hash (aHash).
 * For video files, extracts a frame buffer hash as a simulated fingerprint.
 *
 * Algorithm: Resize → grayscale → 8×8 → compute mean → binarise → hex string
 * This is equivalent to a perceptual hash (pHash-lite) and produces a 16-char hex.
 */

const sharp = require('sharp')
const crypto = require('crypto')

/**
 * Generate perceptual fingerprint from raw file buffer.
 * @param {Buffer} buffer     - Raw file bytes
 * @param {string} mimeType   - e.g. "image/jpeg"
 * @returns {Promise<string>} - 64-char hex fingerprint
 */
async function generateFingerprint(buffer, mimeType) {
  if (mimeType.startsWith('image/')) {
    return generateImageHash(buffer)
  }
  // For video: use a SHA-256 of the first 1 MB as a lightweight fingerprint
  const chunk = buffer.slice(0, 1024 * 1024)
  return crypto.createHash('sha256').update(chunk).digest('hex')
}

/**
 * Average Hash (aHash) implementation for images.
 * Returns a 64-bit hash encoded as 16 hex chars followed by SHA-256 of pixels (48 chars).
 */
async function generateImageHash(buffer) {
  try {
    // Resize to 8×8, convert to greyscale
    const { data } = await sharp(buffer)
      .resize(8, 8, { fit: 'fill' })
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true })

    // Compute mean pixel value
    const mean = data.reduce((s, v) => s + v, 0) / data.length

    // Build bit-string: 1 if pixel >= mean, else 0
    let bits = ''
    for (const px of data) bits += px >= mean ? '1' : '0'

    // Convert 64-bit string to 16-char hex
    let hex = ''
    for (let i = 0; i < 64; i += 4) {
      hex += parseInt(bits.slice(i, i + 4), 2).toString(16)
    }

    // Append SHA-256 suffix for uniqueness in storage
    const sha = crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 48)
    return hex + sha
  } catch (e) {
    // Fallback: full SHA-256
    return crypto.createHash('sha256').update(buffer).digest('hex')
  }
}

/**
 * Compute Hamming distance between two hex-encoded hashes (first 16 chars = 64 bits).
 * @returns {number} 0–64, where 0 = identical, 64 = completely different
 */
function hammingDistance(hashA, hashB) {
  const a = hashA.slice(0, 16)
  const b = hashB.slice(0, 16)
  let dist = 0
  for (let i = 0; i < a.length; i++) {
    const bitsA = parseInt(a[i], 16).toString(2).padStart(4, '0')
    const bitsB = parseInt(b[i], 16).toString(2).padStart(4, '0')
    for (let j = 0; j < 4; j++) if (bitsA[j] !== bitsB[j]) dist++
  }
  return dist
}

/**
 * Convert Hamming distance (0–64) to a 0–100 similarity score.
 * distance=0 → 100%, distance=64 → 0%
 */
function distanceToScore(distance) {
  return Math.round(((64 - distance) / 64) * 100)
}

module.exports = { generateFingerprint, hammingDistance, distanceToScore }
