import { useId } from 'react'
import { content } from '../../content/content.ts'
import { useGame } from '../../state/GameContext.tsx'
import { Dot, Icon } from './parts.tsx'

// The first thing a visitor reads (state.phase is 'intro').
// Its three buttons are the three ways in: play, watch the guided tour, or read the resume.
// Each one only sends an action. The reducer decides what happens next.
export function IntroPanel() {
  const { dispatch } = useGame()
  const headingId = useId()
  const tourNoteId = useId()
  const { identity, intro } = content

  return (
    <section className="panel card intro enter" aria-labelledby={headingId}>
      <header className="panel__head">
        <p className="eyebrow">
          Interactive resume
          <Dot />
          {identity.name}
        </p>
        <h2 id={headingId} className="title title--large" tabIndex={-1} data-panel-heading>
          {intro.opening}
        </h2>
      </header>

      <p className="intro__blurb">{intro.blurb}</p>

      <div className="intro__actions panel__dock">
        <button type="button" className="btn btn--primary intro__start" onClick={() => dispatch({ type: 'START_PLAY' })}>
          <Icon name="play" />
          {intro.startLabel}
        </button>
        <button
          type="button"
          className="btn"
          aria-describedby={tourNoteId}
          onClick={() => dispatch({ type: 'START_TOUR', mode: 'tour' })}
        >
          {intro.tourLabel}
        </button>
        <button type="button" className="btn" onClick={() => dispatch({ type: 'OPEN_RESUME' })}>
          {intro.resumeLabel}
        </button>
        {/* Sits under the Guided tour button and is read out with it. */}
        <p id={tourNoteId} className="note intro__tour-note">
          {intro.tourNote}
        </p>
      </div>
    </section>
  )
}
