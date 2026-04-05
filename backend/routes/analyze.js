const router = require('express').Router()
const { requireAuth } = require('../middleware/auth')
const { analyzeAsset } = require('../controllers/analyzeController')

// Mounted at /analyze in server.js, so this is POST /analyze
router.post('/', requireAuth, analyzeAsset)

module.exports = router