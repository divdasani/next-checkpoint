import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// jsdom has no WebGL. Returning null here sends the world down its normal
// "WebGL unavailable" path instead of printing "not implemented" noise.
HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext

afterEach(() => {
  cleanup()
})
