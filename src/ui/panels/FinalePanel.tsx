import { useId } from 'react'
import { content, missionContent } from '../../content/content.ts'
import { useGame } from '../../state/GameContext.tsx'
import { isTourBusy } from '../../state/selectors.ts'
import { MISSION_IDS } from '../../state/types.ts'
import { EmptyStamp, Stamp } from '../Stamp.tsx'
import { Icon, StatusMark } from './parts.tsx'

// The ending (state.phase is 'finale'), shown after the fourth card is closed.
//
// First the finished trail: all four stamps and the count. Then the next step: one more
// stamp space, for Roblox. It is where Annika hopes to go next, not something she has, so
// it is never stamped. It carries the "Hired!" sticker she asked for as a wish, and the
// words beside it say that she is applying. Below that are the resume, LinkedIn, and a replay.
export function FinalePanel() {
  const { state, dispatch } = useGame()
  const headingId = useId()
  const nextId = useId()
  const revisitId = useId()
  const { finale, identity, trail } = content
  // While the guided sequence holds on this screen, the world still belongs to the timeline,
  // so the buttons that reopen a card wait until it has finished.
  const busy = isTourBusy(state)

  return (
    <section className="panel card finale enter" aria-labelledby={headingId}>
      <header className="panel__head">
        <p className="eyebrow">{trail.name}</p>
        <h2 id={headingId} className="title title--large finale__complete" tabIndex={-1} data-panel-heading>
          <StatusMark done />
          {trail.complete}
        </h2>
      </header>

      {/* The full passport: every stamp of the trail, with the count in words. */}
      <div className="finale__passport">
        <ul className="finale__stamps" role="list" aria-label={trail.passport}>
          {MISSION_IDS.map((id) => {
            const mission = missionContent(id)
            return (
              <li key={id} data-mission={id}>
                <Stamp mission={id} earned number={mission.number} size="m" />
                <span className="finale__stamp-name">{mission.checkpoint.stamp}</span>
                <span className="visually-hidden">, {trail.stamped}</span>
              </li>
            )
          })}
        </ul>
        <p className="finale__count">{trail.completeCount}</p>
      </div>

      {/* The next step. The space is not stamped and can not be. The sticker on it is a wish. */}
      <div className="finale__next" role="group" aria-labelledby={nextId}>
        <p className="eyebrow finale__next-label">{trail.passportComplete}</p>
        <EmptyStamp size="l" sticker={trail.sticker} fresh />
        <div className="finale__next-text">
          <h3 id={nextId} className="title finale__heading">
            {finale.heading}
          </h3>
          <p className="finale__note">
            <span className="visually-hidden">
              {trail.notStamped}. Sticker: {trail.sticker}{' '}
            </span>
            {trail.nextNote} <span className="finale__applying">{finale.applying}</span>
          </p>
        </div>
      </div>

      <p className="finale__motivation">{finale.motivation}</p>

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
            Reopen a checkpoint card
          </p>
          <ul className="finale__cards" role="list" aria-labelledby={revisitId}>
            {MISSION_IDS.map((id) => {
              const mission = missionContent(id)
              return (
                <li key={id}>
                  {/* Shows the checkpoint number in its color. The full name is read out and appears on hover. */}
                  <button
                    type="button"
                    className="btn panel-number finale__card"
                    data-mission={id}
                    title={`${trail.checkpoint} ${mission.number}: ${mission.checkpoint.name}`}
                    onClick={() => dispatch({ type: 'OPEN_CARD', mission: id })}
                  >
                    <span className="visually-hidden">{trail.checkpoint} </span>
                    {mission.number}
                    <span className="visually-hidden">: {mission.checkpoint.name}</span>
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
