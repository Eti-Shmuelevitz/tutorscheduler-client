import { useState } from 'react'
import { addDays, formatRange, formatShortDay, isSameDay, minutesBetween, formatDuration, startOfWeek, toDate } from '../format'
import { subjectStyle } from '../subjects'

// Agenda-style week view: one column per day (Sunday first), lessons stacked
// in time order. Pure client-side - it only re-arranges data already loaded.
// Opens on the current week, unless it's empty and something is coming up -
// then on the week of the next event (e.g. on a Saturday evening).
function initialWeek(events) {
  const thisWeek = startOfWeek(new Date())
  const nextWeek = addDays(thisWeek, 7)
  const hasThisWeek = events.some((e) => toDate(e.start) >= thisWeek && toDate(e.start) < nextWeek)
  if (hasThisWeek) return thisWeek
  const next = events.filter((e) => toDate(e.start) >= new Date()).sort((a, b) => toDate(a.start) - toDate(b.start))[0]
  return next ? startOfWeek(next.start) : thisWeek
}

const TONE_LABELS = { booked: 'הוזמן', available: 'פנוי' }

export default function WeekCalendar({ events, emptyText = 'אין שיעורים בשבוע הזה.', onDayClick, dayClickLabel }) {
  const [weekStart, setWeekStart] = useState(() => initialWeek(events))
  const today = new Date()
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const weekEnd = addDays(weekStart, 7)

  const inWeek = events
    .filter((e) => toDate(e.start) >= weekStart && toDate(e.start) < weekEnd)
    .sort((a, b) => toDate(a.start) - toDate(b.start))

  const weekMinutes = inWeek.reduce((sum, e) => sum + minutesBetween(e.start, e.end), 0)
  const isCurrentWeek = isSameDay(weekStart, startOfWeek(today))
  const todayStart = new Date(today)
  todayStart.setHours(0, 0, 0, 0)

  return (
    <div className="week">
      <div className="week-toolbar">
        <button className="btn btn-ghost btn-sm" onClick={() => setWeekStart((w) => addDays(w, -7))} aria-label="שבוע קודם">
          → שבוע קודם
        </button>
        <div className="week-title">
          <strong>
            {formatShortDay(weekStart)} – {formatShortDay(addDays(weekStart, 6))}
          </strong>
          <span className="muted small">
            {inWeek.length ? `${inWeek.length} שיעורים · ${formatDuration(weekMinutes)}` : 'שבוע פנוי'}
          </span>
        </div>
        <div className="actions">
          {!isCurrentWeek && (
            <button className="btn btn-ghost btn-sm" onClick={() => setWeekStart(startOfWeek(new Date()))}>
              היום
            </button>
          )}
          <button className="btn btn-ghost btn-sm no-print" onClick={() => window.print()} title="הדפסת הלוח">
            הדפסה
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setWeekStart((w) => addDays(w, 7))} aria-label="שבוע הבא">
            שבוע הבא ←
          </button>
        </div>
      </div>

      {inWeek.length === 0 && <p className="muted week-empty">{emptyText}</p>}

      <div className="week-grid">
        {days.map((day) => {
          const dayEvents = inWeek.filter((e) => isSameDay(e.start, day))
          const isPastDay = day < todayStart
          const canAdd = onDayClick && !isPastDay
          return (
            <div
              key={day.toISOString()}
              className={['week-day', isSameDay(day, today) && 'is-today', isPastDay && 'is-past'].filter(Boolean).join(' ')}
            >
              <div className="week-day-head">
                <span>{formatShortDay(day)}</span>
                {dayEvents.length > 0 && <span className="week-day-count">{dayEvents.length}</span>}
              </div>
              {dayEvents.map((e) => (
                <div
                  key={e.id}
                  className={`event event-${e.tone ?? 'default'}`}
                  style={e.subject ? subjectStyle(e.subject) : undefined}
                  title={[e.title, e.subtitle].filter(Boolean).join(' · ')}
                >
                  <span className="event-time">{formatRange(e.start, e.end)}</span>
                  <span className="event-title">{e.title}</span>
                  {e.subtitle && <span className="event-sub">{e.subtitle}</span>}
                  {TONE_LABELS[e.tone] && <span className={`event-tag event-tag-${e.tone}`}>{TONE_LABELS[e.tone]}</span>}
                </div>
              ))}
              {canAdd && (
                <button className="week-add no-print" onClick={() => onDayClick(day)} title={dayClickLabel}>
                  +
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
