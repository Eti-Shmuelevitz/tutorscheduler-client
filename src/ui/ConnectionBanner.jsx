import { useEffect, useState } from 'react'
import { BASE_URL, pingServer } from '../api'

const CHECK_EVERY_MS = 15000

// Answers "is the client actually talking to the server?" at a glance,
// instead of every button failing with a cryptic network error.
export default function ConnectionBanner() {
  const [status, setStatus] = useState('checking') // 'checking' | 'online' | 'offline'
  const [justRecovered, setJustRecovered] = useState(false)

  useEffect(() => {
    let cancelled = false
    let previous = null

    async function check() {
      const ok = await pingServer()
      if (cancelled) return
      const next = ok ? 'online' : 'offline'
      if (previous === 'offline' && next === 'online') {
        setJustRecovered(true)
        setTimeout(() => !cancelled && setJustRecovered(false), 3000)
      }
      previous = next
      setStatus(next)
    }

    check()
    const timer = setInterval(check, CHECK_EVERY_MS)
    window.addEventListener('online', check)
    return () => {
      cancelled = true
      clearInterval(timer)
      window.removeEventListener('online', check)
    }
  }, [])

  async function retry() {
    setStatus('checking')
    setStatus((await pingServer()) ? 'online' : 'offline')
  }

  if (justRecovered) {
    return <div className="banner banner-ok">החיבור לשרת חזר ✓</div>
  }

  if (status !== 'offline') return null

  return (
    <div className="banner banner-error" role="alert">
      <div>
        <strong>אין חיבור לשרת.</strong> ה-API לא עונה בכתובת <code dir="ltr">{BASE_URL}</code>.
        <span className="banner-hint">
          {' '}
          יש להריץ את TutorScheduler.API עם פרופיל <b>http</b> ולוודא ש-PostgreSQL פועל.
        </span>
      </div>
      <button className="btn btn-sm" onClick={retry}>
        בדיקה חוזרת
      </button>
    </div>
  )
}
