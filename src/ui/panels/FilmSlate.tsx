import { useId } from 'react'
import { useGame } from '../../state/GameContext.tsx'
import { TOUR_DURATION_MS } from '../../state/timeline.ts'

// The waiting screen of Film mode (state.tour.status is 'ready').
// Film mode plays the guided sequence with the help hidden, for screen recording.
// Nothing moves until "Start take" sends TOUR_PLAY, so the recorder can be started first.
export function FilmSlate() {
  const { dispatch } = useGame()
  const headingId = useId()
  // Computed from the timeline and rounded to the nearest five seconds, so the number stays
  // right if the sequence is retimed and matches the length stated on the opening panel.
  const seconds = Math.round(TOUR_DURATION_MS / 5000) * 5

  return (
    <section className="panel card slate enter" aria-labelledby={headingId}>
      <header className="panel__head">
        <p className="eyebrow">For screen recording</p>
        <h2 id={headingId} className="title" tabIndex={-1} data-panel-heading>
          Film mode
        </h2>
      </header>

      <ol className="slate__steps" role="list">
        <li>Size this window to 16:9 or 9:16, then start your screen recorder.</li>
        <li>
          Press <strong>Start take</strong> or <kbd className="slate__key">Space</kbd>, then move the pointer off the
          page.
        </li>
        <li>
          The sequence runs about {seconds} seconds, then holds on the final screen.
        </li>
      </ol>

      <ul className="slate__keys" role="list" aria-label="Controls during a take">
        <li>
          <kbd className="slate__key">Space</kbd>{' '}
          <span>pauses and resumes</span>
        </li>
        <li>
          <kbd className="slate__key">R</kbd>{' '}
          <span>restarts the take</span>
        </li>
        <li>
          <kbd className="slate__key">Esc</kbd>{' '}
          <span>leaves Film mode</span>
        </li>
        <li>
          <span className="slate__key">Tap</span>{' '}
          <span>the world to pause or resume on a touch screen</span>
        </li>
      </ul>

      <div className="slate__actions panel__dock">
        <button type="button" className="btn btn--primary slate__start" onClick={() => dispatch({ type: 'TOUR_PLAY' })}>
          Start take
        </button>
        <button type="button" className="btn" onClick={() => dispatch({ type: 'EXIT_TOUR' })}>
          Exit Film mode
        </button>
      </div>
    </section>
  )
}
