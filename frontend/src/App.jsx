import { Link, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './services/auth'
import { ToastProvider } from './components/ui'
import AdminLayout, { ProtectedRoute } from './components/AdminLayout'
import Attendance from './pages/Attendance'
import AdminLogin from './pages/AdminLogin'
import Dashboard from './pages/Dashboard'
import People from './pages/People'
import ImportExcel from './pages/ImportExcel'
import ExportExcel from './pages/ExportExcel'

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Routes>
          {/* الصفحة العامة لتأكيد الحضور */}
          <Route path="/" element={<Attendance />} />

          {/* تسجيل دخول الأدمن */}
          <Route path="/admin/login" element={<AdminLogin />} />

          {/* لوحة التحكم المحمية */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="people" element={<People />} />
            <Route path="import" element={<ImportExcel />} />
            <Route path="export" element={<ExportExcel />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </ToastProvider>
    </AuthProvider>
  )
}

function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 px-4 text-center">
      <p className="num text-5xl font-extrabold text-slate-300">404</p>
      <h1 className="text-lg font-bold text-slate-800">الصفحة غير موجودة</h1>
      <p className="text-sm text-slate-500">الرابط الذي فتحته غير صحيح أو تم تغييره.</p>
      <Link to="/" className="btn-primary mt-2 text-sm">
        العودة إلى صفحة تأكيد الحضور
      </Link>
    </div>
  )
}
