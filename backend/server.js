require('dotenv').config()
const express     = require('express')
const cors        = require('cors')
const helmet      = require('helmet')
const morgan      = require('morgan')
const rateLimit   = require('express-rate-limit')
const axios       = require('axios')
const path        = require('path')

// Routes
const authRoutes   = require('./routes/auth')
const uploadRoutes = require('./routes/upload')
const assetRoutes  = require('./routes/assets')
const analyzeRoutes = require('./routes/analyze')
const statsRoutes  = require('./routes/stats')

const app  = express()
const PORT = process.env.PORT || 5000

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000'
const AI_DATASET_FOLDER = process.env.AI_DATASET_FOLDER || null
const AI_WARMUP_ON_START = (process.env.AI_WARMUP_ON_START || 'true').toLowerCase() === 'true'
const AI_WARMUP_RETRIES = Number(process.env.AI_WARMUP_RETRIES || 3)
const AI_WARMUP_TIMEOUT_MS = Number(process.env.AI_WARMUP_TIMEOUT_MS || 15000)

// ── Security & Middleware ────────────────────────────────────────────────────
app.use(helmet())
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}))
app.use(morgan('dev'))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Rate limiting
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 200,
  message: { error: 'Too many requests — please try again later' },
}))

// ── Routes ──────────────────────────────────────────────────────────────────
app.use('/auth',    authRoutes)
app.use('/upload',  uploadRoutes)
app.use('/assets',  assetRoutes)
app.use('/analyze', analyzeRoutes)
app.use('/stats',   statsRoutes)

// Health check (used by Cloud Run)
app.get('/health', (_, res) => res.json({ status: 'ok', ts: new Date().toISOString() }))
app.get("/", (req, res) => {
  res.send("Backend is running");
});

// ── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message)
  const status = err.status || 500
  res.status(status).json({ error: err.message || 'Internal server error' })
})

app.listen(PORT, async () => {
  console.log(`[Vigil API] running on port ${PORT}`)
  await warmupAiIndex()
})

async function warmupAiIndex() {
  if (!AI_WARMUP_ON_START) {
    console.log('[AI Warmup] skipped (AI_WARMUP_ON_START=false)')
    return
  }

  if (!AI_DATASET_FOLDER) {
    console.log('[AI Warmup] skipped (AI_DATASET_FOLDER not set)')
    return
  }

  for (let attempt = 1; attempt <= AI_WARMUP_RETRIES; attempt++) {
    try {
      const health = await axios.get(`${AI_SERVICE_URL}/health`, { timeout: AI_WARMUP_TIMEOUT_MS })
      if (health.status < 200 || health.status >= 300) throw new Error(`health status ${health.status}`)

      const rebuild = await axios.post(
        `${AI_SERVICE_URL}/index/rebuild`,
        { dataset_folder: AI_DATASET_FOLDER },
        { timeout: AI_WARMUP_TIMEOUT_MS }
      )

      const data = rebuild.data || {}
      console.log(`[AI Warmup] indexed ${data.count || 0} files (dim=${data.dimension || 0}) from ${AI_DATASET_FOLDER}`)
      return
    } catch (err) {
      const msg = err.response?.data?.detail || err.message
      console.error(`[AI Warmup] attempt ${attempt}/${AI_WARMUP_RETRIES} failed: ${msg}`)
      if (attempt < AI_WARMUP_RETRIES) await sleep(1200)
    }
  }

  console.error('[AI Warmup] exhausted retries; backend will continue without startup warm index')
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
module.exports = app
