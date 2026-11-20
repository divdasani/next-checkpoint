import { useEffect, useRef, type MouseEvent } from 'react'
import { content } from '../content/content.ts'
import { useGame } from '../state/GameContext.tsx'
import { TOUR_CHAPTER_COUNT, tourChapter } from '../state/selectors.ts'
import { MISSION_IDS } from '../state/types.ts'
import { IconPause, IconPlay, IconRestart } from './icons.tsx'
import { handleControlKey } from './useShortcuts.ts'

interface TourBarProps {
  /**
   * Film mode hides this bar while a take plays so it stays out of the recording.
   * A tap on the finished take sets this to bring the bar back (see FilmTapLayer).
   */
  revealed?: boolean
}

/**
 * Controls for the guided sequence, shared by Guided tour and Film mode:
 * where the sequence is (chapter 1 to 6), Pause or Resume, Restart, and a way out.
 *
 * The buttons only send TOUR_PAUSE, TOUR_PLAY, TOUR_RESTART, and EXIT_TOUR. The timeline
 * itself lives in state/timeline.ts and is played by state/useTourRunner.ts.
 */
export function TourBar({ revealed = false }: TourBarProps) {
  const { state, dispatch } = useGame()
  const { mode } = state
  const { status, runId } = state.tour
  const bar = useRef<HTMLDivElement>(null)
  const previous = useRef({ mode, runId })

  // Pressing "Guided tour" (or Replay at the end of a tour) removes that button from the
  // page, which would leave keyboard focus nowhere. Hand it to this bar instead, so the
  // next Tab lands on Pause. Nothing happens when the page first loads, or when focus is
  // still on a control. Film mode is left alone: nothing should light up during a recording.
  useEffect(() => {
    const before = previous.current
    previous.current = { mode, runId }
    const started = mode === 'tour' && (before.mode === 'play' || (before.mode === 'tour' && before.runId !== runId))
    if (!started) return
    const focused = document.activeElement
    if (!focused || focused === document.body) bar.current?.focus({ preventScroll: true })
  }, [mode, runId])

  // The Pause button leaves the page when the sequence finishes. If it had keyboard focus,
  // hand focus to the bar so the next Tab lands on Restart instead of starting over at the
  // top of the page. Film mode is left alone again.
  const finished = status === 'done'
  useEffect(() => {
    if (!finished || mode !== 'tour') return
    const focused = document.activeElement
    if (!focused || focused === document.body) bar.current?.focus({ preventScroll: true })
  }, [finished, mode])

  // Film mode hides these controls while a take plays. A mouse or touch press would leave
  // focus on a button that is then invisible, where Space would press it again instead of
  // pausing the take. So after a pointer press the focus is let go. Keyboard users
  // (event.detail is 0 for them) keep their place, and the bar stays visible for them.
  const releasePointerFocus = (event: MouseEvent<HTMLDivElement>) => {
    if (mode !== 'film' || event.detail === 0) return
    const focused = document.activeElement
    if (focused instanceof HTMLElement && event.currentTarget.contains(focused)) focused.blur()
  }

  // Play mode has no sequence, and the Film slate ("ready") has its own Start take button.
  if (mode === 'play' || status === 'ready') return null

  const name = mode === 'film' ? 'Film mode' : content.intro.tourLabel
  const paused = status === 'paused'
  const done = status === 'done'
  // tourChapter counts from 0 (the opening) to 5 (the finale).
  const chapter = tourChapter(state)
  const reached = done ? TOUR_CHAPTER_COUNT : chapter
  const position = Math.min(chapter + 1, TOUR_CHAPTER_COUNT)

  return (
    <div
      ref={bar}
      className="tourbar"
      role="group"
      aria-label={`${name} controls`}
      tabIndex={-1}
      data-revealed={revealed ? 'true' : undefined}
      // K, R, and Escape keep working while one of these buttons has keyboard focus.
      onKeyDown={(event) => handleControlKey(event, status, dispatch)}
      onClick={releasePointerFocus}
    >
      <p className="tourbar__status">
        <span className="tourbar__name">{name}</span>
        <span className="tourbar__segments" aria-hidden="true">
          {Array.from({ length: TOUR_CHAPTER_COUNT }, (_, index) => (
            <span
              key={index}
              className="tourbar__segment"
              // Chapters 2 to 5 are the four checkpoints, so they take their colors.
              data-mission={MISSION_IDS[index - 1]}
              data-state={index < reached ? 'past' : index === reached ? 'now' : 'next'}
            />
          ))}
        </span>
        {/* Screen readers always get the full sentence. The short visible count is dropped on narrow screens. */}
        <span className="visually-hidden">
          {done ? 'Finished. ' : ''}Chapter {position} of {TOUR_CHAPTER_COUNT}
        </span>
        <span className="tourbar__count" aria-hidden="true">
          {position} of {TOUR_CHAPTER_COUNT}
        </span>
      </p>

      {/* One button that changes its label, so keyboard focus stays put across Pause and Resume.
          The aria-labels keep the names when a narrow screen shows only the icons. */}
      {!done && (
        <button
          type="button"
          className={paused ? 'btn btn--primary tourbar__btn tourbar__toggle' : 'btn tourbar__btn tourbar__toggle'}
          aria-label={paused ? 'Resume' : 'Pause'}
          aria-keyshortcuts="Space K"
          onClick={() => dispatch({ type: paused ? 'TOUR_PLAY' : 'TOUR_PAUSE' })}
        >
          {paused ? <IconPlay /> : <IconPause />}
          <span className="tourbar__text tourbar__text--pause">{paused ? 'Resume' : 'Pause'}</span>
        </button>
      )}

      <button
        type="button"
        className="btn tourbar__btn"
        aria-label="Restart"
        aria-keyshortcuts="R"
        onClick={() => dispatch({ type: 'TOUR_RESTART' })}
      >
        <IconRestart />
        <span className="tourbar__text tourbar__text--restart">Restart</span>
      </button>

      {/* Leaves the sequence and keeps the progress it made so far. */}
      <button
        type="button"
        className={done ? 'btn btn--primary tourbar__btn' : 'btn tourbar__btn'}
        aria-keyshortcuts="Escape"
        onClick={() => dispatch({ type: 'EXIT_TOUR' })}
      >
        Play it yourself
      </button>
    </div>
  )
}
