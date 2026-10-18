import { createContext, useContext } from 'react'
import { formatDay, formatRange } from '../format'

// Kept apart from NotificationsProvider.jsx so that file only exports a
// component (keeps React Fast Refresh working).
export const NotificationsContext = createContext(null)

// { items, unreadCount, version, refresh, markRead, markAllRead }
// `version` goes up whenever a new notification arrives, so views can reload
// data the notification is about (e.g. the student's bookings).
export function useNotifications() {
  return useContext(NotificationsContext)
}

export function notificationText(n) {
  return `${n.tutorName} ביטל/ה את שיעור ה${n.subjectName} שנקבע ל${formatDay(n.startTimeUtc)}, ${formatRange(n.startTimeUtc, n.endTimeUtc)}.`
}
