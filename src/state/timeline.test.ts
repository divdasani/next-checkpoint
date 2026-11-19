import { describe, expect, it } from 'vitest'
import { content } from '../content/content.ts'
import { createInitialState, gameReducer } from './reducer.ts'
import { TOUR_DURATION_MS, TOUR_STEPS } from './timeline.ts'
import { COMPANY_COUNT, MISSION_IDS, READINESS_IDS, SOURCE_IDS, type GameState, type MissionId } from './types.ts'

// The guided sequence is a list of timed steps. These tests play that list through the
// real reducer and check two things: the story it tells (same rules as a visitor, nothing
// skipped) and its timing (40 to 60 seconds, with cards held long enough to read).

// Helpers ---------------------------------------------------------------------

/** Lock a state and everything inside it. Any attempt to change it in place then throws. */
function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const inner of Object.values(value as Record<string, unknown>)) deepFreeze(inner)
  }
  return value
}

/** One step of the sequence together with the state just before and just after it. */
interface Frame {
  index: number
  /** Milliseconds from the start of the sequence. */
  at: number
  before: GameState
  after: GameState
}

/** Play the whole sequence through the reducer, one TOUR_STEP per scripted step. */
function replay(start: GameState): Frame[] {
  const frames: Frame[] = []
  let state = start
  TOUR_STEPS.forEach((step, index) => {
    const after = gameReducer(deepFreeze(state), { type: 'TOUR_STEP', runId: state.tour.runId, index })
    frames.push({ index, at: step.at, before: state, after })
    state = after
  })
  return frames
}

/** The part of the state that is the world itself: no mode, timeline position, or resume flag. */
function world(state: GameState) {
  const { phase, activeMission, avatarStop, network, signal, launch, card, hint, cheers } = state
  return { phase, activeMission, avatarStop, network, signal, launch, card, hint, cheers }
}

function finished(state: GameState): Record<MissionId, boolean> {
  return {
    network: state.network.connected.every(Boolean),
    signal: state.signal.feedOn,
    launch: state.launch.launched,
  }
}

const tourFrames = () => replay(createInitialState({ mode: 'tour' }))

/** The first step after which something is true. Fails the test if that never happens. */
function firstFrame(frames: Frame[], reached: (state: GameState) => boolean, what: string): Frame {
  const frame = frames.find(({ after }) => reached(after))
  if (!frame) throw new Error(`The guided sequence never reached: ${what}`)
  return frame
}

// Tests -----------------------------------------------------------------------

describe('timing of the guided sequence', () => {
  it('lists its steps in strictly increasing time order', () => {
    expect(TOUR_STEPS.length).toBeGreaterThan(0)
    for (let index = 1; index < TOUR_STEPS.length; index++) {
      const step = TOUR_STEPS[index]
      expect(step.at, `step ${index} (${step.note})`).toBeGreaterThan(TOUR_STEPS[index - 1].at)
    }
  })

  it('lasts between 40 and 60 seconds, measured to its last step', () => {
    expect(TOUR_DURATION_MS).toBe(TOUR_STEPS[TOUR_STEPS.length - 1].at)
    expect(TOUR_DURATION_MS).toBeGreaterThanOrEqual(40_000)
    expect(TOUR_DURATION_MS).toBeLessThanOrEqual(60_000)
  })

  it('holds on the unfinished world for at least 3 seconds before anything happens', () => {
    const frames = tourFrames()
    const changed = ({ before, after }: Frame) => JSON.stringify(world(after)) !== JSON.stringify(world(before))
    const firstChange = frames.find(changed)
    expect(firstChange).toBeDefined()
    expect(firstChange?.at).toBeGreaterThanOrEqual(3_000)
  })

  it.each(MISSION_IDS)('keeps the %s card on screen long enough to read it at 200 words a minute', (mission) => {
    const frames = tourFrames()
    const opened = firstFrame(frames, (state) => state.card === mission, `${mission} card opens`)
    const closed = frames.find((frame) => frame.index > opened.index && frame.after.card !== mission)
    expect(closed, `the ${mission} card is closed again`).toBeDefined()
    // What a Film take shows on a card: the "Real experience" label, the statement, and its two labels.
    const { quote, labels } = content.missions[mission].evidence
    const words = [content.cardLabels.realExperience, quote, ...labels].join(' ').split(/\s+/).length
    const readingTime = (words / 200) * 60_000
    expect((closed?.at ?? 0) - opened.at).toBeGreaterThanOrEqual(readingTime)
  })

  it('holds on the finale for at least 5 seconds before the sequence is marked done', () => {
    const frames = tourFrames()
    const finale = firstFrame(frames, (state) => state.phase === 'finale', 'the finale')
    expect(TOUR_DURATION_MS - finale.at).toBeGreaterThanOrEqual(5_000)
    // The sequence keeps "running" during that hold, so its controls stay as they are.
    expect(finale.after.tour.status).toBe('running')
  })

  it('matches the length the intro promises, when the intro states one', () => {
    // content.intro.tourNote tells visitors roughly how long the tour takes ("about 50 seconds").
    // If that wording keeps a number, the number has to be true. Without a number there is no claim to check.
    const stated = /(\d+)\s*seconds/.exec(content.intro.tourNote)
    if (stated) expect(Math.abs(Number(stated[1]) - TOUR_DURATION_MS / 1000)).toBeLessThanOrEqual(5)
  })
})

describe('the story the guided sequence tells', () => {
  it('visits the three destinations in order: network, signal, launch', () => {
    const visits = TOUR_STEPS.flatMap((step) => (step.action?.type === 'SELECT_MISSION' ? [step.action.mission] : []))
    expect(visits).toEqual(['network', 'signal', 'launch'])
    expect(visits).toEqual([...MISSION_IDS])
  })

  it('connects all eight companies, each exactly once', () => {
    const connected = TOUR_STEPS.flatMap((step) => (step.action?.type === 'CONNECT_COMPANY' ? [step.action.index] : []))
    expect([...connected].sort((a, b) => a - b)).toEqual(Array.from({ length: COMPANY_COUNT }, (_, index) => index))
  })

  it('switches on every source and prepares every check, each exactly once', () => {
    const sources = TOUR_STEPS.flatMap((step) => (step.action?.type === 'ACTIVATE_SOURCE' ? [step.action.source] : []))
    const checks = TOUR_STEPS.flatMap((step) => (step.action?.type === 'PREPARE' ? [step.action.item] : []))
    expect([...sources].sort()).toEqual([...SOURCE_IDS].sort())
    expect([...checks].sort()).toEqual([...READINESS_IDS].sort())
  })

  it('never breaks a prerequisite: no "something is missing" hint ever appears', () => {
    for (const { after, index } of tourFrames()) {
      expect(after.hint, `after step ${index} (${TOUR_STEPS[index].note})`).toBeNull()
    }
  })

  it('every scripted action changes the world, so no step is wasted or silently ignored', () => {
    for (const { before, after, index } of tourFrames()) {
      const step = TOUR_STEPS[index]
      if (step.action) {
        expect(world(after), `step ${index} (${step.note})`).not.toEqual(world(before))
      } else {
        // A pure hold only lets time pass.
        expect(world(after), `step ${index} (${step.note})`).toEqual(world(before))
      }
    }
  })

  it('moves the cursor one step at a time and stays running until the very last step', () => {
    const frames = tourFrames()
    frames.forEach(({ after, index }) => {
      expect(after.tour.cursor).toBe(index + 1)
      expect(after.tour.status).toBe(index === frames.length - 1 ? 'done' : 'running')
    })
  })

  it('sends the avatar to each destination as it is selected, and to the launch stop for the ending', () => {
    for (const { after, index } of tourFrames()) {
      const action = TOUR_STEPS[index].action
      if (action?.type === 'SELECT_MISSION') expect(after.avatarStop).toBe(action.mission)
    }
    expect(tourFrames().at(-1)?.after.avatarStop).toBe('launch')
  })

  it('opens each Real experience card at the moment its mission completes, in mission order', () => {
    const frames = tourFrames()
    const opened = frames.filter(({ before, after }) => after.card !== null && before.card !== after.card)
    expect(opened.map(({ after }) => after.card)).toEqual(['network', 'signal', 'launch'])
    for (const { before, after } of opened) {
      const mission = after.card
      if (!mission) continue
      expect(finished(before)[mission]).toBe(false)
      expect(finished(after)[mission]).toBe(true)
    }
  })

  it('ends done, in the finale, with all three missions complete and no card open', () => {
    const end = tourFrames().at(-1)?.after
    expect(end).toBeDefined()
    if (!end) return
    expect(end.tour).toMatchObject({ status: 'done', cursor: TOUR_STEPS.length })
    expect(end).toMatchObject({ phase: 'finale', card: null, activeMission: null, hint: null })
    expect(finished(end)).toEqual({ network: true, signal: true, launch: true })
    // Three completions and the finale: one small avatar gesture each.
    expect(end.cheers).toBe(4)
  })
})

describe('one sequence and one set of rules for every mode', () => {
  it('Film mode plays exactly the same world, step for step, as the Guided tour', () => {
    const tour = tourFrames()
    const film = replay(createInitialState({ mode: 'film', autostart: true }))
    expect(film.map(({ after }) => world(after))).toEqual(tour.map(({ after }) => world(after)))
    expect(film.at(-1)?.after.mode).toBe('film')
  })

  it('a Film take started from the slate plays the same sequence', () => {
    const slate = createInitialState({ mode: 'film' })
    const film = replay(gameReducer(slate, { type: 'TOUR_PLAY' }))
    expect(film.map(({ after }) => world(after))).toEqual(tourFrames().map(({ after }) => world(after)))
  })

  it('a visitor making the same clicks by hand reaches the same world after every step', () => {
    let byHand = gameReducer(createInitialState(), { type: 'START_PLAY' })
    for (const { after, index } of tourFrames()) {
      const step = TOUR_STEPS[index]
      if (step.action) byHand = gameReducer(deepFreeze(byHand), step.action)
      expect(world(byHand), `after step ${index} (${step.note})`).toEqual(world(after))
    }
    expect(byHand.mode).toBe('play')
  })

  it('a second run after Restart tells exactly the same story', () => {
    const first = tourFrames()
    const end = first.at(-1)?.after ?? createInitialState({ mode: 'tour' })
    const second = replay(gameReducer(end, { type: 'TOUR_RESTART' }))
    expect(second.map(({ after }) => world(after))).toEqual(first.map(({ after }) => world(after)))
  })
})
