// Shared types for the one game state machine.
// This file has no imports so that both the app and the build config can use it.

/**
 * The four checkpoints of the trail. The ids name what happens in the world:
 * discover = the pitch deck, signal = the signal station, launch = the launch arch,
 * network = the hub. Their trail names (Discover, Build, Ship, Scale) are in content.ts.
 */
export type MissionId = 'discover' | 'signal' | 'launch' | 'network'
/** A place on the ring road where the avatar can stand: the start, or a checkpoint. */
export type RoadStopId = 'home' | MissionId
/** Every place the avatar can stand. 'center' is the middle of the pond, where the ending is celebrated. */
export type StopId = RoadStopId | 'center'
export type DiscoveryId = 'research' | 'need' | 'concept'
export type SourceId = 'revenue' | 'invoices' | 'inquiries'
export type ReadinessId = 'requirements' | 'uat' | 'comms'

/** play = interactive; tour = guided sequence; film = the same sequence with clutter hidden. */
export type Mode = 'play' | 'tour' | 'film'
export type Phase = 'intro' | 'active' | 'finale'
/** ready = Film mode waiting for "Start take"; done = the sequence reached its end. */
export type TourStatus = 'idle' | 'ready' | 'running' | 'paused' | 'done'

/** In trail order: checkpoint 1 to checkpoint 4. */
export const MISSION_IDS: readonly MissionId[] = ['discover', 'signal', 'launch', 'network']
export const DISCOVERY_IDS: readonly DiscoveryId[] = ['research', 'need', 'concept']
export const SOURCE_IDS: readonly SourceId[] = ['revenue', 'invoices', 'inquiries']
export const READINESS_IDS: readonly ReadinessId[] = ['requirements', 'uat', 'comms']
export const COMPANY_COUNT = 8

/** Explanation shown after pressing Pitch, Feed, or Launch too early. */
export type Hint =
  | { mission: 'discover'; missing: readonly DiscoveryId[]; next: DiscoveryId; attempts: number }
  | { mission: 'signal'; missing: readonly SourceId[]; next: SourceId; attempts: number }
  | { mission: 'launch'; missing: readonly ReadinessId[]; next: ReadinessId; attempts: number }

export interface TourState {
  status: TourStatus
  /** Index of the next timeline step to apply. */
  cursor: number
  /** Increments on every (re)start so stale timers can be ignored. */
  runId: number
}

export interface GameState {
  mode: Mode
  phase: Phase
  /** Destination currently selected: its zone is highlighted and its panel is shown. */
  activeMission: MissionId | null
  /** Logical avatar location. The 3D scene tweens toward it. */
  avatarStop: StopId
  discover: { steps: Readonly<Record<DiscoveryId, boolean>>; pitched: boolean }
  signal: { sources: Readonly<Record<SourceId, boolean>>; feedOn: boolean }
  launch: { ready: Readonly<Record<ReadinessId, boolean>>; launched: boolean }
  network: { connected: readonly boolean[] }
  /** Checkpoint card currently shown, if any. */
  card: MissionId | null
  hint: Hint | null
  /** Counts mission completions and the finale, so the avatar can play one small gesture each time. */
  cheers: number
  /** Increments whenever the world is reset, so views can snap instead of tween. */
  epoch: number
  tour: TourState
  resumeOpen: boolean
}

/** Everything a visitor or the guided timeline can do inside the world. */
export type MissionAction =
  | { type: 'SELECT_MISSION'; mission: MissionId }
  | { type: 'LEAVE_MISSION' }
  | { type: 'EXPLORE'; step: DiscoveryId }
  | { type: 'PITCH' }
  | { type: 'ACTIVATE_SOURCE'; source: SourceId }
  | { type: 'START_FEED' }
  | { type: 'PREPARE'; item: ReadinessId }
  | { type: 'LAUNCH' }
  | { type: 'CONNECT_COMPANY'; index: number }
  | { type: 'OPEN_CARD'; mission: MissionId }
  | { type: 'DISMISS_CARD' }

/** Mode, timeline, and resume controls. */
export type ControlAction =
  | { type: 'START_PLAY' }
  | { type: 'START_TOUR'; mode: 'tour' | 'film'; autostart?: boolean }
  | { type: 'TOUR_PLAY' }
  | { type: 'TOUR_PAUSE' }
  | { type: 'TOUR_RESTART' }
  | { type: 'TOUR_STEP'; runId: number; index: number }
  | { type: 'EXIT_TOUR' }
  | { type: 'REPLAY' }
  | { type: 'OPEN_RESUME' }
  | { type: 'CLOSE_RESUME' }

export type GameAction = MissionAction | ControlAction

export interface InitOptions {
  mode?: Mode
  /** Film mode normally waits on a slate; autostart begins the take immediately. */
  autostart?: boolean
  resumeOpen?: boolean
}
