// The server answers in English; the UI is Hebrew. Translating here keeps the
// server untouched. Unknown messages fall through unchanged rather than being
// hidden, so a new server message is still readable.
const serverMessages = {
  // Auth
  'Invalid email or password.': 'אימייל או סיסמה שגויים.',
  'An account with this email already exists.': 'כבר קיים חשבון עם כתובת האימייל הזו.',

  // Booking - the contested resource
  'Lesson slot not found.': 'השיעור לא נמצא. ייתכן שהמורה ביטל אותו.',
  'This lesson slot is no longer available.': 'השיעור כבר לא פנוי – מישהו אחר הזמין אותו לפניך.',
  'This lesson slot has already started.': 'השיעור כבר התחיל, אי אפשר להזמין אותו.',
  'This lesson slot overlaps with another lesson you already booked.': 'השיעור חופף לשיעור אחר שכבר הזמנת.',
  'This slot was just taken, or you booked another lesson at the same moment. Please refresh and try again.':
    'השיעור נתפס ממש עכשיו, או שהזמנת שיעור אחר באותו רגע. יש לרענן ולנסות שוב.',
  'Student not found.': 'המשתמש לא נמצא.',
  'Booking not found.': 'ההזמנה לא נמצאה.',
  'You can only cancel your own bookings.': 'אפשר לבטל רק הזמנות שלך.',
  'This booking is already cancelled.': 'ההזמנה כבר בוטלה.',
  'This booking was already changed elsewhere. Please refresh and try again.':
    'ההזמנה שונתה במקום אחר. יש לרענן ולנסות שוב.',

  // Lesson slots - tutor side
  'Start time must be before end time.': 'שעת ההתחלה חייבת להיות לפני שעת הסיום.',
  'Cannot create a lesson slot in the past.': 'אי אפשר לפרסם שיעור בזמן שכבר עבר.',
  'Cannot move a lesson slot into the past.': 'אי אפשר להזיז שיעור לזמן שכבר עבר.',
  'Subject not found.': 'המקצוע לא נמצא.',
  'Tutor not found.': 'המורה לא נמצא.',
  'You already have a lesson slot that overlaps this time.': 'כבר יש לך שיעור שחופף לזמן הזה.',
  'Your schedule was changed at the same moment. Please refresh and try again.':
    'הלוח שלך השתנה באותו רגע. יש לרענן ולנסות שוב.',
  'You can only edit your own lesson slots.': 'אפשר לערוך רק שיעורים שלך.',
  'You can only delete your own lesson slots.': 'אפשר לבטל רק שיעורים שלך.',
  'This slot has booking history and can no longer be edited.': 'לשיעור הזה כבר היו הזמנות, ולכן אי אפשר לערוך אותו.',
  'Cannot delete a slot with an active booking.': 'אי אפשר לבטל שיעור שיש עליו הזמנה פעילה.',
  'This slot was changed elsewhere. Please refresh and try again.': 'השיעור שונה במקום אחר. יש לרענן ולנסות שוב.',
  'You can only cancel your own lesson slots.': 'אפשר לבטל רק שיעורים שלך.',
  'This lesson slot is already cancelled.': 'השיעור כבר בוטל.',
  'Cannot cancel a lesson that has already started.': 'אי אפשר לבטל שיעור שכבר התחיל.',
  'This lesson was changed at the same moment (a student may have just booked or cancelled it). Please refresh and try again.':
    'השיעור השתנה באותו רגע – ייתכן שתלמיד הזמין או ביטל אותו ממש עכשיו. יש לרענן ולנסות שוב.',

  // Notifications
  'Notification not found.': 'ההודעה לא נמצאה.',
  'You can only read your own notifications.': 'אפשר לקרוא רק הודעות שלך.',

  // Subjects
  'Subject name is required.': 'יש להזין שם מקצוע.',
  'Cannot delete a subject that has lesson slots.': 'אי אפשר למחוק מקצוע שיש בו שיעורים.',

  // Global error middleware
  'An unexpected error occurred.': 'אירעה שגיאה בלתי צפויה בשרת.',
}

const statusFallbacks = {
  0: 'אין חיבור לשרת. יש לוודא שה-API רץ ולנסות שוב.',
  400: 'הבקשה אינה תקינה.',
  401: 'תוקף ההתחברות פג. יש להתחבר מחדש.',
  403: 'אין לך הרשאה לבצע את הפעולה הזו.',
  404: 'הפריט המבוקש לא נמצא.',
  409: 'הפעולה התנגשה עם שינוי אחר שבוצע באותו זמן. יש לרענן ולנסות שוב.',
  500: 'אירעה שגיאה בשרת. יש לנסות שוב בעוד רגע.',
}

// ASP.NET's automatic model validation ([Required], [EmailAddress], [MinLength])
// replies with ProblemDetails { errors: { Field: ["English message"] } }.
const fieldNames = {
  email: 'אימייל',
  password: 'סיסמה',
  fullname: 'שם מלא',
  role: 'תפקיד',
  name: 'שם',
  reason: 'סיבה',
}

function translateValidation(field, message) {
  const key = field.replace(/^\$\./, '').toLowerCase()
  const label = fieldNames[key] ?? field
  const minLength = message.match(/minimum length of '(\d+)'/)
  if (minLength) return `השדה "${label}" חייב להכיל לפחות ${minLength[1]} תווים.`
  if (/is required/i.test(message)) return `יש למלא את השדה "${label}".`
  if (/not a valid e-?mail/i.test(message)) return 'כתובת האימייל אינה תקינה.'
  if (/maximum length/i.test(message)) return `השדה "${label}" ארוך מדי.`
  return `השדה "${label}" אינו תקין.`
}

export function describeError(status, body) {
  if (body?.error) return serverMessages[body.error] ?? body.error
  if (body?.errors && typeof body.errors === 'object') {
    const [field, messages] = Object.entries(body.errors)[0] ?? []
    if (field && Array.isArray(messages) && messages.length > 0) return translateValidation(field, messages[0])
  }
  return statusFallbacks[status] ?? statusFallbacks[status >= 500 ? 500 : 400]
}
