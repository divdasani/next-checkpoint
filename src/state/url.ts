import { useEffect, type Dispatch } from 'react'
import type { GameAction, GameState, InitOptions, Mode } from './types.ts'

// One root URL. The mode lives in the query string (?mode=tour, ?mode=film) and the
// resume view in the hash (#resume), so every state can be linked, refreshed, and recorded.

export const RESUME_HASH = '#resume'

export function parseUrlOptions(search: string, hash: string): InitOptions {
  const params = new URLSearchParams(search)
  const raw = params.get('mode')
  const mode: Mode = raw === 'tour' || raw === 'film' ? raw : 'play'
  const autostart = params.get('autostart') === '1'
  return { mode, autostart, resumeOpen: hash === RESUME_HASH }
}

export function readUrlOptions(): InitOptions {
  if (typeof window === 'undefined') return {}
  return parseUrlOptions(window.location.search, window.location.hash)
}

/** The address that represents a mode and resume state, relative to the current page. */
export function buildUrl(pathname: string, search: string, mode: Mode, resumeOpen: boolean): string {
  const params = new URLSearchParams(search)
  if (mode === 'play') params.delete('mode')
  else params.set('mode', mode)
  if (mode !== 'film') params.delete('autostart')
  const query = params.toString()
  return `${pathname}${query ? `?${query}` : ''}${resumeOpen ? RESUME_HASH : ''}`
}

/** Keeps the address bar in step with the state, and follows Back/Forward on the resume hash. */
export function useUrlSync(state: GameState, dispatch: Dispatch<GameAction>): void {
  const { mode, resumeOpen } = state

  useEffect(() => {
    const { pathname, search, hash } = window.location
    const next = buildUrl(pathname, search, mode, resumeOpen)
    if (next !== `${pathname}${search}${hash}`) window.history.replaceState(null, '', next)
  }, [mode, resumeOpen])

  useEffect(() => {
    const onHashChange = () => {
      dispatch({ type: window.location.hash === RESUME_HASH ? 'OPEN_RESUME' : 'CLOSE_RESUME' })
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [dispatch])
}
