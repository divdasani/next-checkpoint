import { useId } from 'react'
import { content, missionContent } from '../../content/content.ts'
import { useGame } from '../../state/GameContext.tsx'
import { completedCount, isTourBusy, missionStatus, type MissionStatus } from '../../state/selectors.ts'
import { MISSION_IDS } from '../../state/types.ts'
import { Dot, Icon, StatusMark } from './parts.tsx'

// Status words for the mission list. The check mark and these words carry the status, not the color.
const STATUS_LABEL: Record<MissionStatus, string> = {
  todo: 'To do',
  active: 'In progress',
  done: content.trail.stamped,
}

// The map view (state.phase is 'active' and no mission is in progress).
// It lists the four checkpoints as large buttons, in trail order. Choosing one sends
// SELECT_MISSION, the same action as clicking that building in the 3D world.
//
// During the Guided tour and Film mode the timeline owns the world, and this panel is only
// on screen before the first step. It is then the opening of the sequence: who curated the
// trail, the headline, and what the site demonstrates. The passport strip under the world
// already shows the four checkpoints, so the list is left out.
export function OverviewPanel() {
  const { state, dispatch } = useGame()
  const headingId = useId()

  if (isTourBusy(state)) {
    return (
      <section className="panel card overview overview--opening enter" aria-labelledby={headingId}>
        <header className="panel__head">
          <p className="eyebrow">{content.trail.byline}</p>
          <h2 id={headingId} className="title title--large" tabIndex={-1} data-panel-heading>
            {content.intro.opening}
          </h2>
        </header>
        <p className="note trail-demo">{content.trail.demo}</p>
      </section>
    )
  }

  return (
    <section className="panel card overview enter" aria-labelledby={headingId}>
      <header className="panel__head">
        <h2 id={headingId} className="title" tabIndex={-1} data-panel-heading>
          {content.overview.heading}
        </h2>
      </header>

      <p className="overview__body">{content.overview.body}</p>

      <ul className="overview__list" role="list">
        {MISSION_IDS.map((id) => {
          const mission = missionContent(id)
          const status = missionStatus(state, id)
          const done = status === 'done'
          return (
            <li key={id}>
              <button
                type="button"
                className={done ? 'btn overview__mission is-done' : 'btn overview__mission'}
                data-mission={id}
                onClick={() => dispatch({ type: 'SELECT_MISSION', mission: id })}
              >
                <span className="panel-number overview__number" aria-hidden="true">
                  {mission.number}
                </span>
                <span className="overview__text">
                  <span className="visually-hidden">
                    {content.trail.checkpoint} {mission.number}:{' '}
                  </span>
                  <span className="overview__name">
                    {mission.checkpoint.name}
                    <span className="overview__title">
                      <Dot />
                      {mission.title}
                    </span>
                  </span>
                  <span className="visually-hidden">, </span>
                  <span className="overview__meta">
                    {mission.place}
                    <Dot />
                    <span className="overview__status">{STATUS_LABEL[status]}</span>
                  </span>
                </span>
                {/* A check once done, an arrow until then. */}
                {done ? <StatusMark done /> : <Icon name="next" />}
              </button>
            </li>
          )
        })}
      </ul>

      <p className="overview__progress">
        <Icon name="flag" />
        {content.overview.progress(completedCount(state))}
      </p>
    </section>
  )
}
