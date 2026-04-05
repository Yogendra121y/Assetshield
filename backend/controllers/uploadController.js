const multer          = require('multer')
const path            = require('path')
const { bucket, db }  = require('../services/firebase')
const { FieldValue }  = require('firebase-admin/firestore')
const { generateFingerprint } = require('../services/fingerprintService')

// Multer memory storage — file never hits disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
  fileFilter(_, file, cb) {
    const allowed = /^(image\/(jpeg|png|webp|gif)|video\/(mp4|quicktime|x-msvideo|avi))$/
    cb(null, allowed.test(file.mimetype))
  },
}).single('file')

async function uploadMedia(req, res, next) {
  upload(req, res, async (err) => {
    if (err) return next({ status: 400, message: err.message })
    if (!req.file) return res.status(400).json({ error: 'No file provided' })

    try {
      const uid      = req.user.uid
      const ext      = path.extname(req.file.originalname)
      const filename = `assets/${uid}/${Date.now()}${ext}`

      // ── 1. Upload to Cloud Storage ────────────────────────────────────
      const blob = bucket.file(filename)
      await blob.save(req.file.buffer, {
        metadata: { contentType: req.file.mimetype },
        resumable: false,
      })
      await blob.makePublic()
      const fileUrl = blob.publicUrl()

      // ── 2. Generate perceptual fingerprint ───────────────────────────
      const fingerprint = await generateFingerprint(req.file.buffer, req.file.mimetype)

      // ── 3. Save metadata to Firestore ────────────────────────────────
      const docRef = await db.collection('assets').add({
        userId:          uid,
        fileName:        req.file.originalname,
        fileType:        req.file.mimetype,
        fileSize:        req.file.size,
        fileUrl,
        storagePath:     filename,
        fingerprint,
        status:          'processing',
        similarityScore: null,
        createdAt:       FieldValue.serverTimestamp(),
      })

      // ── 4. Update user asset count ────────────────────────────────────
      await db.collection('users').doc(uid).set({
        assetsCount: FieldValue.increment(1),
      }, { merge: true })

      res.status(201).json({ assetId: docRef.id, fingerprint, fileUrl })
    } catch (e) { next(e) }
  })
}

module.exports = { uploadMedia }
