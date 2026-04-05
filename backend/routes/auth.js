const router = require('express').Router()
const { requireAuth } = require('../middleware/auth')
const { register, login } = require('../controllers/authController')

router.post('/register', requireAuth, register)
router.post('/login', requireAuth, login)

module.exports = router
