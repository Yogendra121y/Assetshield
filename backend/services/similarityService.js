/**
 * similarityService.js
 * ─────────────────────
 * Compares an asset fingerprint against:
 *   1) All other assets in the user's Firestore collection
 *   2) A simulated "scraped sports media dataset" of known hashes
 *
 * Returns the highest similarity score found and whether the asset should be flagged.
 */

const { db } = require('./firebase')
const { hammingDistance, distanceToScore } = require('./fingerprintService')

// ── Simulated scraped dataset ───────────────────────────────────────────────
// In production this would be a Cloud Firestore collection or Vector DB.
// These 16-char hex hashes represent "known pirated" sports media fingerprints.
const SCRAPED_DATASET = [
  { id: 'scraped_001', name: 'UEFA_Champions_League_highlight.jpg',   hash: 'aabbccdd11223344' },
  { id: 'scraped_002', name: 'Premier_League_goal_clip.mp4',          hash: 'ff00112233445566' },
  { id: 'scraped_003', name: 'IPL_match_thumbnail.png',               hash: '0f1e2d3c4b5a6978' },
  { id: 'scraped_004', name: 'NBA_dunk_broadcast.jpg',                hash: 'deadbeef01234567' },
  { id: 'scraped_005', name: 'FIFA_World_Cup_promo.webp',             hash: 'c0ffee1122334455' },
  { id: 'scraped_006', name: 'F1_race_podium.jpg',                    hash: '1234567890abcdef' },
  { id: 'scraped_007', name: 'Wimbledon_match_clip.mp4',              hash: 'fedcba9876543210' },
  { id: 'scraped_008', name: 'Super_Bowl_ad_screenshot.jpg',          hash: '0102030405060708' },
  { id: 'scraped_009', name: 'Olympic_ceremony_broadcast.png',        hash: 'a1b2c3d4e5f60718' },
  { id: 'scraped_010', name: 'Tour_de_France_finish.jpg',             hash: '9988776655443322' },
]

/**
 * Find the best match for a given fingerprint across all sources.
 *
 * @param {string} fingerprint  - hex hash of uploaded asset
 * @param {string} userId       - owner's UID (to skip self-comparison)
 * @param {string} assetId      - the asset's own ID (to skip self)
 * @returns {{ score: number, matchedId: string|null, matchedName: string|null }}
 */
async function findBestMatch(fingerprint, userId, assetId) {
  let bestScore    = 0
  let matchedId    = null
  let matchedName  = null

  // ── 1. Compare against scraped dataset ───────────────────────────────────
  for (const entry of SCRAPED_DATASET) {
    const dist  = hammingDistance(fingerprint, entry.hash)
    const score = distanceToScore(dist)
    if (score > bestScore) {
      bestScore   = score
      matchedId   = entry.id
      matchedName = entry.name
    }
  }

  // ── 2. Compare against user's own asset library ──────────────────────────
  try {
    const snap = await db.collection('assets')
      .where('userId', '==', userId)
      .where('status', 'in', ['safe', 'flagged'])
      .limit(200)
      .get()

    for (const doc of snap.docs) {
      if (doc.id === assetId) continue
      const data = doc.data()
      if (!data.fingerprint) continue

      const dist  = hammingDistance(fingerprint, data.fingerprint)
      const score = distanceToScore(dist)
      if (score > bestScore) {
        bestScore   = score
        matchedId   = doc.id
        matchedName = data.fileName
      }
    }
  } catch (e) {
    console.error('[SimilarityService] Firestore query failed:', e.message)
  }

  return { score: bestScore, matchedId, matchedName }
}

module.exports = { findBestMatch }
