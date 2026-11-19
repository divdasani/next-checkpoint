import type { MissionId } from '../state/types.ts'
import { CAMERA, FRAME_BOXES, STOPS, ZONES, type Vec3 } from './layout.ts'

// Pure camera math: no three.js objects, so it is easy to test.
// The camera is orthographic with a fixed direction. Framing only decides how many
// pixels one world unit takes (zoom) and which point sits in the middle of the canvas.

export interface Basis {
  /** Screen-right in world space. */
  right: Vec3
  /** Screen-up in world space. */
  up: Vec3
  /** Unit vector from the scene toward the camera. */
  toCamera: Vec3
}

export interface Size {
  width: number
  height: number
}

/** A rectangle in canvas pixels, measured from the canvas's top-left corner. */
export interface Rect extends Size {
  left: number
  top: number
}

export interface Framing {
  /** Pixels per world unit. */
  zoom: number
  /** Camera elevation in degrees. */
  elevation: number
  /** Screen-plane coordinates (along right and up) of the point at the canvas center. */
  centerR: number
  centerU: number
  /** True when this framing is the eased focus on one zone. */
  focused: boolean
}

interface Extent {
  minR: number
  maxR: number
  minU: number
  maxU: number
}

const rad = (degrees: number) => (degrees * Math.PI) / 180
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

export function cameraBasis(azimuthDeg: number, elevationDeg: number): Basis {
  const az = rad(azimuthDeg)
  const el = rad(elevationDeg)
  return {
    right: [Math.cos(az), 0, -Math.sin(az)],
    up: [-Math.sin(az) * Math.sin(el), Math.cos(el), -Math.cos(az) * Math.sin(el)],
    toCamera: [Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)],
  }
}

export function boxCorners(min: Vec3, max: Vec3): Vec3[] {
  const corners: Vec3[] = []
  for (const x of [min[0], max[0]]) {
    for (const y of [min[1], max[1]]) {
      for (const z of [min[2], max[2]]) corners.push([x, y, z])
    }
  }
  return corners
}

function projectExtent(points: readonly Vec3[], basis: Basis): Extent {
  let minR = Infinity
  let maxR = -Infinity
  let minU = Infinity
  let maxU = -Infinity
  for (const point of points) {
    const r = dot(point, basis.right)
    const u = dot(point, basis.up)
    minR = Math.min(minR, r)
    maxR = Math.max(maxR, r)
    minU = Math.min(minU, u)
    maxU = Math.max(maxU, u)
  }
  return { minR, maxR, minU, maxU }
}

/** Put the middle of an extent at the middle of the safe area. */
function centerOn(extent: Extent, zoom: number, canvas: Size, safe: Rect) {
  const offsetX = safe.left + safe.width / 2 - canvas.width / 2
  const offsetY = canvas.height / 2 - (safe.top + safe.height / 2)
  return {
    centerR: (extent.minR + extent.maxR) / 2 - offsetX / zoom,
    centerU: (extent.minU + extent.maxU) / 2 - offsetY / zoom,
  }
}

function fitZoom(extent: Extent, safe: Size, fill: number): number {
  const width = Math.max(extent.maxR - extent.minR, 0.001)
  const height = Math.max(extent.maxU - extent.minU, 0.001)
  return Math.min((safe.width * fill) / width, (safe.height * fill) / height)
}

/** Wide stages get the classic isometric angle; tall stages a slightly higher one. */
export function elevationFor(aspect: number): number {
  const t = clamp01((aspect - 0.75) / (1.3 - 0.75))
  const eased = t * t * (3 - 2 * t)
  return CAMERA.elevationTall + (CAMERA.elevationWide - CAMERA.elevationTall) * eased
}

/**
 * Decide the camera framing for a canvas, the free ("safe") part of it that panels do not
 * cover, and the zone being worked on, if any.
 *
 * The overview always shows the whole island. A focus move toward the active zone happens
 * only when the overview would leave targets too small to read or tap (narrow screens).
 */
export function computeFraming(canvas: Size, safeArea: Rect | null, focus: MissionId | null): Framing {
  const safe: Rect =
    safeArea && safeArea.width > 40 && safeArea.height > 40
      ? safeArea
      : { left: 0, top: 0, width: Math.max(canvas.width, 1), height: Math.max(canvas.height, 1) }

  const elevation = elevationFor(safe.width / safe.height)
  const basis = cameraBasis(CAMERA.azimuth, elevation)

  const worldExtent = projectExtent(
    FRAME_BOXES.flatMap((box) => boxCorners(box.min, box.max)),
    basis,
  )
  const overviewZoom = fitZoom(worldExtent, safe, CAMERA.fill)
  const overview: Framing = {
    zoom: overviewZoom,
    elevation,
    focused: false,
    ...centerOn(worldExtent, overviewZoom, canvas, safe),
  }
  if (!focus || overviewZoom >= CAMERA.focusBelowZoom) return overview

  const zone = ZONES[focus]
  const [minX, minZ, maxX, maxZ] = zone.bounds
  const stop = STOPS[focus]
  const zoneExtent = projectExtent(
    [...boxCorners([minX, 0, minZ], [maxX, zone.topY, maxZ]), [stop[0], 0, stop[2]], [stop[0], 1.6, stop[2]]],
    basis,
  )
  const zoom = Math.max(
    overviewZoom,
    Math.min(fitZoom(zoneExtent, safe, 0.9), overviewZoom * CAMERA.focusMaxFactor, CAMERA.focusMaxZoom),
  )
  return { zoom, elevation, focused: true, ...centerOn(zoneExtent, zoom, canvas, safe) }
}

export function mixFraming(from: Framing, to: Framing, t: number): Framing {
  const mix = (a: number, b: number) => a + (b - a) * t
  return {
    zoom: mix(from.zoom, to.zoom),
    elevation: mix(from.elevation, to.elevation),
    centerR: mix(from.centerR, to.centerR),
    centerU: mix(from.centerU, to.centerU),
    focused: t < 1 ? from.focused : to.focused,
  }
}

/** Where a world point lands in canvas pixels for a given framing. */
export function projectToCanvas(point: Vec3, framing: Framing, canvas: Size): { x: number; y: number } {
  const basis = cameraBasis(CAMERA.azimuth, framing.elevation)
  return {
    x: canvas.width / 2 + (dot(point, basis.right) - framing.centerR) * framing.zoom,
    y: canvas.height / 2 - (dot(point, basis.up) - framing.centerU) * framing.zoom,
  }
}
