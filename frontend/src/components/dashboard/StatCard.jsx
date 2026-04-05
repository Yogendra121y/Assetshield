export default function StatCard({ label, value, icon: Icon, color, bg, loading }) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: bg }}>
          <Icon size={20} style={{ color }} />
        </div>
      </div>
      {loading
        ? <div className="skeleton h-8 w-16 mb-1" />
        : <p className="font-display text-3xl font-800" style={{ fontWeight: 800, color: 'var(--text-primary)' }}>
            {value}
          </p>
      }
      <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{label}</p>
    </div>
  )
}
