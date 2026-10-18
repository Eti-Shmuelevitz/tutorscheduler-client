import { createContext, useContext } from 'react'

// Kept apart from FeedbackProvider.jsx so that file only exports a component
// (keeps React Fast Refresh working).
export const FeedbackContext = createContext(null)

// toast({ text, kind: 'success' | 'error' | 'conflict' | 'info', title? })
export function useToast() {
  return useContext(FeedbackContext).toast
}

// await confirm({ title, text, confirmText, danger }) -> true | false
export function useConfirm() {
  return useContext(FeedbackContext).confirm
}

// await prompt({ title, text, input: { label, placeholder, maxLength }, ... })
//   -> the entered text ('' if empty), or null when dismissed
export function usePrompt() {
  return useContext(FeedbackContext).prompt
}
