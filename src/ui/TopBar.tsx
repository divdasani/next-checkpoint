import { content } from '../content/content.ts'
import { useGame } from '../state/GameContext.tsx'
import { IconFilm, IconFlag, IconPlay, IconResume } from './icons.tsx'

// The strip across the top: the site title, who it is about, and the controls that are
// always in reach. "Read resume" is shown in every mode and phase. The two buttons that
// start the guided sequence only exist in play mode, because once the sequence is running
// its own controls (TourBar) take over.
//
// Each button has a long and a short label. The stylesheet shows the short one where the
// bar is narrow, and the aria-label keeps the full name for screen readers either way.
export function TopBar() {
  const { state, dispatch } = useGame()
  const { identity, intro } = content

  return (
    <div className="topbar">
      <span className="topbar__mark" aria-hidden="true">
        <IconFlag />
      </span>

      <h1 className="topbar__title">{intro.title}</h1>

      <p className="topbar__identity">
        <span className="topbar__name">{identity.name}</span>
        <span aria-hidden="true"> · </span>
        <span className="visually-hidden">, </span>
        <span className="topbar__role">{identity.role}</span>
      </p>

      <div className="topbar__actions">
        <button
          type="button"
          className="btn topbar__btn topbar__resume"
          aria-label={intro.resumeLabel}
          onClick={() => dispatch({ type: 'OPEN_RESUME' })}
        >
          <IconResume />
          <span className="topbar__long">{intro.resumeLabel}</span>
          <span className="topbar__short">Resume</span>
        </button>

        {state.mode === 'play' && (
          <>
            <button
              type="button"
              className="btn topbar__btn film-hide"
              aria-label={intro.tourLabel}
              onClick={() => dispatch({ type: 'START_TOUR', mode: 'tour' })}
            >
              <IconPlay />
              <span className="topbar__long">{intro.tourLabel}</span>
              <span className="topbar__short">Tour</span>
            </button>
            {/* Film mode opens on a slate that waits for "Start take", so a recorder can be started first. */}
            <button
              type="button"
              className="btn topbar__btn film-hide"
              aria-label="Film mode"
              onClick={() => dispatch({ type: 'START_TOUR', mode: 'film' })}
            >
              <IconFilm />
              <span className="topbar__long">Film mode</span>
              <span className="topbar__short">Film</span>
            </button>
          </>
        )}
      </div>
    </div>
  )
}
