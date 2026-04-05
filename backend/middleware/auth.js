const { auth } = require('../services/firebase')

/**
 * Verifies Firebase ID token from Authorization header.
 * Attaches decoded token to req.user.
 */
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null

  if (!token) return res.status(401).json({ error: 'No token provided' })

  try {
    req.user = await auth.verifyIdToken(token)
    next()
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}

module.exports = { requireAuth }
