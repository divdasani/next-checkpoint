import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { App, PASSPORT_REVEAL_MS } from './App.tsx'
import { content } from './content/content.ts'
import { TOUR_DURATION_MS, TOUR_STEPS } from './state/timeline.ts'
import { DISCOVERY_IDS, MISSION_IDS, READINESS_IDS, SOURCE_IDS, type MissionId } from './state/types.ts'
import { setWorldStatus } from './world/stage.ts'

// The whole site, used the way a visitor uses it: real buttons, real keys, the real page.
// The test browser (jsdom) has no WebGL, so the 3D world never starts and everything here
// happens through the HTML controls alone. That is the point: the site has to work completely
// without the world. The rules of the game are tested in state/reducer.test.ts. These tests
// check the wiring: each button, key, and address reaches those rules, and the page shows it.

const { identity, intro, overview, missions, finale, cardLabels, resume, trail } = content
const { discover, network, signal, launch } = missions
const STEPS = DISCOVERY_IDS.map((id) => discover.steps[id])
const COMPANIES = network.companyLabels
const SOURCES = SOURCE_IDS.map((id) => signal.sources[id])
const CHECKS = READINESS_IDS.map((id) => launch.readiness[id])
/**
 * The guided tour follows the trail: pitch deck, signal station, launch arch, hub.
 * These tests play the other way round.
 */
const VISITOR_ORDER: MissionId[] = ['network', 'launch', 'signal', 'discover']
const NO_WEBGL_NOTICE = 'The 3D world could not start in this browser'
const [TODO, HERE, DONE] = ['To do', 'Here', trail.stamped]
/** What the passport strip reports before anything has been done, and after everything has. */
const UNTOUCHED = [[TODO, TODO, TODO, TODO], overview.progress(0)]
const ALL_DONE = [[DONE, DONE, DONE, DONE], overview.progress(4)]
/** Each shortcut as [its name, the key the browser reports]. Space and K do the same thing. */
const PLAY_PAUSE_KEYS = Object.entries({ Space: ' ', K: 'k' })
const SHORTCUT_KEYS = [...PLAY_PAUSE_KEYS, ...Object.entries({ R: 'r', Escape: 'Escape' })]
/** When the guided sequence takes its first step and turns to the pitch deck. */
const FIRST_STEP = TOUR_STEPS[0].at

// Several tests replay the whole guided sequence. A busy machine needs more than the usual five seconds.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 })
afterAll(() => vi.resetConfig())

// Helpers -------------------------------------------------------------------------

/** Open the site at an address, as a browser tab would. */
function visit(address = '/') {
  window.history.replaceState(null, '', address)
  return render(<App />)
}
const address = () => `${window.location.pathname}${window.location.search}${window.location.hash}`
/** The whole page as text. Two equal copies mean that nothing a visitor can see or hear has changed. */
const page = () => document.body.innerHTML

/** One part of the page, to look for things inside it. */
const part = (selector: string) => within(document.querySelector<HTMLElement>(selector)!)
const topBar = () => part('header') // the first header on the page
const panel = () => part('main')
const footer = () => part('footer')
/** The passport strip under the world: the passport button and the four stamp spaces. */
const passport = () => part(`nav[aria-label="${trail.passport}"]`)
/** Only the four stamp spaces, which are also the shortcuts to the missions. */
const chips = () => part(`nav[aria-label="${trail.passport}"] ol`)
const passportButton = () => passport().getByRole('button', { name: new RegExp(`^${trail.passport}:`) })
/** The count on the passport button, "0/4" to "4/4". */
const passportCount = () => document.querySelector('.passport-tab__count')?.textContent
/** Which stamp spaces in the strip hold a stamp, in trail order. */
const stamped = () =>
  [...document.querySelectorAll(`nav[aria-label="${trail.passport}"] ol .stamp`)].map(
    (stamp) => stamp.getAttribute('data-earned') === 'true',
  )
const tourBar = () => part('[role="group"][aria-label$=" controls"]')
const resumeSheet = () => part('dialog.resume-dialog[open]')
const passportSheet = () => part('dialog.passport-dialog[open]')

/** Click a button, found by its name. It looks in the panel unless told to look elsewhere. */
function press(name: string | RegExp, where = panel()) {
  fireEvent.click(where.getByRole('button', { name }))
}
/** Press a key, with nothing focused unless an element is given. False means the page claimed the key. */
const key = (name: string, on: Element = document.body) => fireEvent.keyDown(on, { key: name })

/** What the passport strip reports: each checkpoint as "To do", "Here" or "Stamped", then the count. */
function progress() {
  const words = chips()
    .getAllByRole('button')
    .map((chip) => new RegExp(`(${TODO}|${HERE}|${DONE})$`).exec(chip.textContent ?? '')?.[1])
  return [words, footer().getByText(/stamps collected$/).textContent]
}

function startPlaying() {
  visit()
  press(intro.startLabel)
}
/** Choose a mission with its stamp space under the world. */
const goTo = (mission: MissionId) => press(new RegExp(`^${trail.checkpoint} ${missions[mission].number}:`), chips())
/** The switches in the open mission panel: one per step, data source, readiness check, or company. */
const switchButtons = () => [...document.querySelectorAll('main button[aria-pressed]')]
/** Which of those switches are on, in the order they are shown. */
const switches = () => switchButtons().map((control) => control.getAttribute('aria-pressed') === 'true')
/** Press one switch, found by the label it starts with. */
const flip = (label: string) => press(new RegExp(`^${label.replaceAll(' ', '\\s*')}`))

/** Do every step of a mission with the buttons in its panel. Its checkpoint card is left open. */
function finish(mission: MissionId) {
  goTo(mission)
  switchButtons().forEach((control) => fireEvent.click(control))
  if (mission === 'discover') press(discover.pitchAction)
  if (mission === 'signal') press(signal.feedAction)
  if (mission === 'launch') press(launch.launchAction)
}
/** Close the open card with its own button: "Continue", or "See what comes next" on the last one. */
const closeCard = () => press(new RegExp(`^(${cardLabels.continue}|${cardLabels.continueToFinale})$`))

/** Finish all four missions in the visitor's order, closing each card. This ends on the finale. */
function finishEverything() {
  for (const mission of VISITOR_ORDER) {
    finish(mission)
    closeCard()
  }
}

/** Run the fake clock to its next timer and let React re-render there, as a browser would. */
const tick = () => act(() => void vi.advanceTimersToNextTimer())
/**
 * Move the fake clock forward by `ms`, stopping at every timer on the way. The marker timer
 * makes it stop at exactly the requested moment. (The technique of state/useTourRunner.test.tsx.)
 */
function advance(ms: number) {
  let arrived = false
  setTimeout(() => void (arrived = true), ms)
  for (let stops = 0; !arrived; stops++) {
    if (stops > 5_000) throw new Error('The fake clock never reached the requested time.')
    tick()
  }
}
/** Let the guided sequence play, one scripted step at a time, until a text shows in the panel. */
function playUntil(text: string) {
  for (let steps = 0; panel().queryByText(text) === null; steps++) {
    if (steps > TOUR_STEPS.length) throw new Error(`The guided sequence never showed "${text}".`)
    tick()
  }
}

// Stand-ins for what jsdom lacks. Each one is removed again after every test.

/**
 * jsdom has no showModal() or close(), so the site falls back to the plain "open" attribute.
 * These do what browsers do: remember what had focus when the dialog opened, give the focus
 * back when it closes, and then fire "close".
 */
function installDialogBuiltIns() {
  let hadFocus: Element | null = null
  Object.assign(HTMLDialogElement.prototype, {
    showModal(this: HTMLDialogElement) {
      hadFocus = document.activeElement
      this.setAttribute('open', '')
    },
    close(this: HTMLDialogElement) {
      this.removeAttribute('open')
      if (hadFocus instanceof HTMLElement) hadFocus.focus()
      this.dispatchEvent(new Event('close'))
    },
  })
}
/** jsdom has no matchMedia either. This one lets a test change a system setting during a visit. */
function installMatchMedia() {
  const media = Object.assign(new EventTarget(), { matches: false })
  vi.spyOn(media, 'addEventListener')
  vi.stubGlobal('matchMedia', () => media)
  return media
}
/**
 * Resize the browser window and tell the page. jsdom has no layout, so this also says where
 * the free part of the stage now is: everything between a 60px top bar and a 300px panel.
 */
function resizeTo(width: number, height: number) {
  vi.stubGlobal('innerWidth', width)
  vi.stubGlobal('innerHeight', height)
  vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(width)
  vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(height)
  const stage = document.querySelector('.stage-safe')!
  vi.spyOn(stage, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 60, width, height - 360))
  act(() => void window.dispatchEvent(new Event('resize')))
}
/** Watch the window or the document. The result lists the events that still have a listener attached. */
function listenersOn(target: EventTarget) {
  const added = vi.spyOn(target, 'addEventListener')
  const removed = vi.spyOn(target, 'removeEventListener')
  // A listener is only removed by the same event, the same function, and the same capture flag.
  const undone = (add: unknown[]) =>
    removed.mock.calls.some((remove) => remove[0] === add[0] && remove[1] === add[1] && !remove[2] === !add[2])
  const attached = () => added.mock.calls.filter((add) => !undone(add)).map(([type]) => type)
  // React keeps one "selectionchange" listener of its own on the document for as long as the page lives.
  return () => attached().filter((type) => type !== 'selectionchange').sort()
}

/** Every console error and warning during a test. A healthy page prints none. */
let complaints: string[] = []

beforeAll(async () => {
  // The 3D world is a separate file that arrives after the page is already readable. Load it
  // once here, so that every test below gets the complete page the moment it renders.
  await import('./world/WorldCanvas.tsx')
  const view = render(<App />)
  await screen.findByText(NO_WEBGL_NOTICE, {}, { timeout: 20_000 })
  view.unmount()
}, 60_000)

beforeEach(() => {
  vi.useFakeTimers()
  complaints = []
  const note = (...args: unknown[]) => void complaints.push(args.map(String).join(' '))
  vi.spyOn(console, 'error').mockImplementation(note)
  vi.spyOn(console, 'warn').mockImplementation(note)
})

afterEach(() => {
  // Unmount while the fake clock is still installed, so the tour's timer is cleared from it.
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  for (const name of ['showModal', 'close']) Reflect.deleteProperty(HTMLDialogElement.prototype, name)
  window.history.replaceState(null, '', '/')
  expect(complaints, 'console errors and warnings during the test').toEqual([])
})

// Tests ---------------------------------------------------------------------------

describe('the first screen', () => {
  beforeEach(() => void visit())

  it('says whose resume this is: her name and the role she is applying for', () => {
    expect(topBar().getByRole('heading', { name: intro.title })).toBeTruthy()
    expect(topBar().getByText(identity.name)).toBeTruthy()
    expect(topBar().getByText(identity.role)).toBeTruthy()
  })

  it.each([intro.startLabel, intro.tourLabel, intro.resumeLabel])('offers "%s" as a real button', (label) => {
    // A <button> works with a keyboard and a screen reader. A clickable <div> would not.
    expect(panel().getByRole('button', { name: label }).matches('button[type="button"]')).toBe(true)
  })

  it('shows no "Independent project" line: Annika asked for it to be removed everywhere', () => {
    // 19 November 2026. It used to stand in the footer, in the passport view, and under the
    // resume for visitors without JavaScript.
    expect(document.body.textContent).not.toMatch(/independent project|not affiliated|endorsed by/i)
  })

  it('names the trail and its curator, and says what the site demonstrates', () => {
    expect(panel().getByText(trail.byline)).toBeTruthy()
    expect(panel().getByText(trail.themes)).toBeTruthy()
    expect(panel().getByText(trail.demo)).toBeTruthy()
    // The same sentence is the one line under the world. (The stylesheet shows one of the two.)
    expect(footer().getByText(trail.demo)).toBeTruthy()
  })

  it('shows the passport from the start: 0/4, with four empty stamp spaces', () => {
    expect(passportCount()).toBe(trail.count(0))
    expect(stamped()).toEqual([false, false, false, false])
    expect(progress()).toEqual(UNTOUCHED)
    // Each empty space shows the number of its checkpoint.
    const spaces = [...document.querySelectorAll(`nav[aria-label="${trail.passport}"] ol .stamp`)]
    expect(spaces.map((space) => space.textContent)).toEqual(['1', '2', '3', '4'])
  })
})

describe('reading the resume before playing', () => {
  let opener: HTMLElement

  // Reach "Read resume" on the first screen with the keyboard and press it.
  beforeEach(() => {
    installDialogBuiltIns()
    visit()
    opener = panel().getByRole('button', { name: intro.resumeLabel })
    opener.focus()
    fireEvent.click(opener)
  })

  it('opens with LinkedIn as the only contact', () => {
    const links = resumeSheet().getAllByRole('link')
    expect(resumeSheet().getByText(resume.contactNote)).toBeTruthy()
    expect([...new Set(links.map((link) => link.getAttribute('href')))]).toEqual([identity.linkedInUrl])
  })

  it('Print resume asks the browser to print', () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    press('Print resume', resumeSheet())
    expect(print).toHaveBeenCalledTimes(1)
  })

  it('Close shuts it and puts the keyboard back on the button that opened it', () => {
    // While it is open, the keyboard is inside the resume, on her name.
    expect(document.activeElement).toBe(resumeSheet().getByRole('heading', { name: resume.name }))
    press('Close', resumeSheet())
    expect(document.querySelector('dialog[open]')).toBeNull()
    expect(document.activeElement).toBe(opener)
  })

  it('the address ends in #resume while it is open, and only then', () => {
    const whileOpen = address()
    press('Close', resumeSheet())
    expect([whileOpen, address()]).toEqual(['/#resume', '/'])
  })
})

describe('playing all four checkpoints with the buttons alone', () => {
  beforeEach(startPlaying)

  // Spot the Gap, Find the Signal, and Launch Day each end in one main button that needs three steps first.
  it.each([
    [discover.pitchAction, discover, STEPS],
    [signal.feedAction, signal, SOURCES],
    [launch.launchAction, launch, CHECKS],
  ] as const)('"%s" pressed too early says what is missing and offers the next step', (action, copy, steps) => {
    goTo(copy.id)
    press(action)
    expect(panel().getByText(copy.blocked(steps))).toBeTruthy()
    press(copy.nextAction(steps[0]))
    expect(switches()).toEqual([true, false, false])
  })

  it.each(VISITOR_ORDER.map((id) => [missions[id].title, id] as const))(
    'finishing "%s" shows its checkpoint card: the stamp, the results, the exact statement, and the skills',
    (_title, mission) => {
      finish(mission)
      const { checkpoint, evidence } = missions[mission]
      expect(panel().getByText(trail.checkpointComplete)).toBeTruthy()
      expect(panel().getByRole('heading', { name: trail.stampEarned(checkpoint.stamp) })).toBeTruthy()
      // The stamp on the card is the earned one, and it is this checkpoint's.
      const stamp = document.querySelector('main .evidence__head .stamp')
      expect([stamp?.getAttribute('data-mission'), stamp?.getAttribute('data-earned')]).toEqual([mission, 'true'])
      // The headline results, value then label.
      const results = [...document.querySelectorAll('main .metric')].map((metric) => metric.textContent)
      expect(results).toEqual(checkpoint.metrics.map((metric) => `${metric.value} ${metric.label}`))
      // The statement in her words, under its label.
      expect(panel().getByText(cardLabels.realExperience)).toBeTruthy()
      expect(document.querySelector('main blockquote')?.textContent).toBe(evidence.quote)
      // The skills this checkpoint unlocks.
      const skills = within(panel().getByText(trail.skillsUnlocked).parentElement!).getAllByRole('listitem')
      expect(skills.map((skill) => skill.textContent)).toEqual([...checkpoint.skills])
    },
  )

  it('the launch arch card shows the four partner teams coming together', () => {
    finish('launch')
    const teams = within(panel().getByRole('list', { name: 'Partner teams' })).getAllByRole('listitem')
    expect(teams.map((team) => team.textContent)).toEqual(['Engineering', 'Tax', 'Sales', 'Business'])
  })

  it('each finished checkpoint fills only its own stamp space, and the count goes from 0/4 to 4/4', () => {
    const seen = [[passportCount(), stamped()]]
    for (const mission of VISITOR_ORDER) {
      finish(mission)
      // The card states the same count as the passport button.
      expect(document.querySelector('main .evidence__count')?.textContent).toContain(passportCount())
      seen.push([passportCount(), stamped()])
      closeCard()
    }
    // The spaces are in trail order (Discover, Build, Ship, Scale). The visitor went backwards.
    expect(seen).toEqual([
      ['0/4', [false, false, false, false]],
      ['1/4', [false, false, false, true]],
      ['2/4', [false, false, true, true]],
      ['3/4', [false, true, true, true]],
      ['4/4', [true, true, true, true]],
    ])
  })

  it.each([
    ['a step that is already done', 'discover', STEPS[1]],
    ['a company that is already connected', 'network', COMPANIES[3]],
    ['a data source that is already on', 'signal', SOURCES[1]],
    ['a readiness check that is already ready', 'launch', CHECKS[2]],
  ] as const)('pressing %s changes nothing', (_what, mission, label) => {
    goTo(mission)
    flip(label)
    const before = page()
    flip(label)
    expect(switches().filter(Boolean)).toHaveLength(1)
    expect(page()).toBe(before)
  })

  it('after the fourth card, the trail is complete: four stamps, 4 of 4, and Resume, LinkedIn and Replay', () => {
    finishEverything()
    expect(panel().getByRole('heading', { name: trail.complete })).toBeTruthy()
    expect(panel().getByText(trail.name)).toBeTruthy()
    expect(panel().getByText(trail.completeCount)).toBeTruthy()
    const stamps = [...document.querySelectorAll('main .finale__stamps li')]
    expect(stamps.map((stamp) => stamp.querySelector('.stamp')?.getAttribute('data-earned'))).toEqual(MISSION_IDS.map(() => 'true'))
    expect(stamps.map((stamp) => stamp.querySelector('.finale__stamp-name')?.textContent)).toEqual([
      'Discovery',
      'Builder',
      'Launch',
      'Scale',
    ])
    expect(panel().getByRole('button', { name: finale.resumeLabel })).toBeTruthy()
    expect(panel().getByRole('link', { name: /^LinkedIn/ }).getAttribute('href')).toBe(identity.linkedInUrl)
    expect(panel().getByRole('button', { name: finale.replayLabel })).toBeTruthy()
  })

  it('the ending names Roblox as the next checkpoint: a space that is never stamped, under the sticker Annika asked for', () => {
    finishEverything()
    const next = within(panel().getByRole('group', { name: 'Next checkpoint: Roblox.' }))
    expect(next.getByRole('heading', { name: 'Next checkpoint: Roblox.' })).toBeTruthy()
    // The words beside the sticker say that she applied, which is as far as it has gone.
    expect(next.getByText(finale.applied)).toBeTruthy()
    expect(next.queryByText(finale.applying)).toBeNull()
    // One space. It is not an earned stamp, and there is nothing in it to press.
    const spaces = [...document.querySelectorAll('main .finale__next .stamp')]
    expect(spaces.map((space) => space.getAttribute('data-earned'))).toEqual(['false'])
    expect(next.queryAllByRole('button')).toEqual([])
    // The sticker on it is the wish she chose, and it is the only thing on the space.
    expect(spaces[0].textContent).toBe(trail.sticker)
    expect(spaces[0].querySelectorAll('.sticker')).toHaveLength(1)
    // Both are said in words too, for visitors who cannot see the ring or the sticker.
    expect(next.getByText(`${trail.notStamped}. Sticker: ${trail.sticker}`)).toBeTruthy()
  })

  it('Replay then takes the progress from 4 of 4 stamps back to 0 of 4, with every checkpoint "To do"', () => {
    finishEverything()
    const atTheEnd = progress()
    press(finale.replayLabel)
    expect([atTheEnd, progress()]).toEqual([ALL_DONE, UNTOUCHED])
  })

  it('Replay empties the world: every company, data source and check is off again', () => {
    finishEverything()
    press(finale.replayLabel)
    press(intro.startLabel)
    const found = VISITOR_ORDER.flatMap((mission) => {
      goTo(mission)
      return switches()
    })
    expect(found).toEqual([...COMPANIES, ...CHECKS, ...SOURCES, ...STEPS].map(() => false))
  })
})

describe('resizing the window in the middle of a mission', () => {
  /** Everything a visitor would hate to lose. */
  const kept = () => [progress(), switches(), panel().getByRole('progressbar').getAttribute('aria-valuetext')]
  const HALFWAY = [
    [[TODO, DONE, TODO, HERE], overview.progress(1)],
    [false, true, false, false, true, false, true, false],
    network.progress(3),
  ]
  let media: ReturnType<typeof installMatchMedia>

  // One mission finished, and three of the eight companies connected at the hub.
  beforeEach(() => {
    media = installMatchMedia()
    startPlaying()
    finish('signal')
    closeCard()
    goTo('network')
    for (const label of [COMPANIES[1], COMPANIES[4], COMPANIES[6]]) flip(label)
  })

  it('turning a phone on its side keeps the finished mission and every connected company', () => {
    resizeTo(844, 390)
    // The page did lay itself out again for the new size...
    expect(document.querySelector<HTMLElement>('.pin-layer')?.style.getPropertyValue('--stage-bottom')).toBe('300px')
    // ...and nothing the visitor had done was lost.
    expect(kept()).toEqual(HALFWAY)
  })

  it('switching the system to reduced motion mid-mission keeps them too', () => {
    // The page listens for this setting, so the change does reach it.
    expect(media.addEventListener).toHaveBeenCalledWith('change', expect.any(Function))
    media.matches = true
    act(() => void media.dispatchEvent(new Event('change')))
    expect(kept()).toEqual(HALFWAY)
  })
})

describe('the passport view', () => {
  let opener: HTMLElement

  // One checkpoint finished (Build), then the passport opened with the keyboard.
  beforeEach(() => {
    installDialogBuiltIns()
    startPlaying()
    finish('signal')
    closeCard()
    opener = passportButton()
    opener.focus()
    fireEvent.click(opener)
  })

  it('names the trail and its curator', () => {
    expect(document.activeElement).toBe(passportSheet().getByRole('heading', { name: trail.name }))
    expect(passportSheet().getByText(trail.byline)).toBeTruthy()
    expect(passportSheet().getByText(trail.themes)).toBeTruthy()
  })

  it('shows all four stamp spaces, and only the finished checkpoint holds a stamp and its skills', () => {
    const spaces = [...document.querySelectorAll('.passport-dialog__space')].map((space) => [
      space.querySelector('.passport-dialog__stamp-label')?.textContent,
      space.querySelector('.stamp')?.getAttribute('data-earned'),
      space.querySelector('.passport-dialog__state')?.textContent,
      [...space.querySelectorAll('.chip')].map((skill) => skill.textContent),
    ])
    expect(spaces).toEqual([
      ['Discovery', 'false', trail.notStamped, []],
      ['Builder', 'true', trail.stamped, [...signal.checkpoint.skills]],
      ['Launch', 'false', trail.notStamped, []],
      ['Scale', 'false', trail.notStamped, []],
    ])
    expect(passportSheet().getByText(overview.progress(1))).toBeTruthy()
  })

  it('keeps one more space, for Roblox, which is empty while the trail is unfinished', () => {
    expect(passportSheet().getByText(finale.heading)).toBeTruthy()
    const space = document.querySelector('.passport-dialog__next .stamp')
    expect(space?.getAttribute('data-earned')).toBe('false')
    // No sticker before the ending.
    expect(space?.textContent).toBe('')
  })

  it('Close shuts it, puts the keyboard back on the passport button, and leaves the visitor where they were', () => {
    press('Close', passportSheet())
    expect(document.querySelector('dialog[open]')).toBeNull()
    expect(document.activeElement).toBe(opener)
    expect(progress()).toEqual([[TODO, DONE, TODO, TODO], overview.progress(1)])
    expect(panel().getByRole('heading', { name: overview.heading })).toBeTruthy()
  })
})

describe('the passport view once the trail is complete', () => {
  it('puts the sticker on the Roblox space, and the line beside it now says that she applied', () => {
    installDialogBuiltIns()
    startPlaying()
    finishEverything()
    fireEvent.click(passportButton())
    expect(passportSheet().getByText(overview.progress(4))).toBeTruthy()
    // Still not an earned stamp, whatever the sticker says.
    const space = document.querySelector('.passport-dialog__next .stamp')
    expect(space?.getAttribute('data-earned')).toBe('false')
    expect(space?.textContent).toBe(trail.sticker)
    // Annika's wording for this state. The sticker is named for visitors who cannot see it.
    expect(document.querySelector('.passport-dialog__next .note')?.textContent).toBe(
      `Sticker: ${trail.sticker}. ${finale.applied}`,
    )
  })
})

describe('the passport opening by itself once the trail is complete', () => {
  const opened = () => document.querySelector('dialog.passport-dialog[open]') !== null
  /** Five seconds, split so a test can stop just short of them. */
  const ALMOST = PASSPORT_REVEAL_MS - 100

  beforeEach(() => {
    installDialogBuiltIns()
    startPlaying()
  })

  it('waits five seconds after "Trail complete" appears, then opens', () => {
    finishEverything()
    expect(panel().getByRole('heading', { name: trail.complete })).toBeTruthy()
    advance(ALMOST)
    expect(opened()).toBe(false)
    advance(100)
    expect(opened()).toBe(true)
    expect(passportSheet().getByText(overview.progress(4))).toBeTruthy()
    expect(passportSheet().getByText(finale.applied)).toBeTruthy()
  })

  it('does not open while the trail is unfinished, however long the visitor waits', () => {
    finish('signal')
    closeCard()
    advance(10 * PASSPORT_REVEAL_MS)
    expect(opened()).toBe(false)
  })

  it('opens once: after it is closed it stays closed, also when a card is reopened and closed again', () => {
    finishEverything()
    advance(PASSPORT_REVEAL_MS)
    press('Close', passportSheet())
    advance(10 * PASSPORT_REVEAL_MS)
    expect(opened()).toBe(false)
    press(new RegExp(`^${trail.checkpoint} 2:`))
    closeCard()
    advance(10 * PASSPORT_REVEAL_MS)
    expect(opened()).toBe(false)
  })

  it('a visitor who opens the passport on the ending has seen it, so it does not open again', () => {
    finishEverything()
    fireEvent.click(passportButton())
    press('Close', passportSheet())
    advance(10 * PASSPORT_REVEAL_MS)
    expect(opened()).toBe(false)
  })

  it('never opens over the resume: the five seconds start again when the resume is closed', () => {
    finishEverything()
    advance(ALMOST)
    press(finale.resumeLabel)
    advance(10 * PASSPORT_REVEAL_MS)
    expect(opened()).toBe(false)
    press('Close', resumeSheet())
    advance(ALMOST)
    expect(opened()).toBe(false)
    advance(100)
    expect(opened()).toBe(true)
  })

  it('starts the five seconds again when the visitor leaves the ending for a card and comes back', () => {
    finishEverything()
    advance(ALMOST)
    press(new RegExp(`^${trail.checkpoint} 3:`))
    advance(10 * PASSPORT_REVEAL_MS)
    expect(opened()).toBe(false)
    closeCard()
    advance(ALMOST)
    expect(opened()).toBe(false)
    advance(100)
    expect(opened()).toBe(true)
  })

  it('opens again for a second finished trail after Replay', () => {
    finishEverything()
    advance(PASSPORT_REVEAL_MS)
    press('Close', passportSheet())
    press(finale.replayLabel)
    press(intro.startLabel)
    finishEverything()
    advance(PASSPORT_REVEAL_MS)
    expect(opened()).toBe(true)
  })
})

describe('the Guided tour', () => {
  it.each([
    ['from the Guided tour button', '/', () => press(intro.tourLabel)],
    ['by itself when the address says ?mode=tour', '/?mode=tour', () => {}],
  ])('starts %s', (_how, at, start) => {
    visit(at)
    start()
    expect(tourBar().getByRole('button', { name: 'Pause' })).toBeTruthy()
    advance(FIRST_STEP)
    expect(panel().getByRole('heading', { name: discover.title })).toBeTruthy()
  })

  it('opens on the trail byline, the headline, and what the site demonstrates', () => {
    visit('/?mode=tour')
    expect(panel().getByText(trail.byline)).toBeTruthy()
    expect(panel().getByRole('heading', { name: intro.opening })).toBeTruthy()
    expect(panel().getByText(trail.demo)).toBeTruthy()
  })

  it('left alone, it ends on the finished trail with all four checkpoints stamped', () => {
    visit('/?mode=tour')
    advance(TOUR_DURATION_MS)
    expect(panel().getByRole('heading', { name: trail.complete })).toBeTruthy()
    expect(panel().getByRole('heading', { name: finale.heading })).toBeTruthy()
    expect(progress()).toEqual(ALL_DONE)
    expect(passportCount()).toBe(trail.count(4))
  })

  it('its cards say the same as the cards in play: results, skills, the statement, and the line under it', () => {
    visit('/?mode=tour')
    // The second checkpoint, because its statement has a line under it.
    playUntil(trail.stampEarned(signal.checkpoint.stamp))
    const results = [...document.querySelectorAll('main .metric')].map((metric) => metric.textContent)
    expect(results).toEqual(signal.checkpoint.metrics.map((metric) => `${metric.value} ${metric.label}`))
    expect(panel().getByText(trail.skillsUnlocked)).toBeTruthy()
    expect(panel().getByText(cardLabels.realExperience)).toBeTruthy()
    expect(document.querySelector('main blockquote')?.textContent).toBe(signal.evidence.quote)
    expect(panel().getByText(signal.evidence.note ?? '')).toBeTruthy()
    // The statement also reaches screen reader users through the hidden status line,
    // because the sequence never moves the keyboard focus onto the card.
    expect(screen.getByRole('status').textContent).toContain(signal.evidence.quote)
    // The one difference from play: the visitor cannot close the card. The sequence does.
    expect(panel().queryByRole('button')).toBeNull()
  })

  it('opens the passport by itself when it has finished, and not a moment before', () => {
    installDialogBuiltIns()
    visit('/?mode=tour')
    const opened = () => document.querySelector('dialog.passport-dialog[open]') !== null
    // The sequence ends more than five seconds after "Trail complete" appears.
    advance(TOUR_DURATION_MS - 1)
    expect(panel().getByRole('heading', { name: trail.complete })).toBeTruthy()
    expect(opened()).toBe(false)
    advance(1)
    tick()
    expect(opened()).toBe(true)
  })

  it('Escape in that passport closes the passport and leaves the visitor in the finished tour', () => {
    installDialogBuiltIns()
    visit('/?mode=tour')
    advance(TOUR_DURATION_MS)
    tick()
    const close = passportSheet().getByRole('button', { name: 'Close' })
    // The key is pressed inside the dialog. The page's own shortcut must not take it.
    expect(key('Escape', close)).toBe(true)
    expect(address()).toBe('/?mode=tour')
  })

  describe('while it is connecting the companies', () => {
    beforeEach(() => {
      visit('/?mode=tour')
      playUntil(network.progress(3))
    })

    it('the mission controls are switched off for the visitor, and a press that gets through changes nothing', () => {
      const controls = [...switchButtons(), ...chips().getAllByRole('button'), passportButton()]
      expect(controls.filter((control) => control.closest('[inert]') === null)).toEqual([])
      const before = page()
      flip(COMPANIES[6])
      goTo('launch')
      expect(page()).toBe(before)
    })

    it('Pause stops the clock: however long the visitor waits, nothing moves', () => {
      press('Pause', tourBar())
      const before = page()
      advance(10 * TOUR_DURATION_MS)
      expect(page()).toBe(before)
    })

    it('Resume carries on with the very next step', () => {
      press('Pause', tourBar())
      advance(60_000)
      press('Resume', tourBar())
      tick()
      expect(switches()).toEqual([true, true, true, true, false, false, false, false])
    })

    it('Restart begins again from an untouched world', () => {
      press('Restart', tourBar())
      expect(progress()).toEqual(UNTOUCHED)
      advance(FIRST_STEP)
      expect(switches()).toEqual(STEPS.map(() => false))
    })

    it('"Play it yourself" keeps the progress made so far, and the visitor carries on by hand', () => {
      press('Play it yourself', tourBar())
      flip(COMPANIES[7])
      expect(switches()).toEqual([true, true, true, false, false, false, false, true])
    })
  })
})

describe('Film mode', () => {
  it('opens on a slate at ?mode=film, and nothing moves until Start take', () => {
    visit('/?mode=film')
    const slate = page()
    advance(TOUR_DURATION_MS)
    expect(page()).toBe(slate)
    press('Start take')
    advance(FIRST_STEP)
    expect(panel().getByRole('heading', { name: discover.title })).toBeTruthy()
  })

  it('runs straight away at ?mode=film&autostart=1, with no slate', () => {
    visit('/?mode=film&autostart=1')
    expect(panel().queryByRole('button', { name: 'Start take' })).toBeNull()
    advance(FIRST_STEP)
    expect(panel().getByRole('heading', { name: discover.title })).toBeTruthy()
  })

  it('two takes in a row both start from an untouched world', () => {
    visit('/?mode=film&autostart=1')
    const firstTakeStarts = progress()
    advance(TOUR_DURATION_MS)
    const firstTakeEnds = progress()
    // The controls are hidden during a take. A tap on the finished take brings them back.
    fireEvent.click(screen.getByRole('button', { name: 'Show controls' }))
    press('Restart', tourBar())
    expect([firstTakeStarts, firstTakeEnds, progress()]).toEqual([UNTOUCHED, ALL_DONE, UNTOUCHED])
    advance(FIRST_STEP)
    expect(switches()).toEqual(STEPS.map(() => false))
  })

  it('a take keeps its cards short: stamp, results, and skills, with the statement read out instead', () => {
    visit('/?mode=film&autostart=1')
    playUntil(trail.stampEarned(discover.checkpoint.stamp))
    const results = [...document.querySelectorAll('main .metric')].map((metric) => metric.textContent)
    expect(results).toEqual(discover.checkpoint.metrics.map((metric) => `${metric.value} ${metric.label}`))
    expect(panel().getByText(trail.skillsUnlocked)).toBeTruthy()
    // A recording has a fixed frame, so the full statement is left off the card...
    expect(document.querySelector('main blockquote')).toBeNull()
    // ...and reaches screen reader users through the hidden status line.
    expect(screen.getByRole('status').textContent).toContain(discover.evidence.quote)
    expect(panel().queryByRole('button')).toBeNull()
  })

  it('a finished take stays on the ending: the passport does not open by itself in a recording', () => {
    installDialogBuiltIns()
    visit('/?mode=film&autostart=1')
    advance(TOUR_DURATION_MS + 10 * PASSPORT_REVEAL_MS)
    expect(panel().getByRole('heading', { name: trail.complete })).toBeTruthy()
    expect(document.querySelector('dialog.passport-dialog[open]')).toBeNull()
  })

  it.each([
    ['the Exit Film mode button', () => press('Exit Film mode')],
    ['the Escape key', () => void key('Escape')],
  ])('%s leaves Film mode for the first screen', (_how, leave) => {
    visit('/?mode=film')
    leave()
    expect(address()).toBe('/')
    expect(panel().getByRole('button', { name: intro.startLabel })).toBeTruthy()
  })
})

describe('changing mode', () => {
  it('from the tour to playing keeps the missions the tour finished', () => {
    visit('/?mode=tour')
    playUntil(signal.checkpoint.challenge)
    press('Play it yourself', tourBar())
    expect(progress()).toEqual([[DONE, HERE, TODO, TODO], overview.progress(1)])
  })

  it('from playing to the tour starts over with an untouched world', () => {
    startPlaying()
    finish('launch')
    closeCard()
    press(intro.tourLabel, topBar())
    expect(progress()).toEqual(UNTOUCHED)
  })

  it('the address always names the mode: ?mode=tour, ?mode=film, or nothing while playing', () => {
    visit()
    press(intro.tourLabel, topBar())
    const inTheTour = address()
    press('Play it yourself', tourBar())
    const playing = address()
    press('Film mode', topBar())
    const inFilmMode = address()
    press('Exit Film mode')
    expect([inTheTour, playing, inFilmMode, address()]).toEqual(['/?mode=tour', '/', '/?mode=film', '/'])
  })
})

describe('keyboard shortcuts for the Guided tour and Film mode', () => {
  /** The one button that reads "Pause" while the sequence runs and "Resume" while it is paused. */
  const pauseOrResume = () => tourBar().getByRole('button', { name: /^(Pause|Resume)$/ })

  it.each(PLAY_PAUSE_KEYS)('%s starts the Film take, then pauses it, then resumes it', (_name, code) => {
    visit('/?mode=film')
    const labels = [1, 2, 3].map(() => {
      key(code)
      return pauseOrResume().getAttribute('aria-label')
    })
    expect(labels).toEqual(['Pause', 'Resume', 'Pause'])
  })

  it('R restarts a Film take from the top, wherever focus is', () => {
    visit('/?mode=film&autostart=1')
    playUntil(signal.checkpoint.challenge)
    key('r')
    expect(progress()).toEqual(UNTOUCHED)
  })

  it('in the Guided tour the letter keys work only while the tour controls have focus', () => {
    visit('/?mode=tour')
    playUntil(signal.checkpoint.challenge)
    const before = page()
    // A stray letter typed or spoken elsewhere on the page must not pause or restart a visitor's tour.
    key('r')
    key('k')
    expect(page()).toBe(before)
    key('r', pauseOrResume())
    expect(progress()).toEqual(UNTOUCHED)
  })

  it('Escape leaves the sequence, and the visitor plays on from where it was', () => {
    visit('/?mode=tour')
    playUntil(signal.checkpoint.challenge)
    key('Escape')
    expect([address(), progress()]).toEqual(['/', [[DONE, HERE, TODO, TODO], overview.progress(1)]])
  })

  it.each(SHORTCUT_KEYS)('%s does nothing while the resume is open', (_name, code) => {
    visit('/?mode=tour')
    advance(FIRST_STEP)
    press(intro.resumeLabel, topBar())
    const before = page()
    key(code)
    key(code, resumeSheet().getByRole('heading', { name: resume.name }))
    expect(page()).toBe(before)
  })

  it.each(SHORTCUT_KEYS)('%s does nothing while the visitor is typing in a text field', (_name, code) => {
    const field = visit('/?mode=tour').container.appendChild(document.createElement('input'))
    advance(FIRST_STEP)
    const before = page()
    key(code, field)
    expect(page()).toBe(before)
  })

  it('after the resume is closed during a tour, Space resumes the tour instead of reopening the resume', () => {
    installDialogBuiltIns()
    visit('/?mode=tour')
    advance(FIRST_STEP)
    press(intro.resumeLabel, topBar())
    press('Close', resumeSheet())
    // The browser hands focus back to "Read resume". The page moves it on to the tour controls.
    key(' ', document.activeElement ?? document.body)
    expect([address(), pauseOrResume().getAttribute('aria-label')]).toEqual(['/?mode=tour', 'Pause'])
  })

  it('with a tour button focused, Space is left to that button, and K still pauses exactly once', () => {
    visit('/?mode=tour')
    advance(FIRST_STEP)
    const before = page()
    // The browser itself turns Space on a button into a click. The shortcut must not add a second action.
    expect(key(' ', pauseOrResume())).toBe(true)
    expect(page()).toBe(before)
    key('k', pauseOrResume())
    expect(pauseOrResume().getAttribute('aria-label')).toBe('Resume')
  })
})

describe('closing the page in the middle of a running tour', () => {
  /** A tour that has run, been paused, and been resumed, so every listener and timer has been set up. */
  function openMidTour() {
    const view = visit('/?mode=tour')
    advance(FIRST_STEP + 500)
    press('Pause', tourBar())
    press('Resume', tourBar())
    return view
  }

  it('leaves no timer behind, and logs no warning however long the clock runs on afterwards', () => {
    const view = openMidTour()
    const timersWhileOpen = vi.getTimerCount()
    view.unmount()
    expect([timersWhileOpen, vi.getTimerCount()]).toEqual([1, 0])
    advance(2 * TOUR_DURATION_MS)
    expect(complaints).toEqual([])
  })

  it('removes every listener it added to the window and the document', () => {
    const [onWindow, onDocument] = [window, document].map(listenersOn)
    const view = openMidTour()
    const whileOpen = [onWindow(), onDocument()]
    view.unmount()
    expect(whileOpen).toEqual([['click', 'hashchange', 'keydown', 'resize'], ['visibilitychange']])
    expect([onWindow(), onDocument()]).toEqual([[], []])
  })
})

describe('when the 3D world cannot start (no WebGL)', () => {
  it('says so where the world would have been, and offers the resume right there', () => {
    // Forget what earlier pages found out, so that this page has to find it out by itself.
    setWorldStatus('loading')
    visit()
    const notice = within(screen.getByRole('region', { name: NO_WEBGL_NOTICE }))
    expect(document.querySelector('canvas')).toBeNull()
    press(intro.resumeLabel, notice)
    expect(resumeSheet().getByRole('heading', { name: resume.name })).toBeTruthy()
  })
})

describe('accessibility', () => {
  /** Every screen of the site, and how a visitor gets there. */
  const SCREENS: [name: string, open: () => void][] = [
    ['the first screen', () => void visit()],
    ['the map', startPlaying],
    ['the pitch deck after an early press', () => (startPlaying(), goTo('discover'), press(discover.pitchAction))],
    ['the signal station after an early press', () => (startPlaying(), goTo('signal'), press(signal.feedAction))],
    ['the hub', () => (startPlaying(), goTo('network'), flip(COMPANIES[0]))],
    ['a checkpoint card', () => (startPlaying(), finish('launch'))],
    ['the finale', () => (startPlaying(), finishEverything())],
    ['the open passport', () => (startPlaying(), finish('discover'), closeCard(), fireEvent.click(passportButton()))],
    ['the open resume', () => void visit('/#resume')],
    ['the Guided tour', () => (visit('/?mode=tour'), advance(FIRST_STEP))],
    ['the Film slate', () => void visit('/?mode=film')],
    ['a finished Film take', () => (visit('/?mode=film&autostart=1'), advance(TOUR_DURATION_MS))],
  ]
  /** Anything a visitor could click or reach with the Tab key. */
  const CONTROLS = 'button, a, input, select, textarea, summary, [role="button"], [role="link"], [tabindex="0"]'

  it.each(SCREENS)('%s: every control is a real button or link with a name', (_name, open) => {
    open()
    const controls = [...document.body.querySelectorAll(CONTROLS)]
    const named: Element[] = ['button', 'link'].flatMap((role) =>
      screen.queryAllByRole(role, { name: /\S/, hidden: true }),
    )
    expect(controls.length).toBeGreaterThan(10)
    const notReal = controls.filter((control) => !control.matches('button[type="button"], a[href]'))
    const unnamed = controls.filter((control) => !named.includes(control))
    expect({ notReal, unnamed }).toEqual({ notReal: [], unnamed: [] })
  })

  it('every stamp space states its status in words, never by color alone', () => {
    startPlaying()
    finish('network')
    closeCard()
    goTo('signal')
    expect(progress()[0]).toEqual([TODO, HERE, TODO, DONE])
  })

  it('the passport button says in words how many stamps have been collected', () => {
    startPlaying()
    finish('launch')
    expect(passportButton().getAttribute('aria-label')).toBe(`${trail.passport}: ${overview.progress(1)}`)
  })

  it('the small line above each panel title reads as two phrases, not "Checkpoint 2 of 4Build"', () => {
    startPlaying()
    goTo('signal')
    // The dot between the two parts is hidden from screen readers. A hidden comma takes its place.
    const line = panel().getByText(/^Checkpoint 2 of 4/)
    const heard = [...line.querySelectorAll('*')].reduce(
      (text, element) => (element.getAttribute('aria-hidden') === 'true' ? text.replace(element.textContent ?? '', '') : text),
      line.textContent ?? '',
    )
    expect(heard).toBe(`Checkpoint 2 of 4, ${signal.checkpoint.name}`)
  })

  it.each([
    [
      'a finished checkpoint, with its stamp and the new count,',
      () => finish('network'),
      `${network.completeLine} ${trail.stampEarned(network.checkpoint.stamp)}. ${overview.progress(1)}.`,
    ],
    ['a blocked action, with its reason,', () => (goTo('launch'), press(launch.launchAction)), launch.blocked(CHECKS)],
  ])('%s is announced to screen readers', (_what, cause, sentence) => {
    startPlaying()
    cause()
    // The hidden line that tells screen reader users what just happened.
    expect(screen.getByRole('status').textContent?.trim()).toBe(sentence)
  })
})
