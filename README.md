# TutorScheduler Client

React client for the TutorScheduler API. It exists to demonstrate the server
end-to-end: login/register with JWT, browsing and booking with real
server-side pagination, and the `409 Conflict` case when a slot is taken by
someone else first. Hebrew, right-to-left UI.

## Running

```
npm install
npm run dev
```

Opens at `http://localhost:5173`. The port is fixed (`strictPort`): the API's
CORS policy only allows that origin, so if 5173 is busy Vite fails with a clear
error instead of silently moving to another port where every request would be
blocked.

Expects the API at `http://localhost:5041/api` (the API's **http** launch
profile). Change `VITE_API_BASE_URL` in `.env` if it runs elsewhere. A red
banner appears at the top whenever the API can't be reached.

## Demo accounts

Seeded by the API on first run: `tutor@demo.com` / `student@demo.com`, both
with password `Passw0rd!`.

## What the client shows

- **Booking race (409):** when a slot is taken between loading the list and
  clicking "book", the card shakes, is marked "just taken", and a conflict
  notification explains what happened. The list also refreshes itself every
  30 seconds.
- **No overlaps:** slots that clash with one of the student's own bookings are
  flagged and can't be selected, and the tutor's "new slot" form warns about an
  overlap before submitting. The server still enforces both rules; the client
  only explains them up front.
- **Student:** next-lesson card with a countdown, filters and sort, select
  several slots and book them together, weekly calendar, upcoming/history
  bookings.
- **Tutor:** stats (upcoming, booked, fill rate, students), quick duration
  picker, "duplicate to next week", status filters, weekly calendar.
- **Extras:** time left until the next lesson, a color per subject
  (`src/subjects.js`), subject filter chips, favorite tutors (stored in the
  browser), "undo" after cancelling a booking (re-books the slot; if someone
  grabbed it in the meantime the server answers 409 like any other race),
  recurring publish for tutors (1/2/4/8 weeks, sequential requests, clashing
  weeks are skipped and reported), a 14-day load chart, click "+" on a calendar
  day to prefill the form, printable weekly calendar.
- Server error messages translated to Hebrew (`src/messages.js`), light/dark
  mode, confirmation before every cancel, automatic logout when the JWT
  expires, works on mobile.

All of this runs in the client only. No server changes are needed.
