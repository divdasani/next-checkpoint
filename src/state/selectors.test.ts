import { describe, expect, it } from 'vitest'
import { createInitialState, gameReducer } from './reducer.ts'
import {
  allComplete,
  completedCount,
  completedMissions,
  connectedCount,
  focusMission,
  isMissionComplete,
  isTourBusy,
  isWorldFresh,
  missingDiscovery,
  missingReadiness,
  missingSources,
  missionStatus,
  panelKind,
  TOUR_CHAPTER_COUNT,
  tourChapter,
} from './selectors.ts'
import { TOUR_STEPS } from './timeline.ts'
import {
  COMPANY_COUNT,
  DISCOVERY_IDS,
  MISSION_IDS,
  READINESS_IDS,
  SOURCE_IDS,
  type GameAction,
  type GameState,
  type MissionAction,
  type MissionId,
  type TourStatus,
} from './types.ts'

// Selectors are the questions every view asks about the state: which panel is showing,
// which mission is done, how far the tour has come. The states used here are produced by
// the real reducer, so each test describes a situation a visitor can actually reach.

// Helpers ---------------------------------------------------------------------

function run(state: GameState, ...actions: GameAction[]): GameState {
  return actions.reduce(gameReducer, state)
}

const select = (mission: MissionId): MissionAction => ({ type: 'SELECT_MISSION', mission })
const connect = (index: number): MissionAction => ({ type: 'CONNECT_COMPANY', index })
const DISMISS: MissionAction = { type: 'DISMISS_CARD' }

/** The clicks that finish each mission. The card is left open. */
const SOLVE: Record<MissionId, MissionAction[]> = {
  discover: [
    select('discover'),
    ...DISCOVERY_IDS.map((step): MissionAction => ({ type: 'EXPLORE', step })),
    { type: 'PITCH' },
  ],
  signal: [
    select('signal'),
    ...SOURCE_IDS.map((source): MissionAction => ({ type: 'ACTIVATE_SOURCE', source })),
    { type: 'START_FEED' },
  ],
  launch: [
    select('launch'),
    ...READINESS_IDS.map((item): MissionAction => ({ type: 'PREPARE', item })),
    { type: 'LAUNCH' },
  ],
  network: [select('network'), ...Array.from({ length: COMPANY_COUNT }, (_, index) => connect(index))],
}

const solve = (state: GameState, mission: MissionId) => run(state, ...SOLVE[mission])
const solveAndClose = (state: GameState, mission: MissionId) => run(solve(state, mission), DISMISS)

const intro = () => createInitialState()
const onMap = () => run(intro(), { type: 'START_PLAY' })
const finale = () => MISSION_IDS.reduce(solveAndClose, onMap())

/** The state after each step of the guided sequence, starting with the state before the first step. */
function replayTour(start: GameState): GameState[] {
  const states = [start]
  TOUR_STEPS.forEach((_, index) => {
    const before = states[states.length - 1]
    states.push(gameReducer(before, { type: 'TOUR_STEP', runId: before.tour.runId, index }))
  })
  return states
}

/** A state with a given tour status, for questions that only look at that one field. */
function withTourStatus(status: TourStatus): GameState {
  const base = createInitialState({ mode: 'tour' })
  return { ...base, tour: { ...base.tour, status } }
}

// Tests -----------------------------------------------------------------------

describe('counting progress', () => {
  it('connectedCount counts the companies joined to the hub', () => {
    expect(connectedCount(onMap())).toBe(0)
    expect(connectedCount(run(onMap(), select('network'), connect(1), connect(6), connect(1)))).toBe(2)
    expect(connectedCount(solve(onMap(), 'network'))).toBe(COMPANY_COUNT)
  })

  it('missingDiscovery lists the steps still to do, in the order they are shown', () => {
    expect(missingDiscovery(onMap())).toEqual(['research', 'need', 'concept'])
    const oneDone = run(onMap(), select('discover'), { type: 'EXPLORE', step: 'need' })
    expect(missingDiscovery(oneDone)).toEqual(['research', 'concept'])
    expect(missingDiscovery(solve(onMap(), 'discover'))).toEqual([])
  })

  it('missingSources lists the sources still off, in the order they are shown', () => {
    expect(missingSources(onMap())).toEqual(['revenue', 'invoices', 'inquiries'])
    const oneOn = run(onMap(), select('signal'), { type: 'ACTIVATE_SOURCE', source: 'invoices' })
    expect(missingSources(oneOn)).toEqual(['revenue', 'inquiries'])
    expect(missingSources(solve(onMap(), 'signal'))).toEqual([])
  })

  it('missingReadiness lists the checks still to prepare, in the order they are shown', () => {
    expect(missingReadiness(onMap())).toEqual(['requirements', 'uat', 'comms'])
    const oneReady = run(onMap(), select('launch'), { type: 'PREPARE', item: 'requirements' })
    expect(missingReadiness(oneReady)).toEqual(['uat', 'comms'])
    expect(missingReadiness(solve(onMap(), 'launch'))).toEqual([])
  })
})

describe('when a mission counts as complete', () => {
  it('the network needs all eight connections, not seven', () => {
    const seven = run(onMap(), ...SOLVE.network.slice(0, -1))
    expect(connectedCount(seven)).toBe(COMPANY_COUNT - 1)
    expect(isMissionComplete(seven, 'network')).toBe(false)
    expect(isMissionComplete(solve(onMap(), 'network'), 'network')).toBe(true)
  })

  it('the pitch deck needs the concept pitched, not just the three steps done', () => {
    const stepsDone = run(onMap(), ...SOLVE.discover.slice(0, -1))
    expect(missingDiscovery(stepsDone)).toEqual([])
    expect(isMissionComplete(stepsDone, 'discover')).toBe(false)
    expect(isMissionComplete(solve(onMap(), 'discover'), 'discover')).toBe(true)
  })

  it('the signal needs the feed running, not just the three sources on', () => {
    const sourcesOn = run(onMap(), ...SOLVE.signal.slice(0, -1))
    expect(missingSources(sourcesOn)).toEqual([])
    expect(isMissionComplete(sourcesOn, 'signal')).toBe(false)
    expect(isMissionComplete(solve(onMap(), 'signal'), 'signal')).toBe(true)
  })

  it('the launch needs Launch pressed, not just the three checks ready', () => {
    const checksReady = run(onMap(), ...SOLVE.launch.slice(0, -1))
    expect(missingReadiness(checksReady)).toEqual([])
    expect(isMissionComplete(checksReady, 'launch')).toBe(false)
    expect(isMissionComplete(solve(onMap(), 'launch'), 'launch')).toBe(true)
  })

  it('finishing one mission does not complete the others', () => {
    const state = solve(onMap(), 'signal')
    expect(MISSION_IDS.map((id) => isMissionComplete(state, id))).toEqual([false, true, false, false])
  })

  it('the missions are listed in trail order: Discover, Build, Ship, Scale', () => {
    expect(MISSION_IDS).toEqual(['discover', 'signal', 'launch', 'network'])
  })

  it('completedMissions, completedCount, and allComplete follow the missions in trail order', () => {
    const none = onMap()
    expect(completedMissions(none)).toEqual([])
    expect(completedCount(none)).toBe(0)
    expect(allComplete(none)).toBe(false)

    // Finished out of order on purpose: the list still comes back in trail order.
    const two = solveAndClose(solveAndClose(none, 'network'), 'signal')
    expect(completedMissions(two)).toEqual(['signal', 'network'])
    expect(completedCount(two)).toBe(2)
    expect(allComplete(two)).toBe(false)

    const three = solveAndClose(two, 'discover')
    expect(completedMissions(three)).toEqual(['discover', 'signal', 'network'])
    expect(completedCount(three)).toBe(3)
    expect(allComplete(three)).toBe(false)

    const four = solve(three, 'launch')
    expect(completedMissions(four)).toEqual(['discover', 'signal', 'launch', 'network'])
    expect(completedCount(four)).toBe(4)
    expect(allComplete(four)).toBe(true)
  })

  it('the passport count goes from 0 to 4, one stamp per finished checkpoint, in any order', () => {
    // The passport, the cards, and the ending all read completedCount, so this is the one
    // number behind "0/4" to "4/4".
    let state = onMap()
    const counts = [completedCount(state)]
    for (const mission of ['launch', 'discover', 'network', 'signal'] as const) {
      state = solveAndClose(state, mission)
      counts.push(completedCount(state))
    }
    expect(counts).toEqual([0, 1, 2, 3, 4])
    expect(allComplete(state)).toBe(true)
  })
})

describe('isWorldFresh: has anything in the world been touched?', () => {
  it('is true on the intro, on the map, and on an untouched tour or Film slate', () => {
    expect(isWorldFresh(intro())).toBe(true)
    expect(isWorldFresh(onMap())).toBe(true)
    expect(isWorldFresh(createInitialState({ mode: 'tour' }))).toBe(true)
    expect(isWorldFresh(createInitialState({ mode: 'film' }))).toBe(true)
  })

  it('is false as soon as a destination is chosen, even after going back to the map', () => {
    const chosen = run(onMap(), select('launch'))
    expect(isWorldFresh(chosen)).toBe(false)
    expect(isWorldFresh(run(chosen, { type: 'LEAVE_MISSION' }))).toBe(false)
  })

  it('is false once any work is done, and true again after Replay', () => {
    const worked = solveAndClose(onMap(), 'network')
    expect(isWorldFresh(worked)).toBe(false)
    expect(isWorldFresh(run(worked, { type: 'REPLAY' }))).toBe(true)
  })

  it('does not depend on the resume being open', () => {
    expect(isWorldFresh(run(onMap(), { type: 'OPEN_RESUME' }))).toBe(true)
  })

  // Hand-made states, one change each, to show that every kind of progress counts by
  // itself. (Through real play several of them always change together.)
  const base = onMap()
  const { discover, signal, launch } = base
  const oneConnected = base.network.connected.map((_, index) => index === 0)
  const touched: [what: string, state: GameState][] = [
    ['a selected destination', { ...base, activeMission: 'signal' }],
    ['an open card', { ...base, card: 'network' }],
    ['the avatar away from home', { ...base, avatarStop: 'launch' }],
    ['the avatar turned to the first checkpoint', { ...base, avatarStop: 'discover' }],
    ['one step done', { ...base, discover: { ...discover, steps: { ...discover.steps, need: true } } }],
    ['the concept pitched', { ...base, discover: { ...discover, pitched: true } }],
    ['one connected company', { ...base, network: { connected: oneConnected } }],
    ['one source switched on', { ...base, signal: { ...signal, sources: { ...signal.sources, invoices: true } } }],
    ['the feed running', { ...base, signal: { ...signal, feedOn: true } }],
    ['one check prepared', { ...base, launch: { ...launch, ready: { ...launch.ready, comms: true } } }],
    ['the launch done', { ...base, launch: { ...launch, launched: true } }],
  ]

  it.each(touched)('is false with only %s', (_what, state) => {
    expect(isWorldFresh(state)).toBe(false)
  })
})

describe('missionStatus: the word shown next to each mission', () => {
  it('is "todo" for missions that are not selected or finished', () => {
    expect(MISSION_IDS.map((id) => missionStatus(onMap(), id))).toEqual(['todo', 'todo', 'todo', 'todo'])
  })

  it('is "active" only for the selected, unfinished mission', () => {
    const state = run(onMap(), select('signal'))
    expect(MISSION_IDS.map((id) => missionStatus(state, id))).toEqual(['todo', 'active', 'todo', 'todo'])
  })

  it('is "done" for a finished mission, whether its card is open, closed, or it is selected again', () => {
    const cardOpen = solve(onMap(), 'network')
    expect(missionStatus(cardOpen, 'network')).toBe('done')
    const closed = run(cardOpen, DISMISS)
    expect(missionStatus(closed, 'network')).toBe('done')
    const elsewhere = run(closed, select('launch'))
    expect(MISSION_IDS.map((id) => missionStatus(elsewhere, id))).toEqual(['todo', 'todo', 'active', 'done'])
  })
})

describe('panelKind: the one panel on screen', () => {
  it('intro: before Start playing', () => {
    expect(panelKind(intro())).toBe('intro')
  })

  it('overview: on the map with nothing selected', () => {
    expect(panelKind(onMap())).toBe('overview')
    expect(panelKind(run(onMap(), select('network'), { type: 'LEAVE_MISSION' }))).toBe('overview')
  })

  it.each(MISSION_IDS)('mission: while %s is selected and unfinished', (mission) => {
    expect(panelKind(run(onMap(), select(mission)))).toBe('mission')
    expect(panelKind(run(intro(), select(mission)))).toBe('mission')
  })

  it('mission: stays up when an action is pressed too early', () => {
    expect(panelKind(run(onMap(), select('launch'), { type: 'LAUNCH' }))).toBe('mission')
  })

  it.each(MISSION_IDS)('card: as soon as %s is completed, and when its card is reopened', (mission) => {
    const completed = solve(onMap(), mission)
    expect(panelKind(completed)).toBe('card')
    const reopened = run(completed, DISMISS, select(mission))
    expect(panelKind(reopened)).toBe('card')
  })

  it('overview: after closing a card while missions remain', () => {
    expect(panelKind(solveAndClose(onMap(), 'network'))).toBe('overview')
  })

  it('card: the last card is read before the finale appears', () => {
    const lastCard = solve(solveAndClose(solveAndClose(solveAndClose(onMap(), 'discover'), 'signal'), 'launch'), 'network')
    expect(panelKind(lastCard)).toBe('card')
  })

  it('finale: after the last card is closed', () => {
    expect(panelKind(finale())).toBe('finale')
  })

  it('card: a reopened card sits on top of the finale, and closing it shows the finale again', () => {
    const reopened = run(finale(), { type: 'OPEN_CARD', mission: 'signal' })
    expect(panelKind(reopened)).toBe('card')
    expect(panelKind(run(reopened, DISMISS))).toBe('finale')
  })

  it('a finished mission never shows its controls again, even if it were left selected', () => {
    // The reducer deselects a mission when its card closes. This hand-made state skips that
    // on purpose: the panel rule must still refuse to show controls for finished work.
    const stillSelected: GameState = { ...solveAndClose(onMap(), 'network'), activeMission: 'network' }
    expect(panelKind(stillSelected)).toBe('overview')
    expect(focusMission(stillSelected)).toBeNull()
  })

  it('slate: Film mode waiting for Start take, and only then', () => {
    const slate = createInitialState({ mode: 'film' })
    expect(panelKind(slate)).toBe('slate')
    expect(panelKind(run(slate, { type: 'TOUR_PLAY' }))).not.toBe('slate')
    expect(panelKind(run(slate, { type: 'EXIT_TOUR' }))).toBe('intro')
    expect(panelKind(createInitialState({ mode: 'film', autostart: true }))).not.toBe('slate')
  })

  it('a guided sequence never shows the intro: it opens on the map', () => {
    expect(panelKind(createInitialState({ mode: 'tour' }))).toBe('overview')
    expect(panelKind(createInitialState({ mode: 'film', autostart: true }))).toBe('overview')
  })

  it('opening the resume or pausing does not change the panel behind it', () => {
    const states = [intro(), onMap(), run(onMap(), select('signal')), solve(onMap(), 'network'), finale()]
    for (const state of states) {
      expect(panelKind(run(state, { type: 'OPEN_RESUME' }))).toBe(panelKind(state))
    }
    const tourCard = replayTour(createInitialState({ mode: 'tour' })).find((state) => state.card === 'network')
    expect(tourCard).toBeDefined()
    if (tourCard) expect(panelKind(run(tourCard, { type: 'TOUR_PAUSE' }))).toBe('card')
  })

  it('every mode shows the same panel for the same world', () => {
    const tour = replayTour(createInitialState({ mode: 'tour' }))
    const film = replayTour(createInitialState({ mode: 'film', autostart: true }))
    // A visitor doing the same things by hand, one click per scripted action.
    const byHand = [onMap()]
    for (const step of TOUR_STEPS) {
      const before = byHand[byHand.length - 1]
      byHand.push(step.action ? gameReducer(before, step.action) : before)
    }
    const panels = (states: GameState[]) => states.map(panelKind)
    expect(panels(film)).toEqual(panels(tour))
    expect(panels(byHand)).toEqual(panels(tour))
    // The walk through the tour passes every panel a sequence can show.
    expect(new Set(panels(tour))).toEqual(new Set(['overview', 'mission', 'card', 'finale']))
  })
})

describe('focusMission: the zone the camera may move toward', () => {
  it('is the selected mission while it is still being worked on', () => {
    for (const mission of MISSION_IDS) expect(focusMission(run(onMap(), select(mission)))).toBe(mission)
    expect(focusMission(run(onMap(), select('signal'), { type: 'START_FEED' }))).toBe('signal')
  })

  it('is nothing on the intro, on the map, on a card, or in the finale', () => {
    expect(focusMission(intro())).toBeNull()
    expect(focusMission(onMap())).toBeNull()
    expect(focusMission(solve(onMap(), 'network'))).toBeNull()
    expect(focusMission(solveAndClose(onMap(), 'network'))).toBeNull()
    expect(focusMission(finale())).toBeNull()
    expect(focusMission(run(finale(), select('launch')))).toBeNull()
    expect(focusMission(createInitialState({ mode: 'film' }))).toBeNull()
  })

  it('follows the guided sequence the same way: each mission in turn, released when its card opens', () => {
    const focused = replayTour(createInitialState({ mode: 'tour' })).map(focusMission)
    const order = focused.filter((mission, index) => mission !== focused[index - 1])
    expect(order).toEqual([null, 'discover', null, 'signal', null, 'launch', null, 'network', null])
  })
})

describe('tourChapter: how far the guided sequence has come', () => {
  const chapters = () => replayTour(createInitialState({ mode: 'tour' })).map(tourChapter)

  it('starts at 0, never goes backwards, and ends at 5', () => {
    const seen = chapters()
    expect(seen[0]).toBe(0)
    for (let index = 1; index < seen.length; index++) {
      expect(seen[index], `after step ${index - 1}`).toBeGreaterThanOrEqual(seen[index - 1])
    }
    expect(seen[seen.length - 1]).toBe(5)
  })

  it('passes through every chapter, one at a time, and fits the chapter count', () => {
    const seen = chapters()
    expect([...new Set(seen)]).toEqual([0, 1, 2, 3, 4, 5])
    expect(TOUR_CHAPTER_COUNT).toBe(6)
    expect(Math.max(...seen)).toBe(TOUR_CHAPTER_COUNT - 1)
  })

  it('counts a mission from the walk to its stop until the next mission begins', () => {
    const states = replayTour(createInitialState({ mode: 'tour' }))
    const at = (reached: (state: GameState) => boolean) => {
      const state = states.find(reached)
      if (!state) throw new Error('The guided sequence never reached the expected moment.')
      return tourChapter(state)
    }
    expect(at((s) => s.activeMission === 'discover')).toBe(1)
    expect(at((s) => s.card === 'discover')).toBe(1)
    // The sequence goes straight from a card to the next mission. A visitor can also close the
    // card first, and with no mission chosen yet that still counts as chapter 1.
    const cardOpen = states.find((s) => s.card === 'discover')
    expect(cardOpen && tourChapter({ ...cardOpen, card: null, activeMission: null })).toBe(1)
    expect(at((s) => s.activeMission === 'signal')).toBe(2)
    expect(at((s) => s.card === 'signal')).toBe(2)
    expect(at((s) => s.activeMission === 'launch')).toBe(3)
    expect(at((s) => s.card === 'launch')).toBe(3)
    expect(at((s) => s.activeMission === 'network')).toBe(4)
    expect(at((s) => s.card === 'network')).toBe(4)
    expect(at((s) => s.phase === 'finale')).toBe(5)
  })

  it('stays on the last chapter when a card is reopened after the sequence has finished', () => {
    const done = replayTour(createInitialState({ mode: 'tour' })).at(-1)
    expect(done?.tour.status).toBe('done')
    if (done) expect(tourChapter(run(done, select('network')))).toBe(5)
  })
})

describe('isTourBusy: does the guided sequence own the world?', () => {
  it.each(['ready', 'running', 'paused'] as const)('yes while it is %s', (status) => {
    expect(isTourBusy(withTourStatus(status))).toBe(true)
  })

  it.each(['idle', 'done'] as const)('no while it is %s', (status) => {
    expect(isTourBusy(withTourStatus(status))).toBe(false)
  })

  it('matches what the reducer reports through a real session', () => {
    expect(isTourBusy(intro())).toBe(false)
    expect(isTourBusy(createInitialState({ mode: 'film' }))).toBe(true)
    const running = createInitialState({ mode: 'tour' })
    expect(isTourBusy(running)).toBe(true)
    expect(isTourBusy(run(running, { type: 'TOUR_PAUSE' }))).toBe(true)
    expect(isTourBusy(run(running, { type: 'EXIT_TOUR' }))).toBe(false)
    expect(isTourBusy(replayTour(running).at(-1) ?? running)).toBe(false)
  })
})
