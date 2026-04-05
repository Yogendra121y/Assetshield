import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Shield, Mail, Lock, User, ArrowRight, Loader2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

export default function RegisterPage() {
  const { register, loginWithGoogle } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [loading, setLoading] = useState(false)

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.password !== form.confirm) return toast.error('Passwords do not match')
    if (form.password.length < 6) return toast.error('Password must be at least 6 characters')
    setLoading(true)
    try {
      await register(form.email, form.password, form.name)
      toast.success('Account created! Welcome to AssetShield AI.')
      navigate('/dashboard')
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') toast.error('Email already in use')
      else toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen grid-bg flex items-center justify-center px-4 relative overflow-hidden"
      style={{ background: 'var(--bg-primary)' }}>
      <div className="absolute top-1/3 right-1/4 w-80 h-80 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)' }} />

      <motion.div
        initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }} className="w-full max-w-md relative z-10"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
            style={{ background: 'linear-gradient(135deg, #3d6aff, #8b5cf6)', boxShadow: '0 0 40px rgba(61,106,255,0.3)' }}>
            <Shield size={26} color="white" />
          </div>
          <h1 className="font-display text-2xl sm:text-3xl" style={{ fontWeight: 800, color: 'var(--text-primary)' }}>AssetShield AI</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Protect your sports media assets</p>
        </div>

        <div className="card p-5 sm:p-8" style={{ borderRadius: 20 }}>
          <h2 className="font-display text-xl mb-6" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
            Create your account
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {[
              { key: 'name',     label: 'Full name',        type: 'text',     icon: User,  placeholder: 'John Doe' },
              { key: 'email',    label: 'Email address',    type: 'email',    icon: Mail,  placeholder: 'you@example.com' },
              { key: 'password', label: 'Password',         type: 'password', icon: Lock,  placeholder: '••••••••' },
              { key: 'confirm',  label: 'Confirm password', type: 'password', icon: Lock,  placeholder: '••••••••' },
            ].map(({ key, label, type, icon: Icon, placeholder }) => (
              <div key={key}>
                <label className="block text-sm mb-1.5" style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                  {label}
                </label>
                <div className="relative">
                  <Icon size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                  <input type={type} required value={form[key]} onChange={set(key)} placeholder={placeholder} className="input-field pl-9" />
                </div>
              </div>
            ))}

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3 text-base mt-2">
              {loading
                ? <><Loader2 size={18} className="animate-spin" /> Creating account…</>
                : <><span>Create account</span><ArrowRight size={18} /></>
              }
            </button>
          </form>

          <p className="text-center text-sm mt-5" style={{ color: 'var(--text-muted)' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'var(--accent)', fontWeight: 600 }} className="hover:underline">Sign in</Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}
