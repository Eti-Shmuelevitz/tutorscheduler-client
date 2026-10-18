import { describeError } from './messages'

export const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5041/api'

const TOKEN_KEY = 'tutorscheduler_token'
const USER_KEY = 'tutorscheduler_user'

// localStorage can throw (private mode, blocked storage) - never let that
// take the whole app down.
function readStorage(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key, value) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // ignore
  }
}

export function getToken() {
  return readStorage(TOKEN_KEY)
}

export function getCurrentUser() {
  const raw = readStorage(USER_KEY)
  if (!raw) return null
  try {
    const user = JSON.parse(raw)
    // A token that already expired is as good as no session.
    if (user.expiresAtUtc && new Date(user.expiresAtUtc) <= new Date()) return null
    return user
  } catch {
    return null
  }
}

export function saveSession(authResponse) {
  writeStorage(TOKEN_KEY, authResponse.token)
  writeStorage(
    USER_KEY,
    JSON.stringify({
      fullName: authResponse.fullName,
      email: authResponse.email,
      role: authResponse.role,
      expiresAtUtc: authResponse.expiresAtUtc,
    })
  )
}

export function clearSession() {
  writeStorage(TOKEN_KEY, null)
  writeStorage(USER_KEY, null)
}

// status 0 = the request never got an HTTP answer (server down, wrong port,
// CORS rejection) - the browser only reports "Failed to fetch" for all of these.
class ApiError extends Error {
  constructor(status, body) {
    super(describeError(status, body))
    this.status = status
    this.body = body
  }
}

let onUnauthorized = null
export function registerUnauthorizedHandler(handler) {
  onUnauthorized = handler
}

async function apiFetch(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  let response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(0, null)
  }

  const text = await response.text()
  let data = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = null
    }
  }

  if (!response.ok) {
    if (response.status === 401 && token) {
      clearSession()
      onUnauthorized?.()
    }
    throw new ApiError(response.status, data)
  }

  return data
}

// Lightweight reachability probe for the connection indicator: any HTTP
// answer at all means the server is up and CORS lets us through.
export async function pingServer(timeoutMs = 4000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(`${BASE_URL}/subjects`, { signal: controller.signal })
    return response.status < 500
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

export const authApi = {
  register: (fullName, email, password, role) =>
    apiFetch('/auth/register', { method: 'POST', body: { fullName, email, password, role } }),
  login: (email, password) => apiFetch('/auth/login', { method: 'POST', body: { email, password } }),
}

export const subjectsApi = {
  list: () => apiFetch('/subjects'),
}

export const lessonSlotsApi = {
  listAvailable: (page, pageSize, { subjectId, tutorId, sortDescending } = {}) => {
    const params = new URLSearchParams({ page, pageSize })
    if (subjectId) params.set('subjectId', subjectId)
    if (tutorId) params.set('tutorId', tutorId)
    if (sortDescending) params.set('sortDescending', 'true')
    return apiFetch(`/lessonslots?${params.toString()}`)
  },
  listMine: (page, pageSize) => apiFetch(`/lessonslots/mine?page=${page}&pageSize=${pageSize}`),
  create: (subjectId, startTimeUtc, endTimeUtc) =>
    apiFetch('/lessonslots', { method: 'POST', body: { subjectId, startTimeUtc, endTimeUtc } }),
  book: (id) => apiFetch(`/lessonslots/${id}/bookings`, { method: 'POST' }),
  cancel: (id) => apiFetch(`/lessonslots/${id}`, { method: 'DELETE' }),
  // Works on booked lessons too: the student is notified.
  cancelByTutor: (id, reason) => apiFetch(`/lessonslots/${id}/cancel`, { method: 'POST', body: { reason: reason || null } }),
}

export const notificationsApi = {
  listMine: (page = 1, pageSize = 30) => apiFetch(`/notifications/mine?page=${page}&pageSize=${pageSize}`),
  unreadCount: () => apiFetch('/notifications/unread-count'),
  markRead: (id) => apiFetch(`/notifications/${id}/read`, { method: 'POST' }),
  markAllRead: () => apiFetch('/notifications/read-all', { method: 'POST' }),
}

export const bookingsApi = {
  listMine: (page, pageSize) => apiFetch(`/bookings/mine?page=${page}&pageSize=${pageSize}`),
  cancel: (id) => apiFetch(`/bookings/${id}`, { method: 'DELETE' }),
}

export { ApiError }
