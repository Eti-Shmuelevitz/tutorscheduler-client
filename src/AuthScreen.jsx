import { useState } from 'react'
import { authApi, saveSession } from './api'

const MIN_PASSWORD = 8

// Older builds remembered the last email here and pre-filled it; drop it.
try {
  localStorage.removeItem('tutorscheduler_last_email')
} catch {
  // ignore
}

export default function AuthScreen({ onAuthenticated, notice, themeToggle }) {
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  // Browsers fill saved credentials into the form on page load, but skip
  // read-only inputs. The inputs unlock on first focus, where the browser
  // still offers the saved accounts as suggestions.
  const [unlocked, setUnlocked] = useState(false)
  const unlock = () => setUnlocked(true)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [role, setRole] = useState('Student')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const passwordTooShort = mode === 'register' && password.length > 0 && password.length < MIN_PASSWORD

  async function authenticate(action) {
    setError(null)
    setBusy(true)
    try {
      const response = await action()
      saveSession(response)
      onAuthenticated(response)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (passwordTooShort) return
    authenticate(() =>
      mode === 'login' ? authApi.login(email, password) : authApi.register(fullName, email, password, role)
    )
  }

  function switchMode(next) {
    if (next === mode) return
    setMode(next)
    setError(null)
    setPassword('')
    setShowPassword(false)
    setEmail('')
    if (next === 'register') setFullName('')
  }

  return (
    <div className="auth-shell">
      <div className="auth-bg" aria-hidden="true" />

      <header className="auth-topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            ת
          </span>
          <strong>TutorScheduler</strong>
        </div>
        {themeToggle}
      </header>

      <main className="auth-main">
        <div className="auth-intro">
          <span className="auth-kicker">תיאום שיעורים פרטיים</span>
          <h1>כל השיעורים שלך, במקום אחד</h1>
          <p>מורים מפרסמים את השעות הפנויות שלהם, ותלמידים מוצאים ומזמינים שיעור בכמה לחיצות.</p>
        </div>

      <section className="card auth-card">
        <div className="auth-card-head">
          <h2>{mode === 'login' ? 'כניסה לחשבון' : 'יצירת חשבון חדש'}</h2>
          <p className="muted small">{mode === 'login' ? 'הזינו את פרטי ההתחברות שלכם.' : 'כמה פרטים ואפשר להתחיל.'}</p>
        </div>
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={mode === 'login'} className={`tab ${mode === 'login' ? 'is-active' : ''}`} onClick={() => switchMode('login')}>
            התחברות
          </button>
          <button role="tab" aria-selected={mode === 'register'} className={`tab ${mode === 'register' ? 'is-active' : ''}`} onClick={() => switchMode('register')}>
            הרשמה
          </button>
        </div>

        {notice && <div className="alert alert-warn">{notice}</div>}

        {/* key={mode}: each tab gets brand-new inputs. The browser's password
            manager fills saved credentials into the login inputs on page load,
            and that value stays visible (and hidden from React) if the same
            DOM inputs are reused for registration. */}
        <form key={mode} onSubmit={handleSubmit} className="form" autoComplete={mode === 'login' ? 'on' : 'off'}>
          {mode === 'register' && (
            <label className="field">
              <span>שם מלא</span>
              <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={100} required autoComplete="name" />
            </label>
          )}

          <label className="field">
            <span>אימייל</span>
            <input className="input" dir="ltr" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              readOnly={!unlocked} onFocus={unlock}
              name={mode === 'login' ? 'email' : 'new-account-email'} autoComplete={mode === 'login' ? 'username' : 'off'} />
          </label>

          <label className="field">
            <span>סיסמה</span>
            <div className="input-with-action">
              <input
                className="input"
                dir="ltr"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                readOnly={!unlocked}
                onFocus={unlock}
                name={mode === 'login' ? 'password' : 'new-password'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
              <button type="button" className="input-action" onClick={() => setShowPassword((s) => !s)}>
                {showPassword ? 'הסתרה' : 'הצגה'}
              </button>
            </div>
            {mode === 'register' && (
              <small className={passwordTooShort ? 'text-danger' : 'muted'}>לפחות {MIN_PASSWORD} תווים</small>
            )}
          </label>

          {mode === 'register' && (
            <fieldset className="field role-picker">
              <legend>אני…</legend>
              {[
                { value: 'Student', title: 'תלמיד/ה', text: 'מחפש/ת שיעורים ומזמין/ה' },
                { value: 'Tutor', title: 'מורה', text: 'מפרסם/ת שעות פנויות' },
              ].map((option) => (
                <label key={option.value} className={`role-option ${role === option.value ? 'is-active' : ''}`}>
                  <input type="radio" name="role" value={option.value} checked={role === option.value} onChange={() => setRole(option.value)} />
                  <strong>{option.title}</strong>
                  <span className="muted">{option.text}</span>
                </label>
              ))}
            </fieldset>
          )}

          {error && <div className="alert alert-error">{error}</div>}

          <button type="submit" className="btn btn-primary btn-block" disabled={busy || passwordTooShort}>
            {busy ? 'רגע…' : mode === 'login' ? 'כניסה' : 'יצירת חשבון'}
          </button>
        </form>
      </section>
      </main>

      <footer className="auth-footer muted small">TutorScheduler · תיאום שיעורים פרטיים</footer>
    </div>
  )
}
