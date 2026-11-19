import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { Vector3 } from 'three'
import { ZONES } from './layout.ts'
import { getPinElements, subscribePins } from './stage.ts'

const EDGE = 24

/**
 * Positions the HTML destination labels above their buildings. It runs only on frames that
 * are actually rendered and writes straight to the elements, so no React state changes.
 */
export function PinProjector() {
  const camera = useThree((three) => three.camera)
  const size = useThree((three) => three.size)
  const invalidate = useThree((three) => three.invalidate)
  const point = useMemo(() => new Vector3(), [])

  useEffect(() => subscribePins(() => invalidate()), [invalidate])

  useFrame(() => {
    camera.updateMatrixWorld()
    for (const [id, element] of getPinElements()) {
      const [x, y, z] = ZONES[id].pin
      point.set(x, y, z).project(camera)
      const left = (point.x * 0.5 + 0.5) * size.width
      const top = (-point.y * 0.5 + 0.5) * size.height
      const transform = `translate3d(${left.toFixed(1)}px, ${top.toFixed(1)}px, 0)`
      if (element.style.transform !== transform) element.style.transform = transform
      const placed = left > EDGE && left < size.width - EDGE && top > EDGE && top < size.height - EDGE
      const flag = placed ? 'true' : 'false'
      if (element.dataset.placed !== flag) element.dataset.placed = flag
    }
  })

  return null
}
