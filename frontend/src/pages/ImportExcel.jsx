import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import api, { downloadFile } from '../services/api'
import { formatNumber } from '../services/format'
import { Alert, Spinner, useToast } from '../components/ui'

const ACCEPTED = '.xlsx,.xlsm,.csv'

export default function ImportExcel() {
  const toast = useToast()
  const inputRef = useRef(null)

  const [file, setFile] = useState(null)
  const [mode, setMode] = useState('append')
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  function pickFile(selected) {
    if (!selected) return
    const name = selected.name.toLowerCase()
    if (!name.endsWith('.xlsx') && !name.endsWith('.xlsm') && !name.endsWith('.csv')) {
      setError('صيغة الملف غير مدعومة. الصيغ المقبولة: xlsx أو xlsm أو csv.')
      return
    }
    if (selected.size > 10 * 1024 * 1024) {
      setError('حجم الملف كبير جداً. الحد الأقصى 10 ميغابايت.')
      return
    }
    setError('')
    setPreview(null)
    setResult(null)
    setFile(selected)
  }

  function handleDrop(event) {
    event.preventDefault()
    setDragging(false)
    pickFile(event.dataTransfer.files?.[0])
  }

  async function send(dryRun) {
    if (!file) {
      setError('يرجى اختيار ملف أولاً.')
      return
    }
    if (!dryRun && mode === 'replace') {
      const confirmed = window.confirm(
        'تحذير: سيتم حذف جميع السجلات الحالية (بما فيها تأكيدات الحضور المسجلة) واستبدالها ببيانات الملف الجديد.\n\nهل أنت متأكد من المتابعة؟',
      )
      if (!confirmed) return
    }

    setLoading(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('mode', mode)
      formData.append('dry_run', dryRun ? 'true' : 'false')

      const { data } = await api.post('/admin/import-excel', formData)

      if (dryRun) {
        setPreview(data)
        setResult(null)
      } else {
        setResult(data)
        setPreview(null)
        toast.success('تم استيراد الملف بنجاح.')
      }
    } catch (err) {
      setError(err.friendlyMessage || 'تعذّر معالجة الملف.')
    } finally {
      setLoading(false)
    }
  }

  function reset() {
    setFile(null)
    setPreview(null)
    setResult(null)
    setError('')
    if (inputRef.current) inputRef.current.value = ''
  }

  async function getTemplate() {
    try {
      await downloadFile('/admin/excel-template', undefined, 'attendance_template.xlsx')
    } catch (err) {
      toast.error(err.friendlyMessage || 'تعذّر تنزيل القالب.')
    }
  }

  const report = result || preview

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-xl font-extrabold text-slate-900 sm:text-2xl">رفع ملف Excel</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          استورد قائمة المقبولين المسموح لهم بتأكيد الحضور.
        </p>
      </div>

      {/* التعليمات */}
      <section className="card border-sky-200 bg-sky-50/60 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="text-sm leading-6 text-sky-900">
            <p className="font-bold">متطلبات الملف</p>
            <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs">
              <li>يجب أن يحتوي الصف الأول على عمودين: <b>الاسم</b> و <b>رقم الهاتف</b>.</li>
              <li>رقم الهاتف بصيغة 07XXXXXXXXX (يقبل النظام أيضاً +964 و 00964 والأرقام العربية).</li>
              <li>رقم الهاتف هو المعرّف الفريد — لا يمكن تكراره لشخصين.</li>
              <li>الصفوف الفارغة تُتجاهل تلقائياً، والصفوف غير الصالحة تُعرض في تقرير الاستيراد.</li>
            </ul>
          </div>
          <button type="button" onClick={getTemplate} className="btn-secondary shrink-0 px-3 py-2 text-xs">
            ⬇️ تنزيل قالب جاهز
          </button>
        </div>
      </section>

      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

      {/* منطقة الرفع */}
      <section className="card p-5">
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${
            dragging
              ? 'border-brand-500 bg-brand-50'
              : file
                ? 'border-brand-300 bg-brand-50/50'
                : 'border-slate-300 bg-slate-50 hover:border-brand-400 hover:bg-brand-50/40'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED}
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0])}
          />

          <span className="text-4xl" aria-hidden="true">
            {file ? '📄' : '📤'}
          </span>

          {file ? (
            <>
              <p className="mt-3 text-sm font-bold text-slate-800">{file.name}</p>
              <p className="num mt-0.5 text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  reset()
                }}
                className="mt-2 text-xs font-bold text-accent-600 hover:underline"
              >
                إزالة الملف
              </button>
            </>
          ) : (
            <>
              <p className="mt-3 text-sm font-bold text-slate-700">اسحب الملف هنا أو اضغط للاختيار</p>
              <p className="mt-1 text-xs text-slate-500">xlsx · xlsm · csv — حتى 10 ميغابايت</p>
            </>
          )}
        </div>

        {/* خيارات الاستيراد */}
        <fieldset className="mt-5">
          <legend className="field-label">طريقة الاستيراد</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <ModeOption
              checked={mode === 'append'}
              onChange={() => setMode('append')}
              title="إضافة إلى القائمة الحالية"
              description="يضيف الأشخاص الجدد فقط ويتجاهل الموجودين مسبقاً. لا يؤثر على تأكيدات الحضور المسجلة."
              recommended
            />
            <ModeOption
              checked={mode === 'replace'}
              onChange={() => setMode('replace')}
              title="استبدال القائمة بالكامل"
              description="يحذف جميع السجلات الحالية — بما فيها تأكيدات الحضور — ثم يستورد الملف الجديد."
              danger
            />
          </div>
        </fieldset>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={() => send(true)} className="btn-secondary flex-1 text-sm" disabled={!file || loading}>
            {loading ? <Spinner className="h-4 w-4" /> : '🔍'}
            معاينة قبل الاستيراد
          </button>
          <button
            type="button"
            onClick={() => send(false)}
            className={`flex-1 text-sm ${mode === 'replace' ? 'btn-danger' : 'btn-primary'}`}
            disabled={!file || loading}
          >
            {loading ? <Spinner className="h-4 w-4" /> : '📥'}
            {mode === 'replace' ? 'استبدال القائمة واستيراد' : 'استيراد البيانات'}
          </button>
        </div>
      </section>

      {/* تقرير الاستيراد */}
      {report && (
        <section className="card animate-fade-up p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-base font-bold text-slate-900">
              {preview ? '🔍 معاينة الاستيراد (لم تُحفظ البيانات)' : '✅ تقرير الاستيراد'}
            </h2>
            {result && (
              <Link to="/admin/people" className="text-xs font-bold text-brand-700 hover:underline">
                عرض القائمة ←
              </Link>
            )}
          </div>

          <Alert type={preview ? 'info' : 'success'}>{report.message}</Alert>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <ReportStat label="إجمالي الصفوف" value={report.total_rows} tone="slate" />
            <ReportStat label={preview ? 'سيتم استيراده' : 'تم استيراده'} value={report.imported} tone="brand" />
            <ReportStat label="موجود مسبقاً" value={report.skipped_existing} tone="sky" />
            <ReportStat label="مكرر داخل الملف" value={report.skipped_duplicates_in_file} tone="amber" />
            <ReportStat label="صفوف غير صالحة" value={report.invalid_rows} tone="accent" />
          </div>

          {report.deleted_existing > 0 && (
            <p className="mt-3 text-xs font-semibold text-accent-700">
              تم حذف {formatNumber(report.deleted_existing)} سجلاً سابقاً نتيجة اختيار «استبدال القائمة».
            </p>
          )}

          {report.issues?.length > 0 && (
            <div className="mt-5">
              <h3 className="mb-2 text-sm font-bold text-slate-800">
                تفاصيل الصفوف التي تحتاج انتباهاً ({formatNumber(report.issues.length)})
              </h3>
              <div className="max-h-72 overflow-auto rounded-xl border border-slate-200 scroll-thin">
                <table className="w-full min-w-[520px] text-right text-xs">
                  <thead className="sticky top-0 bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-3 py-2 font-bold">الصف</th>
                      <th className="px-3 py-2 font-bold">الاسم</th>
                      <th className="px-3 py-2 font-bold">رقم الهاتف</th>
                      <th className="px-3 py-2 font-bold">السبب</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {report.issues.map((issue, index) => (
                      <tr key={`${issue.row}-${index}`}>
                        <td className="num px-3 py-2 text-slate-400">{issue.row}</td>
                        <td className="px-3 py-2 text-slate-700">{issue.name || '—'}</td>
                        <td className="num px-3 py-2 text-slate-600">{issue.phone || '—'}</td>
                        <td className="px-3 py-2 text-slate-500">{issue.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {preview && (
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => send(false)}
                className={`flex-1 text-sm ${mode === 'replace' ? 'btn-danger' : 'btn-primary'}`}
                disabled={loading}
              >
                {loading ? <Spinner className="h-4 w-4" /> : '📥'}
                تأكيد الاستيراد الآن
              </button>
              <button type="button" onClick={reset} className="btn-secondary flex-1 text-sm">
                إلغاء
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  )
}

function ModeOption({ checked, onChange, title, description, recommended, danger }) {
  return (
    <label
      className={`flex cursor-pointer gap-3 rounded-xl border p-3.5 transition ${
        checked
          ? danger
            ? 'border-accent-400 bg-accent-50 ring-2 ring-accent-200'
            : 'border-brand-400 bg-brand-50 ring-2 ring-brand-200'
          : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      <input type="radio" name="mode" checked={checked} onChange={onChange} className="mt-1 h-4 w-4 accent-brand-600" />
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-800">
          {title}
          {recommended && (
            <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-bold text-brand-700">
              موصى به
            </span>
          )}
          {danger && (
            <span className="rounded-full bg-accent-100 px-2 py-0.5 text-[10px] font-bold text-accent-700">
              خطر
            </span>
          )}
        </span>
        <span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span>
      </span>
    </label>
  )
}

const REPORT_TONES = {
  slate: 'bg-slate-50 text-slate-700',
  brand: 'bg-brand-50 text-brand-700',
  sky: 'bg-sky-50 text-sky-700',
  amber: 'bg-amber-50 text-amber-700',
  accent: 'bg-accent-50 text-accent-700',
}

function ReportStat({ label, value, tone }) {
  return (
    <div className={`rounded-xl px-3 py-3 text-center ${REPORT_TONES[tone]}`}>
      <p className="num text-xl font-extrabold">{formatNumber(value)}</p>
      <p className="mt-0.5 text-[11px] font-semibold opacity-80">{label}</p>
    </div>
  )
}
