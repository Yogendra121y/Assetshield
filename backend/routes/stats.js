const router = require('express').Router()
const { requireAuth } = require('../middleware/auth')
const { db } = require('../services/firebase')

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const snap = await db.collection('assets').where('userId', '==', req.user.uid).get()
    const assets = snap.docs.map(d => d.data())
    res.json({
      total:      assets.length,
      safe:       assets.filter(a => a.status === 'safe').length,
      flagged:    assets.filter(a => a.status === 'flagged').length,
      processing: assets.filter(a => a.status === 'processing').length,
      avgScore:   assets.length
        ? Math.round(assets.reduce((s, a) => s + (a.similarityScore || 0), 0) / assets.length)
        : 0,
    })
  } catch (err) { next(err) }
})

module.exports = router
