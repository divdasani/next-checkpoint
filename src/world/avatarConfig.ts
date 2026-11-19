// Annika's avatar, described as plain data so it is easy to change.
// Every value is a hex color or one of the listed options. Save the file and the
// avatar updates. Nothing else needs to be edited.
//
// The outfit follows the brief: teal top, navy trousers, white shoes, and one small
// coral accessory. Skin and hair are neutral, palette-driven placeholders because no
// preference was supplied for them. Replace them with whatever Annika prefers.

/** bob: chin length with side locks. short: cropped close. ponytail: cropped, with a knot on top and a tail behind. */
export type HairStyle = 'bob' | 'short' | 'ponytail'
/** headband: a band over the top of the head. bow: a small bow on top. none: no accessory. */
export type AccessoryStyle = 'headband' | 'bow' | 'none'

export interface AvatarConfig {
  skin: string
  hair: string
  hairStyle: HairStyle
  top: string
  trousers: string
  shoes: string
  /** The one small accent. */
  accessory: string
  accessoryStyle: AccessoryStyle
  /** Eyes and smile. */
  face: string
}

export const avatarConfig: AvatarConfig = {
  skin: '#ffd166',
  hair: '#2b2f45',
  hairStyle: 'bob',
  top: '#18b8a6',
  trousers: '#22335c',
  shoes: '#ffffff',
  accessory: '#ff6b5c',
  accessoryStyle: 'headband',
  face: '#1b2a4a',
}
