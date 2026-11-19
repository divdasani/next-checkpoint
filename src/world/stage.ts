import { useLayoutEffect, useState, useSyncExternalStore } from 'react'
import type { MissionId } from '../state/types.ts'

// Small bridges between the HTML interface and the 3D canvas.
//  - The safe area: the part of the screen not covered by panels. The camera centers the
//    island inside it, so CSS stays the single source of layout truth.
//  - Pins: HTML destination labels that the canvas positions above each main building.
//  - World status: lets the interface know when WebGL could not start.

export interface ScreenRect {
  left: number
  top: number
  width: number
  height: number
}

function createStore<T>(initial: T) {
  let value = initial
  const listeners = new Set<() => void>()
  return {
    get: () => value,
    set: (next: T) => {
      if (Object.is(next, value)) return
      value = next
      listeners.forEach((listener) => listener())
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

// ── Safe area ────────────────────────────────────────────────────────────────

const safeRect = createStore<ScreenRect | null>(null)

function sameRect(a: ScreenRect | null, b: ScreenRect | null): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height
}

/** The free rectangle of the stage in viewport pixels, or null before it is measured. */
export function useStageSafeRect(): ScreenRect | null {
  return useSyncExternalStore(safeRect.subscribe, safeRect.get, () => null)
}

/**
 * Returns a ref callback for the element that marks the free area of the stage.
 * Usage: `const safeRef = useStageSafeArea()` then `<div ref={safeRef} className="stage-safe" />`.
 */
export function useStageSafeArea(): (element: HTMLElement | null) => void {
  const [element, setElement] = useState<HTMLElement | null>(null)

  useLayoutEffect(() => {
    if (!element) return
    const measure = () => {
      const box = element.getBoundingClientRect()
      const next = { left: box.left, top: box.top, width: box.width, height: box.height }
      if (!sameRect(next, safeRect.get())) safeRect.set(next)
    }
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(element)
    window.addEventListener('resize', measure)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', measure)
      safeRect.set(null)
    }
  }, [element])

  return setElement
}

// ── Destination pins ─────────────────────────────────────────────────────────

const pinElements = new Map<MissionId, HTMLElement>()
const pinVersion = createStore(0)

function makePinRef(id: MissionId) {
  return (element: HTMLElement | null) => {
    if (element) pinElements.set(id, element)
    else pinElements.delete(id)
    pinVersion.set(pinVersion.get() + 1)
  }
}

/**
 * Stable ref callbacks for the three destination labels.
 * Usage: `<div ref={PIN_REFS.network} className="pin">` wrapping the pin's button. The canvas
 * then moves that element with a CSS transform and sets `data-placed="true"` once it has a
 * position on screen.
 */
export const PIN_REFS: Record<MissionId, (element: HTMLElement | null) => void> = {
  network: makePinRef('network'),
  signal: makePinRef('signal'),
  launch: makePinRef('launch'),
}

export function getPinElements(): ReadonlyMap<MissionId, HTMLElement> {
  return pinElements
}

export const subscribePins = pinVersion.subscribe

// ── World status ─────────────────────────────────────────────────────────────

export type WorldStatus = 'loading' | 'ready' | 'unavailable'

const worldStatus = createStore<WorldStatus>('loading')

export const setWorldStatus = worldStatus.set

/** 'unavailable' means WebGL could not start; the HTML interface keeps working. */
export function useWorldStatus(): WorldStatus {
  return useSyncExternalStore(worldStatus.subscribe, worldStatus.get, () => 'loading')
}
