import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { lessonSlotsApi, subjectsApi } from './api'
import { slotStatusLabels } from './labels'
import {
  addDays,
  firstName,
  formatDay,
  formatDuration,
  formatRange,
  formatRelative,
  formatShortDay,
  greeting,
  isSameDay,
  minutesBetween,
  overlaps,
  toDate,
  toDateInputValue,
} from './format'
import { subjectStyle } from './subjects'
import { useConfirm, usePrompt, useToast } from './ui/feedback-context'
import { Avatar, Countdown, EmptyState, Pager, ProgressRing, Stat, SubjectIcon } from './ui/bits'
import WeekCalendar from './ui/WeekCalendar'

const ALL_PAGE_SIZE = 200 // server maximum
const LIST_PAGE_SIZE = 8
const DURATIONS = [30, 45, 60, 90, 120]
const REPEATS = [1, 2, 4, 8]
const CHART_DAYS = 14

const FILTERS = [
  { id: 'upcoming', label: 'קרובים' },
  { id: 'booked', label: 'הוזמנו' },
  { id: 'available', label: 'פנויים' },
  { id: 'past', label: 'עברו' },
  { id: 'cancelled', label: 'בוטלו' },
  { id: 'all', label: 'הכל' },
]

const STATUS_BADGE = { Available: 'badge-info', Booked: 'badge-success', Cancelled: 'badge-muted' }
const STATUS_TONE = { Available: 'available', Booked: 'booked', Cancelled: 'cancelled' }

function combine(date, time) {
  return date && time ? new Date(`${date}T${time}`) : null
}

function addMinutesToTime(time, minutes) {
  if (!time) return ''
  const [h, m] = time.split(':').map(Number)
  const total = Math.min(h * 60 + m + minutes, 23 * 60 + 59)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export default function TutorView({ user }) {
  const toast = useToast()
  const confirm = useConfirm()
  const prompt = usePrompt()
  const [now, setNow] = useState(() => new Date())
  const formRef = useRef(null)

  const [subjects, setSubjects] = useState([])
  const [slots, setSlots] = useState([])
  const [loaded, setLoaded] = useState(false)

  // create form
  const [subjectId, setSubjectId] = useState('')
  const [date, setDate] = useState(() => toDateInputValue(addDays(new Date(), 1)))
  const [startTime, setStartTime] = useState('16:00')
  const [duration, setDuration] = useState(60)
  const [repeatWeeks, setRepeatWeeks] = useState(1)
  const [submitting, setSubmitting] = useState(false)

  // list
  const [view, setView] = useState('list') // 'list' | 'calendar'
  const [filter, setFilter] = useState('upcoming')
  const [listPage, setListPage] = useState(1)
  const [busyIds, setBusyIds] = useState(new Set())

  const loadSlots = useCallback(
    () =>
      lessonSlotsApi
        .listMine(1, ALL_PAGE_SIZE)
        .then((result) => {
          setSlots(result.items)
          setLoaded(true)
        })
        .catch((err) => {
          setLoaded(true)
          toast({ text: err.message, kind: 'error' })
        }),
    [toast]
  )

  useEffect(() => {
    loadSlots()
    subjectsApi
      .list()
      .then((result) => {
        setSubjects(result)
        setSubjectId((current) => current || (result[0] ? String(result[0].id) : ''))
      })
      .catch((err) => toast({ text: err.message, kind: 'error' }))
  }, [loadSlots, toast])

  // Bookings arrive from students at any time - keep the tutor's view current.
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date())
      if (document.visibilityState === 'visible') loadSlots()
    }, 30000)
    return () => clearInterval(timer)
  }, [loadSlots])

  // --- create form derived state
  const endTime = addMinutesToTime(startTime, duration)
  const start = combine(date, startTime)
  const end = combine(date, endTime)
  const liveSlots = useMemo(() => slots.filter((s) => s.status !== 'Cancelled'), [slots])
  const selectedSubject = subjects.find((s) => String(s.id) === String(subjectId))

  let formProblem = null
  if (!start || !end) formProblem = 'יש לבחור תאריך ושעה.'
  else if (end <= start) formProblem = 'השיעור חייב להסתיים באותו יום.'
  else if (start < now) formProblem = 'אי אפשר לפרסם שיעור בזמן שכבר עבר.'

  // Every week the form would publish, with the same overlap rule the server
  // enforces checked up front for each one.
  const occurrences =
    start && end
      ? Array.from({ length: repeatWeeks }, (_, i) => {
          const s = addDays(start, 7 * i)
          const e = addDays(end, 7 * i)
          return { start: s, end: e, clash: liveSlots.find((x) => overlaps(s, e, x.startTimeUtc, x.endTimeUtc)) }
        })
      : []
  const clash = occurrences[0]?.clash
  const clashCount = occurrences.filter((o) => o.clash).length

  async function createSlot(subject, startAt, endAt) {
    return lessonSlotsApi.create(Number(subject), startAt.toISOString(), endAt.toISOString())
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (formProblem || clash) return
    setSubmitting(true)

    if (repeatWeeks === 1) {
      try {
        await createSlot(subjectId, start, end)
        toast({ text: `${formatDay(start)} · ${formatRange(start, end)}`, kind: 'success', title: 'השיעור פורסם' })
        setStartTime(endTime) // next slot starts where this one ended
      } catch (err) {
        toast({ text: err.message, kind: err.status === 409 ? 'conflict' : 'error' })
      } finally {
        setSubmitting(false)
        loadSlots()
      }
      return
    }

    // Recurring: one request per week, sequentially (parallel creates by the
    // same tutor would race each other on the server's overlap check).
    let created = 0
    const skipped = []
    for (const o of occurrences) {
      if (o.clash) {
        skipped.push(formatShortDay(o.start))
        continue
      }
      try {
        await createSlot(subjectId, o.start, o.end)
        created++
      } catch {
        skipped.push(formatShortDay(o.start))
      }
    }
    toast({
      title: 'פרסום חוזר',
      text: [`${created} מתוך ${occurrences.length} שבועות פורסמו`, skipped.length && `דולגו (חפיפה): ${skipped.join(', ')}`].filter(Boolean).join(' · '),
      kind: skipped.length ? (created ? 'conflict' : 'error') : 'success',
    })
    setSubmitting(false)
    loadSlots()
  }

  function prefillDay(day) {
    setDate(toDateInputValue(day))
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function markBusy(id, busy) {
    setBusyIds((prev) => {
      const next = new Set(prev)
      if (busy) next.add(id)
      else next.delete(id)
      return next
    })
  }

  // A booked lesson: the student loses their booking and gets a notification
  // in their personal area, with the (optional) reason written here.
  async function handleCancelBooked(slot) {
    const reason = await prompt({
      title: 'לבטל שיעור שכבר הוזמן?',
      text: `${slot.subjectName} עם ${slot.studentName}, ${formatDay(slot.startTimeUtc)} ${formatRange(slot.startTimeUtc, slot.endTimeUtc)}. ההזמנה תבוטל ו${slot.studentName} יקבל/תקבל הודעה באזור האישי.`,
      input: { label: 'סיבה (תוצג לתלמיד/ה, לא חובה)', placeholder: 'לדוגמה: אני חולה היום, אפשר לקבוע מועד אחר', maxLength: 300 },
      confirmText: 'ביטול השיעור ושליחת הודעה',
      cancelText: 'השארה',
      danger: true,
    })
    if (reason === null) return

    markBusy(slot.id, true)
    try {
      await lessonSlotsApi.cancelByTutor(slot.id, reason)
      toast({ text: `${slot.studentName} יראה/תראה את ההודעה באזור האישי.`, kind: 'success', title: 'השיעור בוטל' })
    } catch (err) {
      toast({ text: err.message, kind: err.status === 409 ? 'conflict' : 'error' })
    } finally {
      markBusy(slot.id, false)
      loadSlots()
    }
  }

  async function handleCancelSlot(slot) {
    if (slot.status === 'Booked') return handleCancelBooked(slot)
    const ok = await confirm({
      title: 'לבטל את השיעור?',
      text: `${slot.subjectName}, ${formatDay(slot.startTimeUtc)} ${formatRange(slot.startTimeUtc, slot.endTimeUtc)}. תלמידים לא יוכלו להזמין אותו יותר.`,
      confirmText: 'ביטול השיעור',
      cancelText: 'השארה',
      danger: true,
    })
    if (!ok) return

    markBusy(slot.id, true)
    try {
      await lessonSlotsApi.cancel(slot.id)
      toast({ text: 'השיעור בוטל.', kind: 'success' })
    } catch (err) {
      // 409 here typically means a student booked it a moment ago.
      toast({ text: err.message, kind: err.status === 409 ? 'conflict' : 'error' })
    } finally {
      markBusy(slot.id, false)
      loadSlots()
    }
  }

  // Re-publish the same hour one week later - common for weekly lessons.
  async function handleDuplicate(slot) {
    const nextStart = addDays(slot.startTimeUtc, 7)
    const nextEnd = addDays(slot.endTimeUtc, 7)
    markBusy(slot.id, true)
    try {
      await createSlot(slot.subjectId, nextStart, nextEnd)
      toast({ text: `${formatDay(nextStart)} · ${formatRange(nextStart, nextEnd)}`, kind: 'success', title: 'שוכפל לשבוע הבא' })
      loadSlots()
    } catch (err) {
      toast({ text: err.message, kind: err.status === 409 ? 'conflict' : 'error' })
    } finally {
      markBusy(slot.id, false)
    }
  }

  // --- stats & list
  const upcomingSlots = liveSlots.filter((s) => toDate(s.endTimeUtc) > now)
  const bookedUpcoming = upcomingSlots.filter((s) => s.status === 'Booked')
  const nextBooked = [...bookedUpcoming].sort((a, b) => toDate(a.startTimeUtc) - toDate(b.startTimeUtc))[0]
  const bookedMinutesNext7Days = bookedUpcoming
    .filter((s) => toDate(s.startTimeUtc) < addDays(now, 7))
    .reduce((sum, s) => sum + minutesBetween(s.startTimeUtc, s.endTimeUtc), 0)
  const fillRate = upcomingSlots.length ? Math.round((bookedUpcoming.length / upcomingSlots.length) * 100) : 0
  const students = new Set(bookedUpcoming.map((s) => s.studentName).filter(Boolean))

  // Load chart: published vs booked hours per day, for the next two weeks.
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const chart = Array.from({ length: CHART_DAYS }, (_, i) => {
    const day = addDays(today, i)
    const daySlots = liveSlots.filter((s) => isSameDay(s.startTimeUtc, day))
    const minutes = (list) => list.reduce((sum, s) => sum + minutesBetween(s.startTimeUtc, s.endTimeUtc), 0)
    return { day, total: minutes(daySlots), booked: minutes(daySlots.filter((s) => s.status === 'Booked')) }
  })
  const chartMax = Math.max(60, ...chart.map((d) => d.total))

  const filtered = slots
    .filter((s) => {
      const isPast = toDate(s.endTimeUtc) <= now
      switch (filter) {
        case 'upcoming':
          return !isPast && s.status !== 'Cancelled'
        case 'booked':
          return !isPast && s.status === 'Booked'
        case 'available':
          return !isPast && s.status === 'Available'
        case 'past':
          return isPast && s.status !== 'Cancelled'
        case 'cancelled':
          return s.status === 'Cancelled'
        default:
          return true
      }
    })
    .sort((a, b) => (filter === 'past' || filter === 'cancelled' ? toDate(b.startTimeUtc) - toDate(a.startTimeUtc) : toDate(a.startTimeUtc) - toDate(b.startTimeUtc)))

  const listTotalPages = Math.max(1, Math.ceil(filtered.length / LIST_PAGE_SIZE))
  const currentListPage = Math.min(listPage, listTotalPages)
  const pageItems = filtered.slice((currentListPage - 1) * LIST_PAGE_SIZE, currentListPage * LIST_PAGE_SIZE)

  const calendarEvents = slots
    .filter((s) => s.status !== 'Cancelled')
    .map((s) => ({
      id: s.id,
      start: s.startTimeUtc,
      end: s.endTimeUtc,
      title: s.subjectName,
      subject: s.subjectName,
      subtitle: s.studentName ? `תלמיד/ה: ${s.studentName}` : undefined,
      tone: STATUS_TONE[s.status],
    }))

  return (
    <div className="stack">
      <section className="hero-card">
        <div className="hero-main">
          <span className="hero-eyebrow">
            {greeting(now)}, {firstName(user?.fullName)}
          </span>
          {nextBooked ? (
            <>
              <h2>
                השיעור הבא: {nextBooked.subjectName} עם {nextBooked.studentName}
              </h2>
              <p>
                {formatDay(nextBooked.startTimeUtc)} · {formatRange(nextBooked.startTimeUtc, nextBooked.endTimeUtc)}
              </p>
            </>
          ) : (
            <>
              <h2>אין הזמנות קרובות</h2>
              <p>{upcomingSlots.length ? `${upcomingSlots.length} שעות פנויות מחכות לתלמידים.` : 'פרסמו שעה פנויה והתלמידים יוכלו להזמין.'}</p>
            </>
          )}
        </div>
        {nextBooked && (
          <div className="hero-side">
            <Countdown to={nextBooked.startTimeUtc} />
          </div>
        )}
      </section>

      <div className="stats">
        <Stat icon="calendar" label="שיעורים קרובים" value={upcomingSlots.length} tone="primary" />
        <Stat label="הוזמנו" value={bookedUpcoming.length} hint="מתוך השיעורים הקרובים" tone="success">
          <ProgressRing percent={fillRate} />
        </Stat>
        <Stat icon="clock" label="7 הימים הקרובים" value={bookedMinutesNext7Days ? formatDuration(bookedMinutesNext7Days) : '—'} hint="שעות הוראה שהוזמנו" tone="teal" />
        <Stat icon="users" label="תלמידים" value={students.size} hint="בשיעורים הקרובים" tone="amber" />
      </div>

      <div className="tutor-grid">
        <section className="card reveal" ref={formRef}>
          <div className="card-header">
            <h3>פרסום שיעור חדש</h3>
          </div>
          <form onSubmit={handleCreate} className="create-form">
            <label className="field">
              <span>מקצוע</span>
              <select className="input" value={subjectId} onChange={(e) => setSubjectId(e.target.value)} required>
                <option value="" disabled>
                  בחירת מקצוע
                </option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>תאריך</span>
              <input className="input" type="date" value={date} min={toDateInputValue(now)} onChange={(e) => setDate(e.target.value)} required />
            </label>
            <label className="field">
              <span>שעת התחלה</span>
              <input className="input" type="time" step={900} value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
            </label>
            <div className="field field-wide">
              <span>משך</span>
              <div className="chips">
                {DURATIONS.map((d) => (
                  <button type="button" key={d} className={`chip ${duration === d ? 'is-active' : ''}`} onClick={() => setDuration(d)}>
                    {formatDuration(d)}
                  </button>
                ))}
              </div>
            </div>
            <div className="field field-wide">
              <span>חזרה שבועית</span>
              <div className="chips">
                {REPEATS.map((r) => (
                  <button type="button" key={r} className={`chip ${repeatWeeks === r ? 'is-active' : ''}`} onClick={() => setRepeatWeeks(r)}>
                    {r === 1 ? 'פעם אחת' : `${r} שבועות`}
                  </button>
                ))}
              </div>
            </div>

            <div className="create-preview field-wide" style={selectedSubject ? subjectStyle(selectedSubject.name) : undefined}>
              {selectedSubject && <SubjectIcon name={selectedSubject.name} />}
              <div className="create-preview-text">
                {formProblem ? (
                  <span className="text-danger">{formProblem}</span>
                ) : clash ? (
                  <span className="text-warn">
                    חופף לשיעור {clash.subjectName} שלך ({formatRange(clash.startTimeUtc, clash.endTimeUtc)}). מורה לא יכול ללמד שני שיעורים בבת אחת.
                  </span>
                ) : (
                  <>
                    <span>
                      <strong>{formatDay(start)}</strong> · <span dir="ltr">{formatRange(start, end)}</span> · {formatDuration(duration)}
                    </span>
                    {repeatWeeks > 1 && (
                      <span className="muted small">
                        ועוד {repeatWeeks - 1} שבועות, עד {formatShortDay(occurrences[occurrences.length - 1].start)}
                        {clashCount > 0 && <span className="text-warn"> · {clashCount} חופפים וידולגו</span>}
                      </span>
                    )}
                  </>
                )}
              </div>
              <button type="submit" className="btn btn-primary" disabled={submitting || !!formProblem || !!clash || !subjectId}>
                {submitting ? <span className="spinner" aria-label="מפרסם" /> : repeatWeeks > 1 ? `פרסום ${repeatWeeks - clashCount} שיעורים` : 'פרסום'}
              </button>
            </div>
          </form>
        </section>

        <section className="card reveal">
          <div className="card-header">
            <h3>העומס בשבועיים הקרובים</h3>
          </div>
          <div className="load-chart" role="img" aria-label="שעות שפורסמו והוזמנו בכל יום">
            {chart.map((d) => (
              <div key={d.day.toISOString()} className={`load-col ${isSameDay(d.day, now) ? 'is-today' : ''}`} title={`${formatShortDay(d.day)}: ${d.total ? `${formatDuration(d.total)} פורסמו, ${d.booked ? formatDuration(d.booked) : 'אף שעה לא'} הוזמנו` : 'אין שיעורים'}`}>
                <div className="load-bar">
                  <span className="load-total" style={{ height: `${(d.total / chartMax) * 100}%` }} />
                  <span className="load-booked" style={{ height: `${(d.booked / chartMax) * 100}%` }} />
                </div>
                <span className="load-label">{d.day.toLocaleDateString('he-IL', { weekday: 'narrow' })}</span>
              </div>
            ))}
          </div>
          <div className="legend">
            <span>
              <i className="legend-swatch legend-booked" /> הוזמן
            </span>
            <span>
              <i className="legend-swatch legend-total" /> פנוי
            </span>
          </div>
        </section>
      </div>

      <section className="card reveal">
        <div className="card-header">
          <h3>השיעורים שלי</h3>
          <div className="segmented">
            <button className={view === 'list' ? 'is-active' : ''} onClick={() => setView('list')}>
              רשימה
            </button>
            <button className={view === 'calendar' ? 'is-active' : ''} onClick={() => setView('calendar')}>
              לוח שבועי
            </button>
          </div>
        </div>

        {view === 'calendar' ? (
          <WeekCalendar events={calendarEvents} emptyText="אין שיעורים בשבוע הזה. לחצו + ביום כדי לפרסם." onDayClick={prefillDay} dayClickLabel="פרסום שיעור ביום הזה" />
        ) : (
          <>
            <div className="chips chips-filter">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  className={`chip ${filter === f.id ? 'is-active' : ''}`}
                  onClick={() => {
                    setFilter(f.id)
                    setListPage(1)
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {!loaded ? (
              <p className="muted">טוען…</p>
            ) : pageItems.length === 0 ? (
              <EmptyState title="אין שיעורים כאן" text={filter === 'upcoming' ? 'פרסמו שעה פנויה בטופס למעלה.' : 'נסו סינון אחר.'} />
            ) : (
              <ul className="booking-list">
                {pageItems.map((slot, index) => {
                  const isPast = toDate(slot.endTimeUtc) <= now
                  const busy = busyIds.has(slot.id)
                  return (
                    <li
                      key={slot.id}
                      style={{ ...subjectStyle(slot.subjectName), '--i': index }}
                      className={`booking-row subject-tinted reveal ${slot.status === 'Cancelled' ? 'is-cancelled' : ''}`}
                    >
                      <SubjectIcon name={slot.subjectName} />
                      <div className="booking-main">
                        <strong>
                          {slot.subjectName}
                          {slot.studentName && (
                            <span className="muted student-inline">
                              {' '}
                              · <Avatar name={slot.studentName} size={18} /> {slot.studentName}
                            </span>
                          )}
                        </strong>
                        <span className="muted small">
                          {formatDay(slot.startTimeUtc)} · <span dir="ltr">{formatRange(slot.startTimeUtc, slot.endTimeUtc)}</span>
                          {!isPast && slot.status !== 'Cancelled' && <> · {formatRelative(slot.startTimeUtc, now)}</>}
                        </span>
                      </div>
                      <div className="booking-side">
                        <span className={`badge ${isPast && slot.status !== 'Cancelled' ? 'badge-muted' : STATUS_BADGE[slot.status]}`}>
                          {isPast && slot.status !== 'Cancelled' ? 'עבר' : slotStatusLabels[slot.status] ?? slot.status}
                        </span>
                        {slot.status !== 'Cancelled' && (
                          <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => handleDuplicate(slot)} title="פרסום אותה שעה בשבוע הבא">
                            שכפול לשבוע הבא
                          </button>
                        )}
                        {slot.status !== 'Cancelled' && !isPast && (
                          <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => handleCancelSlot(slot)}>
                            {busy ? '…' : 'ביטול'}
                          </button>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
            <Pager page={currentListPage} totalPages={listTotalPages} onChange={setListPage} />
          </>
        )}
      </section>
    </div>
  )
}
