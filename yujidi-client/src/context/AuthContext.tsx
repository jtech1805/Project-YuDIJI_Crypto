import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'
import { apiClient } from '../api/client'

type User = {
  id: string
  email: string
  role?: string
}

type LoginPayload = {
  email: string
  password: string
}

type AuthContextValue = {
  user: User | null
  isCheckingAuth: boolean
  login: (payload: LoginPayload) => Promise<void>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)

  const checkAuth = useCallback(async () => {
    try {
      const response = await apiClient.get('/auth/me')
      setUser(response.data.user ?? response.data ?? null)
    } catch {
      setUser(null)
    } finally {
      setIsCheckingAuth(false)
    }
  }, [])

  const login = useCallback(async (payload: LoginPayload) => {
    const response = await apiClient.post('/auth/login', payload)
    setUser(response.data.user ?? response.data ?? null)
  }, [])

  const logout = useCallback(async () => {
    try {
      await apiClient.post('/auth/logout')
    } finally {
      setUser(null)
    }
  }, [])

  useEffect(() => {
    void checkAuth()
  }, [checkAuth])

  const value = useMemo<AuthContextValue>(
    () => ({ user, isCheckingAuth, login, logout, checkAuth }),
    [user, isCheckingAuth, login, logout, checkAuth],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
