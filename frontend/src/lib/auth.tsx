import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, tokenStore } from './api'

interface AuthState {
  authed: boolean
  username: string | null
  loginOpen: boolean
  openLogin: () => void
  closeLogin: () => void
  login: (user: string, pass: string) => Promise<void>
  logout: () => void
}

const Ctx = createContext<AuthState | null>(null)
const USER_KEY = 'hidro.user'
const readUser = () => { try { return localStorage.getItem(USER_KEY) } catch { return null } }

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState(tokenStore.get())
  const [username, setUsername] = useState(readUser())
  const [loginOpen, setLoginOpen] = useState(false)

  // Token descartado pela API (expirado/inválido) ou removido em outra aba: volta ao modo visitante.
  useEffect(() => {
    const drop = () => { setToken(tokenStore.get()); if (!tokenStore.get()) setUsername(null) }
    window.addEventListener('hidro:token-cleared', drop)
    window.addEventListener('storage', drop)
    return () => { window.removeEventListener('hidro:token-cleared', drop); window.removeEventListener('storage', drop) }
  }, [])

  const login = useCallback(async (user: string, pass: string) => {
    const t = await api.login(user, pass)
    tokenStore.set(t)
    try { localStorage.setItem(USER_KEY, user) } catch { /* ignora */ }
    setToken(t); setUsername(user); setLoginOpen(false)
  }, [])

  const logout = useCallback(() => {
    tokenStore.clear()
    try { localStorage.removeItem(USER_KEY) } catch { /* ignora */ }
    setToken(null); setUsername(null)
  }, [])

  const value = useMemo<AuthState>(() => ({
    authed: !!token, username, loginOpen, login, logout,
    openLogin: () => setLoginOpen(true), closeLogin: () => setLoginOpen(false),
  }), [token, username, loginOpen, login, logout])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth fora do AuthProvider')
  return v
}
