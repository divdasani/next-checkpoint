import {
  allComplete,
  isMissionComplete,
  isTourBusy,
  isWorldFresh,
  missingDiscovery,
  missingReadiness,
  missingSources,
} from './selectors.ts'
import { TOUR_STEPS } from './timeline.ts'
import {
  COMPANY_COUNT,
  type GameAction,
  type GameState,
  type InitOptions,
  type MissionAction,
  type MissionId,
} from './types.ts'

// The single state machine. Clicks in the 3D world, HTML buttons, keyboard shortcuts,
// and the guided timeline all end up here, so every mode follows the same rules.

type World = Pick<
  GameState,
  'activeMission' | 'avatarStop' | 'discover' | 'signal' | 'launch' | 'network' | 'card' | 'hint' | 'cheers'
>

function freshWorld(): World {
  return {
    activeMission: null,
    avatarStop: 'home',
    discover: { steps: { research: false, need: false, concept: false }, pitched: false },
    signal: { sources: { revenue: false, invoices: false, inquiries: false }, feedOn: false },
    launch: { ready: { requirements: false, uat: false, comms: false }, launched: false },
    network: { connected: Array.from({ length: COMPANY_COUNT }, () => false) },
    card: null,
    hint: null,
    cheers: 0,
  }
}

export function createInitialState(options: InitOptions = {}): GameState {
  const base: GameState = {
    ...freshWorld(),
    mode: 'play',
    phase: 'intro',
    epoch: 0,
    tour: { status: 'idle', cursor: 0, runId: 0 },
    resumeOpen: options.resumeOpen ?? false,
  }
  if (options.mode === 'tour') return startTour(base, 'tour', true)
  if (options.mode === 'film') return startTour(base, 'film', options.autostart ?? false)
  return base
}

/** Reset the world and hand it to the guided sequence. */
function startTour(state: GameState, mode: 'tour' | 'film', run: boolean): GameState {
  // Never start running behind an open resume; wait for the visitor instead.
  const status = !run ? 'ready' : state.resumeOpen ? 'paused' : 'running'
  return {
    ...state,
    ...freshWorld(),
    mode,
    phase: 'active',
    epoch: state.epoch + 1,
    tour: { status, cursor: 0, runId: state.tour.runId + 1 },
  }
}

/** Leave the guided sequence and keep whatever progress it made. */
function exitTour(state: GameState): GameState {
  if (state.mode === 'play') return state
  return {
    ...state,
    mode: 'play',
    phase: isWorldFresh(state) && state.phase === 'active' ? 'intro' : state.phase,
    hint: null,
    tour: { ...state.tour, status: 'idle', cursor: 0 },
  }
}

/** Close the checkpoint card. Closing it once all four checkpoints are done opens the finale. */
function closeCard(state: GameState): GameState {
  if (!state.card) return state
  if (allComplete(state) && state.phase !== 'finale') {
    return {
      ...state,
      card: null,
      hint: null,
      activeMission: null,
      phase: 'finale',
      // The ending is celebrated in the middle of the island.
      avatarStop: 'center',
      cheers: state.cheers + 1,
    }
  }
  // After the ending, closing a reopened card sends the avatar back to the celebration.
  if (state.phase === 'finale') return { ...state, card: null, activeMission: null, avatarStop: 'center' }
  return { ...state, card: null, activeMission: null }
}

function completeMission(state: GameState, mission: MissionId): GameState {
  return { ...state, card: mission, hint: null, cheers: state.cheers + 1 }
}

/**
 * The game rules. Used for visitor input and for guided timeline steps alike.
 * Returns the same state object when an action changes nothing, which keeps repeat clicks harmless.
 */
export function applyMissionAction(state: GameState, action: MissionAction): GameState {
  switch (action.type) {
    case 'SELECT_MISSION': {
      const { mission } = action
      if (state.card === mission) return state
      let next = state.card ? closeCard(state) : state
      if (next.phase === 'intro') next = { ...next, phase: 'active' }
      const card = isMissionComplete(next, mission) ? mission : null
      if (
        next === state &&
        state.activeMission === mission &&
        state.avatarStop === mission &&
        state.card === card &&
        state.hint === null
      ) {
        return state
      }
      return { ...next, activeMission: mission, avatarStop: mission, card, hint: null }
    }

    case 'LEAVE_MISSION': {
      if (state.card) return closeCard(state)
      if (state.activeMission === null && state.hint === null) return state
      return { ...state, activeMission: null, hint: null }
    }

    case 'EXPLORE': {
      if (state.activeMission !== 'discover' || state.discover.pitched) return state
      if (!(action.step in state.discover.steps) || state.discover.steps[action.step]) return state
      return {
        ...state,
        hint: null,
        discover: { ...state.discover, steps: { ...state.discover.steps, [action.step]: true } },
      }
    }

    case 'PITCH': {
      if (state.activeMission !== 'discover' || state.discover.pitched) return state
      const missing = missingDiscovery(state)
      if (missing.length > 0) {
        const attempts = state.hint?.mission === 'discover' ? state.hint.attempts + 1 : 1
        return { ...state, hint: { mission: 'discover', missing, next: missing[0], attempts } }
      }
      return completeMission({ ...state, discover: { ...state.discover, pitched: true } }, 'discover')
    }

    case 'ACTIVATE_SOURCE': {
      if (state.activeMission !== 'signal' || state.signal.feedOn) return state
      if (!(action.source in state.signal.sources) || state.signal.sources[action.source]) return state
      return {
        ...state,
        hint: null,
        signal: { ...state.signal, sources: { ...state.signal.sources, [action.source]: true } },
      }
    }

    case 'START_FEED': {
      if (state.activeMission !== 'signal' || state.signal.feedOn) return state
      const missing = missingSources(state)
      if (missing.length > 0) {
        const attempts = state.hint?.mission === 'signal' ? state.hint.attempts + 1 : 1
        return { ...state, hint: { mission: 'signal', missing, next: missing[0], attempts } }
      }
      return completeMission({ ...state, signal: { ...state.signal, feedOn: true } }, 'signal')
    }

    case 'PREPARE': {
      if (state.activeMission !== 'launch' || state.launch.launched) return state
      if (!(action.item in state.launch.ready) || state.launch.ready[action.item]) return state
      return {
        ...state,
        hint: null,
        launch: { ...state.launch, ready: { ...state.launch.ready, [action.item]: true } },
      }
    }

    case 'LAUNCH': {
      if (state.activeMission !== 'launch' || state.launch.launched) return state
      const missing = missingReadiness(state)
      if (missing.length > 0) {
        const attempts = state.hint?.mission === 'launch' ? state.hint.attempts + 1 : 1
        return { ...state, hint: { mission: 'launch', missing, next: missing[0], attempts } }
      }
      return completeMission({ ...state, launch: { ...state.launch, launched: true } }, 'launch')
    }

    case 'CONNECT_COMPANY': {
      const { index } = action
      if (state.activeMission !== 'network') return state
      if (!Number.isInteger(index) || index < 0 || index >= COMPANY_COUNT) return state
      if (state.network.connected[index]) return state
      const connected = state.network.connected.map((on, i) => on || i === index)
      const next: GameState = { ...state, network: { connected } }
      return connected.every(Boolean) ? completeMission(next, 'network') : next
    }

    case 'OPEN_CARD': {
      if (state.card === action.mission || !isMissionComplete(state, action.mission)) return state
      return { ...state, card: action.mission, hint: null }
    }

    case 'DISMISS_CARD':
      return closeCard(state)
  }
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START_PLAY': {
      if (state.mode !== 'play') return exitTour(state)
      return state.phase === 'intro' ? { ...state, phase: 'active' } : state
    }

    case 'START_TOUR':
      return startTour(state, action.mode, action.autostart ?? action.mode === 'tour')

    case 'TOUR_PLAY': {
      const { status } = state.tour
      if (status !== 'ready' && status !== 'paused') return state
      return { ...state, tour: { ...state.tour, status: 'running' } }
    }

    case 'TOUR_PAUSE': {
      if (state.tour.status !== 'running') return state
      return { ...state, tour: { ...state.tour, status: 'paused' } }
    }

    case 'TOUR_RESTART': {
      if (state.mode === 'play') return state
      return startTour(state, state.mode, true)
    }

    case 'TOUR_STEP': {
      const { tour } = state
      if (tour.status !== 'running' || action.runId !== tour.runId || action.index !== tour.cursor) {
        return state
      }
      const step = TOUR_STEPS[action.index]
      if (!step) return state
      const next = step.action ? applyMissionAction(state, step.action) : state
      const cursor = tour.cursor + 1
      const status = cursor >= TOUR_STEPS.length ? 'done' : 'running'
      return { ...next, tour: { ...tour, cursor, status } }
    }

    case 'EXIT_TOUR':
      return exitTour(state)

    case 'REPLAY': {
      if (state.mode !== 'play') return startTour(state, state.mode, true)
      return { ...state, ...freshWorld(), phase: 'intro', epoch: state.epoch + 1 }
    }

    case 'OPEN_RESUME': {
      if (state.resumeOpen) return state
      // Reading the resume pauses a running sequence so nothing is missed.
      const tour = state.tour.status === 'running' ? { ...state.tour, status: 'paused' as const } : state.tour
      return { ...state, resumeOpen: true, tour }
    }

    case 'CLOSE_RESUME':
      return state.resumeOpen ? { ...state, resumeOpen: false } : state

    default:
      // Visitor mission input. The guided sequence owns the world while it is busy.
      return isTourBusy(state) ? state : applyMissionAction(state, action)
  }
}
