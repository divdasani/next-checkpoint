import { OrthographicCamera, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { MISSION_IDS, type MissionId } from '../state/types.ts'
import {
  boxCorners,
  cameraBasis,
  computeFraming,
  elevationFor,
  mixFraming,
  projectToCanvas,
  type Framing,
  type Rect,
  type Size,
} from './framing.ts'
import { CAMERA, FRAME_BOXES, ZONES, type Vec3 } from './layout.ts'

// The camera never moves freely. framing.ts only decides how large the island is drawn
// and where it sits, so that it always fits the part of the screen no panel covers
// (the "safe" rectangle). These tests check that promise on the screen shapes that
// matter: desktop, a 16:9 recording, a small landscape window, a phone, and 9:16.

// Screens -------------------------------------------------------------------------

interface Screen {
  name: string
  canvas: Size
  /** The free rectangle, in canvas pixels. */
  safe: Rect
}

/** Wide layout: a top bar across the screen and the panel in a column on the right. */
function withSideColumn(width: number, height: number, column: number, topBar: number): Screen {
  return {
    name: `${width}x${height}`,
    canvas: { width, height },
    safe: { left: 0, top: topBar, width: width - column, height: height - topBar },
  }
}

/** Tall layout: the panel is a sheet at the bottom and the world gets the top part. */
function withBottomSheet(width: number, height: number, share: number): Screen {
  return {
    name: `${width}x${height}`,
    canvas: { width, height },
    safe: { left: 0, top: 0, width, height: height * share },
  }
}

const DESKTOP = withSideColumn(1440, 900, 384, 70)
const RECORDING = withSideColumn(1920, 1080, 480, 88)
const SMALL_LANDSCAPE = withSideColumn(1024, 768, 384, 70)
const PHONE = withBottomSheet(390, 844, 0.55)
const PORTRAIT_RECORDING = withBottomSheet(1080, 1920, 0.55)

const SCREENS = [DESKTOP, RECORDING, SMALL_LANDSCAPE, PHONE, PORTRAIT_RECORDING]
const WIDE_SCREENS = [DESKTOP, RECORDING]

/** A few more free rectangles, to make sure nothing depends on the rectangle starting at the corner. */
const OFFSET_SCREENS: Screen[] = [
  // What a phone really leaves free: a band under the top bar and above the footer and sheet.
  {
    name: '390x844 with real insets',
    canvas: { width: 390, height: 844 },
    safe: { left: 12, top: 68, width: 366, height: 316 },
  },
  // A panel on the left instead of the right.
  {
    name: '1440x900 with a left column',
    canvas: { width: 1440, height: 900 },
    safe: { left: 384, top: 70, width: 1056, height: 760 },
  },
  // A small free rectangle in the middle of a large canvas.
  {
    name: '1600x1200 with a centered window',
    canvas: { width: 1600, height: 1200 },
    safe: { left: 500, top: 300, width: 520, height: 420 },
  },
]

const ALL_SCREENS = [...SCREENS, ...OFFSET_SCREENS]

// Helpers -------------------------------------------------------------------------

const TOLERANCE_PX = 1

const ISLAND_CORNERS: Vec3[] = FRAME_BOXES.flatMap((box) => boxCorners(box.min, box.max))

/** The four corners of a mission zone's floor rectangle, at ground level. */
function zoneGroundCorners(mission: MissionId): Vec3[] {
  const [minX, minZ, maxX, maxZ] = ZONES[mission].bounds
  return [
    [minX, 0, minZ],
    [minX, 0, maxZ],
    [maxX, 0, minZ],
    [maxX, 0, maxZ],
  ]
}

function expectInside(points: readonly Vec3[], framing: Framing, screen: Screen): void {
  const { safe, canvas } = screen
  for (const point of points) {
    const { x, y } = projectToCanvas(point, framing, canvas)
    const where = `${screen.name}: point [${point.join(', ')}] lands at (${x.toFixed(1)}, ${y.toFixed(1)})`
    expect(x, where).toBeGreaterThanOrEqual(safe.left - TOLERANCE_PX)
    expect(x, where).toBeLessThanOrEqual(safe.left + safe.width + TOLERANCE_PX)
    expect(y, where).toBeGreaterThanOrEqual(safe.top - TOLERANCE_PX)
    expect(y, where).toBeLessThanOrEqual(safe.top + safe.height + TOLERANCE_PX)
  }
}

/** The rectangle the projected points cover on the canvas. */
function coveredBox(points: readonly Vec3[], framing: Framing, canvas: Size) {
  const projected = points.map((point) => projectToCanvas(point, framing, canvas))
  const xs = projected.map((p) => p.x)
  const ys = projected.map((p) => p.y)
  const left = Math.min(...xs)
  const top = Math.min(...ys)
  return { left, top, width: Math.max(...xs) - left, height: Math.max(...ys) - top }
}

const fullCanvas = (canvas: Size): Rect => ({ left: 0, top: 0, width: canvas.width, height: canvas.height })

// Tests ---------------------------------------------------------------------------

describe('the overview: the whole island, inside the free part of the screen', () => {
  it.each(ALL_SCREENS)('$name: every corner of the island is inside the safe rectangle', (screen) => {
    const framing = computeFraming(screen.canvas, screen.safe, null)
    expect(framing.focused).toBe(false)
    expect(framing.zoom).toBeGreaterThan(0)
    expect(ISLAND_CORNERS.length).toBe(FRAME_BOXES.length * 8)
    expectInside(ISLAND_CORNERS, framing, screen)
  })

  it.each(ALL_SCREENS)('$name: the island is centered there and uses the room it is allowed', (screen) => {
    const { safe, canvas } = screen
    const framing = computeFraming(canvas, safe, null)
    const box = coveredBox(ISLAND_CORNERS, framing, canvas)

    expect(box.left + box.width / 2).toBeCloseTo(safe.left + safe.width / 2, 3)
    expect(box.top + box.height / 2).toBeCloseTo(safe.top + safe.height / 2, 3)

    // It fills the allowed share of the tighter direction, and no more of the other.
    const widthShare = box.width / safe.width
    const heightShare = box.height / safe.height
    expect(Math.max(widthShare, heightShare)).toBeCloseTo(CAMERA.fill, 3)
    expect(Math.min(widthShare, heightShare)).toBeLessThanOrEqual(CAMERA.fill + 1e-6)
  })

  it.each(SCREENS)('$name: the same screen always gets the same framing', (screen) => {
    expect(computeFraming(screen.canvas, screen.safe, null)).toEqual(computeFraming(screen.canvas, screen.safe, null))
  })

  it('a larger free area shows the island larger', () => {
    const small = computeFraming(PHONE.canvas, PHONE.safe, null)
    const large = computeFraming(RECORDING.canvas, RECORDING.safe, null)
    expect(large.zoom).toBeGreaterThan(small.zoom)
  })
})

describe('a missing or tiny safe area falls back to the whole canvas', () => {
  it.each(SCREENS)('$name', ({ canvas }) => {
    const whole = computeFraming(canvas, fullCanvas(canvas), null)
    expect(computeFraming(canvas, null, null)).toEqual(whole)
    // Before the layout has been measured the rectangle can be empty or a sliver.
    expect(computeFraming(canvas, { left: 0, top: 0, width: 0, height: 0 }, null)).toEqual(whole)
    expect(computeFraming(canvas, { left: 10, top: 10, width: 30, height: 600 }, null)).toEqual(whole)
    expect(computeFraming(canvas, { left: 10, top: 10, width: 600, height: 30 }, null)).toEqual(whole)
    expectInside(ISLAND_CORNERS, whole, { name: 'whole canvas', canvas, safe: fullCanvas(canvas) })
  })

  it('never produces unusable numbers, even for a canvas with no size yet', () => {
    const framing = computeFraming({ width: 0, height: 0 }, null, 'network')
    for (const value of [framing.zoom, framing.elevation, framing.centerR, framing.centerU]) {
      expect(Number.isFinite(value)).toBe(true)
    }
    expect(framing.zoom).toBeGreaterThan(0)
  })
})

describe('the one focus move toward an active mission', () => {
  describe.each(MISSION_IDS)('%s on a phone', (mission) => {
    const overview = computeFraming(PHONE.canvas, PHONE.safe, null)
    const focus = computeFraming(PHONE.canvas, PHONE.safe, mission)

    it('moves closer, within the allowed limits', () => {
      expect(focus.focused).toBe(true)
      expect(focus.zoom).toBeGreaterThan(overview.zoom)
      expect(focus.zoom).toBeLessThanOrEqual(overview.zoom * CAMERA.focusMaxFactor + 1e-9)
      expect(focus.zoom).toBeLessThanOrEqual(CAMERA.focusMaxZoom + 1e-9)
    })

    it('keeps the camera angle, so only position and size change', () => {
      expect(focus.elevation).toBe(overview.elevation)
    })

    it('keeps the whole zone floor inside the free part of the screen', () => {
      expectInside(zoneGroundCorners(mission), focus, PHONE)
    })

    it('makes the zone large enough to work in: bigger on screen than in the overview', () => {
      const before = coveredBox(zoneGroundCorners(mission), overview, PHONE.canvas)
      const after = coveredBox(zoneGroundCorners(mission), focus, PHONE.canvas)
      expect(after.width).toBeGreaterThan(before.width)
      expect(after.height).toBeGreaterThan(before.height)
    })
  })

  it.each(WIDE_SCREENS)('$name: the overview is already readable, so the camera stays exactly put', (screen) => {
    const overview = computeFraming(screen.canvas, screen.safe, null)
    expect(overview.zoom).toBeGreaterThanOrEqual(CAMERA.focusBelowZoom)
    for (const mission of MISSION_IDS) {
      expect(computeFraming(screen.canvas, screen.safe, mission), mission).toEqual(overview)
    }
  })

  it.each(ALL_SCREENS)('$name: every mission follows the same rule', (screen) => {
    const overview = computeFraming(screen.canvas, screen.safe, null)
    for (const mission of MISSION_IDS) {
      const framing = computeFraming(screen.canvas, screen.safe, mission)
      if (!framing.focused) {
        // No focus move: identical to the overview, down to the last digit.
        expect(framing, mission).toEqual(overview)
        expect(overview.zoom, mission).toBeGreaterThanOrEqual(CAMERA.focusBelowZoom)
        continue
      }
      // A focus move only happens where the overview is too small to read or tap.
      expect(overview.zoom, mission).toBeLessThan(CAMERA.focusBelowZoom)
      expect(framing.zoom, mission).toBeGreaterThanOrEqual(overview.zoom)
      expect(framing.zoom, mission).toBeLessThanOrEqual(overview.zoom * CAMERA.focusMaxFactor + 1e-9)
      expect(framing.zoom, mission).toBeLessThanOrEqual(CAMERA.focusMaxZoom + 1e-9)
      expect(framing.elevation, mission).toBe(overview.elevation)
      expectInside(zoneGroundCorners(mission), framing, screen)
    }
  })
})

describe('elevationFor: the camera angle for wide and tall stages', () => {
  const low = Math.min(CAMERA.elevationWide, CAMERA.elevationTall)
  const high = Math.max(CAMERA.elevationWide, CAMERA.elevationTall)
  const aspects = Array.from({ length: 400 }, (_, index) => 0.05 + index * 0.01)

  it('always stays between the wide and the tall angle', () => {
    for (const aspect of [...aspects, 0, 0.001, 100, 1e6]) {
      const elevation = elevationFor(aspect)
      expect(elevation, `aspect ${aspect}`).toBeGreaterThanOrEqual(low)
      expect(elevation, `aspect ${aspect}`).toBeLessThanOrEqual(high)
    }
  })

  it('uses the tall angle for narrow stages and the classic isometric angle for wide ones', () => {
    expect(elevationFor(0.4)).toBeCloseTo(CAMERA.elevationTall, 9)
    expect(elevationFor(9 / 16)).toBeCloseTo(CAMERA.elevationTall, 9)
    expect(elevationFor(16 / 9)).toBeCloseTo(CAMERA.elevationWide, 9)
    expect(elevationFor(3)).toBeCloseTo(CAMERA.elevationWide, 9)
  })

  it('changes in one direction only as the stage gets wider: no wobble while resizing', () => {
    for (let index = 1; index < aspects.length; index++) {
      const narrower = elevationFor(aspects[index - 1])
      const wider = elevationFor(aspects[index])
      expect(wider, `aspect ${aspects[index]}`).toBeLessThanOrEqual(narrower + 1e-12)
    }
    expect(elevationFor(aspects[0])).toBeGreaterThan(elevationFor(aspects[aspects.length - 1]))
  })

  it('is the angle the framing reports for a screen', () => {
    for (const { canvas, safe } of SCREENS) {
      expect(computeFraming(canvas, safe, null).elevation).toBe(elevationFor(safe.width / safe.height))
    }
  })
})

describe('mixFraming: the eased move between two framings', () => {
  const from = computeFraming(PHONE.canvas, PHONE.safe, null)
  const to = computeFraming(PHONE.canvas, PHONE.safe, 'launch')

  it('starts exactly on the first framing and ends exactly on the second', () => {
    expect(mixFraming(from, to, 0)).toEqual(from)
    expect(mixFraming(from, to, 1)).toEqual(to)
  })

  it('is halfway between them at the midpoint', () => {
    const middle = mixFraming(from, to, 0.5)
    expect(middle.zoom).toBeCloseTo((from.zoom + to.zoom) / 2, 9)
    expect(middle.centerR).toBeCloseTo((from.centerR + to.centerR) / 2, 9)
    expect(middle.centerU).toBeCloseTo((from.centerU + to.centerU) / 2, 9)
    expect(middle.elevation).toBeCloseTo((from.elevation + to.elevation) / 2, 9)
  })
})

describe('the math agrees with a real three.js camera', () => {
  // The scene places an orthographic camera from a framing (see applyFraming in CameraRig.tsx).
  // This rebuilds that camera and checks that three.js draws a point at the same pixel that
  // projectToCanvas predicts. If the two ever disagreed, the island would look fine in these
  // tests and still sit off-center on screen.
  function threeCamera(framing: Framing, canvas: Size): OrthographicCamera {
    const { right, up, toCamera } = cameraBasis(CAMERA.azimuth, framing.elevation)
    const center = new Vector3(
      right[0] * framing.centerR + up[0] * framing.centerU,
      right[1] * framing.centerR + up[1] * framing.centerU,
      right[2] * framing.centerR + up[2] * framing.centerU,
    )
    const halfWidth = canvas.width / 2
    const halfHeight = canvas.height / 2
    const camera = new OrthographicCamera(-halfWidth, halfWidth, halfHeight, -halfHeight, 0.1, 1000)
    camera.position.copy(center).addScaledVector(new Vector3(...toCamera), 60)
    camera.up.set(0, 1, 0)
    camera.lookAt(center)
    camera.zoom = framing.zoom
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld()
    return camera
  }

  function drawnAt(point: Vec3, camera: OrthographicCamera, canvas: Size) {
    const ndc = new Vector3(...point).project(camera)
    return { x: ((ndc.x + 1) / 2) * canvas.width, y: ((1 - ndc.y) / 2) * canvas.height }
  }

  const landmarks: Vec3[] = [
    [0, 0, 0],
    [7.2, 0.4, 7.2],
    [-7.2, -1.2, 7.2],
    [-5.3, 3.95, -6.05],
    [5, 2.6, -5],
  ]
  const samples = [...landmarks, ...ISLAND_CORNERS]

  it.each(ALL_SCREENS)('$name: overview and focus land on the same pixels', (screen) => {
    for (const focus of [null, ...MISSION_IDS]) {
      const framing = computeFraming(screen.canvas, screen.safe, focus)
      const camera = threeCamera(framing, screen.canvas)
      for (const point of samples) {
        const predicted = projectToCanvas(point, framing, screen.canvas)
        const drawn = drawnAt(point, camera, screen.canvas)
        expect(predicted.x).toBeCloseTo(drawn.x, 2)
        expect(predicted.y).toBeCloseTo(drawn.y, 2)
      }
    }
  })

  it('the camera looks from the front corner: +x and +z toward the viewer, +y up', () => {
    const { right, up, toCamera } = cameraBasis(CAMERA.azimuth, CAMERA.elevationWide)
    // Three unit vectors at right angles to each other.
    const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
    for (const axis of [right, up, toCamera]) expect(dot(axis, axis)).toBeCloseTo(1, 9)
    expect(dot(right, up)).toBeCloseTo(0, 9)
    expect(dot(right, toCamera)).toBeCloseTo(0, 9)
    expect(dot(up, toCamera)).toBeCloseTo(0, 9)
    // The camera sits above the ground on the +x, +z side, and screen-up leans toward +y.
    expect(toCamera[0]).toBeGreaterThan(0)
    expect(toCamera[1]).toBeGreaterThan(0)
    expect(toCamera[2]).toBeGreaterThan(0)
    expect(up[1]).toBeGreaterThan(0)
  })

  it('on screen, launch is at the back, network on the left, signal on the right, and home in front', () => {
    const framing = computeFraming(DESKTOP.canvas, DESKTOP.safe, null)
    const at = (mission: MissionId) => projectToCanvas(ZONES[mission].center, framing, DESKTOP.canvas)
    const home = projectToCanvas([5, 0, 5], framing, DESKTOP.canvas)
    expect(at('launch').y).toBeLessThan(at('network').y)
    expect(at('launch').y).toBeLessThan(at('signal').y)
    expect(at('network').x).toBeLessThan(at('launch').x)
    expect(at('signal').x).toBeGreaterThan(at('launch').x)
    // The start corner is nearest the viewer, lowest on screen.
    expect(home.y).toBeGreaterThan(at('network').y)
    expect(home.y).toBeGreaterThan(at('signal').y)
  })
})
