import { Canvas, useThree } from '@react-three/fiber'
import { Component, useEffect, useMemo, useState, type ReactNode } from 'react'
import { GameContext, useGame } from '../state/GameContext.tsx'
import { isTourBusy } from '../state/selectors.ts'
import { useReducedMotion } from '../state/useReducedMotion.ts'
import { Scene } from './Scene.tsx'
import { WorldContext, type WorldSettings } from './kit.tsx'
import { setWorldStatus } from './stage.ts'

// The only WebGL entry point. It is loaded lazily, renders on demand, and reports
// 'unavailable' instead of throwing when WebGL cannot start, so the HTML interface
// and the resume keep working on any device.

function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
    if (!context) return false
    // This was only a probe. Hand the context back so the real canvas gets a clean slot.
    context.getExtension('WEBGL_lose_context')?.loseContext()
    return true
  } catch {
    return false
  }
}

class WorldBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch() {
    this.props.onError()
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}

/** Marks the world ready once the canvas has mounted, and redraws after a lost WebGL context returns. */
function CanvasLifecycle() {
  const canvas = useThree((three) => three.gl.domElement)
  const invalidate = useThree((three) => three.invalidate)

  useEffect(() => {
    setWorldStatus('ready')
    const onLost = (event: Event) => event.preventDefault()
    const onRestored = () => invalidate()
    const onVisible = () => {
      if (!document.hidden) invalidate()
    }
    canvas.addEventListener('webglcontextlost', onLost)
    canvas.addEventListener('webglcontextrestored', onRestored)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      canvas.removeEventListener('webglcontextlost', onLost)
      canvas.removeEventListener('webglcontextrestored', onRestored)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [canvas, invalidate])

  return null
}

export default function WorldCanvas() {
  const game = useGame()
  const reducedMotion = useReducedMotion()
  const [available, setAvailable] = useState(isWebGLAvailable)

  const interactive = !isTourBusy(game.state)
  const epoch = game.state.epoch
  const settings = useMemo<WorldSettings>(
    () => ({ reducedMotion, interactive, epoch }),
    [reducedMotion, interactive, epoch],
  )

  useEffect(() => {
    if (!available) setWorldStatus('unavailable')
  }, [available])

  if (!available) return null

  return (
    <WorldBoundary onError={() => setAvailable(false)}>
      <Canvas
        orthographic
        flat
        shadows="percentage"
        frameloop="demand"
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: 'default' }}
        camera={{ near: 0.1, far: 200, position: [30, 30, 30], zoom: 40 }}
        aria-hidden="true"
      >
        {/* The canvas has its own React tree, so the shared state is handed in explicitly. */}
        <GameContext value={game}>
          <WorldContext value={settings}>
            <CanvasLifecycle />
            <Scene />
          </WorldContext>
        </GameContext>
      </Canvas>
    </WorldBoundary>
  )
}
