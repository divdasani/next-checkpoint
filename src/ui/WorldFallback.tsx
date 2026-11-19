import { useId } from 'react'
import { content } from '../content/content.ts'
import { useGame } from '../state/GameContext.tsx'
import { useWorldStatus } from '../world/stage.ts'

/**
 * A calm notice for browsers where WebGL cannot start, shown in the space the 3D world
 * would have used. Nothing else changes: every mission is still playable with the buttons
 * in the panel, because those buttons send the same actions as the 3D objects.
 *
 * While the 3D file is still downloading it shows a short "Loading the island" note
 * instead, which the stylesheet keeps invisible for the first moment so it never flashes
 * on a fast connection. Once the world is running it renders nothing.
 */
export function WorldFallback() {
  const status = useWorldStatus()
  const { dispatch } = useGame()
  const headingId = useId()

  if (status === 'loading') {
    // Decorative: the page is fully usable without the world, so screen readers skip this.
    return (
      <p className="world-loading" aria-hidden="true">
        Loading the island…
      </p>
    )
  }
  if (status !== 'unavailable') return null

  return (
    <section className="fallback card" aria-labelledby={headingId}>
      <h2 id={headingId} className="fallback__title">
        The 3D world could not start in this browser
      </h2>
      <p className="fallback__body">
        Every mission still works with the buttons in the panel, and the resume is one click away.
      </p>
      <button type="button" className="btn fallback__btn" onClick={() => dispatch({ type: 'OPEN_RESUME' })}>
        {content.intro.resumeLabel}
      </button>
    </section>
  )
}
