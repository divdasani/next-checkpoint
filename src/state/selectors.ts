import {
  DISCOVERY_IDS,
  MISSION_IDS,
  READINESS_IDS,
  SOURCE_IDS,
  type DiscoveryId,
  type GameState,
  type MissionId,
  type ReadinessId,
  type SourceId,
} from './types.ts'

// Read-only questions about the state. Views and the reducer share these,
// so "is this mission complete?" has exactly one answer everywhere.

export function missingDiscovery(state: GameState): DiscoveryId[] {
  return DISCOVERY_IDS.filter((id) => !state.discover.steps[id])
}

export function missingSources(state: GameState): SourceId[] {
  return SOURCE_IDS.filter((id) => !state.signal.sources[id])
}

export function missingReadiness(state: GameState): ReadinessId[] {
  return READINESS_IDS.filter((id) => !state.launch.ready[id])
}

export function connectedCount(state: GameState): number {
  return state.network.connected.filter(Boolean).length
}

export function isMissionComplete(state: GameState, mission: MissionId): boolean {
  switch (mission) {
    case 'discover':
      return state.discover.pitched
    case 'signal':
      return state.signal.feedOn
    case 'launch':
      return state.launch.launched
    case 'network':
      return state.network.connected.every(Boolean)
  }
}

export function completedMissions(state: GameState): MissionId[] {
  return MISSION_IDS.filter((id) => isMissionComplete(state, id))
}

/** How many checkpoints are complete. This is also the number of stamps in the passport. */
export function completedCount(state: GameState): number {
  return completedMissions(state).length
}

/** True once every checkpoint is complete: the trail is finished and the passport is full. */
export function allComplete(state: GameState): boolean {
  return completedCount(state) === MISSION_IDS.length
}

/** True when nothing in the world has been touched yet. */
export function isWorldFresh(state: GameState): boolean {
  return (
    state.activeMission === null &&
    state.card === null &&
    state.avatarStop === 'home' &&
    missingDiscovery(state).length === DISCOVERY_IDS.length &&
    !state.discover.pitched &&
    missingSources(state).length === SOURCE_IDS.length &&
    !state.signal.feedOn &&
    missingReadiness(state).length === READINESS_IDS.length &&
    !state.launch.launched &&
    connectedCount(state) === 0
  )
}

/** While the guided sequence owns the world, visitor mission input is ignored. */
export function isTourBusy(state: GameState): boolean {
  const { status } = state.tour
  return status === 'ready' || status === 'running' || status === 'paused'
}

export type MissionStatus = 'todo' | 'active' | 'done'

export function missionStatus(state: GameState, mission: MissionId): MissionStatus {
  if (isMissionComplete(state, mission)) return 'done'
  return state.activeMission === mission ? 'active' : 'todo'
}

/** Which single panel the stage shows. Every mode uses this same rule. */
export type PanelKind = 'slate' | 'intro' | 'card' | 'finale' | 'mission' | 'overview'

export function panelKind(state: GameState): PanelKind {
  if (state.tour.status === 'ready') return 'slate'
  if (state.phase === 'intro') return 'intro'
  if (state.card) return 'card'
  if (state.phase === 'finale') return 'finale'
  if (state.activeMission && !isMissionComplete(state, state.activeMission)) return 'mission'
  return 'overview'
}

/** The zone the camera may focus on: an active mission that is still being worked. */
export function focusMission(state: GameState): MissionId | null {
  return panelKind(state) === 'mission' ? state.activeMission : null
}

/** The opening, one chapter per checkpoint, and the finale. */
export const TOUR_CHAPTER_COUNT = MISSION_IDS.length + 2

/** 0 = opening, 1 to 4 = checkpoints in trail order, 5 = finale. */
export function tourChapter(state: GameState): number {
  if (state.phase === 'finale') return TOUR_CHAPTER_COUNT - 1
  const current = state.card ?? state.activeMission
  if (current) return MISSION_IDS.indexOf(current) + 1
  return completedCount(state)
}
