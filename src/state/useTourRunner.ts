import { useEffect, useRef, type Dispatch } from 'react'
import { TOUR_STEPS } from './timeline.ts'
import type { GameAction, TourState } from './types.ts'

/**
 * Plays the guided timeline by dispatching one TOUR_STEP at a time.
 *
 * Only one timer exists at any moment and it is cleared on pause, restart, mode change,
 * and unmount. Elapsed time is tracked in a ref (never in React state), so pausing and
 * resuming continues from the exact position without per-frame renders.
 *
 * `clockRuns` holds the clock still without changing the tour's status. The app passes
 * false while the 3D world is still downloading, so the sequence starts when there is
 * something to see.
 */
export function useTourRunner(tour: TourState, dispatch: Dispatch<GameAction>, clockRuns = true): void {
  const elapsedRef = useRef(0)
  const runIdRef = useRef(tour.runId)

  useEffect(() => {
    if (runIdRef.current !== tour.runId) {
      runIdRef.current = tour.runId
      elapsedRef.current = 0
    }
    if (tour.status !== 'running' || !clockRuns) return
    const step = TOUR_STEPS[tour.cursor]
    if (!step) return

    const base = elapsedRef.current
    const startedAt = Date.now()
    let fired = false
    const timer = setTimeout(() => {
      fired = true
      elapsedRef.current = step.at
      dispatch({ type: 'TOUR_STEP', runId: tour.runId, index: tour.cursor })
    }, Math.max(0, step.at - base))

    return () => {
      clearTimeout(timer)
      if (!fired) elapsedRef.current = Math.min(step.at, base + (Date.now() - startedAt))
    }
  }, [tour.status, tour.cursor, tour.runId, clockRuns, dispatch])

  // A hidden tab pauses the sequence instead of letting it play unseen with throttled timers.
  // That includes a tab that is already hidden when the sequence starts, such as a
  // "?mode=tour" link opened in the background: it waits, paused, until someone is watching.
  useEffect(() => {
    if (tour.status !== 'running') return
    const pauseIfHidden = () => {
      if (document.hidden) dispatch({ type: 'TOUR_PAUSE' })
    }
    pauseIfHidden()
    document.addEventListener('visibilitychange', pauseIfHidden)
    return () => document.removeEventListener('visibilitychange', pauseIfHidden)
  }, [tour.status, dispatch])
}
