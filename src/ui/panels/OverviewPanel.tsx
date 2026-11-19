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
  done: 'Done',
}

// The map view (state.phase is 'active' and no mission is in progress).
// It lists the three missions as large buttons. Choosing one sends SELECT_MISSION,
// the same action as clicking that building in the 3D world.
export function OverviewPanel() {
  const { state, dispatch } = useGame()
  const headingId = useId()
  // During the guided tour and Film mode the timeline owns the world. The panel then
  // shows the opening line, and the list only reports progress.
  const busy = isTourBusy(state)

  return (
    <section className="panel card overview enter" aria-labelledby={headingId}>
      <header className="panel__head">
        {busy && (
          <p className="eyebrow">
            Interactive resume
            <Dot />
            {content.identity.name}
          </p>
        )}
        <h2 id={headingId} className="title" tabIndex={-1} data-panel-heading>
          {busy ? content.intro.opening : content.overview.heading}
        </h2>
      </header>

      {!busy && <p className="overview__body">{content.overview.body}</p>}

      <ul className="overview__list" role="list" inert={busy}>
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
                  <span className="visually-hidden">Mission {mission.number}: </span>
                  <span className="overview__name">{mission.title}</span>
                  <span className="visually-hidden">, </span>
                  <span className="overview__meta">
                    {mission.place}
                    <Dot />
                    <span className="visually-hidden">, </span>
                    <span className="overview__status">{STATUS_LABEL[status]}</span>
                  </span>
                </span>
                {/* A check once done. Otherwise an arrow, or an empty mark while the tour only reports progress. */}
                {done || busy ? <StatusMark done={done} /> : <Icon name="next" />}
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
