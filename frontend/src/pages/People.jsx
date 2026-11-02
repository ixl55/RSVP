import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api, { downloadFile } from '../services/api'
import { formatDateTime, formatNumber } from '../services/format'
import { Alert, EmptyState, Modal, Pagination, SkeletonRows, Spinner, useToast } from '../components/ui'

const STATUS_TABS = [
  { key: 'all', label: 'الجميع' },
  { key: 'confirmed', label: 'المؤكدون' },
  { key: 'not_confirmed', label: 'لم يؤكدوا' },
]

const SORT_COLUMNS = [
  { key: 'name', label: 'الاسم' },
  { key: 'phone', label: 'رقم الهاتف' },
  { key: 'status', label: 'حالة الحضور' },
  { key: 'confirmed_at', label: 'وقت التأكيد' },
]

export default function People() {
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '')
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [status, setStatus] = useState(searchParams.get('status') || 'all')
  const [sortBy, setSortBy] = useState('created_at')
  const [sortDir, setSortDir] = useState('asc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  const [data, setData] = useState({ items: [], total: 0, total_pages: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)

  const [noteTarget, setNoteTarget] = useState(null)
  const [noteText, setNoteText] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  const firstRender = useRef(true)

  // تأخير البحث حتى يتوقف المستخدم عن الكتابة
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 400)
    return () => clearTimeout(timer)
  }, [searchInput])

  // إبقاء الفلاتر في رابط الصفحة
  useEffect(() => {
    const params = {}
    if (search) params.search = search
    if (status !== 'all') params.status = status
    setSearchParams(params, { replace: true })
  }, [search, status, setSearchParams])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data: response } = await api.get('/admin/people', {
        params: { search: search || undefined, status, sort_by: sortBy, sort_dir: sortDir, page, page_size: pageSize },
      })
      setData(response)
    } catch (err) {
      setError(err.friendlyMessage || 'تعذّر تحميل القائمة.')
    } finally {
      setLoading(false)
      firstRender.current = false
    }
  }, [search, status, sortBy, sortDir, page, pageSize])

  useEffect(() => {
    load()
  }, [load])

  function toggleSort(column) {
    if (sortBy === column) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(column)
      setSortDir('asc')
    }
    setPage(1)
  }

  function openNote(person) {
    setNoteTarget(person)
    setNoteText(person.admin_note || '')
  }

  async function saveNote() {
    if (!noteTarget) return
    setSavingNote(true)
    try {
      const { data: updated } = await api.put(`/admin/people/${noteTarget.id}/note`, {
        admin_note: noteText.trim() || null,
      })
      setData((current) => ({
        ...current,
        items: current.items.map((p) => (p.id === updated.id ? updated : p)),
      }))
      toast.success('تم حفظ الملاحظة بنجاح.')
      setNoteTarget(null)
    } catch (err) {
      toast.error(err.friendlyMessage || 'تعذّر حفظ الملاحظة.')
    } finally {
      setSavingNote(false)
    }
  }

  async function toggleAttendance(person) {
    const next = !person.attendance_confirmed
    const question = next
      ? `تأكيد حضور «${person.name}» يدوياً؟`
      : `التراجع عن تأكيد حضور «${person.name}»؟`
    if (!window.confirm(question)) return

    try {
      const { data: updated } = await api.put(`/admin/people/${person.id}/attendance`, null, {
        params: { confirmed: next },
      })
      setData((current) => ({
        ...current,
        items: current.items.map((p) => (p.id === updated.id ? updated : p)),
      }))
      toast.success(next ? 'تم تأكيد الحضور.' : 'تم التراجع عن التأكيد.')
    } catch (err) {
      toast.error(err.friendlyMessage || 'تعذّر تحديث الحالة.')
    }
  }

  async function exportCurrentView() {
    setExporting(true)
    try {
      await downloadFile('/admin/export-excel', { scope: status, search: search || undefined }, 'attendance.xlsx')
      toast.success('تم تنزيل الملف.')
    } catch (err) {
      toast.error(err.friendlyMessage || 'تعذّر تصدير الملف.')
    } finally {
      setExporting(false)
    }
  }

  const isEmpty = !loading && data.items.length === 0
  const hasFilters = Boolean(search) || status !== 'all'

  const summary = useMemo(
    () => `${formatNumber(data.total)} نتيجة${hasFilters ? ' مطابقة للبحث' : ''}`,
    [data.total, hasFilters],
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 sm:text-2xl">إدارة المقبولين</h1>
          <p className="mt-0.5 text-sm text-slate-500">{summary}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={exportCurrentView} className="btn-secondary px-4 py-2 text-xs" disabled={exporting}>
            {exporting ? <Spinner className="h-4 w-4" /> : '📥'}
            تصدير النتائج الحالية
          </button>
          <Link to="/admin/import" className="btn-primary px-4 py-2 text-xs">
            📤 رفع ملف Excel
          </Link>
        </div>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      {/* أدوات البحث والفلترة */}
      <section className="card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">🔍</span>
            <input
              type="search"
              className="field pr-10"
              placeholder="ابحث بالاسم أو رقم الهاتف..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              aria-label="بحث"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput('')}
                className="absolute inset-y-0 left-2 px-2 text-slate-400 transition hover:text-slate-600"
                aria-label="مسح البحث"
              >
                ×
              </button>
            )}
          </div>

          <div className="flex rounded-xl bg-slate-100 p-1">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setStatus(tab.key)
                  setPage(1)
                }}
                className={`flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold transition ${
                  status === tab.key ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <select
            className="field w-full lg:w-auto"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value))
              setPage(1)
            }}
            aria-label="عدد الصفوف في الصفحة"
          >
            {[10, 25, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size} صف
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* الجدول */}
      <section className="card overflow-hidden">
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[860px] text-right text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 font-bold">#</th>
                {SORT_COLUMNS.map((column) => (
                  <th key={column.key} className="px-4 py-3 font-bold">
                    <button
                      type="button"
                      onClick={() => toggleSort(column.key)}
                      className="inline-flex items-center gap-1 transition hover:text-brand-700"
                    >
                      {column.label}
                      <span className="text-[10px] text-slate-400">
                        {sortBy === column.key ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
                      </span>
                    </button>
                  </th>
                ))}
                <th className="px-4 py-3 font-bold">ملاحظة الأدمن</th>
                <th className="px-4 py-3 font-bold">إجراءات</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading && <SkeletonRows rows={6} cols={7} />}

              {!loading &&
                data.items.map((person, index) => (
                  <tr key={person.id} className="transition hover:bg-slate-50/70">
                    <td className="num px-4 py-3 text-xs text-slate-400">
                      {(page - 1) * pageSize + index + 1}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-bold text-slate-800">{person.name}</span>
                    </td>
                    <td className="num px-4 py-3 text-slate-600">{person.phone}</td>
                    <td className="px-4 py-3">
                      {person.attendance_confirmed ? (
                        <span className="badge-success">✅ تم التأكيد</span>
                      ) : (
                        <span className="badge-muted">⏳ لم يؤكد</span>
                      )}
                    </td>
                    <td className="num px-4 py-3 text-xs text-slate-500">
                      {person.confirmed_at ? formatDateTime(person.confirmed_at) : '—'}
                    </td>
                    <td className="max-w-[220px] px-4 py-3">
                      {person.admin_note ? (
                        <span className="line-clamp-2 text-xs text-slate-600" title={person.admin_note}>
                          {person.admin_note}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openNote(person)}
                          className="rounded-lg px-2 py-1 text-xs font-bold text-brand-700 transition hover:bg-brand-50"
                        >
                          📝 ملاحظة
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleAttendance(person)}
                          className={`rounded-lg px-2 py-1 text-xs font-bold transition ${
                            person.attendance_confirmed
                              ? 'text-slate-500 hover:bg-slate-100'
                              : 'text-brand-700 hover:bg-brand-50'
                          }`}
                        >
                          {person.attendance_confirmed ? '↩ تراجع' : '✓ تأكيد'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {isEmpty && (
          <EmptyState
            icon={hasFilters ? '🔍' : '📋'}
            title={hasFilters ? 'لا توجد نتائج مطابقة' : 'القائمة فارغة'}
            description={
              hasFilters
                ? 'جرّب تعديل كلمة البحث أو الفلتر المستخدم.'
                : 'ابدأ برفع ملف Excel يحتوي على أسماء وأرقام المقبولين.'
            }
            action={
              hasFilters ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput('')
                    setStatus('all')
                  }}
                  className="btn-secondary text-xs"
                >
                  مسح الفلاتر
                </button>
              ) : (
                <Link to="/admin/import" className="btn-primary text-xs">
                  📤 رفع ملف Excel
                </Link>
              )
            }
          />
        )}

        <Pagination
          page={data.page || page}
          totalPages={data.total_pages}
          total={data.total}
          pageSize={pageSize}
          onChange={setPage}
        />
      </section>

      {/* نافذة الملاحظة */}
      <Modal
        open={Boolean(noteTarget)}
        onClose={() => setNoteTarget(null)}
        title={`ملاحظة الأدمن — ${noteTarget?.name || ''}`}
        footer={
          <>
            <button type="button" onClick={saveNote} className="btn-primary text-sm" disabled={savingNote}>
              {savingNote ? <Spinner className="h-4 w-4" /> : '💾'}
              حفظ الملاحظة
            </button>
            <button type="button" onClick={() => setNoteTarget(null)} className="btn-secondary text-sm">
              إلغاء
            </button>
          </>
        }
      >
        <div className="mb-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
          <span className="font-bold text-slate-700">{noteTarget?.name}</span>
          <span className="num mx-2">{noteTarget?.phone}</span>
        </div>

        <label htmlFor="note" className="field-label">
          نص الملاحظة
        </label>
        <textarea
          id="note"
          rows={5}
          className="field resize-none"
          placeholder="مثال: تم التواصل معه — سيحضر مع شخص آخر"
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          maxLength={1000}
        />
        <p className="num mt-1.5 text-left text-xs text-slate-400">{noteText.length} / 1000</p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {['تم التواصل معه', 'سيحضر مع شخص آخر', 'اعتذر عن الحضور', 'لم يرد على الاتصال'].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setNoteText(preset)}
              className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
            >
              {preset}
            </button>
          ))}
        </div>
      </Modal>
    </div>
  )
}
