import {
  MISSION_IDS,
  READINESS_IDS,
  SOURCE_IDS,
  type GameState,
  type MissionId,
  type ReadinessId,
  type SourceId,
} from './types.ts'

// Read-only questions about the state. Views and the reducer share these,
// so "is this mission complete?" has exactly one answer everywhere.

export function connectedCount(state: GameState): number {
  return state.network.connected.filter(Boolean).length
}

export function missingSources(state: GameState): SourceId[] {
  return SOURCE_IDS.filter((id) => !state.signal.sources[id])
}

export function missingReadiness(state: GameState): ReadinessId[] {
  return READINESS_IDS.filter((id) => !state.launch.ready[id])
}

export function isMissionComplete(state: GameState, mission: MissionId): boolean {
  switch (mission) {
    case 'network':
      return state.network.connected.every(Boolean)
    case 'signal':
      return state.signal.feedOn
    case 'launch':
      return state.launch.launched
  }
}

export function completedMissions(state: GameState): MissionId[] {
  return MISSION_IDS.filter((id) => isMissionComplete(state, id))
}

export function completedCount(state: GameState): number {
  return completedMissions(state).length
}

export function allComplete(state: GameState): boolean {
  return completedCount(state) === MISSION_IDS.length
}

/** True when nothing in the world has been touched yet. */
export function isWorldFresh(state: GameState): boolean {
  return (
    state.activeMission === null &&
    state.card === null &&
    state.avatarStop === 'home' &&
    connectedCount(state) === 0 &&
    missingSources(state).length === SOURCE_IDS.length &&
    !state.signal.feedOn &&
    missingReadiness(state).length === READINESS_IDS.length &&
    !state.launch.launched
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

export const TOUR_CHAPTER_COUNT = 5

/** 0 = opening, 1 to 3 = missions in order, 4 = finale. */
export function tourChapter(state: GameState): number {
  if (state.phase === 'finale') return 4
  const current = state.card ?? state.activeMission
  if (current) return MISSION_IDS.indexOf(current) + 1
  return completedCount(state)
}
