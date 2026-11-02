import { useEffect, useState } from 'react'
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../services/auth'
import { Logo, PageLoader } from './ui'

const NAV_ITEMS = [
  { to: '/admin/dashboard', label: 'لوحة المعلومات', icon: '📊' },
  { to: '/admin/people', label: 'إدارة المقبولين', icon: '👥' },
  { to: '/admin/import', label: 'رفع ملف Excel', icon: '📤' },
  { to: '/admin/export', label: 'تصدير البيانات', icon: '📥' },
]

/** حارس المسارات المحمية */
export function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()
  const location = useLocation()

  if (loading) return <PageLoader label="جارِ التحقق من الجلسة..." />
  if (!isAuthenticated) {
    return <Navigate to="/admin/login" state={{ from: location.pathname }} replace />
  }
  return children
}

export default function AdminLayout() {
  const { admin, logout } = useAuth()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  // إغلاق القائمة الجانبية عند تغيير الصفحة على الهاتف
  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  return (
    <div className="min-h-screen bg-slate-50">
      {/* الشريط العلوي */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 lg:hidden"
            aria-label="القائمة"
            aria-expanded={menuOpen}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
            </svg>
          </button>

          <Link to="/admin/dashboard" className="flex min-w-0 items-center gap-3">
            <Logo className="h-10 w-10 shrink-0" />
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold leading-5 text-slate-900">
                لوحة تحكم تأكيد الحضور
              </p>
              <p className="truncate text-xs text-slate-500">مؤتمر يوم الشباب العالمي - العراق</p>
            </div>
          </Link>

          <div className="mr-auto flex items-center gap-2">
            <Link
              to="/"
              target="_blank"
              rel="noreferrer"
              className="hidden rounded-lg px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-100 sm:inline-flex"
            >
              معاينة صفحة الحضور ↗
            </Link>
            <div className="hidden text-left sm:block">
              <p className="text-xs font-bold text-slate-700">{admin?.full_name || admin?.username}</p>
              <p className="text-[11px] text-slate-400">{admin?.username}</p>
            </div>
            <button type="button" onClick={logout} className="btn-secondary px-3 py-2 text-xs">
              خروج
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl">
        {/* القائمة الجانبية */}
        <aside
          className={`fixed inset-y-16 right-0 z-20 w-64 shrink-0 border-l border-slate-200 bg-white p-4 transition-transform duration-200 lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:translate-x-0 lg:bg-transparent lg:border-l lg:border-slate-200 ${
            menuOpen ? 'translate-x-0 shadow-lift' : 'translate-x-full'
          }`}
        >
          <nav className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition ${
                    isActive
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                <span aria-hidden="true">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-6 text-slate-500">
            <p className="mb-1 font-bold text-slate-700">تذكير</p>
            رابط تأكيد الحضور العام هو الصفحة الرئيسية للموقع. شاركه مع المقبولين فقط.
          </div>
        </aside>

        {menuOpen && (
          <div
            className="fixed inset-0 top-16 z-10 bg-slate-900/30 lg:hidden"
            onClick={() => setMenuOpen(false)}
            role="presentation"
          />
        )}

        <main className="min-w-0 flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
