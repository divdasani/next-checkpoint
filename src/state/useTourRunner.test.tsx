import { act, cleanup, render } from '@testing-library/react'
import { StrictMode, useCallback, useEffect, useReducer, type Dispatch } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createInitialState, gameReducer } from './reducer.ts'
import { TOUR_DURATION_MS, TOUR_STEPS } from './timeline.ts'
import { COMPANY_COUNT, type GameAction, type GameState } from './types.ts'
import { useTourRunner } from './useTourRunner.ts'

// useTourRunner is the clock of the Guided tour and Film mode: it waits, then sends the
// next TOUR_STEP. These tests run it against the real reducer with a fake clock, so a
// 50 second sequence takes milliseconds and every moment can be checked exactly.

// Harness -----------------------------------------------------------------------

const notMounted: Dispatch<GameAction> = () => {
  throw new Error('The harness is not mounted.')
}

/** The newest state the harness has rendered. */
let latest: GameState | null = null
/** The reducer's own dispatch, used by the tests to act as the visitor. */
let send = notMounted
/** Everything the runner itself dispatched, with the (fake) clock time of each dispatch. */
let fromRunner: { action: GameAction; clock: number }[] = []

/**
 * The smallest possible stand-in for GameProvider: the real reducer plus the runner.
 * The runner gets a dispatch that also writes to `fromRunner`, so the tests can see
 * exactly what it sent and when.
 */
function Harness({ initial }: { initial: GameState }) {
  const [state, dispatch] = useReducer(gameReducer, initial)
  const record = useCallback((action: GameAction) => {
    fromRunner.push({ action, clock: Date.now() })
    dispatch(action)
  }, [])
  useTourRunner(state.tour, record)
  useEffect(() => {
    latest = state
    send = dispatch
  })
  return null
}

function mount(initial: GameState = createInitialState({ mode: 'tour' }), strict = false) {
  const harness = <Harness initial={initial} />
  return render(strict ? <StrictMode>{harness}</StrictMode> : harness)
}

function state(): GameState {
  if (!latest) throw new Error('The harness is not mounted.')
  return latest
}

/** Dispatch an action the way a button or shortcut would. */
function press(action: GameAction): void {
  act(() => {
    send(action)
  })
}

/**
 * Move the fake clock forward by `ms`.
 *
 * It stops at every timer on the way and lets React re-render there, which is what a
 * browser does between timers. (Jumping the whole distance inside one act() would fire
 * only the first step: the runner schedules the next one after React has re-rendered.)
 * The marker timer below makes the clock stop exactly at the requested moment.
 */
function advance(ms: number): void {
  let arrived = false
  setTimeout(() => {
    arrived = true
  }, ms)
  for (let stops = 0; !arrived; stops++) {
    // Far more stops than a sequence has steps. Getting here means timers are being
    // created without end, so fail with a message instead of hanging the test run.
    if (stops > 5_000) throw new Error('The fake clock never reached the requested time.')
    act(() => {
      vi.advanceTimersToNextTimer()
    })
  }
}

/** Pretend the browser tab was hidden or shown again, and announce it like a browser does. */
function setTabHidden(hidden: boolean): void {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
}

const PAUSE: GameAction = { type: 'TOUR_PAUSE' }
const PLAY: GameAction = { type: 'TOUR_PLAY' }
const RESTART: GameAction = { type: 'TOUR_RESTART' }

/** When the first two steps are due, in milliseconds from the start. */
const FIRST = TOUR_STEPS[0].at
const SECOND = TOUR_STEPS[1].at
/** The scripted time of every step, in order. */
const SCHEDULE = TOUR_STEPS.map((step) => step.at)

/** The steps the runner sent, as [index, runId] pairs. */
function stepsSent(entries = fromRunner): [index: number, runId: number][] {
  const steps: [index: number, runId: number][] = []
  for (const { action } of entries) {
    if (action.type === 'TOUR_STEP') steps.push([action.index, action.runId])
  }
  return steps
}

function expectFinale(): void {
  const end = state()
  expect(end.tour.status).toBe('done')
  expect(end).toMatchObject({ phase: 'finale', card: null })
  expect(end.network.connected.filter(Boolean)).toHaveLength(COMPANY_COUNT)
  expect(end.signal.feedOn).toBe(true)
  expect(end.launch.launched).toBe(true)
}

beforeEach(() => {
  vi.useFakeTimers()
  latest = null
  send = notMounted
  fromRunner = []
})

afterEach(() => {
  // Unmount while the fake clock is still installed, so the runner clears a fake timer.
  cleanup()
  Reflect.deleteProperty(document, 'hidden')
  vi.useRealTimers()
})

// Tests -----------------------------------------------------------------------

describe('playing the sequence', () => {
  it('finishes in the finale after exactly the scripted duration', () => {
    mount()
    advance(TOUR_DURATION_MS - 1)
    expect(state().tour.status).toBe('running')
    advance(1)
    expectFinale()
  })

  it('does nothing before the first step is due, then selects the first mission', () => {
    mount()
    const start = state()
    advance(FIRST - 1)
    expect(state()).toBe(start)
    expect(fromRunner).toHaveLength(0)

    advance(1)
    expect(state().tour.cursor).toBe(1)
    expect(state()).toMatchObject({ activeMission: 'network', avatarStop: 'network' })

    advance(SECOND - FIRST - 1)
    expect(state().tour.cursor).toBe(1)
    advance(1)
    expect(state().tour.cursor).toBe(2)
    expect(state().network.connected.filter(Boolean)).toHaveLength(1)
  })

  it('sends every step exactly once, in order, each at its scripted time', () => {
    mount()
    const startedAt = Date.now()
    const runId = state().tour.runId
    advance(TOUR_DURATION_MS)

    expect(fromRunner.every(({ action }) => action.type === 'TOUR_STEP')).toBe(true)
    expect(stepsSent()).toEqual(TOUR_STEPS.map((_, index) => [index, runId]))
    expect(fromRunner.map(({ clock }) => clock - startedAt)).toEqual(SCHEDULE)
  })

  it('keeps exactly one timer waiting while it runs, and none once it has finished', () => {
    mount()
    expect(vi.getTimerCount()).toBe(1)
    let clock = 0
    for (const step of TOUR_STEPS.slice(0, -1)) {
      // Stop right after each step has fired: the timer for the next one must be the only one.
      advance(step.at - clock)
      clock = step.at
      expect(vi.getTimerCount(), `after "${step.note}"`).toBe(1)
    }
    advance(TOUR_DURATION_MS - clock)
    expectFinale()
    expect(vi.getTimerCount()).toBe(0)
    // Long after the end nothing else is sent.
    const sent = fromRunner.length
    advance(TOUR_DURATION_MS)
    expect(fromRunner).toHaveLength(sent)
  })
})

describe('Pause and Resume', () => {
  it('pausing clears the timer and freezes the sequence for as long as it takes', () => {
    mount()
    advance(FIRST + 200)
    press(PAUSE)
    const paused = state()
    const sent = fromRunner.length
    expect(paused.tour.status).toBe('paused')
    expect(vi.getTimerCount()).toBe(0)

    advance(10 * TOUR_DURATION_MS)
    expect(state()).toBe(paused)
    expect(fromRunner).toHaveLength(sent)
  })

  it('resuming waits only for the rest of the interrupted wait, not the whole wait again', () => {
    mount()
    const waited = Math.floor(FIRST / 3)
    advance(waited)
    press(PAUSE)
    advance(60_000)
    press(PLAY)
    expect(vi.getTimerCount()).toBe(1)

    advance(FIRST - waited - 1)
    expect(state().tour.cursor).toBe(0)
    advance(1)
    expect(state().tour.cursor).toBe(1)
  })

  it('however often it is paused, the running time still adds up to the scripted duration', () => {
    mount()
    const startedAt = Date.now()
    const pauses: [from: number, to: number][] = []
    // Stretches of running time between pauses: mid-wait, exactly on a step, one millisecond
    // before a step, and deep inside a card hold.
    const stretches = [1_234, FIRST - 1_234, SECOND - FIRST - 1, 1, 7_777, 13_337, 9_001]
    let ran = 0
    for (const stretch of stretches) {
      advance(stretch)
      ran += stretch
      press(PAUSE)
      const from = Date.now()
      advance(4_321)
      pauses.push([from, Date.now()])
      press(PLAY)
    }
    expect(ran).toBeLessThan(TOUR_DURATION_MS)

    advance(TOUR_DURATION_MS - ran - 1)
    expect(state().tour.status).toBe('running')
    advance(1)
    expectFinale()

    // Each step fired at its own scripted position once the paused time is taken out.
    const runningTime = (clock: number) =>
      clock - startedAt - pauses.filter(([, to]) => to <= clock).reduce((total, [from, to]) => total + (to - from), 0)
    expect(fromRunner.map(({ clock }) => runningTime(clock))).toEqual(SCHEDULE)
    expect(stepsSent().map(([index]) => index)).toEqual(TOUR_STEPS.map((_, index) => index))
  })

  it('opening the resume stops the clock like Pause, and closing it does not restart it', () => {
    mount()
    const intoWait = 100
    advance(FIRST + intoWait)
    press({ type: 'OPEN_RESUME' })
    expect(vi.getTimerCount()).toBe(0)
    advance(30_000)
    press({ type: 'CLOSE_RESUME' })
    expect(vi.getTimerCount()).toBe(0)
    advance(30_000)
    expect(state().tour.cursor).toBe(1)

    press(PLAY)
    advance(SECOND - FIRST - intoWait - 1)
    expect(state().tour.cursor).toBe(1)
    advance(1)
    expect(state().tour.cursor).toBe(2)
  })
})

describe('Restart', () => {
  it('mid-run resets the world and plays the whole sequence again from zero', () => {
    mount()
    const firstRun = state().tour.runId
    advance(Math.floor(TOUR_DURATION_MS / 2))
    expect(state().tour.cursor).toBeGreaterThan(5)

    press(RESTART)
    const restartedAt = Date.now()
    const sentBefore = fromRunner.length
    expect(state().tour).toEqual({ status: 'running', cursor: 0, runId: firstRun + 1 })
    expect(state()).toMatchObject({ activeMission: null, avatarStop: 'home', card: null, cheers: 0 })
    expect(state().network.connected.some(Boolean)).toBe(false)
    expect(vi.getTimerCount()).toBe(1)

    advance(FIRST - 1)
    expect(state().tour.cursor).toBe(0)
    advance(1)
    expect(state()).toMatchObject({ activeMission: 'network' })

    advance(TOUR_DURATION_MS - FIRST)
    expectFinale()
    // The second run sent its own complete set of steps, on the scripted schedule.
    const second = fromRunner.slice(sentBefore)
    expect(stepsSent(second)).toEqual(TOUR_STEPS.map((_, index) => [index, firstRun + 1]))
    expect(second.map(({ clock }) => clock - restartedAt)).toEqual(SCHEDULE)
  })

  it('from a paused run starts from zero too, not from where the pause left off', () => {
    mount()
    advance(FIRST - 500)
    press(PAUSE)
    press(RESTART)
    expect(state().tour.status).toBe('running')

    advance(FIRST - 1)
    expect(state().tour.cursor).toBe(0)
    advance(1)
    expect(state().tour.cursor).toBe(1)
  })

  it('Film mode waits on the slate, then plays take after take, each one full length', () => {
    mount(createInitialState({ mode: 'film' }))
    expect(vi.getTimerCount()).toBe(0)
    advance(TOUR_DURATION_MS)
    expect(state().tour).toMatchObject({ status: 'ready', cursor: 0 })
    expect(fromRunner).toHaveLength(0)

    press(PLAY)
    for (let take = 1; take <= 3; take++) {
      advance(TOUR_DURATION_MS - 1)
      expect(state().tour.status, `take ${take}`).toBe('running')
      advance(1)
      expectFinale()
      advance(5_000)
      press(RESTART)
      expect(state()).toMatchObject({ phase: 'active', activeMission: null, avatarStop: 'home', cheers: 0 })
    }
  })
})

describe('leaving and coming back', () => {
  it('Play it yourself stops the clock, and a later Guided tour starts from zero', () => {
    mount()
    advance(FIRST + 700)
    press({ type: 'EXIT_TOUR' })
    expect(state().mode).toBe('play')
    expect(vi.getTimerCount()).toBe(0)

    const sent = fromRunner.length
    advance(TOUR_DURATION_MS)
    expect(fromRunner).toHaveLength(sent)
    // The visitor now owns the world the tour left behind.
    expect(state().activeMission).toBe('network')

    press({ type: 'START_TOUR', mode: 'tour' })
    advance(FIRST - 1)
    expect(state().tour.cursor).toBe(0)
    advance(1)
    expect(state().tour.cursor).toBe(1)
    advance(TOUR_DURATION_MS - FIRST)
    expectFinale()
  })
})

describe('when nothing should be running', () => {
  it('sets no timer in play mode', () => {
    mount(createInitialState())
    expect(vi.getTimerCount()).toBe(0)
    advance(TOUR_DURATION_MS)
    expect(fromRunner).toHaveLength(0)
    expect(state()).toMatchObject({ mode: 'play', phase: 'intro' })
  })

  it('sets no timer when the page opens paused behind the resume', () => {
    mount(createInitialState({ mode: 'tour', resumeOpen: true }))
    expect(vi.getTimerCount()).toBe(0)
    press({ type: 'CLOSE_RESUME' })
    expect(vi.getTimerCount()).toBe(0)
    advance(TOUR_DURATION_MS)
    expect(state().tour).toMatchObject({ status: 'paused', cursor: 0 })

    press(PLAY)
    advance(FIRST - 1)
    expect(state().tour.cursor).toBe(0)
    advance(1)
    expect(state().tour.cursor).toBe(1)
  })
})

describe('when the browser tab is hidden', () => {
  it('pauses a running sequence, and it continues from the same position afterwards', () => {
    mount()
    const beforeHiding = 1_000
    advance(FIRST - beforeHiding)
    setTabHidden(true)
    expect(state().tour.status).toBe('paused')
    expect(vi.getTimerCount()).toBe(0)

    advance(120_000)
    expect(state().tour.cursor).toBe(0)

    setTabHidden(false)
    // Resume is pressed in case the sequence waits for the visitor. If it had resumed by
    // itself this press would change nothing.
    press(PLAY)
    advance(beforeHiding - 1)
    expect(state().tour.cursor).toBe(0)
    advance(1)
    expect(state().tour.cursor).toBe(1)
  })

  it('a sequence that starts in a tab that is already hidden is paused at once, before any step', () => {
    // For example a "?mode=tour" link opened in a background tab.
    setTabHidden(true)
    mount()
    expect(state().tour).toMatchObject({ status: 'paused', cursor: 0 })
    expect(fromRunner.map(({ action }) => action)).toEqual([PAUSE])
    expect(vi.getTimerCount()).toBe(0)
  })

  it('then nothing plays for as long as the tab stays hidden', () => {
    setTabHidden(true)
    mount()
    const waiting = state()
    advance(10 * TOUR_DURATION_MS)
    expect(state()).toBe(waiting)
    expect(stepsSent()).toEqual([])
    expect(vi.getTimerCount()).toBe(0)
  })

  it('once the tab is shown and it is resumed, it plays the whole sequence from the very start', () => {
    setTabHidden(true)
    mount()
    advance(60_000)
    setTabHidden(false)
    // As above: Resume is pressed in case the sequence waits for the visitor.
    press(PLAY)
    const resumedAt = Date.now()

    advance(FIRST - 1)
    expect(state().tour.cursor).toBe(0)
    advance(1)
    expect(state()).toMatchObject({ activeMission: 'network' })
    advance(TOUR_DURATION_MS - FIRST)
    expectFinale()
    // Nothing was lost or shortened by the wait: every step ran once, on the scripted schedule.
    const steps = fromRunner.filter(({ action }) => action.type === 'TOUR_STEP')
    expect(steps.map(({ clock }) => clock - resumedAt)).toEqual(SCHEDULE)
  })

  it('cannot be made to play unseen: Resume while the tab is still hidden pauses again at once', () => {
    setTabHidden(true)
    mount()
    press(PLAY)
    expect(state().tour).toMatchObject({ status: 'paused', cursor: 0 })
    expect(vi.getTimerCount()).toBe(0)
    advance(TOUR_DURATION_MS)
    expect(stepsSent()).toEqual([])
  })

  it.each<[what: string, opensAs: GameState, then: GameAction | null]>([
    ['a Film take with autostart', createInitialState({ mode: 'film', autostart: true }), null],
    ['a Film take started from the slate', createInitialState({ mode: 'film' }), PLAY],
    ['a Restart', createInitialState({ mode: 'tour' }), RESTART],
    ['a Guided tour started from the first screen', createInitialState(), { type: 'START_TOUR', mode: 'tour' }],
  ])('%s in a hidden tab is paused before any step as well', (_what, opensAs, then) => {
    setTabHidden(true)
    mount(opensAs)
    if (then) press(then)
    expect(state().tour).toMatchObject({ status: 'paused', cursor: 0 })
    advance(TOUR_DURATION_MS)
    expect(stepsSent()).toEqual([])
  })

  it('pauses at once under React StrictMode too, which runs every effect twice in development', () => {
    setTabHidden(true)
    mount(undefined, true)
    expect(state().tour).toMatchObject({ status: 'paused', cursor: 0 })
    expect(vi.getTimerCount()).toBe(0)
    advance(TOUR_DURATION_MS)
    expect(stepsSent()).toEqual([])
  })

  it('ignores a visibility event while the tab is still visible', () => {
    mount()
    advance(1_000)
    setTabHidden(false)
    expect(state().tour.status).toBe('running')
    expect(vi.getTimerCount()).toBe(1)
  })

  it('sends nothing when no sequence is running', () => {
    mount(createInitialState())
    setTabHidden(true)
    expect(fromRunner).toHaveLength(0)
  })
})

describe('a click that lands in the same instant as a step', () => {
  // In a browser a click and a timer can both be handled before React re-renders.
  // Wrapping both in one act() reproduces that.

  it('Pause just before the timer fires: the step is not lost, it runs right after Resume', () => {
    mount()
    advance(FIRST - 1)
    act(() => {
      send(PAUSE)
      vi.advanceTimersByTime(1)
    })
    expect(state().tour).toMatchObject({ status: 'paused', cursor: 0 })
    expect(state().activeMission).toBeNull()

    press(PLAY)
    advance(0)
    expect(state().tour.cursor).toBe(1)
    expect(state().activeMission).toBe('network')
    // The rest of the schedule is not shifted.
    advance(SECOND - FIRST - 1)
    expect(state().tour.cursor).toBe(1)
    advance(1)
    expect(state().tour.cursor).toBe(2)
  })

  it('Pause just after the timer fires: the step counts, and the next wait is the full one', () => {
    mount()
    advance(FIRST - 1)
    act(() => {
      vi.advanceTimersByTime(1)
      send(PAUSE)
    })
    expect(state().tour).toMatchObject({ status: 'paused', cursor: 1 })

    advance(10_000)
    press(PLAY)
    advance(SECOND - FIRST - 1)
    expect(state().tour.cursor).toBe(1)
    advance(1)
    expect(state().tour.cursor).toBe(2)
  })

  it('Restart just before the timer fires: the old step is dropped and the new run starts clean', () => {
    mount()
    const firstRun = state().tour.runId
    advance(FIRST - 1)
    act(() => {
      send(RESTART)
      vi.advanceTimersByTime(1)
    })
    expect(state().tour).toEqual({ status: 'running', cursor: 0, runId: firstRun + 1 })
    expect(state().activeMission).toBeNull()

    advance(FIRST - 1)
    expect(state().tour.cursor).toBe(0)
    advance(1)
    expect(state().tour.cursor).toBe(1)
  })
})

describe('cleaning up', () => {
  it('unmounting clears the pending timer, and nothing fires afterwards', () => {
    const view = mount()
    advance(FIRST + 200)
    expect(vi.getTimerCount()).toBe(1)
    const sent = fromRunner.length
    const last = state()

    view.unmount()
    expect(vi.getTimerCount()).toBe(0)
    expect(() => advance(2 * TOUR_DURATION_MS)).not.toThrow()
    expect(fromRunner).toHaveLength(sent)
    expect(state()).toBe(last)
  })

  it('stops listening for tab visibility after unmount', () => {
    const view = mount()
    advance(500)
    view.unmount()
    setTabHidden(true)
    expect(fromRunner).toHaveLength(0)
  })

  it('behaves the same under React StrictMode, which runs every effect twice in development', () => {
    mount(undefined, true)
    const startedAt = Date.now()
    // The first of the two effect runs must have cleared its timer again.
    expect(vi.getTimerCount()).toBe(1)

    advance(FIRST - 1)
    expect(state().tour.cursor).toBe(0)
    advance(1)
    expect(state().tour.cursor).toBe(1)
    expect(vi.getTimerCount()).toBe(1)

    advance(TOUR_DURATION_MS - FIRST)
    expectFinale()
    expect(fromRunner.map(({ clock }) => clock - startedAt)).toEqual(SCHEDULE)
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('while the 3D world is still downloading', () => {
  /** The smallest possible page: just the clock, told from outside whether it may run. */
  function Clock({ runs, dispatch }: { runs: boolean; dispatch: Dispatch<GameAction> }) {
    useTourRunner({ status: 'running', cursor: 0, runId: 1 }, dispatch, runs)
    return null
  }

  it('holds the clock without setting a timer, then plays the schedule from zero', () => {
    const dispatch = vi.fn()
    const view = render(<Clock runs={false} dispatch={dispatch} />)
    act(() => void vi.advanceTimersByTime(TOUR_DURATION_MS))
    expect([dispatch.mock.calls.length, vi.getTimerCount()]).toEqual([0, 0])

    view.rerender(<Clock runs dispatch={dispatch} />)
    act(() => void vi.advanceTimersByTime(TOUR_STEPS[0].at - 1))
    expect(dispatch).not.toHaveBeenCalled()
    act(() => void vi.advanceTimersByTime(1))
    expect(dispatch.mock.calls).toEqual([[{ type: 'TOUR_STEP', runId: 1, index: 0 }]])
  })
})
