import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCircle, AlertTriangle, Clock, Eye, FileImage, Film } from 'lucide-react'

const STATUS_CONFIG = {
  safe:       { label: 'Safe',       icon: CheckCircle,   cls: 'badge-safe',       dot: '#10b981' },
  flagged:    { label: 'Flagged',    icon: AlertTriangle, cls: 'badge-flagged',    dot: '#ef4444' },
  processing: { label: 'Processing', icon: Clock,         cls: 'badge-processing', dot: '#f59e0b' },
}

function ScoreBar({ score }) {
  const color = score >= 80 ? '#ef4444' : score >= 50 ? '#f59e0b' : '#10b981'
  return (
    <div>
      <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
        <span>Similarity Score</span>
        <span style={{ color, fontWeight: 600, fontFamily: 'JetBrains Mono, monospace' }}>{score}%</span>
      </div>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${score}%`, background: color }} />
      </div>
    </div>
  )
}

export default function AssetCard({ asset }) {
  const cfg  = STATUS_CONFIG[asset.status] || STATUS_CONFIG.processing
  const Icon = cfg.icon
  const isVideo = asset.fileType?.startsWith('video')
  const ts = asset.createdAt?.toDate
    ? asset.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Unknown date'

  return (
    <Link to={`/assets/${asset.id}`}>
      <motion.div
        whileHover={{ y: -3, transition: { duration: 0.15 } }}
        className="card overflow-hidden cursor-pointer group"
      >
        {/* Thumbnail */}
        <div className="relative overflow-hidden" style={{ height: 140, background: 'var(--bg-secondary)' }}>
          {asset.fileUrl
            ? isVideo
              ? <video src={asset.fileUrl} className="w-full h-full object-cover opacity-80" muted />
              : <img src={asset.fileUrl} alt={asset.fileName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
            : <div className="w-full h-full flex items-center justify-center">
                {isVideo ? <Film size={32} style={{ color: 'var(--text-muted)' }} /> : <FileImage size={32} style={{ color: 'var(--text-muted)' }} />}
              </div>
          }
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ background: 'rgba(0,0,0,0.5)' }}>
            <div className="flex items-center gap-2 text-white text-sm" style={{ fontWeight: 600 }}>
              <Eye size={16} /> View Details
            </div>
          </div>
          {asset.status === 'processing' && (
            <div className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full animate-pulse"
              style={{ background: cfg.dot, boxShadow: `0 0 8px ${cfg.dot}` }} />
          )}
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm truncate" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
              {asset.fileName || 'Untitled asset'}
            </p>
            <span className={`${cfg.cls} text-xs px-2 py-0.5 rounded-full flex items-center gap-1 flex-shrink-0`} style={{ fontWeight: 500 }}>
              <Icon size={11} />{cfg.label}
            </span>
          </div>
          {typeof asset.similarityScore === 'number' && <ScoreBar score={asset.similarityScore} />}
          <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
            <span>{ts}</span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{asset.fingerprint?.slice(0, 10) || '—'}…</span>
          </div>
        </div>
      </motion.div>
    </Link>
  )
}
