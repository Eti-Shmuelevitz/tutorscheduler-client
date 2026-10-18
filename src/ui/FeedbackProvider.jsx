import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FeedbackContext } from './feedback-context'

const TOAST_ICONS = { success: '✓', error: '!', conflict: '!', info: 'i' }
const TOAST_TITLES = { success: 'בוצע', error: 'שגיאה', conflict: 'התנגשות', info: 'לידיעתך' }

let nextId = 1

export default function FeedbackProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const [dialog, setDialog] = useState(null)
  const confirmButtonRef = useRef(null)

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), [])

  const toast = useCallback(
    ({ text, kind = 'info', title, action }) => {
      const id = nextId++
      setToasts((list) => [...list.slice(-3), { id, text, kind, title: title ?? TOAST_TITLES[kind], action }])
      // Conflicts are the point of the project - leave them up longer; toasts
      // with an action ("undo") too, so there's time to click it.
      setTimeout(() => dismiss(id), kind === 'conflict' || action ? 8000 : 4500)
    },
    [dismiss]
  )

  const confirm = useCallback(
    (options) => new Promise((resolve) => setDialog({ ...options, resolve })),
    []
  )

  // Like confirm, plus a free-text field: resolves to the trimmed text
  // ('' when left empty), or null when dismissed.
  const prompt = useCallback(
    (options) =>
      new Promise((resolve) =>
        setDialog({ ...options, input: options.input ?? {}, resolve: (ok, text) => resolve(ok ? text.trim() : null) })
      ),
    []
  )
  const [inputValue, setInputValue] = useState('')

  function closeDialog(ok) {
    dialog?.resolve(ok, inputValue)
    setDialog(null)
    setInputValue('')
  }

  useEffect(() => {
    if (!dialog) return
    // With a text field, focus goes there instead (autoFocus below).
    if (!dialog.input) confirmButtonRef.current?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') {
        dialog.resolve(false, '')
        setDialog(null)
        setInputValue('')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dialog])

  const value = useMemo(() => ({ toast, confirm, prompt }), [toast, confirm, prompt])

  return (
    <FeedbackContext.Provider value={value}>
      {children}

      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`} role="status">
            <span className="toast-icon" aria-hidden="true">
              {TOAST_ICONS[t.kind]}
            </span>
            <div className="toast-body">
              <strong>{t.title}</strong>
              <span>{t.text}</span>
              {t.action && (
                <button
                  className="toast-action"
                  onClick={() => {
                    dismiss(t.id)
                    t.action.onClick()
                  }}
                >
                  {t.action.label}
                </button>
              )}
            </div>
            <span className="toast-timer" style={{ animationDuration: t.kind === 'conflict' || t.action ? '8s' : '4.5s' }} aria-hidden="true" />
            <button className="toast-close" onClick={() => dismiss(t.id)} aria-label="סגירה">
              ×
            </button>
          </div>
        ))}
      </div>

      {dialog && (
        <div className="modal-backdrop" onMouseDown={() => closeDialog(false)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h3 id="confirm-title">{dialog.title}</h3>
            {dialog.text && <p className="muted">{dialog.text}</p>}
            {dialog.input && (
              <label className="field modal-field">
                <span>{dialog.input.label}</span>
                <textarea
                  className="input"
                  rows={3}
                  autoFocus
                  maxLength={dialog.input.maxLength}
                  placeholder={dialog.input.placeholder}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                />
                {dialog.input.maxLength && (
                  <small className="muted modal-counter">
                    {inputValue.length}/{dialog.input.maxLength}
                  </small>
                )}
              </label>
            )}
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => closeDialog(false)}>
                {dialog.cancelText ?? 'חזרה'}
              </button>
              <button
                ref={confirmButtonRef}
                className={`btn ${dialog.danger ? 'btn-danger-solid' : 'btn-primary'}`}
                onClick={() => closeDialog(true)}
              >
                {dialog.confirmText ?? 'אישור'}
              </button>
            </div>
          </div>
        </div>
      )}
    </FeedbackContext.Provider>
  )
}
