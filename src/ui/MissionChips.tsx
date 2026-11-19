import { content, missionContent } from '../content/content.ts'
import { useGame } from '../state/GameContext.tsx'
import { completedCount, isTourBusy, missionStatus, type MissionStatus } from '../state/selectors.ts'
import { MISSION_IDS } from '../state/types.ts'
import { IconCheck, IconHere, IconTodo } from './icons.tsx'

// Status is always shown as an icon plus one of these words, never by color alone.
const STATUS_LABEL: Record<MissionStatus, string> = {
  todo: 'To do',
  active: 'Here',
  done: 'Done',
}

function StatusIcon({ status }: { status: MissionStatus }) {
  if (status === 'done') return <IconCheck />
  if (status === 'active') return <IconHere />
  return <IconTodo />
}

/**
 * The three mission chips along the bottom: a progress display and a shortcut in one.
 * Pressing a chip sends SELECT_MISSION, the same action as clicking that building.
 *
 * While the guided sequence owns the world, and for the whole of Film mode, the chips are
 * inert: they keep showing progress but cannot be pressed.
 */
export function MissionChips() {
  const { state, dispatch } = useGame()
  const locked = isTourBusy(state) || state.mode === 'film'

  return (
    <>
      <nav className="chips" aria-label="Missions">
        {/* data-slim: the compact shape used for as long as the guided sequence is on screen. */}
        <ol className="chips__list" inert={locked} data-slim={state.mode === 'play' ? undefined : ''}>
          {MISSION_IDS.map((id) => {
            const mission = missionContent(id)
            const status = missionStatus(state, id)
            return (
              <li key={id}>
                <button
                  type="button"
                  className="chips__chip"
                  data-mission={id}
                  data-status={status}
                  aria-current={state.activeMission === id ? 'true' : undefined}
                  onClick={() => dispatch({ type: 'SELECT_MISSION', mission: id })}
                >
                  <span className="hud-badge">
                    <span className="visually-hidden">Mission </span>
                    {mission.number}
                    <span className="visually-hidden">: </span>
                  </span>
                  {/* Both titles are in the page. The stylesheet shows the one that fits. */}
                  <span className="chips__title chips__title--full">{mission.title}</span>
                  <span className="chips__title chips__title--short">{mission.shortTitle}</span>
                  <span className="chips__status">
                    <StatusIcon status={status} />
                    <span className="visually-hidden">, </span>
                    {STATUS_LABEL[status]}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </nav>

      <p className="chips__progress">{content.overview.progress(completedCount(state))}</p>
    </>
  )
}
