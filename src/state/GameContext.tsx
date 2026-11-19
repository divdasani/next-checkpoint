import { createContext, use, useEffect, useMemo, useReducer, useState, type Dispatch, type ReactNode } from 'react'
import { useWorldStatus } from '../world/stage.ts'
import { createInitialState, gameReducer } from './reducer.ts'
import type { GameAction, GameState } from './types.ts'
import { readUrlOptions, useUrlSync } from './url.ts'
import { useTourRunner } from './useTourRunner.ts'

export interface Game {
  state: GameState
  dispatch: Dispatch<GameAction>
}

export const GameContext = createContext<Game | null>(null)

interface GameProviderProps {
  children: ReactNode
  /** Tests can pass a prepared state. The app reads its starting mode from the URL. */
  initialState?: GameState
}

/** The longest the guided sequence waits for the 3D world before starting without it. */
const WORLD_WAIT_MS = 4000

/**
 * False while the 3D world is still downloading, so a tour or Film take opened by a direct
 * link does not spend its opening seconds on an empty stage. It turns true when the world
 * is ready, when it is known to be unavailable, or after a short wait on a slow connection.
 */
function useWorldSettled(): boolean {
  const status = useWorldStatus()
  const [waitedEnough, setWaitedEnough] = useState(false)

  useEffect(() => {
    if (status !== 'loading') return
    const timer = setTimeout(() => setWaitedEnough(true), WORLD_WAIT_MS)
    return () => clearTimeout(timer)
  }, [status])

  return status !== 'loading' || waitedEnough
}

export function GameProvider({ children, initialState }: GameProviderProps) {
  const [state, dispatch] = useReducer(gameReducer, initialState, (given) => given ?? createInitialState(readUrlOptions()))

  useTourRunner(state.tour, dispatch, useWorldSettled())
  useUrlSync(state, dispatch)

  const game = useMemo<Game>(() => ({ state, dispatch }), [state])

  // Development-only handle for inspecting and driving state from the browser console.
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const target = window as unknown as { __NEXT_CHECKPOINT__?: unknown }
    target.__NEXT_CHECKPOINT__ = { dispatch, getState: () => game.state }
    return () => {
      delete target.__NEXT_CHECKPOINT__
    }
  }, [game])

  return <GameContext value={game}>{children}</GameContext>
}

export function useGame(): Game {
  const game = use(GameContext)
  if (!game) throw new Error('useGame must be used inside <GameProvider>')
  return game
}
