import { useEffect, useState } from 'react'
import api from './api.js'
import AuthContext from './auth-context.js'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sessionError, setSessionError] = useState('')

  useEffect(() => {
    let active = true
    const expireSession = () => {
      if (!active) return
      setUser(null)
      setSessionError('Your session has expired. Please sign in again.')
    }
    window.addEventListener('nexa:session-expired', expireSession)
    api.get('/auth/session')
      .then(({ data }) => {
        if (active) setUser(data.user)
      })
      .catch((error) => {
        if (!active) return
        if (error.response?.status !== 401) {
          setSessionError(error.response?.data?.message || 'Could not verify your session. Check that the NEXA API is running.')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
      window.removeEventListener('nexa:session-expired', expireSession)
    }
  }, [])

  const login = async (credentials) => {
    const { data } = await api.post('/auth/login', credentials)
    setUser(data.user)
    setSessionError('')
    return data.user
  }

  const register = async (details) => {
    const { data } = await api.post('/auth/register', details)
    setUser(data.user)
    setSessionError('')
    return data.user
  }

  const logout = async () => {
    await api.post('/auth/logout')
    setUser(null)
    setSessionError('')
  }

  return (
    <AuthContext.Provider value={{ user, loading, sessionError, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
