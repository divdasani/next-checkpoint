import { useEffect, type Dispatch, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import type { GameAction, GameState, TourStatus } from '../state/types.ts'

// Keyboard shortcuts for the Guided tour and Film mode:
//   Space        start the take, pause, or resume
//   Escape       leave the sequence and play it yourself
//   K            same as Space      (Film mode anywhere; Guided tour while its controls have focus)
//   R            restart from the top (same rule as K)
// They only send the same actions as the on-screen buttons, so the reducer stays in charge.
//
// The two letter keys are page-wide only in Film mode, which a person switches on to record
// and leaves with Escape. In the Guided tour they work only while the tour controls have
// focus, so a stray letter (from speech input, for example) cannot restart a visitor's tour.

/** Places where Space and Enter already have a job of their own. */
const PRESSABLE_TARGETS = 'button, a[href], summary'
/** Places where every key is text. No shortcut fires there. */
const TEXT_TARGETS = 'input, select, textarea, [contenteditable]'

type KeyPress = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>

function isActivationKey(event: KeyPress): boolean {
  return event.key === ' ' || event.key === 'Spacebar' || event.key === 'Enter'
}

/** The action a shortcut key stands for right now, or null when the key is not a shortcut. */
function actionForKey(event: KeyPress, status: TourStatus, letters = true): GameAction | null {
  if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return null
  const key = event.key.toLowerCase()
  if (key === ' ' || key === 'spacebar' || (letters && key === 'k')) {
    if (status === 'ready' || status === 'paused') return { type: 'TOUR_PLAY' }
    if (status === 'running') return { type: 'TOUR_PAUSE' }
    return null
  }
  if (letters && key === 'r') return { type: 'TOUR_RESTART' }
  if (key === 'escape') return { type: 'EXIT_TOUR' }
  return null
}

/**
 * Listens for the shortcuts while the guided sequence is on screen (any mode except play).
 * The one listener is removed again when the visitor returns to play mode or the page closes.
 */
export function useShortcuts(state: GameState, dispatch: Dispatch<GameAction>): void {
  const { mode, resumeOpen } = state
  const { status } = state.tour

  useEffect(() => {
    if (mode === 'play') return

    const onKeyDown = (event: KeyboardEvent) => {
      // defaultPrevented: a control already handled this key itself (see handleControlKey).
      if (event.defaultPrevented || event.isComposing) return
      // The resume dialog handles its own keys (Escape closes it).
      if (resumeOpen) return
      const target = event.target
      if (target instanceof Element) {
        // An open dialog (the passport) handles its own keys too: Escape closes it and
        // must not also end the tour behind it.
        if (target.closest('dialog[open]')) return
        if (target.closest(TEXT_TARGETS)) return
        // A focused button or link keeps its normal Space and Enter behavior.
        if (isActivationKey(event) && target.closest(PRESSABLE_TARGETS)) return
      }

      const action = actionForKey(event, status, mode === 'film')
      if (!action) return
      event.preventDefault()
      // Holding a key down repeats it. Only the first press counts.
      if (!event.repeat) dispatch(action)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [mode, status, resumeOpen, dispatch])
}

/**
 * For the sequence's own controls (the tour bar and the Film mode tap layer).
 * While one of them has keyboard focus, K and R work in the Guided tour as well as in Film
 * mode. Space and Enter are left alone so they press the focused button as usual.
 */
export function handleControlKey(
  event: ReactKeyboardEvent,
  status: TourStatus,
  dispatch: Dispatch<GameAction>,
): void {
  if (event.defaultPrevented || isActivationKey(event)) return
  const action = actionForKey(event, status)
  if (!action) return
  event.preventDefault()
  if (!event.repeat) dispatch(action)
}
