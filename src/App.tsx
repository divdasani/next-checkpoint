import { Component, lazy, Suspense, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { content } from './content/content.ts'
import { GameProvider, useGame } from './state/GameContext.tsx'
import { panelKind } from './state/selectors.ts'
import { DestinationPins } from './ui/DestinationPins.tsx'
import { FilmTapLayer } from './ui/FilmTapLayer.tsx'
import { LiveRegion } from './ui/LiveRegion.tsx'
import { MissionChips } from './ui/MissionChips.tsx'
import { ResumeDialog } from './ui/ResumeDialog.tsx'
import { StagePanel } from './ui/StagePanel.tsx'
import { TopBar } from './ui/TopBar.tsx'
import { TourBar } from './ui/TourBar.tsx'
import { useShortcuts } from './ui/useShortcuts.ts'
import { WorldFallback } from './ui/WorldFallback.tsx'
import { setWorldStatus, useStageSafeArea, useStageSafeRect, useWorldStatus, type ScreenRect } from './world/stage.ts'

// The 3D world (three.js) is the heaviest part of the site, so it is loaded as a separate
// file after the page is already readable. Nothing below waits for it.
const WorldCanvas = lazy(() => import('./world/WorldCanvas.tsx'))

/**
 * Catches a failed download of that file (a dropped connection, a blocked script).
 * Without it the error would take the whole page down, resume included. With it the world
 * is reported as unavailable and everything else carries on with the HTML controls.
 */
class WorldLoadBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch() {
    setWorldStatus('unavailable')
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}

/**
 * The whole page. GameProvider holds the one shared state, and Shell lays out everything
 * that reads it. Shell is a separate component because useGame() only works inside the provider.
 */
export function App() {
  return (
    <GameProvider>
      <Shell />
    </GameProvider>
  )
}

/**
 * Where the free stage ends, measured from the right and bottom edges of the screen.
 * The stylesheet uses the two numbers to cut the pin layer off at the panel and the footer,
 * so a pin that the zoomed-in camera pushes out of the stage never peeks out beside them.
 */
function pinLayerBounds(stage: ScreenRect | null): CSSProperties | undefined {
  if (!stage) return undefined
  const { clientWidth, clientHeight } = document.documentElement
  return {
    '--stage-right': `${Math.max(0, clientWidth - stage.left - stage.width)}px`,
    '--stage-bottom': `${Math.max(0, clientHeight - stage.top - stage.height)}px`,
  } as CSSProperties
}

/**
 * Three layers stacked on top of each other, back to front:
 *   world-layer  the 3D canvas, filling the screen
 *   pin-layer    HTML labels that the canvas positions above the buildings
 *   hud          the interface: top bar, the free "stage" area, the panel, and the footer
 *
 * The data attributes on .app-shell expose the current state to the stylesheets
 * (for example, Film mode hides optional help with one CSS rule).
 */
function Shell() {
  const { state, dispatch } = useGame()
  const { mode } = state
  const { status, runId } = state.tour

  // The camera centers the island inside this element (see world/CameraRig.tsx).
  const stageSafeRef = useStageSafeArea()
  // The same rectangle as measured on screen. It only changes when the window is resized,
  // so the pin layer's bounds are worked out again only then.
  const stageRect = useStageSafeRect()
  const pinBounds = useMemo(() => pinLayerBounds(stageRect), [stageRect])
  const worldStatus = useWorldStatus()

  useShortcuts(state, dispatch)

  // Film mode hides the tour controls during a take. Tapping the finished take shows them.
  // Remembering which run they were shown for means a restart hides them again by itself.
  const [controlsRun, setControlsRun] = useState<number | null>(null)
  const controlsShown = mode === 'film' && status === 'done' && controlsRun === runId
  const toggleControls = () => setControlsRun((shownFor) => (shownFor === runId ? null : runId))

  return (
    <>
      <div
        className="app-shell"
        data-mode={mode}
        data-tour={status}
        data-phase={state.phase}
        data-panel={panelKind(state)}
        data-world={worldStatus}
      >
        <div className="world-layer">
          <WorldLoadBoundary>
            <Suspense fallback={null}>
              <WorldCanvas />
            </Suspense>
          </WorldLoadBoundary>
        </div>

        <div
          className="pin-layer"
          role="group"
          aria-label="Destinations in the world"
          style={pinBounds}
        >
          <DestinationPins />
        </div>

        <div className="hud">
          <header className="hud__top">
            <TopBar />
          </header>

          {/* .stage-cell is the empty grid cell. .stage-safe is the same rectangle minus a little
              headroom at the top, so the label above the tallest building never touches the top bar. */}
          <div className="stage-cell">
            <div className="stage-safe" ref={stageSafeRef}>
              <FilmTapLayer controlsShown={controlsShown} onToggleControls={toggleControls} />
              <WorldFallback />
            </div>
          </div>

          {/* The panel is the page's main content: screen readers can jump straight to it. */}
          <main className="stage-panel">
            <StagePanel />
          </main>

          <footer className="hud__foot">
            <TourBar revealed={controlsShown} />
            <MissionChips />
            <p className="credit">{content.credit.line}</p>
          </footer>
        </div>
      </div>

      {/* Outside .app-shell on purpose: the print stylesheet hides the shell and prints the resume. */}
      <ResumeDialog />
      <LiveRegion />
    </>
  )
}
