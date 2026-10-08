import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  withCredentials: true,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    config.headers.delete('Content-Type')
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAuthRequest = error.config?.url?.startsWith('/auth/')
    if (error.response?.status === 401 && !isAuthRequest && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('nexa:session-expired'))
    }
    return Promise.reject(error)
  },
)

export default api
