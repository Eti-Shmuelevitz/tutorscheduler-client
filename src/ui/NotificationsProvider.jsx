import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { notificationsApi } from '../api'
import { NotificationsContext } from './notifications-context'
import { useToast } from './feedback-context'

const POLL_EVERY_MS = 30000

// Loads the signed-in user's notifications and polls for new ones while the
// tab is visible. Shared by the top-bar bell and the student's personal area.
export default function NotificationsProvider({ children }) {
  const toast = useToast()
  const [items, setItems] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [version, setVersion] = useState(0)
  const knownUnread = useRef(null) // null until the first load

  const refresh = useCallback(
    () =>
      Promise.all([notificationsApi.listMine(1, 30), notificationsApi.unreadCount()])
        .then(([list, unread]) => {
          setItems(list.items)
          setUnreadCount(unread.count)
          // Only announce what arrived *while* the page was open - on first
          // load the unread items are already shown in the personal area.
          if (knownUnread.current !== null && unread.count > knownUnread.current) {
            toast({ title: 'הודעה חדשה', text: 'מורה ביטל/ה שיעור שהזמנת. הפרטים באזור האישי.', kind: 'info' })
            setVersion((v) => v + 1)
          }
          knownUnread.current = unread.count
        })
        .catch(() => {
          // The connection banner already reports an unreachable server.
        }),
    [toast]
  )

  useEffect(() => {
    refresh()
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') refresh()
    }, POLL_EVERY_MS)
    return () => clearInterval(timer)
  }, [refresh])

  const markRead = useCallback(async (id) => {
    // Optimistic: the item fades to "read" at once; a failed call is corrected
    // by the next refresh.
    setItems((list) => list.map((n) => (n.id === id ? { ...n, isRead: true } : n)))
    setUnreadCount((c) => Math.max(0, c - 1))
    knownUnread.current = Math.max(0, (knownUnread.current ?? 1) - 1)
    try {
      await notificationsApi.markRead(id)
    } catch {
      refresh()
    }
  }, [refresh])

  const markAllRead = useCallback(async () => {
    setItems((list) => list.map((n) => ({ ...n, isRead: true })))
    setUnreadCount(0)
    knownUnread.current = 0
    try {
      await notificationsApi.markAllRead()
    } catch {
      refresh()
    }
  }, [refresh])

  const value = useMemo(
    () => ({ items, unreadCount, version, refresh, markRead, markAllRead }),
    [items, unreadCount, version, refresh, markRead, markAllRead]
  )

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
}
