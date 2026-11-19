import { Avatar } from './Avatar.tsx'
import { CameraRig } from './CameraRig.tsx'
import { Checkpoints } from './Checkpoints.tsx'
import { LaunchZone } from './LaunchZone.tsx'
import { NetworkZone } from './NetworkZone.tsx'
import { PinProjector } from './PinProjector.tsx'
import { SignalZone } from './SignalZone.tsx'
import { Terrain } from './Terrain.tsx'

// One small scene: two lights, the island, three mission zones, and the avatar.
// Light comes from the upper left, so tops are brightest, left faces are mid, and right
// faces are darkest. That contrast is what makes the blocks read as solid.

export function Scene() {
  return (
    <>
      <hemisphereLight args={['#ffffff', '#bcdcf5', 1.85]} />
      <directionalLight
        position={[-7, 12, 4.5]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
      >
        <orthographicCamera attach="shadow-camera" args={[-13, 13, 13, -13, 1, 40]} />
      </directionalLight>

      <CameraRig />
      <Terrain />
      <Checkpoints />
      <NetworkZone />
      <SignalZone />
      <LaunchZone />
      <Avatar />
      <PinProjector />
    </>
  )
}
