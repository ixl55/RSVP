import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import api, { tokenStore } from './api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null)
  const [loading, setLoading] = useState(true)

  // التحقق من صلاحية الجلسة عند فتح التطبيق
  useEffect(() => {
    let cancelled = false

    async function verify() {
      if (!tokenStore.get()) {
        setLoading(false)
        return
      }
      try {
        const { data } = await api.get('/auth/me')
        if (!cancelled) setAdmin(data)
      } catch {
        tokenStore.clear()
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    verify()
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (username, password) => {
    const { data } = await api.post('/auth/login', { username, password })
    tokenStore.set(data.access_token)
    const me = await api.get('/auth/me')
    setAdmin(me.data)
    return me.data
  }, [])

  const logout = useCallback(() => {
    tokenStore.clear()
    setAdmin(null)
  }, [])

  const value = useMemo(
    () => ({ admin, loading, login, logout, isAuthenticated: Boolean(admin) }),
    [admin, loading, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth يجب أن يُستخدم داخل AuthProvider')
  return context
}
