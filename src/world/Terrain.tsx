import { Block } from './kit.tsx'
import { PALETTE, PROPS, TERRAIN, type PropSpec, type Vec3 } from './layout.ts'

// Static scenery, drawn straight from the fixed arrays in layout.ts.

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const times = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k]

function Tree({ at, scale }: { at: Vec3; scale: number }) {
  // Each part is [offset of its center above the base, size].
  const part = (offset: Vec3, size: Vec3, color: string) => (
    <Block at={add(at, times(offset, scale))} size={times(size, scale)} color={color} />
  )
  return (
    <>
      {part([0, 0.28, 0], [0.28, 0.56, 0.28], PALETTE.trunk)}
      {part([0, 0.86, 0], [1.05, 0.66, 1.05], PALETTE.leaf)}
      {part([0, 1.42, 0], [0.7, 0.5, 0.7], PALETTE.leafLight)}
    </>
  )
}

function Bush({ at, scale }: { at: Vec3; scale: number }) {
  return (
    <>
      <Block at={add(at, [0, 0.22 * scale, 0])} size={times([0.78, 0.44, 0.78], scale)} color={PALETTE.leaf} />
      <Block
        at={add(at, times([0.1, 0.56, -0.08], scale))}
        size={times([0.44, 0.26, 0.44], scale)}
        color={PALETTE.leafLight}
      />
    </>
  )
}

function Rock({ at, scale }: { at: Vec3; scale: number }) {
  return (
    <>
      <Block at={add(at, [0, 0.19 * scale, 0])} size={times([0.62, 0.38, 0.52], scale)} color={PALETTE.rock} />
      <Block
        at={add(at, times([0.36, 0.11, 0.2], scale))}
        size={times([0.3, 0.22, 0.3], scale)}
        color={PALETTE.stoneDark}
      />
    </>
  )
}

function Flower({ at, color }: { at: Vec3; color: string }) {
  return (
    <>
      <Block at={add(at, [0, 0.09, 0])} size={[0.06, 0.18, 0.06]} color={PALETTE.leaf} cast={false} />
      <Block at={add(at, [0, 0.22, 0])} size={[0.2, 0.12, 0.2]} color={color} cast={false} />
    </>
  )
}

function Cloud({ at, scale }: { at: Vec3; scale: number }) {
  return (
    <>
      <Block at={at} size={times([2.4, 0.5, 1.1], scale)} color={PALETTE.cloud} cast={false} receive={false} />
      <Block
        at={add(at, times([0.3, 0.45, -0.1], scale))}
        size={times([1.3, 0.45, 0.8], scale)}
        color={PALETTE.cloud}
        cast={false}
        receive={false}
      />
    </>
  )
}

function Prop({ spec }: { spec: PropSpec }) {
  switch (spec.kind) {
    case 'tree':
      return <Tree at={spec.at} scale={spec.scale} />
    case 'bush':
      return <Bush at={spec.at} scale={spec.scale} />
    case 'rock':
      return <Rock at={spec.at} scale={spec.scale} />
    case 'flower':
      return <Flower at={spec.at} color={PALETTE[spec.color]} />
    case 'cloud':
      return <Cloud at={spec.at} scale={spec.scale} />
  }
}

export function Terrain() {
  return (
    <>
      {TERRAIN.map((block) => (
        <Block
          key={block.id}
          at={block.at}
          size={block.size}
          color={PALETTE[block.color]}
          cast={block.cast ?? true}
          receive={block.receive ?? true}
        />
      ))}
      {PROPS.map((spec) => (
        <Prop key={spec.id} spec={spec} />
      ))}
    </>
  )
}
