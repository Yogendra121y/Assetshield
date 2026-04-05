import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  Upload, FileImage, Film, X, CheckCircle,
  Loader2, Sparkles,
} from 'lucide-react'
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { storage, db } from '../services/firebase'
import { useAuth } from '../context/AuthContext'
import { analyzeAsset } from '../services/api'
import toast from 'react-hot-toast'

const ACCEPTED = { 'image/*': ['.jpg','.jpeg','.png','.webp','.gif'], 'video/*': ['.mp4','.mov','.avi'] }
const MAX_SIZE  = 100 * 1024 * 1024 // 100 MB

function formatBytes(b) {
  if (b < 1024) return `${b} B`
  if (b < 1048576) return `${(b/1024).toFixed(1)} KB`
  return `${(b/1048576).toFixed(1)} MB`
}

export default function UploadPage() {
  const { user }    = useAuth()
  const navigate    = useNavigate()
  const [files, setFiles]         = useState([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress]   = useState({}) // { fileName: pct }
  const [done, setDone]           = useState(false)

  const onDrop = useCallback((accepted, rejected) => {
    if (rejected.length) toast.error(`${rejected.length} file(s) rejected — check type/size`)
    const mapped = accepted.map(f => Object.assign(f, { preview: URL.createObjectURL(f) }))
    setFiles(prev => [...prev, ...mapped].slice(0, 10)) // max 10 at once
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: ACCEPTED, maxSize: MAX_SIZE, multiple: true,
  })

  const removeFile = (name) => setFiles(f => f.filter(x => x.name !== name))

  const uploadAll = async () => {
    if (!files.length) return toast.error('No files selected')
    setUploading(true)
    const assetIds = []

    for (const file of files) {
      try {
        // 1. Upload to Firebase Storage
        const path    = `assets/${user.uid}/${Date.now()}_${file.name}`
        const storRef = ref(storage, path)
        const task    = uploadBytesResumable(storRef, file)

        const fileUrl = await new Promise((res, rej) => {
          task.on('state_changed',
            snap => setProgress(p => ({ ...p, [file.name]: Math.round(snap.bytesTransferred / snap.totalBytes * 100) })),
            rej,
            async () => res(await getDownloadURL(task.snapshot.ref))
          )
        })

        // 2. Save metadata to Firestore with status=processing
        const docRef = await addDoc(collection(db, 'assets'), {
          userId:      user.uid,
          fileName:    file.name,
          fileType:    file.type,
          fileSize:    file.size,
          fileUrl,
          storagePath: path,
          status:      'processing',
          fingerprint: null,
          similarityScore: null,
          createdAt:   serverTimestamp(),
        })

        assetIds.push(docRef.id)

        // 3. Trigger AI analysis (non-blocking)
        analyzeAsset(docRef.id).catch(console.error)

        toast.success(`${file.name} uploaded!`)
      } catch (err) {
        console.error(err)
        toast.error(`Failed to upload ${file.name}`)
      }
    }

    setDone(true)
    setUploading(false)
  }

  if (done) return (
    <div className="px-4 sm:px-6 max-w-2xl mx-auto flex flex-col items-center text-center py-16 sm:py-24">
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}
        className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
        style={{ background: 'rgba(16,185,129,0.12)', border: '2px solid #10b981' }}>
        <CheckCircle size={36} style={{ color: '#10b981' }} />
      </motion.div>
      <h2 className="font-display text-2xl mb-2" style={{ fontWeight: 800, color: 'var(--text-primary)' }}>
        Upload Complete!
      </h2>
      <p className="mb-6 text-base" style={{ color: 'var(--text-secondary)' }}>
        {files.length} asset{files.length > 1 ? 's' : ''} uploaded. AI analysis is running in the background.
      </p>
      <div className="flex w-full sm:w-auto flex-col sm:flex-row gap-3">
        <button onClick={() => { setFiles([]); setProgress({}); setDone(false) }} className="btn-ghost w-full sm:w-auto justify-center">
          Upload More
        </button>
        <button onClick={() => navigate('/dashboard')} className="btn-primary w-full sm:w-auto justify-center">
          View Dashboard
        </button>
      </div>
    </div>
  )

  return (
    <div className="px-4 sm:px-6 py-6 sm:py-8 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl md:text-3xl mb-1" style={{ fontWeight: 800, color: 'var(--text-primary)' }}>
          Upload Assets
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>
          Upload images or videos to generate fingerprints and detect unauthorized usage
        </p>
      </div>

      {/* Drop zone */}
      <motion.div
        {...getRootProps()}
        whileHover={{ borderColor: 'var(--accent)' }}
        animate={{ borderColor: isDragActive ? 'var(--accent)' : 'var(--border)' }}
        className="relative rounded-2xl p-6 sm:p-10 text-center cursor-pointer transition-all"
        style={{
          border: '2px dashed var(--border)',
          background: isDragActive ? 'rgba(61,106,255,0.04)' : 'var(--bg-card)',
        }}
      >
        <input {...getInputProps()} />
        <motion.div animate={{ y: isDragActive ? -6 : 0 }} className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(61,106,255,0.1)', border: '1px solid rgba(61,106,255,0.2)' }}>
            <Upload size={28} style={{ color: 'var(--accent)' }} />
          </div>
          <div>
            <p className="font-600 text-base" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
              {isDragActive ? 'Drop files here…' : 'Drag & drop media files'}
            </p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              or <span style={{ color: 'var(--accent)', fontWeight: 600 }}>browse</span> to select — JPG, PNG, MP4, MOV up to 100 MB
            </p>
          </div>
        </motion.div>
      </motion.div>

      {/* File list */}
      <AnimatePresence>
        {files.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-600" style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                {files.length} file{files.length > 1 ? 's' : ''} selected
              </p>
              <button onClick={() => setFiles([])} className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Clear all
              </button>
            </div>
            {files.map(file => {
              const pct     = progress[file.name]
              const isImage = file.type.startsWith('image')
              return (
                <motion.div key={file.name} layout
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="card p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4"
                >
                  {/* Preview */}
                  <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center"
                    style={{ background: 'var(--bg-secondary)' }}>
                    {isImage
                      ? <img src={file.preview} alt="" className="w-full h-full object-cover" />
                      : <Film size={20} style={{ color: 'var(--text-muted)' }} />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-500 truncate" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                      {file.name}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {formatBytes(file.size)}
                    </p>
                    {pct !== undefined && (
                      <div className="mt-2">
                        <div className="progress-bar">
                          <motion.div className="progress-fill"
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            style={{ background: pct === 100 ? '#10b981' : 'var(--accent)' }}
                          />
                        </div>
                        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                          {pct === 100 ? 'Uploaded ✓' : `Uploading ${pct}%`}
                        </p>
                      </div>
                    )}
                  </div>
                  {!uploading && (
                    <button onClick={() => removeFile(file.name)} className="flex-shrink-0 p-1.5 rounded-lg"
                      style={{ color: 'var(--text-muted)' }}>
                      <X size={16} />
                    </button>
                  )}
                </motion.div>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI info banner */}
      <div className="card p-4 flex gap-3 items-start">
        <Sparkles size={18} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 2 }} />
        <div>
          <p className="text-sm font-600" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>AI Analysis Pipeline</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            After upload, AssetShield AI generates a perceptual hash fingerprint and runs cosine similarity matching against
            our scraped sports media dataset. Assets above 80% similarity are automatically flagged.
          </p>
        </div>
      </div>

      {/* Upload button */}
      <button
        onClick={uploadAll}
        disabled={!files.length || uploading}
        className="btn-primary w-full justify-center py-4 text-base"
      >
        {uploading
          ? <><Loader2 size={20} className="animate-spin" /> Processing uploads…</>
          : <><Upload size={20} /> Upload {files.length > 0 ? `${files.length} File${files.length > 1 ? 's' : ''}` : 'Files'}</>
        }
      </button>
    </div>
  )
}
