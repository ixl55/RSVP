import { useEffect, useRef, useState } from 'react'
import api from '../services/api'
import { formatDateTime } from '../services/format'
import { Alert, Logo, Spinner } from '../components/ui'

// يُحفظ التأكيد على الجهاز لمنع استخدام نفس الجهاز لتأكيد أشخاص آخرين.
// ملاحظة مهمة: هذا مجرد ذاكرة مؤقتة - قاعدة البيانات هي المرجع، ويُتحقق منها
// عند كل فتح للصفحة حتى لا يبقى الجهاز مقفلاً بعد إعادة رفع قائمة المقبولين.
const STORAGE_KEY = 'attendance_confirmation'

function readSavedConfirmation() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const saved = JSON.parse(raw)
    return saved?.phone ? { ...saved, status: 'already_confirmed', restored: true } : null
  } catch {
    return null
  }
}

function clearConfirmation() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* تجاهل */
  }
}

function saveConfirmation(data) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        name: data.name,
        phone: data.phone,
        confirmed_at: data.confirmed_at,
        event_name: data.event_name,
        event_place: data.event_place,
      }),
    )
  } catch {
    /* الوضع الخاص أو تعطيل التخزين - لا يمنع إتمام التأكيد */
  }
}

export default function Attendance() {
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  // إن سبق التأكيد من هذا الجهاز تُعرض النتيجة مباشرة بدل النموذج
  const [result, setResult] = useState(readSavedConfirmation)
  // نتحقق من الخادم قبل الاعتماد على التأكيد المحفوظ محلياً
  const [verifying, setVerifying] = useState(() => Boolean(readSavedConfirmation()))
  const [serverError, setServerError] = useState('')
  const [event, setEvent] = useState({
    event_name: 'مؤتمر يوم الشباب العالمي - العراق',
    event_place: 'فندق موفنبيك - المنطقة الخضراء',
  })
  const resultRef = useRef(null)

  useEffect(() => {
    api
      .get('/attendance/event-info')
      .then(({ data }) => setEvent(data))
      .catch(() => {
        /* نُبقي القيم الافتراضية إذا تعذّر جلب بيانات الفعالية */
      })
  }, [])

  // التحقق من أن التأكيد المحفوظ على الجهاز ما زال قائماً في قاعدة البيانات.
  // إذا أُعيد رفع القائمة أو تراجع الأدمن عن التأكيد، يُفتح النموذج من جديد.
  useEffect(() => {
    const saved = readSavedConfirmation()
    if (!saved?.phone) {
      setVerifying(false)
      return undefined
    }

    let cancelled = false
    api
      .get('/attendance/status', { params: { phone: saved.phone } })
      .then(({ data }) => {
        if (cancelled) return
        if (data.status === 'confirmed') {
          // ما زال مؤكداً - نحدّث البيانات المعروضة من المصدر الرسمي
          setResult({ ...data, status: 'already_confirmed', restored: true })
          saveConfirmation(data)
        } else {
          // لم يعد مؤكداً (أو حُذف من القائمة) - نفتح النموذج
          clearConfirmation()
          setResult(null)
        }
      })
      .catch(() => {
        // تعذّر التحقق - نفتح النموذج ولا نحبس أحداً؛ الخادم يبقى المرجع عند الإرسال
        if (!cancelled) {
          clearConfirmation()
          setResult(null)
        }
      })
      .finally(() => {
        if (!cancelled) setVerifying(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  // تمرير الشاشة إلى النتيجة بعد ظهورها
  useEffect(() => {
    if (result || serverError) {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [result, serverError])

  function validate() {
    const value = phone.trim()
    const digits = value.replace(/[^\d٠-٩]/g, '')

    if (!value) {
      setError('يرجى إدخال رقم الهاتف.')
      return false
    }
    if (digits.length < 10) {
      setError('رقم الهاتف غير مكتمل. مثال: 07XXXXXXXXX')
      return false
    }

    setError('')
    return true
  }

  async function handleSubmit(submitEvent) {
    submitEvent.preventDefault()
    setServerError('')
    setResult(null)

    if (!validate()) return

    setLoading(true)
    try {
      const { data } = await api.post('/attendance/confirm', { phone: phone.trim() })
      setResult(data)
      if (data.status === 'confirmed' || data.status === 'already_confirmed') {
        setPhone('')
        saveConfirmation(data)
      }
    } catch (err) {
      setServerError(err.friendlyMessage || 'حدث خطأ غير متوقع.')
    } finally {
      setLoading(false)
    }
  }

  // يُخفى النموذج بعد نجاح التأكيد - لكل جهاز تأكيد واحد ولصاحبه فقط
  const showForm = !verifying && (!result || result.status === 'not_found')

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-brand-50 via-slate-50 to-white">
      {/* زخارف الخلفية */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 right-1/2 h-[420px] w-[420px] translate-x-1/2 rounded-full bg-brand-200/35 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-0 h-72 w-72 rounded-full bg-accent-100/40 blur-3xl"
      />

      <main className="relative mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-4 py-10">
        {/* الترويسة */}
        <header className="mb-6 flex flex-col items-center text-center animate-fade-up">
          <Logo className="h-28 w-28 sm:h-32 sm:w-32" />
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            تأكيد الحضور
          </h1>
          <p className="mt-1 text-sm font-bold text-brand-700 sm:text-base">{event.event_name}</p>
          {event.event_place && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500 sm:text-sm">
              <span aria-hidden="true">📍</span>
              {event.event_place}
            </p>
          )}
        </header>

        {/* البطاقة الرئيسية */}
        <section className="card p-5 sm:p-7 animate-fade-up" style={{ animationDelay: '80ms' }}>
          {verifying && (
            <div className="flex flex-col items-center justify-center gap-3 py-8 text-slate-500">
              <Spinner className="h-7 w-7 text-brand-600" />
              <p className="text-sm font-semibold">جارِ التحقق من حالة تأكيدك...</p>
            </div>
          )}

          {showForm && (
            <>
              <p className="mb-5 text-center text-sm leading-6 text-slate-600">
                يرجى إدخال رقم الهاتف المستخدم أثناء التسجيل لتأكيد حضورك.
              </p>

              <form onSubmit={handleSubmit} noValidate>
                <div className="mb-5">
                  <label htmlFor="phone" className="field-label">
                    رقم الهاتف
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    autoFocus
                    dir="ltr"
                    className={`field text-center text-lg tracking-widest ${error ? 'field-error' : ''}`}
                    placeholder="07XXXXXXXXX"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value)
                      if (error) setError('')
                    }}
                    disabled={loading}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? 'phone-error' : 'phone-hint'}
                  />
                  {error ? (
                    <p id="phone-error" className="mt-1.5 text-xs font-semibold text-accent-600">
                      {error}
                    </p>
                  ) : (
                    <p id="phone-hint" className="mt-1.5 text-xs text-slate-400">
                      اكتب الرقم كما سجّلته — يقبل النظام صيغ 07 و +964 و 00964.
                    </p>
                  )}
                </div>

                <button type="submit" className="btn-primary w-full py-3.5 text-base" disabled={loading}>
                  {loading ? (
                    <>
                      <Spinner />
                      جارِ التحقق من رقمك...
                    </>
                  ) : (
                    <>
                      <span aria-hidden="true">✅</span>
                      تأكيد الحضور
                    </>
                  )}
                </button>
              </form>
            </>
          )}

          {/* النتائج */}
          <div ref={resultRef}>
            {serverError && (
              <Alert type="error" title="تعذّر إتمام العملية" className="mt-5" onClose={() => setServerError('')}>
                {serverError}
              </Alert>
            )}

            {result?.status === 'not_found' && (
              <Alert type="error" title="لم يتم العثور على رقمك" className="mt-5">
                {result.message}
                <br />
                إذا كنت متأكداً من رقمك، يرجى التواصل مع اللجنة المنظمة.
              </Alert>
            )}

            {!verifying && result?.status === 'confirmed' && <ResultCard result={result} success />}

            {!verifying && result?.status === 'already_confirmed' && <ResultCard result={result} />}
          </div>
        </section>

        <footer className="mt-6 text-center animate-fade-up" style={{ animationDelay: '160ms' }}>
          <p className="text-xs text-slate-400">
            تأكيد الحضور شخصي ومتاح لمرة واحدة فقط لكل شخص ضمن قائمة المقبولين.
          </p>
        </footer>
      </main>
    </div>
  )
}

/** بطاقة النتيجة: نجاح جديد أو تأكيد سابق */
function ResultCard({ result, success = false }) {
  const tone = success
    ? { ring: 'bg-brand-100', title: 'text-brand-800', box: 'border-brand-100 bg-brand-50', label: 'text-brand-700', value: 'text-brand-900' }
    : { ring: 'bg-amber-100', title: 'text-amber-700', box: 'border-amber-200 bg-amber-50', label: 'text-amber-700', value: 'text-amber-900' }

  return (
    <div className="animate-pop-in text-center">
      <div className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full ${tone.ring}`}>
        {success ? (
          <svg
            className="h-11 w-11 text-brand-600"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
        ) : (
          <span className="text-4xl" aria-hidden="true">
            ⚠️
          </span>
        )}
      </div>

      <h2 className={`mt-4 text-xl font-extrabold sm:text-2xl ${tone.title}`}>
        {success ? '🎉 تم تأكيد حضورك بنجاح' : 'لقد تم تأكيد حضورك مسبقاً'}
      </h2>

      <p className="mt-3 text-lg font-bold text-slate-900">
        {success ? `أهلاً ${result.name}` : result.name}
      </p>

      <p className="mt-1.5 text-sm leading-6 text-slate-600">
        {success ? (
          <>
            تم تسجيل تأكيد حضورك بنجاح.
            <br />
            نتطلع إلى رؤيتك في الفعالية.
          </>
        ) : (
          'تم تسجيل حضورك سابقاً ولا حاجة لتأكيده مرة أخرى.'
        )}
      </p>

      {/* تفاصيل التأكيد */}
      <dl className={`mt-5 divide-y divide-white/60 rounded-xl border text-right ${tone.box}`}>
        <DetailRow label="الاسم" value={result.name} tone={tone} />
        {result.phone && <DetailRow label="رقم الهاتف" value={result.phone} tone={tone} ltr />}
        <DetailRow
          label={success ? 'وقت التأكيد' : 'وقت التأكيد السابق'}
          value={formatDateTime(result.confirmed_at)}
          tone={tone}
          ltr
        />
        {result.event_name && <DetailRow label="الفعالية" value={result.event_name} tone={tone} />}
        {result.event_place && <DetailRow label="المكان" value={result.event_place} tone={tone} />}
      </dl>

      <p className="mt-4 text-xs leading-6 text-slate-400">
        احتفظ بهذه الصفحة — يمكنك عرضها عند الدخول.
      </p>
    </div>
  )
}

function DetailRow({ label, value, tone, ltr = false }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5">
      <dt className={`shrink-0 text-xs font-semibold ${tone.label}`}>{label}</dt>
      <dd className={`text-sm font-bold ${tone.value} ${ltr ? 'num' : ''}`}>{value}</dd>
    </div>
  )
}
