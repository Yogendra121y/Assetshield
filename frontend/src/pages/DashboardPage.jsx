import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import {
  Shield, AlertTriangle, CheckCircle, Clock, Upload,
  TrendingUp, Eye, FileImage, AlertCircle, RefreshCw,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useAssets } from '../hooks/useAssets'
import AssetCard from '../components/dashboard/AssetCard'
import StatCard from '../components/dashboard/StatCard'
import AlertBanner from '../components/dashboard/AlertBanner'
import { exportPDF } from '../services/exportPDF'

const ANIM = { container: { hidden: {}, show: { transition: { staggerChildren: 0.07 } } }, item: { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } } }

// Generate sparkline data from assets
function buildTrendData(assets) {
  const map = {}
  assets.forEach(a => {
    if (!a.createdAt) return
    const d = a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt)
    const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    if (!map[key]) map[key] = { date: key, total: 0, flagged: 0 }
    map[key].total++
    if (a.status === 'flagged') map[key].flagged++
  })
  return Object.values(map).slice(-7)
}

export default function DashboardPage() {
  const { user }                = useAuth()
  const { assets, loading, stats } = useAssets()
  const [filter, setFilter]     = useState('all')

  const flaggedAssets = assets.filter(a => a.status === 'flagged')
  const trendData     = buildTrendData(assets)

  const filtered = filter === 'all'
    ? assets
    : assets.filter(a => a.status === filter)

  const name = user?.displayName?.split(' ')[0] || 'there'

  const pieData = [
    { name: 'Safe',       value: stats.safe,       color: '#10b981' },
    { name: 'Flagged',    value: stats.flagged,     color: '#ef4444' },
    { name: 'Processing', value: stats.processing,  color: '#f59e0b' },
  ].filter(d => d.value > 0)

  return (
    <div className="px-4 sm:px-6 py-6 sm:py-8 max-w-7xl mx-auto space-y-6 sm:space-y-8">

      {/* Alert banner for flagged assets */}
      {flaggedAssets.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <AlertBanner count={flaggedAssets.length} assets={flaggedAssets} />
        </motion.div>
      )}

      {/* Header */}
      <motion.div variants={ANIM.container} initial="hidden" animate="show"
        className="flex items-center justify-between flex-wrap gap-4">
        <motion.div variants={ANIM.item}>
          <h1 className="font-display text-2xl md:text-3xl mb-1" style={{ fontWeight: 800, color: 'var(--text-primary)' }}>
            Hey, {name} 👋
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>
            Here's your asset protection overview
          </p>
        </motion.div>
        <motion.div variants={ANIM.item} className="flex flex-wrap w-full sm:w-auto gap-2 sm:gap-3">
          <button onClick={() => exportPDF(assets)} className="btn-ghost text-sm py-2 px-4 w-full sm:w-auto justify-center">
            <TrendingUp size={15} /> Export Report
          </button>
          <Link to="/upload" className="btn-primary text-sm py-2 px-4 w-full sm:w-auto justify-center">
            <Upload size={15} /> Upload Asset
          </Link>
        </motion.div>
      </motion.div>

      {/* Stat cards */}
      <motion.div variants={ANIM.container} initial="hidden" animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Assets',  value: stats.total,      icon: FileImage,    color: '#3d6aff', bg: 'rgba(61,106,255,0.1)' },
          { label: 'Safe',          value: stats.safe,       icon: CheckCircle,  color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
          { label: 'Flagged',       value: stats.flagged,    icon: AlertTriangle, color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
          { label: 'Processing',    value: stats.processing, icon: Clock,        color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
        ].map((s, i) => (
          <motion.div key={s.label} variants={ANIM.item}>
            <StatCard {...s} loading={loading} />
          </motion.div>
        ))}
      </motion.div>

      {/* Charts row */}
      <motion.div variants={ANIM.container} initial="hidden" animate="show"
        className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Trend area chart */}
        <motion.div variants={ANIM.item} className="card p-4 sm:p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display font-700 text-base" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Upload Trend</h3>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Last 7 days</p>
            </div>
          </div>
          {trendData.length === 0
            ? <EmptyChart />
            : <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3d6aff" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#3d6aff" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gFlagged" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }} />
                  <Area type="monotone" dataKey="total"   stroke="#3d6aff" fill="url(#gTotal)"   strokeWidth={2} dot={false} name="Total" />
                  <Area type="monotone" dataKey="flagged" stroke="#ef4444" fill="url(#gFlagged)" strokeWidth={2} dot={false} name="Flagged" />
                </AreaChart>
              </ResponsiveContainer>
          }
        </motion.div>

        {/* Pie chart */}
        <motion.div variants={ANIM.item} className="card p-4 sm:p-5">
          <h3 className="font-display font-700 text-base mb-1" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Status Breakdown</h3>
          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>All time</p>
          {pieData.length === 0
            ? <EmptyChart />
            : <>
                <ResponsiveContainer width="100%" height={150}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                      {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 mt-2">
                  {pieData.map(d => (
                    <div key={d.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                        <span style={{ color: 'var(--text-secondary)' }}>{d.name}</span>
                      </div>
                      <span className="font-mono font-500" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{d.value}</span>
                    </div>
                  ))}
                </div>
              </>
          }
        </motion.div>
      </motion.div>

      {/* Asset list */}
      <motion.div variants={ANIM.container} initial="hidden" animate="show">
        <motion.div variants={ANIM.item} className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="font-display font-700 text-lg" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
            Your Assets
          </h2>
          {/* Filter tabs */}
          <div className="flex gap-2 flex-wrap">
            {['all', 'safe', 'flagged', 'processing'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className="text-xs px-3 py-1.5 rounded-full capitalize transition-all"
                style={{
                  background: filter === f ? 'var(--accent)' : 'var(--bg-card)',
                  color:      filter === f ? 'white' : 'var(--text-secondary)',
                  border:     `1px solid ${filter === f ? 'transparent' : 'var(--border)'}`,
                  fontWeight: filter === f ? 600 : 400,
                }}>
                {f}
                {f !== 'all' && <span className="ml-1.5 opacity-70">
                  {f === 'safe' ? stats.safe : f === 'flagged' ? stats.flagged : stats.processing}
                </span>}
              </button>
            ))}
          </div>
        </motion.div>

        {loading
          ? <SkeletonList />
          : filtered.length === 0
            ? <EmptyAssets filter={filter} />
            : <motion.div variants={ANIM.container} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filtered.map(asset => (
                  <motion.div key={asset.id} variants={ANIM.item}>
                    <AssetCard asset={asset} />
                  </motion.div>
                ))}
              </motion.div>
        }
      </motion.div>
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function EmptyChart() {
  return (
    <div className="flex items-center justify-center h-40 flex-col gap-2" style={{ color: 'var(--text-muted)' }}>
      <TrendingUp size={28} opacity={0.3} />
      <p className="text-sm">No data yet</p>
    </div>
  )
}

function EmptyAssets({ filter }) {
  return (
    <div className="card flex flex-col items-center justify-center py-16 text-center">
      <FileImage size={40} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
      <p className="mt-3 font-600 text-base" style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
        {filter === 'all' ? 'No assets yet' : `No ${filter} assets`}
      </p>
      <p className="text-sm mt-1 mb-5" style={{ color: 'var(--text-muted)' }}>
        {filter === 'all' ? 'Upload your first media asset to get started.' : `All your ${filter} assets will appear here.`}
      </p>
      {filter === 'all' && <Link to="/upload" className="btn-primary text-sm"><Upload size={15} /> Upload Now</Link>}
    </div>
  )
}

function SkeletonList() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {[1,2,3,4,5,6].map(i => (
        <div key={i} className="card p-5 space-y-3">
          <div className="skeleton h-36 w-full" />
          <div className="skeleton h-4 w-3/4" />
          <div className="skeleton h-3 w-1/2" />
        </div>
      ))}
    </div>
  )
}
