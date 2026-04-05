/**
 * analyzeController.js
 * ─────────────────────
 * Orchestrates the AI analysis pipeline:
 *   1. Fetch asset from Firestore
 *   2. Download file from Storage
 *   3. (Re-)generate fingerprint
 *   4. Run similarity matching
 *   5. Flag if score ≥ threshold
 *   6. Persist results to Firestore
 *   7. Simulate Pub/Sub notification
 */

const https   = require('https')
const http    = require('http')
const axios   = require('axios')
const { db, bucket } = require('../services/firebase')
const { FieldValue } = require('firebase-admin/firestore')
const { generateFingerprint }  = require('../services/fingerprintService')
const { findBestMatch }        = require('../services/similarityService')

const FLAG_THRESHOLD = Number(process.env.FLAG_THRESHOLD || 80)
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000'
const AI_DATASET_FOLDER = process.env.AI_DATASET_FOLDER || null
const AI_USE_INDEX = (process.env.AI_USE_INDEX || 'true').toLowerCase() === 'true'
const AI_INDEX_TOP_K = Number(process.env.AI_INDEX_TOP_K || 25)

/**
 * Download a file from a URL and return as Buffer.
 */
function downloadBuffer(url) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http
    const req = proto.get(url, (res) => {
      // Follow one-level redirects for signed/public URLs.
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        resolve(downloadBuffer(res.headers.location))
        return
      }

      if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
        reject(new Error(`Download failed with status ${res.statusCode || 'unknown'}`))
        return
      }

      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end',  () => resolve(Buffer.concat(chunks)))
      res.on('error', reject)
    })

    req.setTimeout(15000, () => {
      req.destroy(new Error('Download timeout'))
    })

    req.on('error', reject)
  })
}

async function analyzeAsset(req, res, next) {
  const { assetId } = req.body
  if (!assetId) return res.status(400).json({ error: 'assetId required' })

  try {
    // ── 1. Fetch asset doc ────────────────────────────────────────────────
    const ref  = db.collection('assets').doc(assetId)
    const snap = await ref.get()
    if (!snap.exists) return res.status(404).json({ error: 'Asset not found' })
    const asset = snap.data()

    // Authorisation: only owner may trigger analysis
    if (asset.userId !== req.user.uid) return res.status(403).json({ error: 'Forbidden' })

    // Mark as processing (re-run)
    await ref.update({ status: 'processing', analyzedAt: FieldValue.serverTimestamp() })

    // Respond immediately — analysis continues in background
    res.json({ success: true, message: 'Analysis started', assetId })

    // ── 2. Background pipeline (async — does not block response) ─────────
    ;(async () => {
      try {
        // Keep analysis near real-time without blocking request thread.
        await sleep(80)

        let fingerprint = asset.fingerprint

        // Re-generate fingerprint if missing or explicitly requested
        if (!fingerprint) {
          let buffer
          if (asset.storagePath) {
            // Prefer Storage
            const [buf] = await bucket.file(asset.storagePath).download()
            buffer = buf
          } else if (asset.fileUrl) {
            buffer = await downloadBuffer(asset.fileUrl)
          }
          if (buffer) {
            fingerprint = await generateFingerprint(buffer, asset.fileType || 'image/jpeg')
          }
        }

        if (!fingerprint) {
          await ref.update({ status: 'safe', similarityScore: 0, error: 'Could not generate fingerprint' })
          return
        }

        // Small delay to smooth pipeline spikes in local demo mode.
        await sleep(120)

        // ── 3. Run similarity matching ─────────────────────────────────
        const { score, matchedId, matchedName } = await runSimilarity({
          assetId,
          asset,
          fingerprint,
        })

        // ── 4. Determine status ────────────────────────────────────────
        const status = score >= FLAG_THRESHOLD ? 'flagged' : 'safe'

        // ── 5. Persist results ─────────────────────────────────────────
        await ref.update({
          fingerprint,
          status,
          similarityScore: score,
          matchedAssetId:  matchedId,
          matchedAssetName: matchedName,
          analyzedAt:      FieldValue.serverTimestamp(),
        })

        console.log(`[Analyze] ${assetId} → score=${score}% status=${status}`)

        // ── 6. Simulate Pub/Sub alert if flagged ──────────────────────
        if (status === 'flagged') {
          simulatePubSubAlert({ assetId, score, matchedName, userId: asset.userId })
        }
      } catch (bgErr) {
        console.error('[Analyze Background]', bgErr.message)
        await ref.update({ status: 'safe', error: bgErr.message }).catch(() => {})
      }
    })()

  } catch (err) { next(err) }
}

/** Simulate a Pub/Sub publish by logging a structured message */
function simulatePubSubAlert(payload) {
  console.log('[PubSub ALERT]', JSON.stringify({
    topic:     'projects/vigil/topics/asset-violations',
    messageId: `msg_${Date.now()}`,
    data:      Buffer.from(JSON.stringify(payload)).toString('base64'),
    publishTime: new Date().toISOString(),
  }))
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function buildCandidates(userId, currentAssetId) {
  const snap = await db.collection('assets')
    .where('userId', '==', userId)
    .where('status', 'in', ['safe', 'flagged'])
    .limit(200)
    .get()

  return snap.docs
    .filter((doc) => doc.id !== currentAssetId)
    .map((doc) => {
      const data = doc.data()
      return {
        id: doc.id,
        name: data.fileName || doc.id,
        url: data.fileUrl || null,
        fingerprint: data.fingerprint || null,
        file_type: data.fileType || null,
      }
    })
}

async function runSimilarity({ assetId, asset, fingerprint }) {
  const fallback = () => findBestMatch(fingerprint, asset.userId, assetId)

  try {
    const candidates = await buildCandidates(asset.userId, assetId)

    const response = await axios.post(
      `${AI_SERVICE_URL}/analyze`,
      {
        file_url: asset.fileUrl,
        file_type: asset.fileType || null,
        threshold: FLAG_THRESHOLD,
        candidates,
        dataset_folder: AI_DATASET_FOLDER,
        use_index: AI_USE_INDEX,
        top_k: AI_INDEX_TOP_K,
      },
      { timeout: 20000 }
    )

    const payload = response.data || {}
    const similarity = Number(payload.similarity)

    if (!Number.isFinite(similarity)) {
      throw new Error('AI service returned invalid similarity score')
    }

    return {
      score: Math.max(0, Math.min(100, Math.round(similarity))),
      matchedId: payload.matched_id || null,
      matchedName: payload.matched_file || null,
    }
  } catch (err) {
    console.error('[Analyze] AI service fallback:', err.message)
    return fallback()
  }
}

module.exports = { analyzeAsset }
