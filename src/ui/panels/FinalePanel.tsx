import { useId } from 'react'
import { content, missionContent } from '../../content/content.ts'
import { useGame } from '../../state/GameContext.tsx'
import { completedCount, isTourBusy } from '../../state/selectors.ts'
import { MISSION_IDS } from '../../state/types.ts'
import { Icon, StatusMark } from './parts.tsx'

// The ending (state.phase is 'finale'), shown after the third card is closed.
// It states where Annika wants to go next and offers the resume, LinkedIn, and a replay.
// The wording says she is applying. Nothing here claims an offer or a job at Roblox.
export function FinalePanel() {
  const { state, dispatch } = useGame()
  const headingId = useId()
  const revisitId = useId()
  const { finale, identity } = content
  // While the guided sequence holds on this screen, the world still belongs to the timeline,
  // so the buttons that reopen a card wait until it has finished.
  const busy = isTourBusy(state)

  return (
    <section className="panel card finale enter" aria-labelledby={headingId}>
      <header className="panel__head">
        <p className="eyebrow finale__reached">
          <StatusMark done />
          {content.overview.progress(completedCount(state))}
        </p>
        <h2 id={headingId} className="title title--large" tabIndex={-1} data-panel-heading>
          {finale.heading}
        </h2>
      </header>

      <p className="finale__motivation">{finale.motivation}</p>
      {/* Two separate lines on a wide panel, one short paragraph on the phone sheet. */}
      <p className="finale__story">
        <span className="finale__gaming">{finale.gaming}</span>{' '}
        <span className="finale__applying">{finale.applying}</span>
      </p>

      <div className="finale__actions panel__dock">
        <button type="button" className="btn btn--primary finale__resume" onClick={() => dispatch({ type: 'OPEN_RESUME' })}>
          {finale.resumeLabel}
        </button>
        <a className="btn" href={identity.linkedInUrl} target="_blank" rel="noopener noreferrer">
          {finale.linkedInLabel}
          <Icon name="external" />
          <span className="visually-hidden"> (opens in a new tab)</span>
        </a>
        <button type="button" className="btn" onClick={() => dispatch({ type: 'REPLAY' })}>
          <Icon name="replay" />
          {finale.replayLabel}
        </button>
      </div>

      {/* A way back to each card. Film mode hides it, and it waits for the guided sequence to end. */}
      {!busy && (
        <div className="finale__revisit film-hide">
          <p id={revisitId} className="note">
            Reopen a {content.cardLabels.realExperience} card
          </p>
          <ul className="finale__cards" role="list" aria-labelledby={revisitId}>
            {MISSION_IDS.map((id) => {
              const mission = missionContent(id)
              return (
                <li key={id}>
                  {/* Shows the mission number in its color. The full name is read out and appears on hover. */}
                  <button
                    type="button"
                    className="btn panel-number finale__card"
                    data-mission={id}
                    title={`Mission ${mission.number}: ${mission.title}`}
                    onClick={() => dispatch({ type: 'OPEN_CARD', mission: id })}
                  >
                    <span className="visually-hidden">Mission </span>
                    {mission.number}
                    <span className="visually-hidden">: {mission.title}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}
