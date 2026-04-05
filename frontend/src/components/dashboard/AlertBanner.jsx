import { motion } from 'framer-motion'
import { AlertTriangle, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

export default function AlertBanner({ count, assets }) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="rounded-2xl p-4 flex flex-col sm:flex-row items-start gap-3"
      style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
    >
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: 'rgba(239,68,68,0.15)' }}>
        <AlertTriangle size={16} style={{ color: '#ef4444' }} />
      </div>
      <div className="flex-1">
        <p className="text-sm" style={{ color: '#ef4444', fontWeight: 700 }}>
          {count} potential copyright violation{count > 1 ? 's' : ''} detected
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
          Assets with similarity scores above 80% have been flagged for review.{' '}
          {assets.slice(0, 2).map((a, i) => (
            <span key={a.id}>
              <Link to={`/assets/${a.id}`} className="underline" style={{ color: '#ef4444' }}>
                {a.fileName?.slice(0, 20) || 'Asset'}
              </Link>
              {i < Math.min(assets.length, 2) - 1 && ', '}
            </span>
          ))}
          {assets.length > 2 && ` and ${assets.length - 2} more`}
        </p>
      </div>
      <button onClick={() => setDismissed(true)} className="flex-shrink-0 p-1 rounded-lg transition-colors self-end sm:self-auto"
        style={{ color: 'var(--text-muted)' }}>
        <X size={16} />
      </button>
    </motion.div>
  )
}
