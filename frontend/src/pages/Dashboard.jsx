import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import { formatDateTime, formatNumber } from '../services/format'
import { Alert, EmptyState, Spinner } from '../components/ui'

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [recent, setRecent] = useState([])
  const [hourly, setHourly] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    setError('')
    try {
      const [statsRes, recentRes, hourlyRes] = await Promise.all([
        api.get('/admin/statistics'),
        api.get('/admin/recent-confirmations', { params: { limit: 8 } }),
        api.get('/admin/hourly-confirmations'),
      ])
      setStats(statsRes.data)
      setRecent(recentRes.data)
      setHourly(hourlyRes.data.buckets || [])
    } catch (err) {
      setError(err.friendlyMessage || 'تعذّر تحميل الإحصائيات.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
    // تحديث تلقائي كل 30 ثانية لمتابعة الحضور لحظياً
    const timer = setInterval(() => load(true), 30000)
    return () => clearInterval(timer)
  }, [load])

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card h-32 animate-pulse bg-slate-100" />
        ))}
      </div>
    )
  }

  const percentage = stats?.confirmation_percentage ?? 0

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 sm:text-2xl">لوحة المعلومات</h1>
          <p className="mt-0.5 text-sm text-slate-500">نظرة عامة على حالة تأكيد الحضور</p>
        </div>
        <button
          type="button"
          onClick={() => load(true)}
          className="btn-secondary px-4 py-2 text-xs"
          disabled={refreshing}
        >
          {refreshing ? <Spinner className="h-4 w-4" /> : '🔄'}
          تحديث
        </button>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      {/* البطاقات الإحصائية */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="إجمالي المقبولين"
          value={formatNumber(stats?.total_people)}
          icon="👥"
          tone="slate"
        />
        <StatCard
          label="تم تأكيد الحضور"
          value={formatNumber(stats?.confirmed_people)}
          icon="✅"
          tone="brand"
        />
        <StatCard
          label="لم يؤكدوا بعد"
          value={formatNumber(stats?.not_confirmed_people)}
          icon="⏳"
          tone="amber"
        />
        <StatCard label="نسبة التأكيد" value={`${percentage}%`} icon="📈" tone="sky" />
      </div>

      {/* شريط التقدم */}
      <section className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800">نسبة إنجاز تأكيد الحضور</h2>
          <span className="num text-sm font-extrabold text-brand-700">{percentage}%</span>
        </div>

        <div
          className="h-4 w-full overflow-hidden rounded-full bg-slate-100"
          role="progressbar"
          aria-valuenow={percentage}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-gradient-to-l from-brand-400 to-brand-600 transition-all duration-700"
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
          <MiniStat label="تأكيدات آخر ٢٤ ساعة" value={formatNumber(stats?.confirmations_today)} />
          <MiniStat
            label="آخر تأكيد"
            value={stats?.last_confirmation_at ? formatDateTime(stats.last_confirmation_at) : '—'}
            small
          />
          <MiniStat label="المتبقون" value={formatNumber(stats?.not_confirmed_people)} />
          <MiniStat label="الإجمالي" value={formatNumber(stats?.total_people)} />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* آخر التأكيدات */}
        <section className="card lg:col-span-3">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h2 className="text-sm font-bold text-slate-800">آخر التأكيدات</h2>
            <Link to="/admin/people?status=confirmed" className="text-xs font-bold text-brand-700 hover:underline">
              عرض الكل ←
            </Link>
          </div>

          {recent.length === 0 ? (
            <EmptyState
              icon="🕓"
              title="لا توجد تأكيدات بعد"
              description="ستظهر هنا أسماء الأشخاص فور تأكيدهم للحضور."
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {recent.map((person) => (
                <li key={person.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-extrabold text-brand-700">
                    {person.name.trim().charAt(0)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-800">{person.name}</p>
                    <p className="num text-xs text-slate-400">{person.phone}</p>
                  </div>
                  <span className="num shrink-0 text-xs text-slate-500">
                    {formatDateTime(person.confirmed_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* توزيع التأكيدات على الساعات */}
        <section className="card lg:col-span-2">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-sm font-bold text-slate-800">التأكيدات خلال آخر ٢٤ ساعة</h2>
          </div>

          {hourly.length === 0 ? (
            <EmptyState icon="📊" title="لا توجد بيانات" description="لم تُسجَّل أي تأكيدات خلال آخر ٢٤ ساعة." />
          ) : (
            <div className="flex h-56 items-end justify-around gap-1 px-4 py-5">
              {hourly.map((bucket) => {
                const max = Math.max(...hourly.map((b) => b.count), 1)
                const height = Math.max((bucket.count / max) * 100, 6)
                return (
                  <div key={bucket.hour} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                    <span className="num text-[10px] font-bold text-slate-500">{bucket.count}</span>
                    <div
                      className="w-full max-w-[26px] rounded-t-md bg-gradient-to-t from-brand-500 to-brand-400 transition-all"
                      style={{ height: `${height}%` }}
                      title={`${bucket.hour} — ${bucket.count}`}
                    />
                    <span className="num text-[9px] text-slate-400">{bucket.hour}</span>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>

      {/* إجراءات سريعة */}
      <section className="grid gap-3 sm:grid-cols-3">
        <QuickAction to="/admin/people" icon="👥" title="إدارة المقبولين" text="بحث، فلترة، وإضافة ملاحظات" />
        <QuickAction to="/admin/import" icon="📤" title="رفع ملف Excel" text="استيراد أو تحديث قائمة المقبولين" />
        <QuickAction to="/admin/export" icon="📥" title="تصدير البيانات" text="تنزيل تقارير Excel جاهزة" />
      </section>
    </div>
  )
}

const TONES = {
  slate: 'bg-slate-100 text-slate-700',
  brand: 'bg-brand-100 text-brand-700',
  amber: 'bg-amber-100 text-amber-700',
  sky: 'bg-sky-100 text-sky-700',
}

function StatCard({ label, value, icon, tone }) {
  return (
    <div className="card flex items-center gap-4 p-5 transition hover:shadow-lift">
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl ${TONES[tone]}`}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-500">{label}</p>
        <p className="num mt-0.5 text-2xl font-extrabold text-slate-900">{value}</p>
      </div>
    </div>
  )
}

function MiniStat({ label, value, small = false }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2.5">
      <p className="text-[11px] font-semibold text-slate-500">{label}</p>
      <p className={`num mt-0.5 font-extrabold text-slate-800 ${small ? 'text-xs' : 'text-lg'}`}>{value}</p>
    </div>
  )
}

function QuickAction({ to, icon, title, text }) {
  return (
    <Link to={to} className="card flex items-center gap-3 p-4 transition hover:shadow-lift hover:border-brand-200">
      <span className="text-2xl" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-bold text-slate-800">{title}</p>
        <p className="truncate text-xs text-slate-500">{text}</p>
      </div>
      <span className="mr-auto text-slate-300">←</span>
    </Link>
  )
}
