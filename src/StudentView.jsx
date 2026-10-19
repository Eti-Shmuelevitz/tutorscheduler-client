import { useCallback, useEffect, useMemo, useState } from 'react'
import { lessonSlotsApi, bookingsApi, subjectsApi, ApiError } from './api'
import {
  firstName,
  formatDay,
  formatDuration,
  formatPrice,
  formatRange,
  formatRelative,
  greeting,
  minutesBetween,
  overlaps,
  addDays,
  toDate,
} from './format'
import { subjectStyle } from './subjects'
import { useConfirm, useToast } from './ui/feedback-context'
import { Avatar, Countdown, EmptyState, Pager, SkeletonCards, Stat, SubjectIcon } from './ui/bits'
import WeekCalendar from './ui/WeekCalendar'
import { notificationText, useNotifications } from './ui/notifications-context'

const PAGE_SIZE = 6
const ALL_PAGE_SIZE = 200 // server maximum; used for derived views (calendar, overlap hints)
const REFRESH_EVERY_MS = 30000

// Favorite tutors live in this browser only (per user) - no server change needed.
function favoritesKey(user) {
  return `tutorscheduler_favorites_${user?.email ?? 'anon'}`
}

function readFavorites(user) {
  try {
    const parsed = JSON.parse(localStorage.getItem(favoritesKey(user)) ?? '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export default function StudentView({ user }) {
  const toast = useToast()
  const confirm = useConfirm()
  const { items: notifications, version: notificationsVersion, markRead, markAllRead } = useNotifications()
  const unreadNotifications = notifications.filter((n) => !n.isRead)

  const [tab, setTab] = useState('available') // 'available' | 'calendar' | 'mine'
  const [now, setNow] = useState(() => new Date())

  // --- available slots: real server-side pagination + filters + sort
  const [page, setPage] = useState(1)
  const [subjectFilter, setSubjectFilter] = useState('')
  const [tutorFilter, setTutorFilter] = useState('')
  const [sortDescending, setSortDescending] = useState(false)
  const [slots, setSlots] = useState({ items: [], totalCount: 0 })
  const [loadedKey, setLoadedKey] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)
  const queryKey = `${page}|${subjectFilter}|${tutorFilter}|${sortDescending}`
  const loading = loadedKey !== queryKey

  const [subjects, setSubjects] = useState([])
  const [tutorOptions, setTutorOptions] = useState([])
  const [bookings, setBookings] = useState([])
  const [favorites, setFavorites] = useState(() => readFavorites(user))

  const [selectedIds, setSelectedIds] = useState(new Set())
  const [bookingIds, setBookingIds] = useState(new Set())
  const [takenIds, setTakenIds] = useState(new Set()) // slots that just answered 409
  const [bulkBooking, setBulkBooking] = useState(false)
  const [historyTab, setHistoryTab] = useState('upcoming') // 'upcoming' | 'history'

  const fetchSlots = useCallback(
    () =>
      lessonSlotsApi
        .listAvailable(page, PAGE_SIZE, {
          subjectId: subjectFilter || undefined,
          tutorId: tutorFilter || undefined,
          sortDescending,
        })
        .then((result) => {
          setSlots(result)
          setLoadedKey(queryKey)
          setLastUpdated(new Date())
        })
        .catch((err) => {
          setLoadedKey(queryKey)
          toast({ text: err.message, kind: 'error' })
        }),
    [page, subjectFilter, tutorFilter, sortDescending, queryKey, toast]
  )

  const fetchBookings = useCallback(
    () =>
      bookingsApi
        .listMine(1, ALL_PAGE_SIZE)
        .then((result) => setBookings(result.items))
        .catch((err) => toast({ text: err.message, kind: 'error' })),
    [toast]
  )

  useEffect(() => {
    fetchSlots()
  }, [fetchSlots])

  useEffect(() => {
    fetchBookings()
    subjectsApi
      .list()
      .then(setSubjects)
      .catch(() => {})
    // No "list tutors" endpoint: derive the options from whoever has an open slot.
    lessonSlotsApi
      .listAvailable(1, ALL_PAGE_SIZE)
      .then((result) => {
        const byId = new Map(result.items.map((s) => [s.tutorId, s.tutorName]))
        setTutorOptions(Array.from(byId, ([id, name]) => ({ id, name })))
      })
      .catch(() => {})
  }, [fetchBookings])

  // Keep the list fresh while the tab is visible, so a slot someone else
  // just took disappears without a manual reload.
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date())
      if (document.visibilityState === 'visible') fetchSlots()
    }, REFRESH_EVERY_MS)
    return () => clearInterval(timer)
  }, [fetchSlots])

  // A new notification means a tutor cancelled one of our lessons: reload so
  // it moves from "upcoming" to history right away.
  useEffect(() => {
    if (notificationsVersion > 0) fetchBookings()
  }, [notificationsVersion, fetchBookings])

  useEffect(() => {
    try {
      localStorage.setItem(favoritesKey(user), JSON.stringify(favorites))
    } catch {
      // ignore
    }
  }, [favorites, user])

  // --- derived data
  const activeBookings = useMemo(() => bookings.filter((b) => b.status === 'Active'), [bookings])
  const upcoming = useMemo(
    () => activeBookings.filter((b) => toDate(b.endTimeUtc) > now).sort((a, b) => toDate(a.startTimeUtc) - toDate(b.startTimeUtc)),
    [activeBookings, now]
  )
  const history = useMemo(
    () =>
      bookings
        .filter((b) => b.status !== 'Active' || toDate(b.endTimeUtc) <= now)
        .sort((a, b) => toDate(b.startTimeUtc) - toDate(a.startTimeUtc)),
    [bookings, now]
  )
  const nextLesson = upcoming[0]
  const completedCount = activeBookings.filter((b) => toDate(b.endTimeUtc) <= now).length

  // Rolling 7 days rather than the calendar week: on a Saturday, "this week"
  // would otherwise always read as empty.
  const minutesNext7Days = upcoming
    .filter((b) => toDate(b.startTimeUtc) < addDays(now, 7))
    .reduce((sum, b) => sum + minutesBetween(b.startTimeUtc, b.endTimeUtc), 0)

  // Mirrors the server rule client-side, so the student sees *why* before clicking.
  // The server still enforces it - this is a hint, not the check.
  function conflictFor(slot) {
    return upcoming.find((b) => overlaps(slot.startTimeUtc, slot.endTimeUtc, b.startTimeUtc, b.endTimeUtc))
  }

  const totalPages = Math.max(1, Math.ceil(slots.totalCount / PAGE_SIZE))
  const bookableOnPage = slots.items.filter((s) => !conflictFor(s)).map((s) => s.id)
  const allOnPageSelected = bookableOnPage.length > 0 && bookableOnPage.every((id) => selectedIds.has(id))
  const isFavorite = (tutorId) => favorites.some((f) => f.id === tutorId)

  function changeFilter(setter) {
    return (e) => {
      setter(e.target.value)
      setPage(1)
    }
  }

  function toggleFavorite(slot) {
    setFavorites((prev) =>
      prev.some((f) => f.id === slot.tutorId) ? prev.filter((f) => f.id !== slot.tutorId) : [...prev, { id: slot.tutorId, name: slot.tutorName }]
    )
  }

  function filterByTutor(tutorId) {
    setTutorFilter((current) => (String(current) === String(tutorId) ? '' : String(tutorId)))
    setPage(1)
  }

  function toggleSelected(slotId) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(slotId)) next.delete(slotId)
      else next.add(slotId)
      return next
    })
  }

  function toggleSelectAllOnPage() {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      bookableOnPage.forEach((id) => (allOnPageSelected ? next.delete(id) : next.add(id)))
      return next
    })
  }

  function flashTaken(slotId) {
    setTakenIds((prev) => new Set(prev).add(slotId))
    setTimeout(() => {
      setTakenIds((prev) => {
        const next = new Set(prev)
        next.delete(slotId)
        return next
      })
      fetchSlots()
    }, 1600)
  }

  async function handleBook(slot) {
    // Guards against a flood of duplicate requests from impatient repeat clicks.
    if (bookingIds.has(slot.id)) return

    setBookingIds((prev) => new Set(prev).add(slot.id))
    try {
      await lessonSlotsApi.book(slot.id)
      toast({ text: `${slot.subjectName} עם ${slot.tutorName}, ${formatDay(slot.startTimeUtc)} ${formatRange(slot.startTimeUtc, slot.endTimeUtc)} · ${formatPrice(slot.price)}`, kind: 'success', title: 'השיעור הוזמן' })
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(slot.id)
        return next
      })
      fetchSlots()
      fetchBookings()
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // This is the case the whole project is about: someone else won the race.
        toast({ text: err.message, kind: 'conflict', title: 'השיעור נתפס' })
        flashTaken(slot.id)
      } else {
        toast({ text: err.message, kind: 'error' })
      }
    } finally {
      setBookingIds((prev) => {
        const next = new Set(prev)
        next.delete(slot.id)
        return next
      })
    }
  }

  async function handleBookSelected() {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return

    setBulkBooking(true)
    let successCount = 0
    let conflictCount = 0
    const otherErrors = []

    // Sequential on purpose: parallel bookings by the same student would race
    // each other on the server's per-student schedule check.
    for (const id of ids) {
      try {
        await lessonSlotsApi.book(id)
        successCount++
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) conflictCount++
        else otherErrors.push(err.message)
      }
    }

    const parts = []
    if (successCount > 0) parts.push(`${successCount} שיעורים הוזמנו`)
    if (conflictCount > 0) parts.push(`${conflictCount} כבר נתפסו על ידי מישהו אחר`)
    if (otherErrors.length > 0) parts.push(`${otherErrors.length} נכשלו: ${[...new Set(otherErrors)].join(' ')}`)

    toast({
      text: parts.join(' · '),
      kind: conflictCount > 0 ? 'conflict' : otherErrors.length > 0 ? 'error' : 'success',
      title: 'הזמנה מרובה',
    })
    setSelectedIds(new Set())
    setBulkBooking(false)
    fetchSlots()
    fetchBookings()
  }

  // "Undo" simply books the same slot again. If someone grabbed it in the
  // seconds since, the server answers 409 like any other race.
  async function undoCancel(booking) {
    try {
      await lessonSlotsApi.book(booking.lessonSlotId)
      toast({ text: `${booking.subjectName} חזר ללוח שלך.`, kind: 'success', title: 'ההזמנה שוחזרה' })
    } catch (err) {
      toast({ text: err.message, kind: err.status === 409 ? 'conflict' : 'error', title: 'לא ניתן לשחזר' })
    } finally {
      fetchBookings()
      fetchSlots()
    }
  }

  async function handleCancel(booking) {
    const ok = await confirm({
      title: 'לבטל את ההזמנה?',
      text: `${booking.subjectName} עם ${booking.tutorName}, ${formatDay(booking.startTimeUtc)} ${formatRange(booking.startTimeUtc, booking.endTimeUtc)}. השיעור יחזור להיות פנוי לתלמידים אחרים.`,
      confirmText: 'ביטול ההזמנה',
      cancelText: 'השארה',
      danger: true,
    })
    if (!ok) return

    try {
      await bookingsApi.cancel(booking.id)
      toast({
        text: 'ההזמנה בוטלה והשיעור שוחרר.',
        kind: 'success',
        action: toDate(booking.startTimeUtc) > new Date() ? { label: 'ביטול הפעולה', onClick: () => undoCancel(booking) } : undefined,
      })
      fetchBookings()
      fetchSlots()
    } catch (err) {
      toast({ text: err.message, kind: 'error' })
    }
  }

  const calendarEvents = upcoming.map((b) => ({
    id: b.id,
    start: b.startTimeUtc,
    end: b.endTimeUtc,
    title: b.subjectName,
    subject: b.subjectName,
    subtitle: `עם ${b.tutorName}`,
    tone: 'mine',
  }))

  const hasFilter = Boolean(subjectFilter || tutorFilter)

  return (
    <div className="stack">
      {unreadNotifications.length > 0 && (
        <section className="notice-card reveal" aria-live="polite">
          <div className="notice-head">
            <strong>
              {unreadNotifications.length === 1 ? 'הודעה חדשה' : `${unreadNotifications.length} הודעות חדשות`}
            </strong>
            {unreadNotifications.length > 1 && (
              <button className="link-button" onClick={markAllRead}>
                סימון הכל כנקרא
              </button>
            )}
          </div>
          <ul className="notice-list">
            {unreadNotifications.map((n) => (
              <li key={n.id} className="notice-item" style={subjectStyle(n.subjectName)}>
                <SubjectIcon name={n.subjectName} />
                <div className="notice-body">
                  <span>{notificationText(n)}</span>
                  {n.reason && <span className="notice-reason">{n.reason}</span>}
                  <span className="muted small">{formatRelative(n.createdAtUtc, now)}</span>
                </div>
                <div className="notice-actions">
                  <button
                    className="btn btn-sm"
                    onClick={() => {
                      const subject = subjects.find((s) => s.name === n.subjectName)
                      setSubjectFilter(subject ? String(subject.id) : '')
                      setPage(1)
                      setTab('available')
                      markRead(n.id)
                    }}
                  >
                    מציאת שיעור חלופי
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => markRead(n.id)}>
                    הבנתי
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="hero-card">
        <div className="hero-main">
          <span className="hero-eyebrow">
            {greeting(now)}, {firstName(user?.fullName)}
          </span>
          {nextLesson ? (
            <>
              <h2>
                השיעור הבא: {nextLesson.subjectName} עם {nextLesson.tutorName}
              </h2>
              <p>
                {formatDay(nextLesson.startTimeUtc)} · {formatRange(nextLesson.startTimeUtc, nextLesson.endTimeUtc)}
              </p>
            </>
          ) : (
            <>
              <h2>אין לך שיעורים קרובים</h2>
              <p>בחרו שעה פנויה מהרשימה כדי להזמין שיעור.</p>
            </>
          )}
        </div>
        {nextLesson && (
          <div className="hero-side">
            <Countdown to={nextLesson.startTimeUtc} />
            <button className="btn btn-on-hero btn-sm" onClick={() => setTab('calendar')}>
              ללוח השבועי
            </button>
          </div>
        )}
      </section>

      <div className="stats">
        <Stat icon="calendar" label="שיעורים קרובים" value={upcoming.length} hint={completedCount ? `${completedCount} כבר הושלמו` : undefined} tone="primary" />
        <Stat icon="clock" label="7 הימים הקרובים" value={minutesNext7Days ? formatDuration(minutesNext7Days) : '—'} hint="זמן לימוד מתוכנן" tone="teal" />
        <Stat icon="search" label="שיעורים פנויים" value={slots.totalCount} hint={hasFilter ? 'לפי הסינון' : 'בכל המקצועות'} tone="amber" />
      </div>

      <div className="tabs tabs-lg" role="tablist">
        {[
          { id: 'available', label: 'שיעורים פנויים', count: slots.totalCount },
          { id: 'calendar', label: 'לוח שבועי' },
          { id: 'mine', label: 'ההזמנות שלי', count: upcoming.length },
        ].map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={`tab ${tab === t.id ? 'is-active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
            {t.count !== undefined && <span className="tab-count">{t.count}</span>}
          </button>
        ))}
      </div>

      {tab === 'available' && (
        <section className="card reveal">
          {subjects.length > 0 && (
            <div className="subject-chips" role="group" aria-label="סינון לפי מקצוע">
              <button className={`chip ${!subjectFilter ? 'is-active' : ''}`} onClick={() => changeFilter(setSubjectFilter)({ target: { value: '' } })}>
                הכל
              </button>
              {subjects.map((s) => (
                <button
                  key={s.id}
                  className={`chip chip-subject ${String(subjectFilter) === String(s.id) ? 'is-active' : ''}`}
                  style={subjectStyle(s.name)}
                  onClick={() => changeFilter(setSubjectFilter)({ target: { value: String(subjectFilter) === String(s.id) ? '' : String(s.id) } })}
                >
                  <SubjectIcon name={s.name} size="xs" />
                  {s.name}
                </button>
              ))}
            </div>
          )}

          <div className="toolbar">
            <label className="field field-inline">
              <span>מורה</span>
              <select className="input" value={tutorFilter} onChange={changeFilter(setTutorFilter)}>
                <option value="">הכל</option>
                {tutorOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {isFavorite(t.id) ? '★ ' : ''}
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field field-inline">
              <span>מיון</span>
              <select
                className="input"
                value={sortDescending ? 'desc' : 'asc'}
                onChange={(e) => {
                  setSortDescending(e.target.value === 'desc')
                  setPage(1)
                }}
              >
                <option value="asc">הקרובים קודם</option>
                <option value="desc">הרחוקים קודם</option>
              </select>
            </label>
            <div className="toolbar-end">
              {lastUpdated && (
                <span className="live-dot muted small" title="הרשימה מתרעננת כל 30 שניות">
                  עודכן {formatRelative(lastUpdated, now)}
                </span>
              )}
              <button className="btn btn-ghost btn-sm" onClick={fetchSlots} title="רענון">
                ↻ רענון
              </button>
            </div>
          </div>

          {favorites.length > 0 && (
            <div className="favorites-bar">
              <span className="muted small">המורים שלי:</span>
              {favorites.map((f) => (
                <button key={f.id} className={`chip chip-sm ${String(tutorFilter) === String(f.id) ? 'is-active' : ''}`} onClick={() => filterByTutor(f.id)}>
                  <Avatar name={f.name} size={18} />
                  {f.name}
                </button>
              ))}
            </div>
          )}

          {loading ? (
            <SkeletonCards count={PAGE_SIZE} />
          ) : slots.items.length === 0 ? (
            <EmptyState title="אין שיעורים פנויים" text={hasFilter ? 'נסו לשנות את הסינון.' : 'כשמורה יפרסם שעה פנויה היא תופיע כאן.'}>
              {hasFilter && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setSubjectFilter('')
                    setTutorFilter('')
                    setPage(1)
                  }}
                >
                  ניקוי סינון
                </button>
              )}
            </EmptyState>
          ) : (
            <>
              <div className="select-bar">
                <label className="checkbox">
                  <input type="checkbox" checked={allOnPageSelected} onChange={toggleSelectAllOnPage} disabled={bookableOnPage.length === 0} />
                  <span>בחירת כל העמוד</span>
                </label>
                {selectedIds.size > 0 && (
                  <button className="btn btn-primary btn-sm pop-in" disabled={bulkBooking} onClick={handleBookSelected}>
                    {bulkBooking ? 'מזמין…' : `הזמנת ${selectedIds.size} שנבחרו`}
                  </button>
                )}
              </div>

              <div className="slot-grid">
                {slots.items.map((slot, index) => {
                  const conflict = conflictFor(slot)
                  const isBooking = bookingIds.has(slot.id)
                  const isTaken = takenIds.has(slot.id)
                  const favorite = isFavorite(slot.tutorId)
                  const start = toDate(slot.startTimeUtc)
                  const startsSoon = start - now < 24 * 60 * 60 * 1000
                  return (
                    <article
                      key={slot.id}
                      style={{ ...subjectStyle(slot.subjectName), '--i': index }}
                      className={['slot-card', 'subject-tinted', 'reveal', selectedIds.has(slot.id) && 'is-selected', conflict && 'is-conflict', isTaken && 'is-taken']
                        .filter(Boolean)
                        .join(' ')}
                    >
                      <div className="slot-head">
                        <div className="date-pill">
                          <span className="date-pill-day">{start.getDate()}</span>
                          <span className="date-pill-month">{start.toLocaleDateString('he-IL', { month: 'short' })}</span>
                        </div>
                        <div className="slot-title">
                          <strong>{slot.subjectName}</strong>
                          <span className="slot-tutor">
                            <Avatar name={slot.tutorName} size={22} />
                            {slot.tutorName}
                            <button
                              className={`star ${favorite ? 'is-on' : ''}`}
                              onClick={() => toggleFavorite(slot)}
                              aria-pressed={favorite}
                              title={favorite ? 'הסרה מהמורים שלי' : 'הוספה למורים שלי'}
                            >
                              {favorite ? '★' : '☆'}
                            </button>
                          </span>
                        </div>
                        <label className="checkbox slot-check" title={conflict ? 'חופף לשיעור שלך' : 'בחירה להזמנה מרובה'}>
                          <input type="checkbox" checked={selectedIds.has(slot.id)} onChange={() => toggleSelected(slot.id)} disabled={!!conflict} />
                        </label>
                      </div>

                      <div className="slot-meta">
                        <span>{start.toLocaleDateString('he-IL', { weekday: 'long' })}</span>
                        <span className="dot" />
                        <span dir="ltr">{formatRange(slot.startTimeUtc, slot.endTimeUtc)}</span>
                        <span className="dot" />
                        <span>{formatDuration(minutesBetween(slot.startTimeUtc, slot.endTimeUtc))}</span>
                        <span className="dot" />
                        <strong>{formatPrice(slot.price)}</strong>
                      </div>

                      <div className="slot-foot">
                        {isTaken ? (
                          <span className="badge badge-conflict">נתפס הרגע</span>
                        ) : conflict ? (
                          <span className="badge badge-warn" title={`${conflict.subjectName} ${formatRange(conflict.startTimeUtc, conflict.endTimeUtc)}`}>
                            חופף ל{conflict.subjectName} שלך
                          </span>
                        ) : startsSoon ? (
                          <span className="badge badge-hot">{formatRelative(slot.startTimeUtc, now)}</span>
                        ) : (
                          <span className="muted small">{formatRelative(slot.startTimeUtc, now)}</span>
                        )}
                        <button className="btn btn-primary btn-sm" disabled={isBooking || bulkBooking || isTaken || !!conflict} onClick={() => handleBook(slot)}>
                          {isBooking ? <span className="spinner" aria-label="מזמין" /> : 'הזמנה'}
                        </button>
                      </div>
                    </article>
                  )
                })}
              </div>
            </>
          )}

          <Pager page={page} totalPages={totalPages} onChange={setPage} disabled={loading} />
        </section>
      )}

      {tab === 'calendar' && (
        <section className="card reveal">
          <WeekCalendar events={calendarEvents} emptyText="אין לך שיעורים בשבוע הזה." />
        </section>
      )}

      {tab === 'mine' && (
        <section className="card reveal">
          <div className="toolbar">
            <div className="segmented">
              <button className={historyTab === 'upcoming' ? 'is-active' : ''} onClick={() => setHistoryTab('upcoming')}>
                קרובים ({upcoming.length})
              </button>
              <button className={historyTab === 'history' ? 'is-active' : ''} onClick={() => setHistoryTab('history')}>
                היסטוריה ({history.length})
              </button>
            </div>
          </div>

          {(historyTab === 'upcoming' ? upcoming : history).length === 0 ? (
            <EmptyState
              title={historyTab === 'upcoming' ? 'אין הזמנות קרובות' : 'אין עדיין היסטוריה'}
              text={historyTab === 'upcoming' ? 'שיעורים שתזמינו יופיעו כאן.' : 'שיעורים שהסתיימו או בוטלו יופיעו כאן.'}
            >
              {historyTab === 'upcoming' && (
                <button className="btn btn-primary btn-sm" onClick={() => setTab('available')}>
                  לשיעורים הפנויים
                </button>
              )}
            </EmptyState>
          ) : (
            <ul className="booking-list">
              {(historyTab === 'upcoming' ? upcoming : history).map((b, index) => {
                const cancelled = b.status !== 'Active'
                return (
                  <li
                    key={b.id}
                    style={{ ...subjectStyle(b.subjectName), '--i': index }}
                    className={`booking-row subject-tinted reveal ${cancelled ? 'is-cancelled' : ''}`}
                  >
                    <SubjectIcon name={b.subjectName} />
                    <div className="booking-main">
                      <strong>
                        {b.subjectName} <span className="muted">עם {b.tutorName}</span>
                      </strong>
                      <span className="muted small">
                        {formatDay(b.startTimeUtc)} · <span dir="ltr">{formatRange(b.startTimeUtc, b.endTimeUtc)}</span> · {formatPrice(b.price)}
                      </span>
                    </div>
                    <div className="booking-side">
                      {b.status === 'CancelledByTutor' ? (
                        <span className="badge badge-warn">בוטל ע״י המורה</span>
                      ) : cancelled ? (
                        <span className="badge badge-muted">בוטל</span>
                      ) : historyTab === 'history' ? (
                        <span className="badge badge-muted">הושלם</span>
                      ) : (
                        <>
                          <span className="badge badge-success">{formatRelative(b.startTimeUtc, now)}</span>
                          <button className="btn btn-danger btn-sm" onClick={() => handleCancel(b)}>
                            ביטול
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
