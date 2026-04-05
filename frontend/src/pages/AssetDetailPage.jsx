import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { doc, getDoc, deleteDoc } from 'firebase/firestore'
import { ref, deleteObject } from 'firebase/storage'
import { db, storage } from '../services/firebase'
import { analyzeAsset } from '../services/api'
import {
  ArrowLeft, Shield, AlertTriangle, CheckCircle, Clock,
  RefreshCw, Trash2, Download, Copy, ExternalLink,
  FileImage, Film, Hash, Calendar, User, Loader2,
} from 'lucide-react'
import toast from 'react-hot-toast'

const STATUS = {
  safe:       { label: 'Safe',       icon: CheckCircle,   color: '#10b981', bg: 'rgba(16,185,129,0.1)',  cls: 'badge-safe' },
  flagged:    { label: 'Flagged',    icon: AlertTriangle, color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   cls: 'badge-flagged' },
  processing: { label: 'Processing', icon: Clock,         color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', cls: 'badge-processing' },
}

function DetailRow({ label, value, mono, copy }) {
  const handleCopy = () => { navigator.clipboard.writeText(value); toast.success('Copied!') }
  return (
    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-4 py-3"
      style={{ borderBottom: '1px solid var(--border)' }}>
      <span className="text-sm flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm sm:text-right break-all" style={{ color: 'var(--text-primary)', fontFamily: mono ? 'JetBrains Mono, monospace' : 'inherit', fontWeight: 500 }}>
          {value || '—'}
        </span>
        {copy && value && (
          <button onClick={handleCopy} className="flex-shrink-0 p-1 rounded" style={{ color: 'var(--text-muted)' }}>
            <Copy size={13} />
          </button>
        )}
      </div>
    </div>
  )
}

export default function AssetDetailPage() {
  const { id }      = useParams()
  const navigate    = useNavigate()
  const [asset, setAsset]       = useState(null)
  const [loading, setLoading]   = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [deleting,  setDeleting]  = useState(false)

  const fetchAsset = async () => {
    setLoading(true)
    try {
      const snap = await getDoc(doc(db, 'assets', id))
      if (snap.exists()) setAsset({ id: snap.id, ...snap.data() })
      else toast.error('Asset not found')
    } catch (e) { toast.error(e.message) }
    setLoading(false)
  }

  useEffect(() => { fetchAsset() }, [id])

  const handleAnalyze = async () => {
    setAnalyzing(true)
    try {
      await analyzeAsset(id)
      toast.success('Analysis triggered — refreshing…')
      setTimeout(fetchAsset, 2500)
    } catch (e) { toast.error('Analysis failed') }
    setAnalyzing(false)
  }

  const handleDelete = async () => {
    if (!confirm('Delete this asset? This cannot be undone.')) return
    setDeleting(true)
    try {
      if (asset.storagePath) await deleteObject(ref(storage, asset.storagePath)).catch(() => {})
      await deleteDoc(doc(db, 'assets', id))
      toast.success('Asset deleted')
      navigate('/dashboard')
    } catch (e) { toast.error(e.message) }
    setDeleting(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={28} className="animate-spin" style={{ color: 'var(--accent)' }} />
    </div>
  )

  if (!asset) return (
    <div className="px-6 py-8 text-center">
      <p style={{ color: 'var(--text-muted)' }}>Asset not found.</p>
      <Link to="/dashboard" className="btn-primary mt-4 inline-flex">Back to Dashboard</Link>
    </div>
  )

  const cfg = STATUS[asset.status] || STATUS.processing
  const Icon = cfg.icon
  const isVideo = asset.fileType?.startsWith('video')
  const ts = asset.createdAt?.toDate
    ? asset.createdAt.toDate().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
    : 'Unknown'
  const score = asset.similarityScore
  const scoreColor = score >= 80 ? '#ef4444' : score >= 50 ? '#f59e0b' : '#10b981'

  return (
    <div className="px-4 sm:px-6 py-6 sm:py-8 max-w-5xl mx-auto space-y-6">
      {/* Back */}
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm hover:opacity-80 transition-opacity"
        style={{ color: 'var(--text-secondary)' }}>
        <ArrowLeft size={16} /> Back
      </button>

      {/* Top card */}
      <div className="card overflow-hidden">
        <div className="grid md:grid-cols-2 gap-0">
          {/* Media preview */}
          <div className="relative" style={{ minHeight: 280, background: 'var(--bg-secondary)' }}>
            {asset.fileUrl
              ? isVideo
                ? <video src={asset.fileUrl} controls className="w-full h-full object-contain" style={{ maxHeight: 360 }} />
                : <img src={asset.fileUrl} alt={asset.fileName} className="w-full h-full object-contain" style={{ maxHeight: 360 }} />
              : <div className="w-full h-full flex items-center justify-center" style={{ minHeight: 280 }}>
                  {isVideo ? <Film size={48} style={{ color: 'var(--text-muted)' }} /> : <FileImage size={48} style={{ color: 'var(--text-muted)' }} />}
                </div>
            }
          </div>

          {/* Meta panel */}
          <div className="p-4 sm:p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <h1 className="font-display text-xl font-700 break-all" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                {asset.fileName || 'Untitled'}
              </h1>
              <span className={`${cfg.cls} text-xs px-3 py-1 rounded-full flex items-center gap-1.5 flex-shrink-0`} style={{ fontWeight: 600 }}>
                <Icon size={13} />{cfg.label}
              </span>
            </div>

            {/* Score gauge */}
            {typeof score === 'number' && (
              <div className="p-4 rounded-xl" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Similarity Score</span>
                  <span className="font-mono text-2xl font-700" style={{ color: scoreColor, fontWeight: 700 }}>{score}%</span>
                </div>
                <div className="progress-bar" style={{ height: 10 }}>
                  <motion.div className="progress-fill" initial={{ width: 0 }} animate={{ width: `${score}%` }} transition={{ duration: 0.8, ease: 'easeOut' }}
                    style={{ background: `linear-gradient(90deg, #10b981, ${scoreColor})` }} />
                </div>
                <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                  {score >= 80 ? '⚠️ High similarity — likely unauthorized use' : score >= 50 ? '⚠️ Moderate similarity — review recommended' : '✅ Low similarity — asset appears original'}
                </p>
              </div>
            )}

            {asset.status === 'flagged' && (
              <div className="p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <p className="text-sm" style={{ color: '#ef4444', fontWeight: 600 }}>🚨 Potential Misuse Detected</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                  This asset closely matches content in our scraped sports media database.
                  Consider issuing a DMCA takedown notice.
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-2 pt-2">
              <button onClick={handleAnalyze} disabled={analyzing} className="btn-ghost text-sm py-2 px-3 w-full sm:w-auto justify-center">
                {analyzing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                {analyzing ? 'Analyzing…' : 'Re-analyze'}
              </button>
              {asset.fileUrl && (
                <a href={asset.fileUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost text-sm py-2 px-3 w-full sm:w-auto justify-center">
                  <ExternalLink size={14} /> Open File
                </a>
              )}
              <button onClick={handleDelete} disabled={deleting}
                className="btn-ghost text-sm py-2 px-3 w-full sm:w-auto justify-center"
                style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}>
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Details card */}
      <div className="card p-4 sm:p-6">
        <h2 className="font-display text-base font-700 mb-1" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
          Asset Details
        </h2>
        <DetailRow label="Asset ID"        value={asset.id}          mono copy />
        <DetailRow label="File Name"       value={asset.fileName} />
        <DetailRow label="File Type"       value={asset.fileType} />
        <DetailRow label="File Size"       value={asset.fileSize ? `${(asset.fileSize / 1024).toFixed(1)} KB` : null} />
        <DetailRow label="Fingerprint"     value={asset.fingerprint}  mono copy />
        <DetailRow label="Storage Path"    value={asset.storagePath}  mono />
        <DetailRow label="Uploaded"        value={ts} />
        <DetailRow label="Owner UID"       value={asset.userId}       mono />
      </div>

      {/* Fingerprint visualization */}
      {asset.fingerprint && (
        <div className="card p-4 sm:p-6">
          <h2 className="font-display text-base font-700 mb-3" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
            Perceptual Hash Fingerprint
          </h2>
          <div className="p-4 rounded-xl overflow-x-auto" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
            <p className="font-mono text-xs break-all" style={{ color: '#60a5fa', letterSpacing: '0.05em' }}>
              {asset.fingerprint}
            </p>
          </div>
          <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
            SHA-256 perceptual hash generated from pixel data. Used for similarity matching via Hamming distance.
          </p>
        </div>
      )}
    </div>
  )
}
