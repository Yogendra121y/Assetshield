const router = require('express').Router()
const { requireAuth } = require('../middleware/auth')
const { uploadMedia } = require('../controllers/uploadController')

router.post('/', requireAuth, uploadMedia)

module.exports = router
