import { useFrame, useThree, type ThreeElements } from '@react-three/fiber'
import { createContext, use, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { BoxGeometry, CylinderGeometry, MeshBasicMaterial, MeshLambertMaterial } from 'three'
import type { Vec3 } from './layout.ts'

// The small toolkit every part of the world is built from:
//  - one shared box and one shared cylinder, scaled per object
//  - one cached flat-shaded material per color
//  - short tweens that run inside the render loop and never touch React state

// ── Shared geometry and materials ────────────────────────────────────────────

export const UNIT_BOX = new BoxGeometry(1, 1, 1)
export const UNIT_CYLINDER = new CylinderGeometry(0.5, 0.5, 1, 20)

const materials = new Map<string, MeshLambertMaterial>()

/** A shared material for a color. Never mutate it; create your own material for anything animated. */
export function mat(color: string): MeshLambertMaterial {
  let material = materials.get(color)
  if (!material) {
    material = new MeshLambertMaterial({ color })
    materials.set(color, material)
  }
  return material
}

/**
 * A material that belongs to one object, for anything whose color animates. Shared materials
 * from `mat()` must never change. Pass `glow` for a material that can also light up in that
 * color: raise `emissiveIntensity` above 0 to switch the glow on.
 */
export function useOwnMaterial(color: string, glow = '#000000'): MeshLambertMaterial {
  const material = useMemo(
    () => new MeshLambertMaterial({ color, emissive: glow, emissiveIntensity: 0 }),
    [color, glow],
  )
  useEffect(() => () => material.dispose(), [material])
  return material
}

const HIT_MATERIAL = new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })

// ── World context ────────────────────────────────────────────────────────────

export interface WorldSettings {
  /** The visitor prefers reduced motion: tweens jump to their end value. */
  reducedMotion: boolean
  /** False while the guided sequence owns the world, so 3D clicks are ignored. */
  interactive: boolean
  /** Changes when the world is reset, which makes tweens snap instead of animate. */
  epoch: number
}

export const WorldContext = createContext<WorldSettings>({ reducedMotion: false, interactive: true, epoch: 0 })

export function useWorld(): WorldSettings {
  return use(WorldContext)
}

// ── Block ────────────────────────────────────────────────────────────────────

type MeshProps = ThreeElements['mesh']

export interface BlockProps extends Omit<MeshProps, 'position' | 'scale' | 'geometry' | 'material'> {
  /** Center of the box. */
  at: Vec3
  size: Vec3
  /** Hex color. Ignored when `material` is given. */
  color?: string
  /** Pass your own material for anything that changes color. */
  material?: MeshProps['material']
  cast?: boolean
  receive?: boolean
  shape?: 'box' | 'cylinder'
}

/** One flat-shaded box (or cylinder). Almost everything in the world is a Block. */
export function Block({ at, size, color = '#ffffff', material, cast = true, receive = true, shape = 'box', ...rest }: BlockProps) {
  return (
    <mesh
      position={at as [number, number, number]}
      scale={size as [number, number, number]}
      geometry={shape === 'box' ? UNIT_BOX : UNIT_CYLINDER}
      material={material ?? mat(color)}
      castShadow={cast}
      receiveShadow={receive}
      {...rest}
    />
  )
}

// ── Easing ───────────────────────────────────────────────────────────────────

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

export const easing = {
  outCubic: (t: number) => 1 - (1 - t) ** 3,
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  /** Overshoots slightly, for a satisfying pop. */
  outBack: (t: number) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2,
}

// ── Tweens ───────────────────────────────────────────────────────────────────

export interface TweenOptions {
  /** Milliseconds. */
  duration?: number
  delay?: number
  easing?: (t: number) => number
}

/**
 * Ease a number toward `target` and hand every intermediate value to `apply`.
 *
 * `apply` should write straight to three.js objects (position, scale, material color).
 * The canvas only renders on demand, so the tween requests frames while it is moving
 * and then goes quiet. It snaps instead of animating on first mount, when the world
 * resets, and when reduced motion is on.
 */
export function useTween(target: number, apply: (value: number) => void, options: TweenOptions = {}): void {
  const { duration = 320, delay = 0, easing: ease = easing.outCubic } = options
  const { reducedMotion, epoch } = useWorld()
  const invalidate = useThree((three) => three.invalidate)
  const applyRef = useRef(apply)
  applyRef.current = apply
  const tween = useRef({ value: target, from: target, to: target, start: 0, active: false, epoch })

  useLayoutEffect(() => {
    const t = tween.current
    const snap = reducedMotion || duration <= 0 || t.epoch !== epoch
    t.epoch = epoch
    if (snap) {
      t.value = target
      t.to = target
      t.active = false
    } else if (t.to !== target) {
      t.from = t.value
      t.to = target
      t.start = performance.now() + delay
      t.active = true
    }
    applyRef.current(t.value)
    invalidate()
  }, [target, epoch, reducedMotion, duration, delay, invalidate])

  useFrame(() => {
    const t = tween.current
    if (!t.active) return
    const progress = clamp01((performance.now() - t.start) / duration)
    t.value = t.from + (t.to - t.from) * ease(progress)
    applyRef.current(t.value)
    if (progress >= 1) {
      t.value = t.to
      t.active = false
    } else {
      invalidate()
    }
  })
}

/**
 * Play one short pulse whenever `trigger` changes (not on first mount or world reset).
 * `apply` receives progress from 0 to 1 and must treat 1 as the resting pose,
 * for example `scale = 1 + 0.2 * Math.sin(Math.PI * t)`.
 */
export function usePulse(trigger: unknown, apply: (progress: number) => void, duration = 500): void {
  const { reducedMotion, epoch } = useWorld()
  const invalidate = useThree((three) => three.invalidate)
  const applyRef = useRef(apply)
  applyRef.current = apply
  const pulse = useRef({ trigger, epoch, start: 0, active: false })

  useLayoutEffect(() => {
    const p = pulse.current
    const changed = !Object.is(p.trigger, trigger)
    const reset = p.epoch !== epoch
    p.trigger = trigger
    p.epoch = epoch
    if (changed && !reset && !reducedMotion) {
      p.start = performance.now()
      p.active = true
    } else {
      p.active = false
      applyRef.current(1)
    }
    invalidate()
  }, [trigger, epoch, reducedMotion, invalidate])

  useFrame(() => {
    const p = pulse.current
    if (!p.active) return
    const progress = clamp01((performance.now() - p.start) / duration)
    applyRef.current(progress)
    if (progress >= 1) p.active = false
    else invalidate()
  })
}

// ── Click targets ────────────────────────────────────────────────────────────

export interface HitTargetProps {
  /** Center of the invisible box. */
  at: Vec3
  /** Make it generous: this is the tap target. */
  size: Vec3
  onActivate: () => void
  enabled?: boolean
  onHoverChange?: (hovering: boolean) => void
}

/**
 * An invisible, generously sized box that catches clicks and taps for a small object.
 * It disappears while the guided sequence is running, so the tour cannot be disturbed.
 */
export function HitTarget({ at, size, onActivate, enabled = true, onHoverChange }: HitTargetProps) {
  const canvas = useThree((three) => three.gl.domElement)
  const { interactive } = useWorld()
  const live = enabled && interactive
  const hoverRef = useRef(onHoverChange)
  hoverRef.current = onHoverChange

  useEffect(() => {
    if (!live) return
    return () => {
      canvas.style.cursor = ''
      hoverRef.current?.(false)
    }
  }, [live, canvas])

  if (!live) return null
  return (
    <mesh
      position={at as [number, number, number]}
      scale={size as [number, number, number]}
      geometry={UNIT_BOX}
      material={HIT_MATERIAL}
      onClick={(event) => {
        event.stopPropagation()
        onActivate()
      }}
      onPointerOver={(event) => {
        event.stopPropagation()
        canvas.style.cursor = 'pointer'
        onHoverChange?.(true)
      }}
      onPointerOut={() => {
        canvas.style.cursor = ''
        onHoverChange?.(false)
      }}
    />
  )
}
