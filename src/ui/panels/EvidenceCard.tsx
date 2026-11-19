import { useId } from 'react'
import { content, missionContent } from '../../content/content.ts'
import { useGame } from '../../state/GameContext.tsx'
import { allComplete, isTourBusy } from '../../state/selectors.ts'
import { Dot, Icon } from './parts.tsx'

// The Real experience card (state.card names the mission). This is where the game stops
// and the facts start, so the label is prominent and the words come from the content
// file unchanged.
export function EvidenceCard() {
  const { state, dispatch } = useGame()
  const headingId = useId()
  const id = state.card
  if (!id) return null

  const mission = missionContent(id)
  const { evidence } = mission
  // During the guided tour and Film mode the timeline closes the card after a fixed hold.
  const busy = isTourBusy(state)
  // Closing the last card opens the finale, so the button says what comes next.
  const leadsToFinale = allComplete(state) && state.phase !== 'finale'

  return (
    <section className="panel card card--mission evidence enter" data-mission={id} aria-labelledby={headingId}>
      <header className="evidence__head">
        <p className="eyebrow">
          Mission {mission.number} complete
          {/* The mission title is dropped on the short phone sheet to save a line. */}
          <span className="evidence__title">
            <Dot />
            {mission.title}
          </span>
        </p>
        <h2 id={headingId} className="title evidence__badge" tabIndex={-1} data-panel-heading>
          <span className="evidence__badge-mark" aria-hidden="true">
            <Icon name="check" />
          </span>
          {content.cardLabels.realExperience}
        </h2>
      </header>

      <blockquote className="evidence__quote">
        <p>{evidence.quote}</p>
      </blockquote>

      <ul className="evidence__labels" role="list">
        {evidence.labels.map((label) => (
          <li key={label} className="chip">
            {label}
          </li>
        ))}
      </ul>

      {/* The precision note is for readers. A Film take holds each card about eleven seconds,
          enough for the statement and its labels, so the note is left out of recordings. */}
      <p className="note film-hide">{evidence.note}</p>

      {!busy && (
        <div className="panel__dock">
          <button type="button" className="btn btn--primary btn--block" onClick={() => dispatch({ type: 'DISMISS_CARD' })}>
            {leadsToFinale ? content.cardLabels.continueToFinale : content.cardLabels.continue}
            <Icon name="next" />
          </button>
        </div>
      )}
    </section>
  )
}
