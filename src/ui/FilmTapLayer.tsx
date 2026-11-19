import type { MouseEvent } from 'react'
import { useGame } from '../state/GameContext.tsx'
import { handleControlKey } from './useShortcuts.ts'

interface FilmTapLayerProps {
  /** True while the tour controls are shown after a finished take. */
  controlsShown: boolean
  /** Shows or hides the tour controls after a finished take. */
  onToggleControls: () => void
}

/**
 * Film mode only: an invisible button over the free part of the stage, so a take can be
 * paused and resumed by tapping the world, with no visible controls in the recording.
 *
 * It fills .stage-safe and nothing else, so the top bar and the panel stay usable.
 * Pause and resume are the same TOUR_PAUSE and TOUR_PLAY actions the tour buttons send.
 */
export function FilmTapLayer({ controlsShown, onToggleControls }: FilmTapLayerProps) {
  const { state, dispatch } = useGame()
  const { status } = state.tour

  // Not in play or tour mode, and not while the slate is waiting for "Start take".
  if (state.mode !== 'film' || status === 'ready' || status === 'idle') return null

  let label = controlsShown ? 'Hide controls' : 'Show controls'
  if (status === 'running') label = 'Pause take'
  if (status === 'paused') label = 'Resume take'

  const onClick = (event: MouseEvent<HTMLButtonElement>) => {
    // A mouse or touch press leaves focus on this invisible button, and the next key press
    // would then draw its focus outline around the whole stage, in the recording. Letting
    // go of focus avoids that. Keyboard users (event.detail is 0 for them) keep their place.
    if (event.detail > 0) event.currentTarget.blur()

    if (status === 'running') dispatch({ type: 'TOUR_PAUSE' })
    else if (status === 'paused') dispatch({ type: 'TOUR_PLAY' })
    // The take has finished: the hidden controls (Restart, Play it yourself) come back.
    else onToggleControls()
  }

  return (
    <button
      type="button"
      className="film__tap"
      aria-label={label}
      onClick={onClick}
      // K, R, and Escape keep working while this button has keyboard focus.
      onKeyDown={(event) => handleControlKey(event, status, dispatch)}
    />
  )
}
