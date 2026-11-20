import { useId } from 'react'
import { content, missionContent } from '../../content/content.ts'
import { useGame } from '../../state/GameContext.tsx'
import { allComplete, completedCount, isTourBusy } from '../../state/selectors.ts'
import { Stamp } from '../Stamp.tsx'
import { Dot, Icon } from './parts.tsx'

// The checkpoint card (state.card names the mission). It is the reward and the facts in
// one: the stamp comes down, then the card answers what happened and what it shows.
//
//   stamp and heading   "Checkpoint complete", the stamp, and the passport count
//   results             the headline numbers, shown large
//   how                 the steps Annika took, the teams that came together, or the takeaway
//   skills              the skills this work demonstrates, unlocked with the stamp
//   Real experience     the full statement in her words, with its precision note
//
// The words come from the content file unchanged. While the guided sequence plays, the
// card is on screen for a fixed time, so it keeps to the parts that read at a glance:
// the stamp, the results, how, and the skills. The full statement is for readers.
export function EvidenceCard() {
  const { state, dispatch } = useGame()
  const headingId = useId()
  const id = state.card
  if (!id) return null

  const mission = missionContent(id)
  const { checkpoint, evidence } = mission
  const { trail } = content
  // During the guided tour and Film mode the timeline closes the card after a fixed hold.
  const busy = isTourBusy(state)
  // Closing the last card opens the finale, so the button says what comes next.
  const leadsToFinale = allComplete(state) && state.phase !== 'finale'

  return (
    <section className="panel card card--mission evidence enter" data-mission={id} aria-labelledby={headingId}>
      <header className="evidence__head">
        <Stamp mission={id} earned number={mission.number} size="l" fresh />
        <div className="evidence__headline">
          <p className="eyebrow">
            {trail.checkpointComplete}
            <span className="evidence__title">
              <Dot />
              {checkpoint.name}
            </span>
          </p>
          <h2 id={headingId} className="title" tabIndex={-1} data-panel-heading>
            {trail.stampEarned(checkpoint.stamp)}
          </h2>
        </div>
        <p className="evidence__count">
          <span className="visually-hidden">{trail.passport}: </span>
          <span aria-hidden="true">{trail.count(completedCount(state))}</span>
          <span className="visually-hidden">{content.overview.progress(completedCount(state))}</span>
        </p>
      </header>

      {/* The partner teams, drawn as coming together above the result they delivered. */}
      {checkpoint.teams && (
        <div className="evidence__teams">
          <ul className="evidence__team-list" role="list" aria-label="Partner teams">
            {checkpoint.teams.map((team) => (
              <li key={team}>{team}</li>
            ))}
          </ul>
          <span className="evidence__join" aria-hidden="true" />
        </div>
      )}

      <ul className="evidence__metrics" role="list">
        {checkpoint.metrics.map((metric) => (
          <li key={metric.value} className="metric">
            <strong className="metric__value">{metric.value}</strong>{' '}
            <span className="metric__label">{metric.label}</span>
          </li>
        ))}
      </ul>

      {checkpoint.flow && (
        <ol className="evidence__flow" role="list" aria-label="What I did">
          {checkpoint.flow.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      )}

      {checkpoint.theme && <p className="evidence__theme">{checkpoint.theme}</p>}

      <div className="evidence__skills">
        <p className="evidence__skills-label">{trail.skillsUnlocked}</p>
        <ul className="evidence__labels" role="list">
          {checkpoint.skills.map((skill) => (
            <li key={skill} className="chip">
              {skill}
            </li>
          ))}
        </ul>
      </div>

      {/* The statement behind the numbers. Left out while the sequence plays (see above). */}
      {!busy && (
        <div className="evidence__fact">
          <p className="evidence__fact-label">
            <span className="evidence__fact-mark" aria-hidden="true">
              <Icon name="check" />
            </span>
            {content.cardLabels.realExperience}
          </p>
          <blockquote className="evidence__quote">
            <p>{evidence.quote}</p>
          </blockquote>
          {evidence.note && <p className="note">{evidence.note}</p>}
        </div>
      )}

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
