import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

/* ============================ الشعار ============================ */

/**
 * شعار المؤتمر.
 * يُحمَّل من frontend/public — نسخة WebP خفيفة أولاً ثم PNG،
 * وفي حال تعذّر تحميلهما تُعرض النسخة المتجهة logo.svg.
 * لتغيير الشعار: استبدل الملفات في مجلد frontend/public بنفس الأسماء.
 */
export function Logo({ className = 'h-24 w-24' }) {
  const [failed, setFailed] = useState(false)
  const classes = `${className} select-none object-contain drop-shadow-sm`

  if (failed) {
    return <img src="/logo.svg" alt="شعار المؤتمر" className={classes} draggable="false" />
  }

  return (
    <picture>
      <source srcSet="/logo@2x.webp" type="image/webp" />
      <img
        src="/logo.png"
        onError={() => setFailed(true)}
        alt="شعار مؤتمر يوم الشباب العالمي - العراق"
        className={classes}
        draggable="false"
        width="256"
        height="256"
      />
    </picture>
  )
}

/* ============================ مؤشر التحميل ============================ */

export function Spinner({ className = 'h-5 w-5' }) {
  return (
    <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  )
}

export function PageLoader({ label = 'جارِ التحميل...' }) {
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 text-slate-500">
      <Spinner className="h-8 w-8 text-brand-600" />
      <p className="text-sm font-semibold">{label}</p>
    </div>
  )
}

/* ============================ الهياكل العظمية ============================ */

export function SkeletonRows({ rows = 5, cols = 5 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="border-b border-slate-100">
          {Array.from({ length: cols }).map((__, c) => (
            <td key={c} className="px-4 py-4">
              <div className="h-3.5 w-full max-w-[160px] animate-pulse rounded bg-slate-200" />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

/* ============================ التنبيهات ============================ */

const ALERT_STYLES = {
  success: 'border-brand-200 bg-brand-50 text-brand-900',
  error: 'border-accent-200 bg-accent-50 text-accent-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  info: 'border-sky-200 bg-sky-50 text-sky-900',
}

const ALERT_ICONS = {
  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️',
}

export function Alert({ type = 'info', title, children, onClose, className = '' }) {
  return (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      className={`animate-fade-up rounded-xl border p-4 ${ALERT_STYLES[type]} ${className}`}
    >
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="text-lg leading-6">
          {ALERT_ICONS[type]}
        </span>
        <div className="min-w-0 flex-1">
          {title && <p className="font-bold leading-6">{title}</p>}
          {children && <div className="mt-1 text-sm leading-6 opacity-90">{children}</div>}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="rounded-lg px-2 text-lg leading-6 opacity-50 transition hover:opacity-100"
          >
            ×
          </button>
        )}
      </div>
    </div>
  )
}

/* ============================ الإشعارات المنبثقة ============================ */

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const remove = useCallback((id) => {
    setToasts((current) => current.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (message, type = 'success', duration = 3500) => {
      const id = Date.now() + Math.random()
      setToasts((current) => [...current, { id, message, type }])
      setTimeout(() => remove(id), duration)
    },
    [remove],
  )

  const value = useMemo(
    () => ({
      success: (m) => push(m, 'success'),
      error: (m) => push(m, 'error', 5000),
      info: (m) => push(m, 'info'),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:left-4 sm:items-start">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold shadow-lift animate-pop-in ${ALERT_STYLES[toast.type]}`}
          >
            <span aria-hidden="true">{ALERT_ICONS[toast.type]}</span>
            <span className="flex-1">{toast.message}</span>
            <button
              type="button"
              onClick={() => remove(toast.id)}
              aria-label="إغلاق"
              className="opacity-50 transition hover:opacity-100"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast يجب أن يُستخدم داخل ToastProvider')
  return context
}

/* ============================ نافذة منبثقة ============================ */

export function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  useEffect(() => {
    if (!open) return undefined
    const handler = (event) => {
      if (event.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  const widths = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-3xl' }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div
        className="absolute inset-0"
        onClick={onClose}
        role="presentation"
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative z-10 w-full ${widths[size]} animate-pop-in rounded-t-2xl bg-white shadow-lift sm:rounded-2xl`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h3 className="text-base font-bold text-slate-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="rounded-lg p-1 text-xl leading-none text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            ×
          </button>
        </div>
        <div className="max-h-[65vh] overflow-y-auto px-5 py-4 scroll-thin">{children}</div>
        {footer && (
          <div className="flex flex-col-reverse gap-2 border-t border-slate-200 px-5 py-4 sm:flex-row sm:justify-start">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

/* ============================ حالة فارغة ============================ */

export function EmptyState({ icon = '📋', title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <span className="text-4xl" aria-hidden="true">
        {icon}
      </span>
      <p className="text-base font-bold text-slate-700">{title}</p>
      {description && <p className="max-w-md text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

/* ============================ التنقل بين الصفحات ============================ */

export function Pagination({ page, totalPages, total, pageSize, onChange }) {
  if (!total) return null

  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)

  const pages = []
  const window_ = 1
  for (let i = 1; i <= totalPages; i += 1) {
    if (i === 1 || i === totalPages || (i >= page - window_ && i <= page + window_)) {
      pages.push(i)
    } else if (pages[pages.length - 1] !== '…') {
      pages.push('…')
    }
  }

  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row">
      <p className="text-xs text-slate-500 sm:text-sm">
        عرض <span className="num font-bold text-slate-700">{start}</span> إلى{' '}
        <span className="num font-bold text-slate-700">{end}</span> من أصل{' '}
        <span className="num font-bold text-slate-700">{total}</span>
      </p>

      <div className="flex items-center gap-1">
        <button
          type="button"
          className="btn-ghost px-3 py-1.5 text-xs"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          السابق
        </button>

        {pages.map((p, index) =>
          p === '…' ? (
            <span key={`gap-${index}`} className="px-1.5 text-slate-400">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              aria-current={p === page ? 'page' : undefined}
              className={`num min-w-[34px] rounded-lg px-2 py-1.5 text-xs font-bold transition ${
                p === page
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {p}
            </button>
          ),
        )}

        <button
          type="button"
          className="btn-ghost px-3 py-1.5 text-xs"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
        >
          التالي
        </button>
      </div>
    </div>
  )
}
