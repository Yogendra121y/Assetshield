import axios from 'axios'
import { auth } from './firebase'

const BASE_URL = import.meta.env.VITE_API_URL || '/api'

// Create axios instance
const api = axios.create({ baseURL: BASE_URL })

// Attach Firebase ID token to every request
api.interceptors.request.use(async (config) => {
  const user = auth.currentUser
  if (user) {
    const token = await user.getIdToken()
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ─── Auth ─────────────────────────────────────────────────────────────────
export const registerUser  = (data) => api.post('/auth/register', data)
export const loginUser     = (data) => api.post('/auth/login', data)

// ─── Assets ───────────────────────────────────────────────────────────────
export const getAssets     = ()     => api.get('/assets')
export const getAsset      = (id)   => api.get(`/assets/${id}`)
export const deleteAsset   = (id)   => api.delete(`/assets/${id}`)

// ─── Upload ───────────────────────────────────────────────────────────────
export const uploadMedia = (formData, onProgress) =>
  api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (onProgress) onProgress(Math.round((e.loaded * 100) / e.total))
    },
  })

// ─── Analysis ─────────────────────────────────────────────────────────────
export const analyzeAsset  = (assetId) => api.post('/analyze', { assetId })

// ─── Reports ──────────────────────────────────────────────────────────────
export const getStats      = ()     => api.get('/stats')

export default api
