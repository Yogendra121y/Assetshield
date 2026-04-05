const { db } = require('../services/firebase')
const { FieldValue } = require('firebase-admin/firestore')

/**
 * POST /auth/register
 * Called after Firebase client-side registration to persist user doc.
 */
async function register(req, res, next) {
  try {
    const { name } = req.body
    const uid = req.user?.uid
    const email = req.user?.email
    if (!uid || !email) return res.status(401).json({ error: 'Valid auth token required' })

    const ref  = db.collection('users').doc(uid)
    const snap = await ref.get()

    if (!snap.exists) {
      await ref.set({
        uid, email,
        displayName: name || '',
        plan: 'free',
        assetsCount: 0,
        createdAt: FieldValue.serverTimestamp(),
      })
    }

    res.json({ success: true, uid })
  } catch (err) { next(err) }
}

/**
 * POST /auth/login
 * Verifies the Firebase token (via requireAuth middleware) and returns profile.
 */
async function login(req, res, next) {
  try {
    const ref  = db.collection('users').doc(req.user.uid)
    const snap = await ref.get()
    const profile = snap.exists ? snap.data() : {}
    res.json({ uid: req.user.uid, email: req.user.email, ...profile })
  } catch (err) { next(err) }
}

module.exports = { register, login }
