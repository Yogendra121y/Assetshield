const router = require('express').Router()
const { requireAuth } = require('../middleware/auth')
const { getAssets, getAsset, deleteAsset } = require('../controllers/assetsController')

router.get('/',    requireAuth, getAssets)
router.get('/:id', requireAuth, getAsset)
router.delete('/:id', requireAuth, deleteAsset)

module.exports = router
