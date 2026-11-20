import { describe, expect, it } from 'vitest'
import { applyMissionAction, createInitialState, gameReducer } from './reducer.ts'
import {
  COMPANY_COUNT,
  DISCOVERY_IDS,
  MISSION_IDS,
  READINESS_IDS,
  SOURCE_IDS,
  type DiscoveryId,
  type GameAction,
  type GameState,
  type MissionAction,
  type MissionId,
  type ReadinessId,
  type SourceId,
} from './types.ts'

// These tests describe the game rules the way a visitor meets them: what each click does,
// what is ignored, and what survives a change of mode. They only use the public reducer,
// so they keep working if the code inside it is reorganized.

// Helpers ---------------------------------------------------------------------

/** Lock a state and everything inside it. Any attempt to change it in place then throws. */
function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const inner of Object.values(value as Record<string, unknown>)) deepFreeze(inner)
  }
  return value
}

/**
 * Send actions through the reducer one after another and return the last state.
 * Every state is frozen first, so each test also proves the reducer never edits its input.
 */
function run(state: GameState, ...actions: GameAction[]): GameState {
  return actions.reduce((current, action) => gameReducer(deepFreeze(current), action), state)
}

/** The part of the state that is the world itself: no mode, timeline position, or resume flag. */
function world(state: GameState) {
  const { phase, activeMission, avatarStop, discover, signal, launch, network, card, hint, cheers } = state
  return { phase, activeMission, avatarStop, discover, signal, launch, network, card, hint, cheers }
}

/** Which missions are finished, read straight from the state. */
function finished(state: GameState): Record<MissionId, boolean> {
  return {
    discover: state.discover.pitched,
    signal: state.signal.feedOn,
    launch: state.launch.launched,
    network: state.network.connected.every(Boolean),
  }
}

const NONE_FINISHED = { discover: false, signal: false, launch: false, network: false }
const ALL_FINISHED = { discover: true, signal: true, launch: true, network: true }

/** What the world looks like before anything has been done. */
const UNTOUCHED = {
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

const select = (mission: MissionId): MissionAction => ({ type: 'SELECT_MISSION', mission })
const explore = (step: DiscoveryId): MissionAction => ({ type: 'EXPLORE', step })
const switchOn = (source: SourceId): MissionAction => ({ type: 'ACTIVATE_SOURCE', source })
const prepare = (item: ReadinessId): MissionAction => ({ type: 'PREPARE', item })
const connect = (index: number): MissionAction => ({ type: 'CONNECT_COMPANY', index })
const openCard = (mission: MissionId): MissionAction => ({ type: 'OPEN_CARD', mission })
const PITCH: MissionAction = { type: 'PITCH' }
const START_FEED: MissionAction = { type: 'START_FEED' }
const LAUNCH: MissionAction = { type: 'LAUNCH' }
const DISMISS: MissionAction = { type: 'DISMISS_CARD' }
const LEAVE: MissionAction = { type: 'LEAVE_MISSION' }

const PAUSE: GameAction = { type: 'TOUR_PAUSE' }
const PLAY: GameAction = { type: 'TOUR_PLAY' }
const RESTART: GameAction = { type: 'TOUR_RESTART' }
const EXIT: GameAction = { type: 'EXIT_TOUR' }
const REPLAY: GameAction = { type: 'REPLAY' }
const OPEN_RESUME: GameAction = { type: 'OPEN_RESUME' }
const CLOSE_RESUME: GameAction = { type: 'CLOSE_RESUME' }

/** The clicks that finish each mission, starting from anywhere on the map. The card is left open. */
const SOLVE: Record<MissionId, MissionAction[]> = {
  discover: [select('discover'), ...DISCOVERY_IDS.map((id) => explore(id)), PITCH],
  signal: [select('signal'), ...SOURCE_IDS.map((id) => switchOn(id)), START_FEED],
  launch: [select('launch'), ...READINESS_IDS.map((id) => prepare(id)), LAUNCH],
  network: [select('network'), ...Array.from({ length: COMPANY_COUNT }, (_, index) => connect(index))],
}

const solve = (state: GameState, mission: MissionId) => run(state, ...SOLVE[mission])
const solveAndClose = (state: GameState, mission: MissionId) => run(solve(state, mission), DISMISS)

/** A visitor who has pressed Start playing and is looking at the map. */
const playing = () => run(createInitialState(), { type: 'START_PLAY' })
/** All four missions done in trail order, with the last card (the hub) still open. */
const lastCardOpen = () =>
  solve(solveAndClose(solveAndClose(solveAndClose(playing(), 'discover'), 'signal'), 'launch'), 'network')

const startedTour = () => createInitialState({ mode: 'tour' })

/** Apply the next guided step, exactly as the timer in useTourRunner would. */
function tourStep(state: GameState): GameState {
  return run(state, { type: 'TOUR_STEP', runId: state.tour.runId, index: state.tour.cursor })
}

/** Let the guided sequence play until the world reaches a given moment. */
function tourUntil(state: GameState, reached: (state: GameState) => boolean): GameState {
  let current = state
  while (!reached(current)) {
    const next = tourStep(current)
    // A step that changes nothing means the sequence is over (or not running), so stop
    // with a clear message instead of waiting forever.
    if (next === current) throw new Error('The guided sequence stopped before the expected moment.')
    current = next
  }
  return current
}

const tourFinished = () => tourUntil(startedTour(), (state) => state.tour.status === 'done')

// Tests -----------------------------------------------------------------------

describe('where the visitor starts', () => {
  it('opens in play mode on the intro, with the avatar at home and nothing done', () => {
    const state = createInitialState()
    expect(state).toMatchObject({ mode: 'play', phase: 'intro', resumeOpen: false, ...UNTOUCHED })
    expect(state.tour.status).toBe('idle')
  })

  it('runs the guided tour straight away when the page is opened in tour mode', () => {
    const state = createInitialState({ mode: 'tour' })
    expect(state).toMatchObject({ mode: 'tour', phase: 'active', ...UNTOUCHED })
    expect(state.tour).toMatchObject({ status: 'running', cursor: 0 })
  })

  it('waits on the slate in Film mode until the take is started', () => {
    const state = createInitialState({ mode: 'film' })
    expect(state).toMatchObject({ mode: 'film', ...UNTOUCHED })
    expect(state.tour).toMatchObject({ status: 'ready', cursor: 0 })
  })

  it('starts the Film take at once when autostart is requested', () => {
    const state = createInitialState({ mode: 'film', autostart: true })
    expect(state).toMatchObject({ mode: 'film', ...UNTOUCHED })
    expect(state.tour).toMatchObject({ status: 'running', cursor: 0 })
  })

  it('never starts running behind an open resume: it waits paused instead', () => {
    expect(createInitialState({ mode: 'tour', resumeOpen: true }).tour.status).toBe('paused')
    expect(createInitialState({ mode: 'film', autostart: true, resumeOpen: true }).tour.status).toBe('paused')
    // The slate was not going to run anyway, so it simply keeps waiting.
    expect(createInitialState({ mode: 'film', resumeOpen: true }).tour.status).toBe('ready')
    expect(createInitialState({ resumeOpen: true })).toMatchObject({ mode: 'play', phase: 'intro', resumeOpen: true })
  })

  it('ignores autostart outside Film mode', () => {
    expect(createInitialState({ autostart: true })).toEqual(createInitialState())
    expect(createInitialState({ mode: 'tour', autostart: false }).tour.status).toBe('running')
  })
})

describe('starting to play and choosing a destination', () => {
  it('Start playing leaves the intro for the map', () => {
    const state = run(createInitialState(), { type: 'START_PLAY' })
    expect(state).toMatchObject({ mode: 'play', phase: 'active', ...UNTOUCHED })
  })

  it('Start playing does nothing once the visitor is already playing', () => {
    const state = playing()
    expect(run(state, { type: 'START_PLAY' })).toBe(state)
  })

  it('clicking a destination on the intro also starts playing', () => {
    const state = run(createInitialState(), select('signal'))
    expect(state).toMatchObject({ phase: 'active', activeMission: 'signal', avatarStop: 'signal', card: null })
  })

  it.each(MISSION_IDS)('selecting %s highlights it and sends the avatar to its stop', (mission) => {
    const state = run(playing(), select(mission))
    expect(state).toMatchObject({ activeMission: mission, avatarStop: mission, card: null, hint: null })
    expect(finished(state)).toEqual(NONE_FINISHED)
  })

  it('the first checkpoint is where the avatar already stands: selecting it turns it, with no walk', () => {
    const state = run(playing(), select('discover'))
    // 'discover' and 'home' are the same corner of the ring road (see world/paths.ts).
    expect(state).toMatchObject({ activeMission: 'discover', avatarStop: 'discover' })
  })

  it.each(MISSION_IDS)('selecting %s a second time returns the very same state', (mission) => {
    const state = run(playing(), select(mission))
    expect(run(state, select(mission))).toBe(state)
  })

  it('moving to another destination keeps the work done at the first one', () => {
    const state = run(playing(), select('network'), connect(0), connect(3), select('signal'))
    expect(state).toMatchObject({ activeMission: 'signal', avatarStop: 'signal' })
    expect(state.network.connected).toEqual([true, false, false, true, false, false, false, false])
  })

  it('Back to map deselects the mission, keeps its progress, and leaves the avatar where it is', () => {
    const state = run(playing(), select('network'), connect(2), LEAVE)
    expect(state).toMatchObject({ phase: 'active', activeMission: null, avatarStop: 'network' })
    expect(state.network.connected[2]).toBe(true)
    expect(run(state, LEAVE)).toBe(state)
  })
})

describe('mission actions only count at their own destination', () => {
  const places: [where: string, make: () => GameState, actions: MissionAction[]][] = [
    [
      'on the map with nothing selected',
      playing,
      [explore('research'), PITCH, switchOn('revenue'), START_FEED, prepare('uat'), LAUNCH, connect(0)],
    ],
    [
      'at the pitch deck',
      () => run(playing(), select('discover')),
      [switchOn('revenue'), START_FEED, prepare('uat'), LAUNCH, connect(0)],
    ],
    [
      'at the signal station',
      () => run(playing(), select('signal')),
      [explore('research'), PITCH, prepare('uat'), LAUNCH, connect(0)],
    ],
    [
      'at the launch arch',
      () => run(playing(), select('launch')),
      [explore('research'), PITCH, switchOn('revenue'), START_FEED, connect(0)],
    ],
    [
      'at the hub',
      () => run(playing(), select('network')),
      [explore('research'), PITCH, switchOn('revenue'), START_FEED, prepare('uat'), LAUNCH],
    ],
  ]

  it.each(places)('%s, actions that belong to other missions return the same state', (_where, make, actions) => {
    const state = make()
    for (const action of actions) expect(run(state, action), action.type).toBe(state)
  })

  it('nothing in the world can be worked while the intro is still showing', () => {
    const intro = createInitialState()
    const missionWork = [explore('research'), PITCH, switchOn('revenue'), START_FEED, prepare('uat'), LAUNCH, connect(0)]
    for (const action of [...missionWork, openCard('network'), DISMISS, LEAVE]) {
      expect(run(intro, action), action.type).toBe(intro)
    }
  })
})

describe('checkpoint four, the hub: Eight Worlds, One System', () => {
  const atHub = () => run(playing(), select('network'))

  it('connects the companies one click at a time, and is not done until the eighth', () => {
    let state = atHub()
    for (let index = 0; index < COMPANY_COUNT - 1; index++) {
      state = run(state, connect(index))
      expect(state.network.connected.filter(Boolean)).toHaveLength(index + 1)
      expect(state).toMatchObject({ card: null, cheers: 0 })
    }
    expect(finished(state).network).toBe(false)
  })

  it('the eighth connection completes the mission, opens its card, and cheers once', () => {
    const state = solve(playing(), 'network')
    expect(state.network.connected).toEqual(Array.from({ length: COMPANY_COUNT }, () => true))
    expect(state).toMatchObject({ phase: 'active', activeMission: 'network', card: 'network', hint: null, cheers: 1 })
  })

  it('accepts the companies in any order', () => {
    const order = [5, 0, 7, 2, 6, 1, 4, 3]
    const beforeLast = run(atHub(), ...order.slice(0, -1).map((index) => connect(index)))
    expect(beforeLast.card).toBeNull()
    const state = run(beforeLast, connect(order[order.length - 1]))
    expect(state).toMatchObject({ card: 'network', cheers: 1 })
    expect(finished(state).network).toBe(true)
  })

  it('a repeated click on a connected company returns the very same state', () => {
    const state = run(atHub(), connect(4))
    expect(run(state, connect(4))).toBe(state)
  })

  it.each([-1, COMPANY_COUNT, 99, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'ignores a company number that does not exist (%s)',
    (index) => {
      const state = run(atHub(), connect(0))
      expect(run(state, connect(index))).toBe(state)
    },
  )

  it('stays complete: further clicks change nothing', () => {
    const state = solve(playing(), 'network')
    for (let index = 0; index < COMPANY_COUNT; index++) expect(run(state, connect(index))).toBe(state)
  })
})

describe('checkpoint one, the pitch deck: Spot the Gap', () => {
  const atDeck = () => run(playing(), select('discover'))

  it('pitching too early does not pitch, and says exactly what is missing', () => {
    const state = run(atDeck(), PITCH)
    expect(state.discover.pitched).toBe(false)
    expect(state).toMatchObject({ card: null, cheers: 0, activeMission: 'discover' })
    expect(state.hint).toEqual({
      mission: 'discover',
      missing: ['research', 'need', 'concept'],
      next: 'research',
      attempts: 1,
    })
  })

  it('the hint lists only the steps still to do and points at the first of them', () => {
    const oneDone = run(atDeck(), explore('research'), PITCH)
    expect(oneDone.hint).toMatchObject({ mission: 'discover', missing: ['need', 'concept'], next: 'need' })

    const twoDone = run(atDeck(), explore('concept'), explore('research'), PITCH)
    expect(twoDone.hint).toMatchObject({ mission: 'discover', missing: ['need'], next: 'need' })
    expect(twoDone.discover.pitched).toBe(false)
  })

  it('pressing again counts the attempt, so the interface can nudge each time', () => {
    const state = run(atDeck(), PITCH, PITCH, PITCH)
    expect(state.hint?.attempts).toBe(3)
    expect(state.hint?.missing).toEqual(['research', 'need', 'concept'])
    expect(state.discover.pitched).toBe(false)
  })

  it('doing a step clears the hint', () => {
    const state = run(atDeck(), PITCH, explore('need'))
    expect(state.hint).toBeNull()
    expect(state.discover.steps).toEqual({ research: false, need: true, concept: false })
  })

  it('a repeated click on a step that is already done returns the very same state', () => {
    const state = run(atDeck(), explore('research'))
    expect(run(state, explore('research'))).toBe(state)
  })

  it('with all three steps done, the pitch completes the mission, opens its card, and cheers once', () => {
    const state = solve(playing(), 'discover')
    expect(state.discover).toEqual({ steps: { research: true, need: true, concept: true }, pitched: true })
    expect(state).toMatchObject({ activeMission: 'discover', card: 'discover', hint: null, cheers: 1 })
    // Only this checkpoint's stamp is earned.
    expect(finished(state)).toEqual({ ...NONE_FINISHED, discover: true })
  })

  it('accepts the steps in any order, and forgets an earlier hint once it completes', () => {
    const backwards = [explore('concept'), explore('need'), explore('research')]
    const state = run(atDeck(), PITCH, ...backwards, PITCH)
    expect(state).toMatchObject({ card: 'discover', hint: null, cheers: 1 })
    expect(finished(state).discover).toBe(true)
  })

  it('stays complete: nothing changes afterwards, with the card open or after coming back', () => {
    const actions = [PITCH, ...DISCOVERY_IDS.map((id) => explore(id))]
    const cardOpen = solve(playing(), 'discover')
    for (const action of actions) expect(run(cardOpen, action), action.type).toBe(cardOpen)

    const cameBack = run(cardOpen, DISMISS, select('signal'), select('discover'))
    for (const action of actions) expect(run(cameBack, action), action.type).toBe(cameBack)
  })
})

describe('checkpoint two, the signal station: Find the Signal', () => {
  const atStation = () => run(playing(), select('signal'))

  it('pressing the feed too early does not start it, and says exactly what is missing', () => {
    const state = run(atStation(), START_FEED)
    expect(state.signal.feedOn).toBe(false)
    expect(state).toMatchObject({ card: null, cheers: 0, activeMission: 'signal' })
    expect(state.hint).toEqual({
      mission: 'signal',
      missing: ['revenue', 'invoices', 'inquiries'],
      next: 'revenue',
      attempts: 1,
    })
  })

  it('the hint lists only the sources still off and points at the first of them', () => {
    const oneOn = run(atStation(), switchOn('revenue'), START_FEED)
    expect(oneOn.hint).toMatchObject({ mission: 'signal', missing: ['invoices', 'inquiries'], next: 'invoices' })

    const twoOn = run(atStation(), switchOn('inquiries'), switchOn('revenue'), START_FEED)
    expect(twoOn.hint).toMatchObject({ mission: 'signal', missing: ['invoices'], next: 'invoices' })
    expect(twoOn.signal.feedOn).toBe(false)
  })

  it('pressing again counts the attempt, so the interface can nudge each time', () => {
    const once = run(atStation(), START_FEED)
    const twice = run(once, START_FEED)
    const thrice = run(twice, START_FEED)
    expect(twice).not.toBe(once)
    expect(twice.hint?.attempts).toBe(2)
    expect(thrice.hint?.attempts).toBe(3)
    expect(thrice.hint?.missing).toEqual(['revenue', 'invoices', 'inquiries'])
    expect(thrice.signal.feedOn).toBe(false)
  })

  it('switching on a source clears the hint', () => {
    const state = run(atStation(), START_FEED, switchOn('invoices'))
    expect(state.hint).toBeNull()
    expect(state.signal.sources).toEqual({ revenue: false, invoices: true, inquiries: false })
  })

  it('a repeated click on a source that is already on returns the very same state', () => {
    const state = run(atStation(), switchOn('revenue'))
    expect(run(state, switchOn('revenue'))).toBe(state)
  })

  it('with all three sources on, the feed completes the mission, opens its card, and cheers once', () => {
    const state = solve(playing(), 'signal')
    expect(state.signal).toEqual({ sources: { revenue: true, invoices: true, inquiries: true }, feedOn: true })
    expect(state).toMatchObject({ activeMission: 'signal', card: 'signal', hint: null, cheers: 1 })
  })

  it('accepts the sources in any order, and forgets an earlier hint once it completes', () => {
    const backwards = [switchOn('inquiries'), switchOn('invoices'), switchOn('revenue')]
    const state = run(atStation(), START_FEED, ...backwards, START_FEED)
    expect(state).toMatchObject({ card: 'signal', hint: null, cheers: 1 })
    expect(finished(state).signal).toBe(true)
  })

  it('stays complete: nothing changes afterwards, with the card open or after coming back', () => {
    const actions = [START_FEED, ...SOURCE_IDS.map((id) => switchOn(id))]
    const cardOpen = solve(playing(), 'signal')
    for (const action of actions) expect(run(cardOpen, action), action.type).toBe(cardOpen)

    const cameBack = run(cardOpen, DISMISS, select('network'), select('signal'))
    for (const action of actions) expect(run(cameBack, action), action.type).toBe(cameBack)
  })
})

describe('checkpoint three, the launch arch: Launch Day', () => {
  const atArch = () => run(playing(), select('launch'))

  it('pressing Launch too early does not launch, and says exactly what is missing', () => {
    const state = run(atArch(), LAUNCH)
    expect(state.launch.launched).toBe(false)
    expect(state).toMatchObject({ card: null, cheers: 0, activeMission: 'launch' })
    expect(state.hint).toEqual({
      mission: 'launch',
      missing: ['requirements', 'uat', 'comms'],
      next: 'requirements',
      attempts: 1,
    })
  })

  it('the hint lists only the checks still to prepare and points at the first of them', () => {
    const oneReady = run(atArch(), prepare('requirements'), LAUNCH)
    expect(oneReady.hint).toMatchObject({ mission: 'launch', missing: ['uat', 'comms'], next: 'uat' })

    const twoReady = run(atArch(), prepare('comms'), prepare('requirements'), LAUNCH)
    expect(twoReady.hint).toMatchObject({ mission: 'launch', missing: ['uat'], next: 'uat' })
    expect(twoReady.launch.launched).toBe(false)
  })

  it('pressing again counts the attempt', () => {
    const state = run(atArch(), LAUNCH, LAUNCH, LAUNCH)
    expect(state.hint?.attempts).toBe(3)
    expect(state.launch.launched).toBe(false)
  })

  it('preparing a check clears the hint', () => {
    const state = run(atArch(), LAUNCH, prepare('uat'))
    expect(state.hint).toBeNull()
    expect(state.launch.ready).toEqual({ requirements: false, uat: true, comms: false })
  })

  it('a repeated click on a check that is already ready returns the very same state', () => {
    const state = run(atArch(), prepare('comms'))
    expect(run(state, prepare('comms'))).toBe(state)
  })

  it('with all three checks ready, Launch completes the mission, opens its card, and cheers once', () => {
    const state = solve(playing(), 'launch')
    expect(state.launch).toEqual({ ready: { requirements: true, uat: true, comms: true }, launched: true })
    expect(state).toMatchObject({ activeMission: 'launch', card: 'launch', hint: null, cheers: 1 })
  })

  it('stays complete: nothing changes afterwards', () => {
    const state = solve(playing(), 'launch')
    for (const action of [LAUNCH, ...READINESS_IDS.map((id) => prepare(id))]) {
      expect(run(state, action), action.type).toBe(state)
    }
  })

  it('a hint does not follow the visitor to another destination, and attempts start over there', () => {
    const moved = run(playing(), select('signal'), START_FEED, START_FEED, select('launch'))
    expect(moved.hint).toBeNull()
    expect(run(moved, LAUNCH).hint).toMatchObject({ mission: 'launch', attempts: 1 })
    // Coming back to the same destination also starts with a clean panel.
    expect(run(playing(), select('signal'), START_FEED, LEAVE).hint).toBeNull()
  })
})

describe('checkpoint cards', () => {
  it('Continue closes the card and returns to the map, leaving the avatar at that stop', () => {
    const open = solve(playing(), 'network')
    const closed = run(open, DISMISS)
    expect(closed).toMatchObject({ phase: 'active', card: null, activeMission: null, avatarStop: 'network', cheers: 1 })
    expect(finished(closed).network).toBe(true)
    expect(run(closed, DISMISS)).toBe(closed)
  })

  it('selecting a finished mission reopens its card without cheering again', () => {
    const state = run(solveAndClose(playing(), 'network'), select('signal'), select('network'))
    expect(state).toMatchObject({ card: 'network', activeMission: 'network', avatarStop: 'network', cheers: 1 })
  })

  it('selecting the mission whose card is already open returns the very same state', () => {
    const open = solve(playing(), 'signal')
    expect(run(open, select('signal'))).toBe(open)
  })

  it('a card can only be opened for a finished mission', () => {
    const state = solveAndClose(playing(), 'network')
    expect(run(state, openCard('signal'))).toBe(state)
    expect(run(state, openCard('launch'))).toBe(state)

    const reopened = run(state, openCard('network'))
    expect(reopened).toMatchObject({ card: 'network', cheers: 1 })
    expect(run(reopened, openCard('network'))).toBe(reopened)
  })

  it('choosing another destination while a card is open closes the card and goes there', () => {
    const state = run(solve(playing(), 'network'), select('launch'))
    expect(state).toMatchObject({ card: null, activeMission: 'launch', avatarStop: 'launch', phase: 'active' })
  })

  it('Back to map also closes an open card', () => {
    const state = run(solve(playing(), 'signal'), LEAVE)
    expect(state).toMatchObject({ card: null, activeMission: null, phase: 'active' })
  })
})

describe('the finale', () => {
  /** Every order in which the four checkpoints can be played: 24 of them. */
  function orders(missions: readonly MissionId[]): MissionId[][] {
    if (missions.length <= 1) return [[...missions]]
    return missions.flatMap((first, index) =>
      orders([...missions.slice(0, index), ...missions.slice(index + 1)]).map((rest) => [first, ...rest]),
    )
  }
  const ORDERS = orders(MISSION_IDS).map((order) => [order.join(', then '), order] as const)

  it('covers every order the trail can be played in', () => {
    expect(ORDERS).toHaveLength(24)
    expect(ORDERS[0][1]).toEqual(MISSION_IDS)
  })

  it('does not start while a mission is still unfinished', () => {
    const state = solveAndClose(solveAndClose(solveAndClose(playing(), 'discover'), 'signal'), 'launch')
    expect(state).toMatchObject({ phase: 'active', cheers: 3 })
    expect(finished(state)).toEqual({ ...ALL_FINISHED, network: false })
  })

  it('waits behind the last card, then appears when that card is closed', () => {
    const lastCard = lastCardOpen()
    expect(lastCard).toMatchObject({ phase: 'active', card: 'network', cheers: 4 })

    const finale = run(lastCard, DISMISS)
    expect(finale).toMatchObject({ phase: 'finale', card: null, activeMission: null, avatarStop: 'center', cheers: 5 })
    expect(finished(finale)).toEqual(ALL_FINISHED)
  })

  it.each(ORDERS)('is reached by playing %s', (_name, order) => {
    const state = order.reduce(solveAndClose, playing())
    expect(finished(state)).toEqual(ALL_FINISHED)
    // The avatar goes to the middle of the island for the ending, whichever mission came last.
    expect(state).toMatchObject({ phase: 'finale', card: null, activeMission: null, avatarStop: 'center', cheers: 5 })
  })

  it('also appears when the last card is closed by going back to the map', () => {
    expect(run(lastCardOpen(), LEAVE)).toMatchObject({ phase: 'finale', card: null, cheers: 5 })
  })

  it('is entered once, even when the last card is closed by opening another one', () => {
    const viaWorld = run(lastCardOpen(), select('signal'))
    expect(viaWorld).toMatchObject({ phase: 'finale', card: 'signal', cheers: 5 })
    expect(run(viaWorld, DISMISS)).toMatchObject({ phase: 'finale', card: null, cheers: 5 })

    const viaCardButton = run(lastCardOpen(), openCard('signal'), DISMISS)
    expect(viaCardButton).toMatchObject({ phase: 'finale', card: null, cheers: 5 })
  })

  it('persists: every card can be reopened and closed without leaving it or cheering again', () => {
    const finale = run(lastCardOpen(), DISMISS)
    for (const mission of MISSION_IDS) {
      // Reopened from the panel, the card opens over the celebration, which carries on.
      const fromPanel = run(finale, openCard(mission))
      expect(fromPanel).toMatchObject({ phase: 'finale', card: mission, avatarStop: 'center' })
      expect(run(fromPanel, DISMISS)).toMatchObject({ phase: 'finale', card: null, avatarStop: 'center', cheers: 5 })

      // Reopened from the world, the avatar walks to that checkpoint, and back to the middle afterwards.
      const fromWorld = run(finale, select(mission))
      expect(fromWorld).toMatchObject({ phase: 'finale', card: mission, avatarStop: mission })
      expect(run(fromWorld, DISMISS)).toMatchObject({
        phase: 'finale',
        card: null,
        activeMission: null,
        avatarStop: 'center',
        cheers: 5,
      })
    }
    expect(run(finale, DISMISS)).toBe(finale)
    expect(run(finale, { type: 'START_PLAY' })).toBe(finale)
  })
})

describe('repeated clicks are harmless', () => {
  it('double-clicking everything ends in exactly the same world as single clicks', () => {
    const clicks = MISSION_IDS.flatMap((mission) => [...SOLVE[mission], DISMISS])
    const single = run(playing(), ...clicks)
    const double = run(playing(), ...clicks.flatMap((click) => [click, click]))
    expect(double).toEqual(single)
    expect(double.phase).toBe('finale')
  })
})

describe('Replay in play mode', () => {
  it('puts the world back to the intro and bumps the reset counter so views snap', () => {
    const finale = run(lastCardOpen(), DISMISS)
    const replayed = run(finale, REPLAY)
    expect(replayed).toMatchObject({ mode: 'play', phase: 'intro', ...UNTOUCHED })
    expect(replayed.epoch).toBe(finale.epoch + 1)
    expect(replayed.tour).toEqual(finale.tour)
  })

  it('the whole game can be played again afterwards', () => {
    const replayed = run(lastCardOpen(), DISMISS, REPLAY, { type: 'START_PLAY' })
    const again = MISSION_IDS.reduce(solveAndClose, replayed)
    expect(again).toMatchObject({ phase: 'finale', cheers: 5 })
  })
})

describe('Guided tour and Film mode', () => {
  describe('starting', () => {
    it('Guided tour resets the world and starts running as a new run', () => {
      const before = playing()
      const state = run(before, { type: 'START_TOUR', mode: 'tour' })
      expect(state).toMatchObject({ mode: 'tour', phase: 'active', ...UNTOUCHED })
      expect(state.tour).toEqual({ status: 'running', cursor: 0, runId: before.tour.runId + 1 })
      expect(state.epoch).toBe(before.epoch + 1)
    })

    it('Film mode waits on the slate, unless autostart is set', () => {
      const slate = run(playing(), { type: 'START_TOUR', mode: 'film' })
      expect(slate).toMatchObject({ mode: 'film', ...UNTOUCHED })
      expect(slate.tour).toMatchObject({ status: 'ready', cursor: 0 })

      const rolling = run(playing(), { type: 'START_TOUR', mode: 'film', autostart: true })
      expect(rolling.tour).toMatchObject({ status: 'running', cursor: 0 })
    })

    it('starting from the middle of a play session discards that progress, by design', () => {
      const midPlay = run(solveAndClose(playing(), 'network'), select('signal'), switchOn('revenue'), START_FEED)
      const state = run(midPlay, { type: 'START_TOUR', mode: 'tour' })
      expect(state).toMatchObject({ mode: 'tour', phase: 'active', ...UNTOUCHED })
    })

    it('does not start running behind an open resume', () => {
      const reading = run(playing(), OPEN_RESUME)
      expect(run(reading, { type: 'START_TOUR', mode: 'tour' }).tour.status).toBe('paused')
      expect(run(reading, { type: 'START_TOUR', mode: 'film', autostart: true }).tour.status).toBe('paused')

      const readingMidTour = run(tourStep(startedTour()), OPEN_RESUME)
      expect(run(readingMidTour, RESTART).tour.status).toBe('paused')
      expect(run(readingMidTour, REPLAY).tour.status).toBe('paused')
    })
  })

  describe('the sequence owns the world while it is ready, running, or paused', () => {
    const connected = (state: GameState) => state.network.connected.filter(Boolean).length

    // Moments chosen so that every visitor click listed would do something in play mode.
    const moments: [when: string, make: () => GameState, clicks: MissionAction[]][] = [
      ['on the Film slate', () => createInitialState({ mode: 'film' }), [select('network')]],
      [
        'at the pitch deck',
        () => tourUntil(startedTour(), (s) => s.discover.steps.research),
        [explore('concept'), PITCH, select('signal'), LEAVE],
      ],
      ['with a card open', () => tourUntil(startedTour(), (s) => s.card === 'discover'), [DISMISS, select('launch')]],
      [
        'at the signal station',
        () => tourUntil(startedTour(), (s) => s.signal.sources.revenue),
        [switchOn('inquiries'), START_FEED, openCard('discover')],
      ],
      [
        'at the launch arch',
        () => tourUntil(startedTour(), (s) => s.launch.ready.requirements),
        [prepare('comms'), LAUNCH],
      ],
      ['at the hub', () => tourUntil(startedTour(), (s) => connected(s) === 3), [connect(7), select('signal'), LEAVE]],
    ]

    it.each(moments)('%s: visitor clicks return the same state', (_when, make, clicks) => {
      const busy = make()
      const paused = run(busy, PAUSE)
      const takenOver = run(busy, EXIT)
      for (const click of clicks) {
        expect(run(busy, click), `${click.type} while ${busy.tour.status}`).toBe(busy)
        expect(run(paused, click), `${click.type} while ${paused.tour.status}`).toBe(paused)
        // The same click does work once the visitor takes over, so it is the sequence that blocks it.
        expect(run(takenOver, click), `${click.type} after taking over`).not.toBe(takenOver)
      }
    })

    it('once the sequence has finished, the visitor can use the world again', () => {
      const done = tourFinished()
      const state = run(done, select('network'))
      expect(state).toMatchObject({ mode: 'tour', phase: 'finale', card: 'network' })
    })
  })

  describe('Pause and Resume', () => {
    it('switch a running sequence to paused and back without touching the world', () => {
      const running = tourUntil(startedTour(), (s) => s.activeMission === 'network')
      const paused = run(running, PAUSE)
      expect(paused.tour).toEqual({ ...running.tour, status: 'paused' })
      expect(world(paused)).toEqual(world(running))
      expect(run(paused, PLAY)).toEqual(running)
    })

    it('Pause does nothing unless the sequence is running', () => {
      const states = [playing(), createInitialState({ mode: 'film' }), run(startedTour(), PAUSE), tourFinished()]
      for (const state of states) expect(run(state, PAUSE), state.tour.status).toBe(state)
    })

    it('Resume does nothing unless the sequence is paused or waiting on the slate', () => {
      const states = [playing(), startedTour(), tourFinished()]
      for (const state of states) expect(run(state, PLAY), state.tour.status).toBe(state)
    })

    it('Start take on the Film slate begins the same run without another reset', () => {
      const slate = createInitialState({ mode: 'film' })
      const state = run(slate, PLAY)
      expect(state.tour).toEqual({ ...slate.tour, status: 'running' })
      expect(state.epoch).toBe(slate.epoch)
      expect(state).toMatchObject(UNTOUCHED)
    })
  })

  describe('timeline steps', () => {
    it('apply the next scripted action and move the cursor forward', () => {
      const start = startedTour()
      const state = tourStep(start)
      expect(state.tour).toEqual({ ...start.tour, cursor: 1 })
      // The sequence follows the trail, so it begins at the first checkpoint.
      expect(state).toMatchObject({ activeMission: 'discover', avatarStop: 'discover' })
    })

    it('are ignored when they come from an earlier run', () => {
      const first = startedTour()
      const restarted = run(first, RESTART)
      expect(restarted.tour.runId).not.toBe(first.tour.runId)
      expect(run(restarted, { type: 'TOUR_STEP', runId: first.tour.runId, index: 0 })).toBe(restarted)
    })

    it('are ignored when they are not the next step', () => {
      const state = tourStep(tourStep(startedTour()))
      const { runId, cursor } = state.tour
      for (const index of [cursor - 1, cursor + 1, 0, -1, 9999]) {
        expect(run(state, { type: 'TOUR_STEP', runId, index }), `index ${index}`).toBe(state)
      }
    })

    it('are ignored unless the sequence is running', () => {
      const running = tourStep(startedTour())
      const stopped = [
        run(running, PAUSE),
        run(running, EXIT),
        createInitialState({ mode: 'film' }),
        playing(),
        tourFinished(),
      ]
      for (const state of stopped) {
        const step: GameAction = { type: 'TOUR_STEP', runId: state.tour.runId, index: state.tour.cursor }
        expect(run(state, step), state.tour.status).toBe(state)
      }
    })
  })

  describe('Restart', () => {
    const before: [from: string, make: () => GameState][] = [
      ['the middle of a run', () => tourUntil(startedTour(), (s) => s.card === 'network')],
      ['a paused run', () => run(tourUntil(startedTour(), (s) => s.activeMission === 'signal'), PAUSE)],
      ['a finished run', tourFinished],
      ['the Film slate', () => createInitialState({ mode: 'film' })],
    ]

    it.each(before)('from %s: resets the world and runs from the top as a new run', (_from, make) => {
      const state = make()
      const restarted = run(state, RESTART)
      expect(restarted).toMatchObject({ mode: state.mode, phase: 'active', ...UNTOUCHED })
      expect(restarted.tour).toEqual({ status: 'running', cursor: 0, runId: state.tour.runId + 1 })
      expect(restarted.epoch).toBe(state.epoch + 1)
    })

    it('does nothing in play mode', () => {
      const state = run(playing(), select('network'), connect(1))
      expect(run(state, RESTART)).toBe(state)
    })
  })

  describe('Play it yourself (leaving the sequence)', () => {
    it('keeps the progress made so far and hands the world to the visitor', () => {
      const mid = tourUntil(startedTour(), (s) => s.discover.steps.need)
      const state = run(mid, EXIT)
      expect(state.mode).toBe('play')
      expect(state.tour.status).toBe('idle')
      expect(world(state)).toEqual(world(mid))
      // Nothing was reset, so the views must not snap.
      expect(state.epoch).toBe(mid.epoch)

      // The visitor carries on from exactly there.
      const byHand = run(state, explore('concept'), PITCH)
      expect(byHand).toMatchObject({ card: 'discover', cheers: 1 })
    })

    it('keeps completed missions and an open card', () => {
      const mid = tourUntil(startedTour(), (s) => s.card === 'signal')
      const state = run(mid, EXIT)
      expect(state.mode).toBe('play')
      expect(world(state)).toEqual(world(mid))
      expect(finished(state)).toEqual({ discover: true, signal: true, launch: false, network: false })
    })

    it('works the same from a paused sequence', () => {
      const paused = run(tourUntil(startedTour(), (s) => s.launch.ready.uat), PAUSE)
      const state = run(paused, EXIT)
      expect(state).toMatchObject({ mode: 'play', activeMission: 'launch' })
      expect(world(state)).toEqual(world(paused))
    })

    it('keeps the finale', () => {
      const done = tourFinished()
      const state = run(done, EXIT)
      expect(state).toMatchObject({ mode: 'play', phase: 'finale' })
      expect(world(state)).toEqual(world(done))
    })

    it('from an untouched Film slate returns to the intro', () => {
      const state = run(createInitialState({ mode: 'film' }), EXIT)
      expect(state).toMatchObject({ mode: 'play', phase: 'intro', ...UNTOUCHED })
      expect(state.tour.status).toBe('idle')
    })

    it('from a tour that has not touched the world yet also returns to the intro', () => {
      expect(run(startedTour(), EXIT)).toMatchObject({ mode: 'play', phase: 'intro', ...UNTOUCHED })
    })

    it('does nothing in play mode', () => {
      const state = playing()
      expect(run(state, EXIT)).toBe(state)
    })

    it('a later Guided tour starts again from the top as a new run', () => {
      const exited = run(tourUntil(startedTour(), (s) => s.card === 'network'), EXIT)
      const again = run(exited, { type: 'START_TOUR', mode: 'tour' })
      expect(again).toMatchObject({ mode: 'tour', phase: 'active', ...UNTOUCHED })
      expect(again.tour).toEqual({ status: 'running', cursor: 0, runId: exited.tour.runId + 1 })
    })
  })

  describe('Replay at the end of the sequence', () => {
    it.each(['tour', 'film'] as const)('restarts the sequence in %s mode', (mode) => {
      const done = tourUntil(createInitialState({ mode, autostart: true }), (s) => s.tour.status === 'done')
      const state = run(done, REPLAY)
      expect(state).toMatchObject({ mode, phase: 'active', ...UNTOUCHED })
      expect(state.tour).toEqual({ status: 'running', cursor: 0, runId: done.tour.runId + 1 })
      expect(state.epoch).toBe(done.epoch + 1)
    })
  })
})

describe('the resume', () => {
  it('opens and closes, and repeated presses return the very same state', () => {
    const closed = playing()
    const open = run(closed, OPEN_RESUME)
    expect(open.resumeOpen).toBe(true)
    expect(run(open, OPEN_RESUME)).toBe(open)

    const closedAgain = run(open, CLOSE_RESUME)
    expect(closedAgain.resumeOpen).toBe(false)
    expect(run(closedAgain, CLOSE_RESUME)).toBe(closedAgain)
    expect(run(closed, CLOSE_RESUME)).toBe(closed)
  })

  it('never changes the world or the progress behind it', () => {
    const mid = run(solveAndClose(playing(), 'network'), select('signal'), switchOn('revenue'), START_FEED)
    expect(run(mid, OPEN_RESUME, CLOSE_RESUME)).toEqual(mid)
    const finale = run(lastCardOpen(), DISMISS)
    expect(run(finale, OPEN_RESUME, CLOSE_RESUME)).toEqual(finale)
  })

  it('opening it pauses a running sequence so nothing is missed', () => {
    const running = tourUntil(startedTour(), (s) => s.card === 'network')
    const reading = run(running, OPEN_RESUME)
    expect(reading.resumeOpen).toBe(true)
    expect(reading.tour).toEqual({ ...running.tour, status: 'paused' })
    expect(world(reading)).toEqual(world(running))
  })

  it('closing it does not resume the sequence by itself', () => {
    const running = tourUntil(startedTour(), (s) => s.card === 'network')
    const back = run(running, OPEN_RESUME, CLOSE_RESUME)
    expect(back.tour.status).toBe('paused')
    expect(run(back, PLAY)).toEqual(running)
  })

  it('leaves a waiting, paused, or finished sequence as it is', () => {
    const states = [createInitialState({ mode: 'film' }), run(startedTour(), PAUSE), tourFinished()]
    for (const state of states) {
      expect(run(state, OPEN_RESUME).tour, state.tour.status).toEqual(state.tour)
      expect(run(state, OPEN_RESUME, CLOSE_RESUME), state.tour.status).toEqual(state)
    }
  })
})

describe('the reset counter (epoch) only moves when the world is reset', () => {
  it('stays the same through a whole play session', () => {
    const start = createInitialState()
    const end = MISSION_IDS.reduce(solveAndClose, run(start, { type: 'START_PLAY' }))
    expect(end.phase).toBe('finale')
    expect(end.epoch).toBe(start.epoch)
  })

  it('stays the same through a whole guided run, with pauses, the resume, and leaving', () => {
    const start = startedTour()
    const mid = run(tourUntil(start, (s) => s.card === 'signal'), PAUSE, PLAY, OPEN_RESUME, CLOSE_RESUME, PLAY)
    const end = run(tourUntil(mid, (s) => s.tour.status === 'done'), EXIT)
    expect(end.epoch).toBe(start.epoch)
  })
})

describe('one set of rules for visitors and for the guided sequence', () => {
  it('a visitor click gives the same result as the shared rule function', () => {
    const state = deepFreeze(run(playing(), select('signal'), switchOn('revenue')))
    for (const action of [switchOn('invoices'), START_FEED, select('launch'), LEAVE, connect(0)]) {
      expect(gameReducer(state, action), action.type).toEqual(applyMissionAction(state, action))
    }
  })

  it('the guided sequence uses those rules even though visitor clicks are blocked', () => {
    const busy = deepFreeze(tourUntil(startedTour(), (s) => s.activeMission === 'network'))
    expect(gameReducer(busy, connect(6))).toBe(busy)
    expect(applyMissionAction(busy, connect(6)).network.connected[6]).toBe(true)
  })
})

describe('the reducer never edits the state it is given', () => {
  // Every helper in this file freezes the state before each action, so all tests above
  // already fail loudly on an in-place edit. This one shows the same thing from the other
  // side: a state that is not frozen still looks exactly as it did after a long session.
  it('leaves an earlier state exactly as it was after a long mixed session', () => {
    const before = structuredClone(solve(playing(), 'network'))
    const snapshot = structuredClone(before)
    const session: GameAction[] = [
      DISMISS,
      select('signal'),
      START_FEED,
      switchOn('revenue'),
      OPEN_RESUME,
      CLOSE_RESUME,
      { type: 'START_TOUR', mode: 'tour' },
      PAUSE,
      PLAY,
      { type: 'TOUR_STEP', runId: before.tour.runId + 1, index: 0 },
      EXIT,
      REPLAY,
    ]
    const after = session.reduce(gameReducer, before)
    expect(before).toEqual(snapshot)
    expect(after).not.toBe(before)
  })
})
