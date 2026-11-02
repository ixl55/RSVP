import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../services/auth'
import { Alert, Logo, Spinner } from '../components/ui'

export default function AdminLogin() {
  const { login, isAuthenticated, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()

  const [form, setForm] = useState({ username: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (searchParams.get('expired')) {
      setNotice('انتهت صلاحية الجلسة. يرجى تسجيل الدخول مجدداً.')
    }
  }, [searchParams])

  if (!authLoading && isAuthenticated) {
    return <Navigate to={location.state?.from || '/admin/dashboard'} replace />
  }

  async function handleSubmit(submitEvent) {
    submitEvent.preventDefault()
    setError('')
    setNotice('')

    if (!form.username.trim() || !form.password) {
      setError('يرجى إدخال اسم المستخدم وكلمة المرور.')
      return
    }

    setLoading(true)
    try {
      await login(form.username.trim(), form.password)
      navigate(location.state?.from || '/admin/dashboard', { replace: true })
    } catch (err) {
      setError(err.friendlyMessage || 'تعذّر تسجيل الدخول.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-100 via-slate-50 to-white px-4 py-10">
      <div className="w-full max-w-md animate-fade-up">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo className="h-20 w-20" />
          <h1 className="mt-4 text-xl font-extrabold text-slate-900">لوحة تحكم المنظمين</h1>
          <p className="mt-1 text-sm text-slate-500">نظام تأكيد الحضور</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6" noValidate>
          {notice && (
            <Alert type="warning" className="mb-4" onClose={() => setNotice('')}>
              {notice}
            </Alert>
          )}
          {error && (
            <Alert type="error" className="mb-4" onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          <div className="mb-4">
            <label htmlFor="username" className="field-label">
              اسم المستخدم
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              className="field"
              placeholder="اسم المستخدم"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              disabled={loading}
            />
          </div>

          <div className="mb-5">
            <label htmlFor="password" className="field-label">
              كلمة المرور
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                className="field pl-12"
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 left-0 px-3 text-slate-400 transition hover:text-slate-600"
                aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <button type="submit" className="btn-primary w-full py-3" disabled={loading}>
            {loading ? (
              <>
                <Spinner />
                جارِ تسجيل الدخول...
              </>
            ) : (
              'تسجيل الدخول'
            )}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-slate-400">
          <Link to="/" className="font-semibold transition hover:text-brand-700">
            ← العودة إلى صفحة تأكيد الحضور
          </Link>
        </p>
      </div>
    </div>
  )
}
