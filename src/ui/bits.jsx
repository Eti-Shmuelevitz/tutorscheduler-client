// Small presentational building blocks shared by both views.
import { useEffect, useState } from 'react'
import { subjectHue } from '../subjects'

const AVATAR_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#ef4444']

export function Avatar({ name = '', size = 36 }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
  // Stable color per name, so the same tutor always looks the same.
  const hash = [...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0)
  const color = AVATAR_COLORS[hash % AVATAR_COLORS.length]
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, fontSize: size * 0.4, background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 60%, #000))` }}
      aria-hidden="true"
    >
      {initials || '?'}
    </span>
  )
}

// Monogram badge in the subject's color: "מ" for מתמטיקה, "P" for Physics.
export function SubjectIcon({ name = '', size = 'md' }) {
  if (size === 'xs') return <span className="subject-dot" style={{ '--hue': subjectHue(name) }} aria-hidden="true" />
  return (
    <span className="subject-icon" style={{ '--hue': subjectHue(name) }} aria-hidden="true">
      {name.trim()[0] ?? '?'}
    </span>
  )
}

// Numbered pager with a window of pages around the current one.
export function Pager({ page, totalPages, onChange, disabled }) {
  if (totalPages <= 1) return null

  const pages = new Set([1, totalPages, page - 1, page, page + 1])
  const visible = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b)

  const items = []
  visible.forEach((p, i) => {
    if (i > 0 && p - visible[i - 1] > 1) items.push(<span key={`gap-${p}`} className="pager-gap">…</span>)
    items.push(
      <button
        key={p}
        className={`pager-btn ${p === page ? 'is-active' : ''}`}
        onClick={() => onChange(p)}
        disabled={disabled}
        aria-current={p === page ? 'page' : undefined}
      >
        {p}
      </button>
    )
  })

  return (
    <nav className="pager" aria-label="עמודים">
      <button className="pager-btn" disabled={disabled || page <= 1} onClick={() => onChange(page - 1)}>
        הקודם
      </button>
      {items}
      <button className="pager-btn" disabled={disabled || page >= totalPages} onClick={() => onChange(page + 1)}>
        הבא
      </button>
    </nav>
  )
}

export function EmptyState({ title, text, children }) {
  return (
    <div className="empty">
      <div className="empty-icon" aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
          <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
        </svg>
      </div>
      <strong>{title}</strong>
      {text && <p className="muted">{text}</p>}
      {children}
    </div>
  )
}

export function SkeletonCards({ count = 3 }) {
  return (
    <div className="slot-grid">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="slot-card skeleton" aria-hidden="true" />
      ))}
    </div>
  )
}

// Simple line icons (24x24, stroke = currentColor).
const ICON_PATHS = {
  calendar: 'M3 9.5h18M8 2.5v4M16 2.5v4M5.5 4.5h13a2.5 2.5 0 0 1 2.5 2.5v11a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 18V7a2.5 2.5 0 0 1 2.5-2.5Z',
  clock: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  search: 'm21 21-4.3-4.3M17 11a6 6 0 1 1-12 0 6 6 0 0 1 12 0Z',
  users: 'M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM20 20v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 4.15a3.5 3.5 0 0 1 0 6.7',
}

export function Icon({ name, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICON_PATHS[name]} />
    </svg>
  )
}

export function Stat({ label, value, hint, icon, tone = 'default', children }) {
  return (
    <div className={`stat stat-${tone}`}>
      {icon && (
        <span className="stat-icon">
          <Icon name={icon} />
        </span>
      )}
      <div className="stat-body">
        <span className="stat-label">{label}</span>
        <span className={`stat-value ${String(value).length > 8 ? 'stat-value-long' : ''}`}>{value}</span>
        {hint && <span className="stat-hint">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

export function ProgressRing({ percent, size = 52, stroke = 6 }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <svg className="ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${percent}%`}>
      <circle className="ring-track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" />
      <circle
        className="ring-value"
        cx={size / 2}
        cy={size / 2}
        r={r}
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - Math.min(100, Math.max(0, percent)) / 100)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="ring-text">
        {percent}%
      </text>
    </svg>
  )
}

function plural(n, one, two, many) {
  if (n === 1) return one
  if (n === 2 && two) return two
  return `${n} ${many}`
}

// Time left until the lesson, in words. Updates every 20 seconds on its own,
// so the rest of the page doesn't re-render.
export function Countdown({ to }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 20000)
    return () => clearInterval(timer)
  }, [])

  const minutes = Math.max(0, Math.round((new Date(to) - now) / 60000))
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  const mins = minutes % 60

  let text
  if (minutes === 0) text = 'מתחיל עכשיו'
  else if (days > 0) text = [plural(days, 'יום', 'יומיים', 'ימים'), hours && plural(hours, 'שעה', 'שעתיים', 'שעות')].filter(Boolean).join(' ו-')
  else if (hours > 0) text = [plural(hours, 'שעה', 'שעתיים', 'שעות'), mins && `${mins} דק׳`].filter(Boolean).join(' ו-')
  else text = `${mins} דק׳`

  return (
    <div className="countdown" role="timer">
      <span className="countdown-label">מתחיל בעוד</span>
      <span className="countdown-value">{text}</span>
    </div>
  )
}
