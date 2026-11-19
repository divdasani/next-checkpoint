import { useFrame, useThree } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import type { OrthographicCamera } from 'three'
import { useGame } from '../state/GameContext.tsx'
import { focusMission } from '../state/selectors.ts'
import { cameraBasis, computeFraming, mixFraming, type Framing } from './framing.ts'
import { easing, useWorld } from './kit.tsx'
import { CAMERA } from './layout.ts'
import { useStageSafeRect } from './stage.ts'

const CAMERA_DISTANCE = 60
const FOCUS_MOVE_MS = 700
/** The free area is measured a moment after the window. Changes this soon after a resize belong to it. */
const RESIZE_SETTLE_MS = 400

function applyFraming(camera: OrthographicCamera, framing: Framing): void {
  const { right, up, toCamera } = cameraBasis(CAMERA.azimuth, framing.elevation)
  const x = right[0] * framing.centerR + up[0] * framing.centerU
  const y = right[1] * framing.centerR + up[1] * framing.centerU
  const z = right[2] * framing.centerR + up[2] * framing.centerU
  camera.position.set(
    x + toCamera[0] * CAMERA_DISTANCE,
    y + toCamera[1] * CAMERA_DISTANCE,
    z + toCamera[2] * CAMERA_DISTANCE,
  )
  camera.up.set(0, 1, 0)
  camera.lookAt(x, y, z)
  camera.zoom = framing.zoom
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld()
}

/**
 * Keeps the fixed overview camera framed on the island inside the free part of the screen.
 * Resizing the window reframes instantly. Two things are eased instead:
 *  - the single preset focus toward the active zone, which happens only on screens too
 *    small to read the overview (and never in Film mode: a recording keeps the whole
 *    island in frame at every window size);
 *  - a change of the free area while the window stays the same size, which happens on
 *    short phones when a Real experience card takes more room than the mission panel did.
 */
export function CameraRig() {
  const { state } = useGame()
  const { reducedMotion, epoch } = useWorld()
  const camera = useThree((three) => three.camera) as OrthographicCamera
  const size = useThree((three) => three.size)
  const invalidate = useThree((three) => three.invalidate)
  const safe = useStageSafeRect()
  const focus = state.mode === 'film' ? null : focusMission(state)

  const goal = useMemo(() => {
    const canvas = { width: size.width, height: size.height }
    const safeArea = safe
      ? { left: safe.left - size.left, top: safe.top - size.top, width: safe.width, height: safe.height }
      : null
    return computeFraming(canvas, safeArea, focus)
  }, [size.width, size.height, size.left, size.top, safe, focus])

  const move = useRef({
    from: goal,
    to: goal,
    current: goal,
    start: 0,
    active: false,
    focus,
    epoch,
    width: size.width,
    height: size.height,
    measured: safe !== null,
    resizedAt: Number.NEGATIVE_INFINITY,
  })

  useLayoutEffect(() => {
    const m = move.current
    const focusChanged = m.focus !== focus
    const reset = m.epoch !== epoch
    // The free area moved although the window did not change size: the interface made room.
    const windowResized = m.width !== size.width || m.height !== size.height
    if (windowResized) m.resizedAt = performance.now()
    const settled = performance.now() - m.resizedAt > RESIZE_SETTLE_MS
    const madeRoom = m.measured && safe !== null && settled && m.to !== goal && !focusChanged
    m.focus = focus
    m.epoch = epoch
    m.width = size.width
    m.height = size.height
    m.measured = safe !== null
    const wasFocused = m.current.focused || m.to.focused
    const focusMove = focusChanged && (goal.focused || wasFocused)
    if ((focusMove || madeRoom) && !reset && !reducedMotion) {
      m.from = m.current
      m.to = goal
      m.start = performance.now()
      m.active = true
    } else {
      m.current = goal
      m.to = goal
      m.active = false
      applyFraming(camera, goal)
    }
    invalidate()
  }, [goal, focus, epoch, reducedMotion, camera, invalidate, size.width, size.height, safe])

  useFrame(() => {
    const m = move.current
    if (!m.active) return
    const progress = Math.min(1, (performance.now() - m.start) / FOCUS_MOVE_MS)
    m.current = mixFraming(m.from, m.to, easing.inOutCubic(progress))
    applyFraming(camera, m.current)
    if (progress >= 1) {
      m.current = m.to
      m.active = false
    } else {
      invalidate()
    }
  })

  return null
}
