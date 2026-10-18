import { useEffect, useState } from 'react'
import { getCurrentUser, clearSession, registerUnauthorizedHandler } from './api'
import AuthScreen from './AuthScreen'
import StudentView from './StudentView'
import TutorView from './TutorView'
import { roleLabels } from './labels'
import FeedbackProvider from './ui/FeedbackProvider'
import ConnectionBanner from './ui/ConnectionBanner'
import { Avatar } from './ui/bits'
import NotificationsProvider from './ui/NotificationsProvider'
import NotificationBell from './ui/NotificationBell'

const THEME_KEY = 'tutorscheduler_theme'

function MaybeNotifications({ enabled, children }) {
  return enabled ? <NotificationsProvider>{children}</NotificationsProvider> : children
}
const EXPIRED_NOTICE = 'תוקף ההתחברות פג. יש להתחבר מחדש.'

function initialTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY)
    if (saved) return saved
  } catch {
    // ignore
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export default function App() {
  const [user, setUser] = useState(getCurrentUser)
  const [sessionNotice, setSessionNotice] = useState(null)
  const [theme, setTheme] = useState(initialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      // ignore
    }
  }, [theme])

  // A 401 from any API call (JWT expired or otherwise rejected) bounces the
  // user back to the login screen instead of leaving every button silently
  // failing with a message that never explains why.
  useEffect(() => {
    registerUnauthorizedHandler(() => {
      setSessionNotice(EXPIRED_NOTICE)
      setUser(null)
    })
  }, [])

  // Log out at the token's own expiry time, before the next click hits a 401.
  useEffect(() => {
    if (!user?.expiresAtUtc) return
    const msLeft = new Date(user.expiresAtUtc) - new Date()
    const timer = setTimeout(() => {
      clearSession()
      setSessionNotice(EXPIRED_NOTICE)
      setUser(null)
    }, Math.max(0, Math.min(msLeft, 2 ** 31 - 1)))
    return () => clearTimeout(timer)
  }, [user])

  function handleLogout() {
    clearSession()
    setSessionNotice(null)
    setUser(null)
  }

  const themeToggle = (
    <button
      className="btn btn-ghost btn-icon"
      onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
      aria-label={theme === 'dark' ? 'מעבר למצב בהיר' : 'מעבר למצב כהה'}
      title={theme === 'dark' ? 'מצב בהיר' : 'מצב כהה'}
    >
      {theme === 'dark' ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4.5" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
        </svg>
      )}
    </button>
  )

  return (
    <FeedbackProvider>
      <ConnectionBanner />
      {!user ? (
        <AuthScreen
          notice={sessionNotice}
          themeToggle={themeToggle}
          onAuthenticated={() => {
            setSessionNotice(null)
            setUser(getCurrentUser())
          }}
        />
      ) : (
        // Only students receive notifications (a tutor cancelling their lesson).
        <MaybeNotifications enabled={user.role === 'Student'}>
        <div className="app-shell">
          <header className="topbar">
            <div className="brand">
              <span className="brand-mark" aria-hidden="true">
                ת
              </span>
              <div className="brand-text">
                <strong>TutorScheduler</strong>
                <span className="brand-sub">תיאום שיעורים פרטיים</span>
              </div>
            </div>
            <div className="topbar-actions">
              {user.role === 'Student' && <NotificationBell />}
              {themeToggle}
              <div className="user-chip">
                <Avatar name={user.fullName} size={32} />
                <div className="user-chip-text">
                  <span className="user-name">{user.fullName}</span>
                  <span className={`badge ${user.role === 'Tutor' ? 'badge-info' : 'badge-success'}`}>
                    {roleLabels[user.role] ?? user.role}
                  </span>
                </div>
              </div>
              <button className="btn btn-ghost" onClick={handleLogout}>
                התנתקות
              </button>
            </div>
          </header>

          <main className="container">
            {user.role === 'Student' ? <StudentView user={user} /> : <TutorView user={user} />}
          </main>
        </div>
        </MaybeNotifications>
      )}
    </FeedbackProvider>
  )
}
