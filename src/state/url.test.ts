import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createInitialState } from './reducer.ts'
import type { GameAction, GameState, Mode } from './types.ts'
import { buildUrl, parseUrlOptions, readUrlOptions, RESUME_HASH, useUrlSync } from './url.ts'

// The site has one address. The mode travels in the query string (?mode=tour, ?mode=film)
// and the resume in the hash (#resume). These tests cover reading an address into a
// starting state, writing the state back into an address, and keeping the two in step.

/** Split an address the way the browser does. */
function parts(address: string) {
  const url = new URL(address, 'http://localhost')
  return { pathname: url.pathname, search: url.search, hash: url.hash }
}

/** Put the test page on a given address without reloading it. */
function visit(address: string): void {
  window.history.replaceState(null, '', address)
}

afterEach(() => {
  visit('/')
})

describe('reading the address', () => {
  it.each([
    ['', '', { mode: 'play', autostart: false, resumeOpen: false }],
    ['?mode=tour', '', { mode: 'tour', autostart: false, resumeOpen: false }],
    ['?mode=film', '', { mode: 'film', autostart: false, resumeOpen: false }],
    ['?mode=film&autostart=1', '', { mode: 'film', autostart: true, resumeOpen: false }],
    ['?mode=film&autostart=0', '', { mode: 'film', autostart: false, resumeOpen: false }],
    ['?mode=bogus', '', { mode: 'play', autostart: false, resumeOpen: false }],
    ['?mode=', '', { mode: 'play', autostart: false, resumeOpen: false }],
    ['', '#resume', { mode: 'play', autostart: false, resumeOpen: true }],
    ['?mode=tour', '#resume', { mode: 'tour', autostart: false, resumeOpen: true }],
    ['', '#something-else', { mode: 'play', autostart: false, resumeOpen: false }],
    ['?ref=newsletter&mode=film', '', { mode: 'film', autostart: false, resumeOpen: false }],
  ] as const)('search "%s" with hash "%s"', (search, hash, expected) => {
    expect(parseUrlOptions(search, hash)).toEqual(expected)
  })

  it('uses "#resume" as the resume hash', () => {
    expect(RESUME_HASH).toBe('#resume')
  })

  it('readUrlOptions reads the address the page is on', () => {
    visit('/?mode=film&autostart=1#resume')
    expect(readUrlOptions()).toEqual({ mode: 'film', autostart: true, resumeOpen: true })
    visit('/')
    expect(readUrlOptions()).toEqual({ mode: 'play', autostart: false, resumeOpen: false })
  })
})

describe('the starting state each address leads to', () => {
  const start = (search: string, hash = '') => createInitialState(parseUrlOptions(search, hash))

  it('the plain address opens the intro in play mode', () => {
    expect(start('')).toMatchObject({ mode: 'play', phase: 'intro', resumeOpen: false })
    expect(start('').tour.status).toBe('idle')
  })

  it('?mode=tour starts the guided tour running', () => {
    expect(start('?mode=tour')).toMatchObject({ mode: 'tour', resumeOpen: false })
    expect(start('?mode=tour').tour.status).toBe('running')
  })

  it('?mode=film waits on the slate, and autostart=1 starts the take at once', () => {
    expect(start('?mode=film').tour.status).toBe('ready')
    expect(start('?mode=film&autostart=1').tour.status).toBe('running')
    expect(start('?mode=film&autostart=1').mode).toBe('film')
  })

  it('an unknown mode falls back to play, and autostart alone does nothing', () => {
    expect(start('?mode=bogus')).toEqual(start(''))
    expect(start('?autostart=1')).toEqual(start(''))
  })

  it('#resume opens the resume, and holds a sequence paused behind it', () => {
    expect(start('', '#resume')).toMatchObject({ mode: 'play', phase: 'intro', resumeOpen: true })
    expect(start('?mode=tour', '#resume').tour.status).toBe('paused')
    expect(start('?mode=film&autostart=1', '#resume').tour.status).toBe('paused')
  })
})

describe('writing the address', () => {
  it('adds the mode for tour and film, and removes it for play', () => {
    expect(buildUrl('/', '', 'play', false)).toBe('/')
    expect(buildUrl('/', '', 'tour', false)).toBe('/?mode=tour')
    expect(buildUrl('/', '', 'film', false)).toBe('/?mode=film')
    expect(buildUrl('/', '?mode=tour', 'play', false)).toBe('/')
    expect(buildUrl('/', '?mode=tour', 'film', false)).toBe('/?mode=film')
    expect(buildUrl('/', '?mode=film', 'tour', false)).toBe('/?mode=tour')
  })

  it('keeps autostart only in Film mode', () => {
    expect(buildUrl('/', '?mode=film&autostart=1', 'film', false)).toBe('/?mode=film&autostart=1')
    expect(buildUrl('/', '?mode=film&autostart=1', 'tour', false)).toBe('/?mode=tour')
    expect(buildUrl('/', '?mode=film&autostart=1', 'play', false)).toBe('/')
    // It is never added by itself.
    expect(buildUrl('/', '?mode=tour', 'film', false)).toBe('/?mode=film')
  })

  it('keeps unrelated parameters and the path', () => {
    expect(buildUrl('/', '?ref=newsletter', 'tour', false)).toBe('/?ref=newsletter&mode=tour')
    expect(buildUrl('/', '?ref=newsletter&mode=film&autostart=1', 'play', false)).toBe('/?ref=newsletter')
    expect(buildUrl('/preview/', '?a=1&b=two', 'film', true)).toBe('/preview/?a=1&b=two&mode=film#resume')
  })

  it('appends #resume only while the resume is open', () => {
    expect(buildUrl('/', '', 'play', true)).toBe('/#resume')
    expect(buildUrl('/', '?mode=tour', 'tour', true)).toBe('/?mode=tour#resume')
    expect(buildUrl('/', '?mode=tour', 'tour', false)).toBe('/?mode=tour')
  })

  const MODES: Mode[] = ['play', 'tour', 'film']
  it.each(MODES)('an address written for %s mode reads back as the same mode', (mode) => {
    for (const resumeOpen of [false, true]) {
      const { search, hash } = parts(buildUrl('/', '?ref=x', mode, resumeOpen))
      expect(parseUrlOptions(search, hash)).toMatchObject({ mode, resumeOpen })
    }
  })
})

describe('keeping the address bar in step with the state', () => {
  type Sent = (action: GameAction) => void
  const sync = (state: GameState, dispatch: Sent = () => {}) =>
    renderHook((props: { state: GameState }) => useUrlSync(props.state, dispatch), { initialProps: { state } })
  const address = () => `${window.location.pathname}${window.location.search}${window.location.hash}`

  it('writes the mode into the address as it changes, without adding history entries', () => {
    const entries = window.history.length
    const view = sync(createInitialState())
    expect(address()).toBe('/')

    view.rerender({ state: createInitialState({ mode: 'tour' }) })
    expect(address()).toBe('/?mode=tour')
    view.rerender({ state: createInitialState({ mode: 'film' }) })
    expect(address()).toBe('/?mode=film')
    view.rerender({ state: createInitialState() })
    expect(address()).toBe('/')
    expect(window.history.length).toBe(entries)
  })

  it('shows #resume while the resume is open and removes it when it closes', () => {
    const view = sync(createInitialState({ mode: 'tour' }))
    view.rerender({ state: createInitialState({ mode: 'tour', resumeOpen: true }) })
    expect(address()).toBe('/?mode=tour#resume')
    view.rerender({ state: createInitialState({ mode: 'tour' }) })
    expect(address()).toBe('/?mode=tour')
  })

  it('leaves a matching address alone, including autostart and unrelated parameters', () => {
    visit('/?ref=x&mode=film&autostart=1')
    const replace = vi.spyOn(window.history, 'replaceState')
    sync(createInitialState({ mode: 'film', autostart: true }))
    expect(replace).not.toHaveBeenCalled()
    expect(address()).toBe('/?ref=x&mode=film&autostart=1')
  })

  it('opens and closes the resume when Back or Forward changes the hash', () => {
    const dispatch = vi.fn<Sent>()
    sync(createInitialState(), dispatch)

    visit('/#resume')
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'OPEN_RESUME' })

    visit('/')
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'CLOSE_RESUME' })
    expect(dispatch).toHaveBeenCalledTimes(2)
  })

  it('stops listening for hash changes after unmount', () => {
    const dispatch = vi.fn<Sent>()
    const view = sync(createInitialState(), dispatch)
    view.unmount()
    visit('/#resume')
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    expect(dispatch).not.toHaveBeenCalled()
  })
})
