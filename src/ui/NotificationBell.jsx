import { useEffect, useRef, useState } from 'react'
import { formatRelative } from '../format'
import { notificationText, useNotifications } from './notifications-context'

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  )
}

// Top-bar bell with an unread badge and a dropdown of recent notifications.
export default function NotificationBell() {
  const { items, unreadCount, markRead, markAllRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="bell" ref={rootRef}>
      <button
        className="btn btn-ghost btn-icon bell-button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={unreadCount ? `הודעות, ${unreadCount} חדשות` : 'הודעות'}
        title="הודעות"
      >
        <BellIcon />
        {unreadCount > 0 && <span className="bell-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>

      {open && (
        <div className="bell-panel" role="dialog" aria-label="הודעות">
          <div className="bell-panel-head">
            <strong>הודעות</strong>
            {unreadCount > 0 && (
              <button className="link-button" onClick={markAllRead}>
                סימון הכל כנקרא
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="muted bell-empty">אין הודעות עדיין.</p>
          ) : (
            <ul className="bell-list">
              {items.map((n) => (
                <li key={n.id} className={`bell-item ${n.isRead ? '' : 'is-unread'}`}>
                  <div className="bell-item-body">
                    <span>{notificationText(n)}</span>
                    {n.reason && <span className="notice-reason">{n.reason}</span>}
                    <span className="muted small">{formatRelative(n.createdAtUtc)}</span>
                  </div>
                  {!n.isRead && (
                    <button className="link-button" onClick={() => markRead(n.id)}>
                      סימון כנקרא
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
