const TIME_ZONE = 'Asia/Baghdad'

/** الخادم يُرجع التوقيت بصيغة UTC بدون لاحقة Z - نضيفها قبل التحويل */
function parseUtc(value) {
  if (!value) return null
  const normalized = /[zZ]|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value}Z`
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatDateTime(value) {
  const date = parseUtc(value)
  if (!date) return '—'
  return new Intl.DateTimeFormat('ar-IQ-u-nu-latn', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date)
}

export function formatDate(value) {
  const date = parseUtc(value)
  if (!date) return '—'
  return new Intl.DateTimeFormat('ar-IQ-u-nu-latn', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function formatTime(value) {
  const date = parseUtc(value)
  if (!date) return '—'
  return new Intl.DateTimeFormat('ar-IQ-u-nu-latn', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date)
}

export function formatNumber(value) {
  if (value === null || value === undefined) return '0'
  return new Intl.NumberFormat('en-US').format(value)
}
