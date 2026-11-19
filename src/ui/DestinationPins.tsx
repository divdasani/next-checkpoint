import { missionContent } from '../content/content.ts'
import { useGame } from '../state/GameContext.tsx'
import { isTourBusy, missionStatus, type MissionStatus } from '../state/selectors.ts'
import { MISSION_IDS } from '../state/types.ts'
import { PIN_REFS } from '../world/stage.ts'
import { IconCheck } from './icons.tsx'

const STATUS_WORD: Record<MissionStatus, string> = {
  todo: 'to do',
  active: 'you are here',
  done: 'done',
}

/**
 * The HTML labels that float just above the three main buildings.
 *
 * The 3D canvas owns each pin's position: it writes a CSS transform on the outer
 * <div class="pin"> and sets data-placed="true" while the building is on screen
 * (see world/PinProjector.tsx). This component only decides what the label shows and
 * what a click does, which is SELECT_MISSION, the same as clicking the building.
 *
 * Pins are left out of the Tab order on purpose. The mission chips under the world do the
 * same job in a fixed, readable order, so keyboard users are not sent hopping around the map.
 * While the guided sequence owns the world, and in Film mode, pins are plain labels.
 */
export function DestinationPins() {
  const { state, dispatch } = useGame()
  const locked = isTourBusy(state) || state.mode === 'film'

  return (
    <>
      {MISSION_IDS.map((id) => {
        const mission = missionContent(id)
        const status = missionStatus(state, id)
        const current = state.activeMission === id
        return (
          <div
            key={id}
            className="pin"
            ref={PIN_REFS[id]}
            data-mission={id}
            data-status={status}
            data-current={current ? 'true' : undefined}
            inert={locked}
          >
            <button
              type="button"
              className="pin__button"
              tabIndex={-1}
              aria-label={`Mission ${mission.number}: ${mission.place}, ${STATUS_WORD[status]}`}
              aria-current={current ? 'true' : undefined}
              onClick={() => dispatch({ type: 'SELECT_MISSION', mission: id })}
            >
              <span className="hud-badge" aria-hidden="true">
                {mission.number}
              </span>
              <span className="pin__label" aria-hidden="true">
                {mission.place}
              </span>
              {status === 'done' && (
                <span className="pin__check" aria-hidden="true">
                  <IconCheck />
                </span>
              )}
            </button>
          </div>
        )
      })}
    </>
  )
}
