import axios from 'axios'

const TOKEN_KEY = 'attendance_admin_token'

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 60000,
})

// إرفاق رمز الدخول مع كل طلب
api.interceptors.request.use((config) => {
  const token = tokenStore.get()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// معالجة موحّدة للأخطاء + تسجيل خروج تلقائي عند انتهاء الجلسة
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status

    if (status === 401 && !error.config?.url?.includes('/auth/login')) {
      tokenStore.clear()
      if (window.location.pathname.startsWith('/admin')) {
        window.location.href = '/admin/login?expired=1'
      }
    }

    error.friendlyMessage = extractMessage(error)
    return Promise.reject(error)
  },
)

function extractMessage(error) {
  if (error.code === 'ECONNABORTED') {
    return 'انتهت مهلة الاتصال بالخادم. يرجى المحاولة مجدداً.'
  }
  if (!error.response) {
    return 'تعذّر الاتصال بالخادم. تأكد من اتصالك بالإنترنت ثم حاول مجدداً.'
  }

  const detail = error.response.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && detail.length) {
    return detail[0]?.msg || 'البيانات المُدخلة غير صحيحة.'
  }

  const byStatus = {
    401: 'انتهت صلاحية الجلسة. يرجى تسجيل الدخول مجدداً.',
    403: 'ليس لديك صلاحية لتنفيذ هذا الإجراء.',
    404: 'العنصر المطلوب غير موجود.',
    413: 'حجم الملف كبير جداً.',
    429: 'عدد المحاولات كبير. يرجى الانتظار قليلاً.',
  }
  return byStatus[error.response.status] || 'حدث خطأ غير متوقع. يرجى المحاولة مجدداً.'
}

/** تنزيل ملف قادم من الـ API مع الحفاظ على اسمه */
export async function downloadFile(url, params, fallbackName) {
  const response = await api.get(url, { params, responseType: 'blob' })

  const disposition = response.headers['content-disposition'] || ''
  let filename = fallbackName
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i)
  const plainMatch = disposition.match(/filename="?([^";]+)"?/i)
  if (utf8Match) filename = decodeURIComponent(utf8Match[1])
  else if (plainMatch) filename = plainMatch[1]

  const blobUrl = window.URL.createObjectURL(new Blob([response.data]))
  const link = document.createElement('a')
  link.href = blobUrl
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(blobUrl)
}

export default api
