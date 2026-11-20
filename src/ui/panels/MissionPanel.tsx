import { useId } from 'react'
import { content, missionContent } from '../../content/content.ts'
import { useGame } from '../../state/GameContext.tsx'
import { connectedCount, isTourBusy } from '../../state/selectors.ts'
import { COMPANY_COUNT, DISCOVERY_IDS, MISSION_IDS, READINESS_IDS, SOURCE_IDS } from '../../state/types.ts'
import { Dot, Icon, StatusMark } from './parts.tsx'
import { StepControls } from './StepControls.tsx'

// The controls for the mission the visitor is working on (state.activeMission).
// Every button here sends the same action as clicking the matching object in the 3D
// world, so the world and this panel always agree.
//
// The panel opens with the real problem behind the checkpoint (the challenge), then says
// what to do in the mini-game. The result and the skills follow on the checkpoint card.
export function MissionPanel() {
  const { state, dispatch } = useGame()
  const headingId = useId()
  const id = state.activeMission
  if (!id) return null

  const mission = missionContent(id)
  // While the guided tour or Film mode runs, the timeline presses the buttons.
  // The controls stay visible to show progress, but the visitor cannot operate them.
  const busy = isTourBusy(state)

  return (
    <section
      className={busy ? 'panel card card--mission mission mission--guided enter' : 'panel card card--mission mission enter'}
      data-mission={id}
      aria-labelledby={headingId}
    >
      <header className="panel__head">
        <p className="eyebrow">
          {content.trail.checkpoint} {mission.number} of {MISSION_IDS.length}
          <Dot />
          {mission.checkpoint.name}
        </p>
        <h2 id={headingId} className="title" tabIndex={-1} data-panel-heading>
          {mission.title}
        </h2>
      </header>

      <p className="mission__challenge">
        <span className="mission__source">{mission.checkpoint.source}</span>
        <span className="visually-hidden">: </span>
        {mission.checkpoint.challenge}
      </p>
      {/* The instruction is for players. The guided sequence does the steps itself. */}
      {!busy && <p className="mission__objective">{mission.objective}</p>}
      {!busy && <p className="note mission__how film-hide">{mission.how}</p>}

      <div className="mission__controls" inert={busy}>
        {id === 'discover' && <DiscoverControls />}
        {id === 'signal' && <SignalControls />}
        {id === 'launch' && <LaunchControls />}
        {id === 'network' && <NetworkControls />}
      </div>

      {/* The way back, for players. The guided sequence moves on by itself. */}
      {!busy && (
        <div className="mission__foot film-hide">
          <button type="button" className="btn mission__back film-hide" onClick={() => dispatch({ type: 'LEAVE_MISSION' })}>
            <Icon name="back" />
            Back to map
          </button>
        </div>
      )}
    </section>
  )
}

/** "Company A" becomes ["Company", "A"], so the tile can show the letter large. */
function splitLabel(label: string): [lead: string, key: string] {
  const cut = label.lastIndexOf(' ')
  return cut === -1 ? ['', label] : [label.slice(0, cut), label.slice(cut + 1)]
}

/** The hub: eight company tiles and a progress bar. Each tile sends CONNECT_COMPANY. */
function NetworkControls() {
  const { state, dispatch } = useGame()
  const copy = content.missions.network
  const count = connectedCount(state)
  const progressText = copy.progress(count)

  return (
    <>
      <ul className="mission__companies" role="list">
        {copy.companyLabels.map((label, index) => {
          const connected = state.network.connected[index] === true
          const [lead, key] = splitLabel(label)
          return (
            <li key={label}>
              <button
                type="button"
                className={connected ? 'btn mission__company is-done' : 'btn mission__company'}
                aria-pressed={connected}
                onClick={() => dispatch({ type: 'CONNECT_COMPANY', index })}
              >
                {lead && <span className="mission__company-lead">{lead} </span>}
                <span className="mission__company-key">{key}</span>
                <StatusMark done={connected} todoIcon="plus" />
                {connected && <span className="visually-hidden">, Connected</span>}
              </button>
            </li>
          )
        })}
      </ul>

      <div className="mission__progress">
        {/* Screen readers get the same words from the progress bar, so this copy is visual only. */}
        <p className="mission__progress-text" aria-hidden="true">
          {progressText}
        </p>
        <div
          className="mission__bar"
          role="progressbar"
          aria-label="Companies connected"
          aria-valuemin={0}
          aria-valuemax={COMPANY_COUNT}
          aria-valuenow={count}
          aria-valuetext={progressText}
        >
          {state.network.connected.map((_, index) => (
            <span key={index} className={index < count ? 'is-on' : undefined} />
          ))}
        </div>
      </div>
    </>
  )
}

/** The pitch deck: three steps from research to concept, then the pitch. */
function DiscoverControls() {
  const { state, dispatch } = useGame()
  const copy = content.missions.discover

  return (
    <StepControls
      ids={DISCOVERY_IDS}
      labels={copy.steps}
      done={state.discover.steps}
      todoWord="To do"
      doneWord="Done"
      actionLabel={copy.pitchAction}
      hint={state.hint?.mission === 'discover' ? state.hint : null}
      blocked={copy.blocked}
      nextAction={copy.nextAction}
      onStep={(step) => dispatch({ type: 'EXPLORE', step })}
      onAction={() => dispatch({ type: 'PITCH' })}
    />
  )
}

/** The signal station: three data sources, then the automated feed. */
function SignalControls() {
  const { state, dispatch } = useGame()
  const copy = content.missions.signal

  return (
    <StepControls
      ids={SOURCE_IDS}
      labels={copy.sources}
      done={state.signal.sources}
      todoWord="Off"
      doneWord="On"
      actionLabel={copy.feedAction}
      hint={state.hint?.mission === 'signal' ? state.hint : null}
      blocked={copy.blocked}
      nextAction={copy.nextAction}
      onStep={(source) => dispatch({ type: 'ACTIVATE_SOURCE', source })}
      onAction={() => dispatch({ type: 'START_FEED' })}
    />
  )
}

/** The launch arch: three readiness checks, then Launch. */
function LaunchControls() {
  const { state, dispatch } = useGame()
  const copy = content.missions.launch

  return (
    <StepControls
      ids={READINESS_IDS}
      labels={copy.readiness}
      done={state.launch.ready}
      todoWord="Not ready"
      doneWord="Ready"
      actionLabel={copy.launchAction}
      hint={state.hint?.mission === 'launch' ? state.hint : null}
      blocked={copy.blocked}
      nextAction={copy.nextAction}
      onStep={(item) => dispatch({ type: 'PREPARE', item })}
      onAction={() => dispatch({ type: 'LAUNCH' })}
    />
  )
}
