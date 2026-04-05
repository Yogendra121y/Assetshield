const { db, bucket }  = require('../services/firebase')
const { FieldValue }  = require('firebase-admin/firestore')

async function getAssets(req, res, next) {
  try {
    const snap = await db.collection('assets')
      .where('userId', '==', req.user.uid)
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get()

    const assets = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate().toISOString() || null,
    }))
    res.json({ assets })
  } catch (err) { next(err) }
}

async function getAsset(req, res, next) {
  try {
    const snap = await db.collection('assets').doc(req.params.id).get()
    if (!snap.exists) return res.status(404).json({ error: 'Asset not found' })
    const data = snap.data()
    if (data.userId !== req.user.uid) return res.status(403).json({ error: 'Forbidden' })
    res.json({ id: snap.id, ...data, createdAt: data.createdAt?.toDate().toISOString() })
  } catch (err) { next(err) }
}

async function deleteAsset(req, res, next) {
  try {
    const snap = await db.collection('assets').doc(req.params.id).get()
    if (!snap.exists) return res.status(404).json({ error: 'Asset not found' })
    const data = snap.data()
    if (data.userId !== req.user.uid) return res.status(403).json({ error: 'Forbidden' })

    // Delete from Storage
    if (data.storagePath) {
      await bucket.file(data.storagePath).delete().catch(() => {})
    }
    // Delete Firestore doc
    await db.collection('assets').doc(req.params.id).delete()
    // Decrement counter
    await db.collection('users').doc(req.user.uid).set({
      assetsCount: FieldValue.increment(-1),
    }, { merge: true })
    res.json({ success: true })
  } catch (err) { next(err) }
}

module.exports = { getAssets, getAsset, deleteAsset }
