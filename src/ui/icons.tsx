import type { ReactNode } from 'react'

// Tiny inline icons for the top bar, chips, pins, and tour controls.
// They are drawn here so the site needs no icon files or icon library.
// Every icon is decorative: the control it sits in always has a text label or an
// aria-label, so screen readers skip the drawing itself.

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg
      className="hud-icon"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

/** Done. */
export function IconCheck() {
  return (
    <Svg>
      <path d="M3.2 8.6l3.1 3.1 6.5-7.2" strokeWidth="2.4" />
    </Svg>
  )
}

/** Not started yet: an empty ring. */
export function IconTodo() {
  return (
    <Svg>
      <circle cx="8" cy="8" r="5.2" />
    </Svg>
  )
}

/** The avatar is here: a ring with a solid center, like a map marker. */
export function IconHere() {
  return (
    <Svg>
      <circle cx="8" cy="8" r="5.2" />
      <circle cx="8" cy="8" r="2" fill="currentColor" stroke="none" />
    </Svg>
  )
}

export function IconPlay() {
  return (
    <Svg>
      <path d="M5.2 3.4v9.2L12.8 8z" fill="currentColor" strokeWidth="1.4" />
    </Svg>
  )
}

export function IconPause() {
  return (
    <Svg>
      <path d="M5.4 3.6v8.8M10.6 3.6v8.8" strokeWidth="2.6" />
    </Svg>
  )
}

export function IconRestart() {
  return (
    <Svg>
      <path d="M3.3 9.4a4.9 4.9 0 1 0 1-5M2.9 2.4v3.2h3.2" />
    </Svg>
  )
}

/** A page with two lines of text, for the resume. */
export function IconResume() {
  return (
    <Svg>
      <path d="M4 2.4h5.4L12 5v8.6H4zM6.4 8h3.2M6.4 10.6h3.2" strokeWidth="1.8" />
    </Svg>
  )
}

/** A small video camera, for Film mode. */
export function IconFilm() {
  return (
    <Svg>
      <path d="M2.4 4.6h7.4v6.8H2.4zM9.8 7.2l3.8-2v5.6l-3.8-2" strokeWidth="1.8" />
    </Svg>
  )
}

/** The checkpoint flag that marks the site title. */
export function IconFlag() {
  return (
    <Svg>
      <path d="M4.4 3h7.8l-2.1 2.6 2.1 2.6H4.4z" fill="var(--coral)" strokeWidth="1.6" />
      <path d="M4.4 14V2.4" />
    </Svg>
  )
}
