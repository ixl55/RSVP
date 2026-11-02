import { useEffect, useState } from 'react'
import api, { downloadFile } from '../services/api'
import { formatNumber } from '../services/format'
import { Alert, Spinner, useToast } from '../components/ui'

const OPTIONS = [
  {
    scope: 'all',
    icon: '📋',
    title: 'تصدير جميع الأشخاص',
    description: 'كل من في قائمة المقبولين مع حالة الحضور ووقت التأكيد وملاحظات الأدمن.',
    countKey: 'total_people',
    tone: 'slate',
  },
  {
    scope: 'confirmed',
    icon: '✅',
    title: 'تصدير المؤكدين فقط',
    description: 'الأشخاص الذين أكدوا حضورهم فعلياً مع تاريخ ووقت التأكيد.',
    countKey: 'confirmed_people',
    tone: 'brand',
  },
  {
    scope: 'not_confirmed',
    icon: '⏳',
    title: 'تصدير غير المؤكدين',
    description: 'الأشخاص الذين لم يؤكدوا حضورهم بعد — مفيد لمتابعة التواصل معهم.',
    countKey: 'not_confirmed_people',
    tone: 'amber',
  },
]

const TONES = {
  slate: 'border-slate-200 bg-slate-50 text-slate-700',
  brand: 'border-brand-200 bg-brand-50 text-brand-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
}

export default function ExportExcel() {
  const toast = useToast()
  const [stats, setStats] = useState(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .get('/admin/statistics')
      .then(({ data }) => setStats(data))
      .catch((err) => setError(err.friendlyMessage || 'تعذّر تحميل الإحصائيات.'))
  }, [])

  async function handleExport(scope) {
    setBusy(scope)
    setError('')
    try {
      await downloadFile('/admin/export-excel', { scope }, `attendance_${scope}.xlsx`)
      toast.success('تم إنشاء الملف وتنزيله بنجاح.')
    } catch (err) {
      setError(err.friendlyMessage || 'تعذّر تصدير الملف.')
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-xl font-extrabold text-slate-900 sm:text-2xl">تصدير البيانات إلى Excel</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          اختر نطاق البيانات المطلوب تصديره — يُنشأ الملف منسّقاً وجاهزاً للطباعة أو المشاركة.
        </p>
      </div>

      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

      <div className="grid gap-4 md:grid-cols-3">
        {OPTIONS.map((option) => (
          <section key={option.scope} className="card flex flex-col p-5">
            <span className={`flex h-12 w-12 items-center justify-center rounded-xl border text-xl ${TONES[option.tone]}`}>
              {option.icon}
            </span>

            <h2 className="mt-3 text-sm font-bold text-slate-900">{option.title}</h2>
            <p className="mt-1 flex-1 text-xs leading-6 text-slate-500">{option.description}</p>

            <p className="num mt-3 text-2xl font-extrabold text-slate-900">
              {stats ? formatNumber(stats[option.countKey]) : '—'}
              <span className="mr-1 text-xs font-semibold text-slate-400">سجل</span>
            </p>

            <button
              type="button"
              onClick={() => handleExport(option.scope)}
              className="btn-primary mt-4 w-full text-sm"
              disabled={Boolean(busy)}
            >
              {busy === option.scope ? <Spinner className="h-4 w-4" /> : '📥'}
              تصدير
            </button>
          </section>
        ))}
      </div>

      <section className="card p-5">
        <h2 className="text-sm font-bold text-slate-800">محتويات ملف التصدير</h2>
        <p className="mt-1 text-xs text-slate-500">يحتوي كل ملف على ورقتين: بيانات الأشخاص وورقة ملخص.</p>

        <div className="mt-4 overflow-x-auto scroll-thin">
          <table className="w-full min-w-[560px] text-right text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                {['#', 'الاسم', 'رقم الهاتف', 'حالة الحضور', 'تاريخ التأكيد', 'وقت التأكيد', 'ملاحظة الأدمن'].map(
                  (header) => (
                    <th key={header} className="whitespace-nowrap px-3 py-2 font-bold">
                      {header}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              <tr>
                <td className="num px-3 py-2">1</td>
                <td className="px-3 py-2">أحمد محمد علي</td>
                <td className="num px-3 py-2">07701234567</td>
                <td className="px-3 py-2">تم التأكيد</td>
                <td className="num px-3 py-2">2026-08-19</td>
                <td className="num px-3 py-2">10:24</td>
                <td className="px-3 py-2">تم التواصل معه</td>
              </tr>
              <tr>
                <td className="num px-3 py-2">2</td>
                <td className="px-3 py-2">علي حسن كريم</td>
                <td className="num px-3 py-2">07801234567</td>
                <td className="px-3 py-2">لم يؤكد</td>
                <td className="px-3 py-2">—</td>
                <td className="px-3 py-2">—</td>
                <td className="px-3 py-2">—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
