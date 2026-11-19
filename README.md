# Next Checkpoint

Next Checkpoint is a small interactive resume for Annika Dasani, who is applying for Roblox's Associate Product Manager role. A visitor sees one blocky island, travels to three destinations, and finishes a short mission at each one. Every mission ends on a "Real experience" card that states the actual accomplishment behind it. The same sequence can also play by itself as a Guided tour or in Film mode for screen recording, and the full resume is one click away at all times.

It is a static site built with React, TypeScript, Vite, three.js, and React Three Fiber. It has no backend.

Independent project. Not affiliated with or endorsed by Roblox.

This repository is the whole application. The briefs, the reference images, and the original resume it was built from are working material. They are kept outside the repository and are not published.

## Run it locally

You need Node.js 24. That is the `engines` value in `package.json` (`24.x`), and the `.nvmrc` file says `24`, so `nvm use` selects it if you use nvm. npm is installed with Node. Node 24 is the version the project was checked on. The tools also declare support for Node 22.13 and later, but that was not tried, and npm prints a version warning there.

Run every command from the repository folder, the one that holds `package.json`.

```sh
npm ci
npm run dev
```

| Command | What it does |
| --- | --- |
| `npm ci` | Installs exactly the versions recorded in `package-lock.json`. Run it once after cloning. |
| `npm run dev` | Starts the development server, which updates the page as you save. Vite prints the address, normally `http://localhost:5173`. |
| `npm run build` | Type-checks the code, then writes the production site to `dist/`. |
| `npm run preview` | Serves the built `dist/` folder, normally at `http://localhost:4173`. Build first. |
| `npm run typecheck` | Runs the TypeScript compiler over the app, the tests, and the build config. |
| `npm test` | Runs the test suite once with Vitest. `npm run test:watch` reruns it as files change. |
| `npm run verify:dist` | Inspects the built `dist/` folder: referenced files, file types, a privacy scan, the no-JavaScript resume, and file sizes. Build first. |
| `npm run check` | Runs typecheck, tests, build, and verify:dist in that order. Run it before every deploy. |

The site has one address. The mode is chosen in the URL, so each one can be linked and reloaded.

| URL | Opens |
| --- | --- |
| `/` | The intro, with Start playing, Guided tour, and Read resume. |
| `/?mode=tour` | The Guided tour, already running. |
| `/?mode=film` | Film mode, waiting on its slate for Start take. |
| `/?mode=film&autostart=1` | Film mode with the take starting at once. |
| `/#resume` | The resume, open. `#resume` can follow any address above, and a sequence then waits instead of running behind the resume. |

## Edit the content

Every career fact and almost all visible wording live in one file, `src/content/content.ts`. Edit the text there and the missions, the cards, and the resume all pick it up.

| Part | What it holds |
| --- | --- |
| `identity` | The name, the role line ("Associate Product Manager applicant"), and the LinkedIn address. |
| `intro` | The title, the opening line, a short blurb, and the labels of the three opening buttons. `tourNote` states how long the tour takes. |
| `overview` | The map panel's heading and text, and the "2 of 3 checkpoints reached" line. |
| `missions` | One entry each for `network`, `signal`, and `launch`: title, place name, objective, how-to line, illustration note, the names of its objects, and `evidence`. |
| `cardLabels` | "Real experience" and the two Continue button labels. |
| `finale` | "Next checkpoint: Roblox.", the motivation, the gaming-concept line, the "applying" line, and the button labels. |
| `resume` | The readable resume: summary, skills, sections with entries and bullets, education, and `publicPdf`. |
| `credit` | The independent-project line in the footer. |

Each mission's `evidence` holds the card: a `quote`, two `labels`, and a `note` that keeps the claim precise. The three quotes are fixed word for word.

| Mission | Place | Card quote |
| --- | --- | --- |
| 1. Eight Worlds, One System | The Hub | "At Microsoft, I built a framework to centralize $700M in acquisition billing across eight companies. It enabled an additional $360M in revenue to be absorbed within three months." |
| 2. Find the Signal | The Signal Station | "I interviewed users to understand reporting needs, then designed a self-service Power BI dashboard across eight acquired companies. It eliminated approximately six hours of weekly manual reporting." |
| 3. Launch Day | The Launch Arch | "I translated business needs into engineering requirements and acceptance criteria, and coordinated roadmaps, dependencies, testing, and communications for two global tax-rate change rollouts." |

Two things live elsewhere. The browser tab title and the link-preview description are in `index.html`. Interface labels that are not career content, such as Back to map or Start take, are in the components under `src/ui/`.

### The content test fails on purpose

`src/content/content.test.ts` holds its own copy of the confirmed career facts and of the card wording from the project brief, and compares the content with them. When wording drifts, `npm test` fails. These are the rules it enforces.

- **Exact card wording.** Each `evidence.quote` must match the brief character for character and keep exactly its two labels. The mission titles, the three data-source names, the three readiness names, "Real experience", the opening button labels, and "Next checkpoint: Roblox." are fixed the same way.
- **Confirmed numbers only.** Every number in the cards, the finale, and the resume must be on the test's list of confirmed figures. The only dollar amounts allowed anywhere are $700M and $360M. A sentence with $700M must say "billing". A sentence with $360M must say "absorbed" or "accommodated". The word "generated" may appear only in a sentence that negates it.
- **The gaming project is a concept.** Any sentence that contains "app" or "gaming" must also contain "concept". Wording such as "built an app", "shipped", "app users", or "downloads" fails.
- **Roblox.** The role line must stay "Associate Product Manager applicant". Every sentence that names Roblox must be the ending line, or mention applying, or state independence, or say "Roblox-inspired". Wording that implies a job, an offer, or an official Roblox page fails.
- **No invented results.** Percentages, user counts, A/B tests, retention or conversion claims, testimonials, and AI or machine-learning mentions fail. Skills must come from the source resume's list. The resume must list exactly Microsoft, 3 Day Startup, and Mercedes-Benz U.S. International, with their confirmed roles, dates, and places.
- **No authorship claim.** Nothing may say that Annika built, coded, or user-tested this site.
- **Privacy scan.** The test reads every `.ts`, `.tsx`, and `.css` file under `src/`, plus `index.html` and the text files in `public/`, and fails on anything shaped like a phone number, an email address, or a `tel:` or `mailto:` link. It fails if a PDF or Word file sits in `public/` without being the configured public PDF, and if a file named like the source resume or a reference image appears in `src/` or `public/`. The only web addresses allowed in the content are the LinkedIn profile and the Roblox job posting.

When a check fails after an edit, look at the edit first. Change the test only when the fact itself has changed and Annika has confirmed the new one. Then update the matching expectation in the same change, for example by adding the new figure to the `amounts` list, so the test keeps describing the truth. Do not delete a check to get a passing run.

Two smaller ties are worth knowing. `intro.tourNote` says "about 55 seconds", and `src/state/timeline.test.ts` fails if that number is more than 5 seconds from the real length. If you add a new text-building function to `content.ts` (like `progress` or `blocked`), the content test "this test reads every text-building function in the content file" fails until you add the function to its list and the function's output to `builtText`, so the wording rules read the new text too.

### The resume has two renderers

`src/ui/Resume.tsx` draws the resume in the app. It is the sheet behind every Read resume button, and it is what Print resume prints. `src/content/resumeHtml.ts` writes the same resume as a plain HTML string, and the build places it inside `<noscript>` in `index.html` for visitors without JavaScript.

Both read `content.resume`. Editing words, bullets, skills, or sections in `content.ts` updates both with no code change. Only a change of structure, such as a new kind of field or a different element, has to be made in both files. A test in `src/ui/Resume.test.tsx` ("has the same structure and words as the copy for visitors without JavaScript") renders both and compares them, and `src/content/resumeHtml.test.ts` checks the plain copy by itself. The headings Summary, Skills, and Education come from `RESUME_LABELS` in `resumeHtml.ts` and are shared by both.

## Change the avatar

`src/world/avatarConfig.ts` describes the avatar as plain data. While `npm run dev` is running, saving the file updates the avatar in the browser.

| Field | Now | Meaning |
| --- | --- | --- |
| `skin` | `#ffd166` | Head and forearms. Placeholder. |
| `hair` | `#2b2f45` | Hair color. Placeholder. |
| `hairStyle` | `'bob'` | `'bob'` (chin length with side locks), `'short'` (cropped close), or `'ponytail'` (cropped, with a knot on top and a tail behind). |
| `top` | `#18b8a6` | The teal top: torso and sleeves. |
| `trousers` | `#22335c` | Navy trousers. |
| `shoes` | `#ffffff` | White shoes. |
| `accessory` | `#ff6b5c` | The one small coral accent. |
| `accessoryStyle` | `'headband'` | `'headband'`, `'bow'`, or `'none'`. |
| `face` | `#1b2a4a` | Eyes and smile. |

**The skin and hair colors are neutral placeholders.** No preference was supplied for them, so the current values are stand-ins chosen to sit with the site's palette. They are not a guess about Annika. Set `skin`, `hair`, and `hairStyle` to what Annika wants. The outfit follows the brief's suggestion and can be changed the same way.

Colors are hex strings. An option that does not exist, such as a misspelled hair style, is caught by `npm run typecheck`.

Movement is tuned by the constants at the top of `src/world/Avatar.tsx`: walking speed (`WALK_SPEED`), the shortest and longest walk (`TRIP_MIN_MS`, `TRIP_MAX_MS`), the step (`STEP_LENGTH`, `SWING`, `BOB`), turning (`TURN_MS`, `LOOK_AHEAD_MS`, `SETTLE_DISTANCE`), and the completion cheer (`CHEER_MS`, `HOP`, `ARMS_UP`). To add a new hair or accessory shape, add the option to its type in `avatarConfig.ts` and draw its boxes in the `Hair` or `Accessory` function in `Avatar.tsx`.

## Add a public PDF later

The site offers Read resume and Print resume, and no download button. The original resume PDF contains the phone number and the personal email address, so it is not in this repository and must not be published. Add a download only after Annika approves a public version with no phone number and no personal email.

1. Put the approved file in `public/`, for example `public/Annika-Dasani-Resume.pdf`. Use hyphens and no digits in the name. One test rejects files named like the source resume (`Annika_Dasani...` with underscores), and another checks every number under `content.resume`, where this path is stored.
2. In `src/content/content.ts`, replace `publicPdf: null as PublicPdf | null,` with the line below. `href` is the path under `public/` with a leading slash, and `label` is the button text. Keep the `as PublicPdf | null` ending, because some tests switch the PDF off and need that type.

   ```ts
   publicPdf: { href: '/Annika-Dasani-Resume.pdf', label: 'Download PDF' } as PublicPdf | null,
   ```

3. Run `npm test`. Four expectations state that no PDF is offered, and they now fail. Update each one so it states the new fact.

   | File | Test | Change |
   | --- | --- | --- |
   | `src/content/content.test.ts` | "offers no PDF download: Annika has not approved a public PDF" | Expect `publicPdf` to equal the `href` and `label` you set, and rename the test. |
   | `src/content/resumeHtml.test.ts` | "contains nothing that looks like a phone number or an email address" | Its last line lists the page's links. Put the PDF path before `identity.linkedInUrl`. |
   | `src/content/resumeHtml.test.ts` | "offers a PDF only when a public PDF is set in the content" | Delete its first three `expect` lines, which assert that no PDF is set. |
   | `src/ui/Resume.test.tsx` | "links to LinkedIn and shows no PDF link while no public PDF is set" | Change `toHaveLength(2)` to `3`. Replace the four lines that assume there is no PDF with one that expects an `a[download]` pointing at the file. |

4. Run `npm run check`.

A Download PDF button then appears in the resume sheet's toolbar, and a matching link appears in the no-JavaScript copy of the resume.

Three safety nets keep a mistake from shipping.

- If `publicPdf` names a file that is not in `public/`, the development server, the tests, and the build all stop with a message that names the missing file. The check is in `vite.config.ts`. A broken download button cannot ship.
- `npm test` fails if any PDF or Word file other than the configured one sits in `public/`.
- `npm run verify:dist` fails if a PDF or PNG in the build is not linked from the site, or, when the original working folders sit beside the repository, if it is a byte-for-byte copy of a file in them. It also fails on file types it does not expect at all, such as Word documents or JPEG and WebP images. When a linked PDF does ship, it prints a reminder to confirm that the file is approved. It cannot read the visible text of a PDF, so check the file yourself for the phone number and the personal email address.

Never copy the original resume files or the reference images into `public/`.

## Deploy on Netlify

The production site is [annikadasani.netlify.app](https://annikadasani.netlify.app). Its source repository is [divdasani/next-checkpoint](https://github.com/divdasani/next-checkpoint), and the [Netlify project](https://app.netlify.com/projects/annikadasani) is connected to the `main` branch.

Pushing a commit to `main` automatically starts a Netlify build. A successful build publishes the new version at the same address. Saving a local file alone does not update the public site.

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Base directory | Empty: the repository is the application |
| Build command | `npm run build` |
| Publish directory | `dist` |
| Node.js | 24, from `.nvmrc` |
| Environment variables | None |

`netlify.toml` keeps the build command, publish directory, and response headers in Git. Netlify has a read-only repository deploy key and a GitHub webhook for automatic builds. Local Netlify CLI state is ignored in `.netlify/`.

Before publishing an edit, run `npm run check`, review the changes, commit the intended files, and push to `main`. Follow the build under **Deploys** in the Netlify project. If it fails, inspect that deploy's build log, fix the problem, and push the correction.

## Deploy on Vercel

These instructions are an optional alternative to the configured Netlify hosting.

### Keep the original resume out

This repository holds only the application. The original resume (PDF and Word), which carries the phone number and the personal email address, and the reference images are not part of it. Do not add them. `npm test` and `npm run verify:dist` both fail if a phone number or an email address shows up in the code or in the build.

### Import settings

1. Push the repository to GitHub.
2. In Vercel, add a new project and import that repository.
3. Confirm these settings on the import screen.

   | Setting | Value |
   | --- | --- |
   | Root Directory | Leave empty. The repository is the application. |
   | Framework Preset | Vite |
   | Build Command | `npm run build` |
   | Output Directory | `dist` |
   | Install Command | `npm ci` |
   | Environment Variables | None |

4. Deploy. Then open the deployed address and check `/`, `/?mode=tour`, `/?mode=film`, and `/#resume`.

`vercel.json` already states the framework, the install command, the build command, and the output directory, so these should already be filled in. The file also sets response headers. Files under `/assets/` get `Cache-Control: public, max-age=31536000, immutable`, which is safe because Vite puts a content hash in those file names, so a changed file gets a new name. Every response gets `X-Content-Type-Options: nosniff` and `Referrer-Policy: strict-origin-when-cross-origin`. No rewrites are needed, because the site is one page and its modes live in the query string.

Vercel takes its Node.js version from `engines` in `package.json` (`24.x`), and that value overrides the Node.js Version in the project settings. To build on another version, change `engines` and `.nvmrc`, run `npm install --package-lock-only`, then `npm run check`.

The Vercel CLI is an optional alternative. Run it from the repository folder.

```sh
npx vercel          # first run: log in and link a project, then a preview deployment
npx vercel --prod   # production deployment
```

## Record the video

Film mode plays the same timeline as the Guided tour (`src/state/timeline.ts`) with the optional interface hidden. It does not export video. You record the screen.

1. Build and serve the real site with `npm run build` and `npm run preview`, then open `http://localhost:4173/?mode=film`. You can also press Film mode in the top bar, which resets any progress. A slate titled "Film mode" appears and nothing moves.
2. Size the window to 16:9 or 9:16 (see Frame sizes below), then start your screen recorder.
3. Press Space, or K, or click Start take. Starting from the keyboard lets the pointer stay out of the picture. If you click, move the pointer off the page afterwards.
4. The take runs about 55 seconds and then holds on "Next checkpoint: Roblox." until you do something. Stop the recorder when you like.

The length comes from `TOUR_DURATION_MS` in `src/state/timeline.ts`, which is 55,310 milliseconds. The slate rounds it to "about 55 seconds". The clock waits for the 3D world to finish loading (at most 4 seconds), so a take never starts on an empty stage. There is no audio, so add music or a voice in your editor.

| Time | On screen |
| --- | --- |
| 0:00 | The unfinished world, the title, and Annika's name. |
| 0:04 | The avatar walks to the Hub, and the eight companies connect. |
| 0:08 | Card one, held for 11 seconds. |
| 0:19 | The Signal Station: three sources switch on, then the feed. |
| 0:23 | Card two, held for 11 seconds. |
| 0:34 | The Launch Arch: three checks turn ready, then Launch. |
| 0:38 | Card three, held for 11 seconds. |
| 0:49 | "Next checkpoint: Roblox." The sequence is marked finished at 0:55, and this screen stays up. |

Each card is held for 11 seconds, which is enough to read its label, its statement, and its two supporting labels at about 200 words a minute. The longest card has 34 such words.

### Keys and controls

The shortcuts are defined in `src/ui/useShortcuts.ts`.

| Key | Effect |
| --- | --- |
| Space or K | Starts the take from the slate. Pauses and resumes a running take. |
| R | Restarts from the top at once. It does not return to the slate. |
| Esc | Leaves Film mode for normal play and keeps the progress made so far. |

In the Guided tour, Space and Esc work the same way. The letter keys K and R work there only while the tour controls have keyboard focus, so a stray letter cannot restart a visitor's tour. Keys pressed with Ctrl, Cmd, Alt, or Shift are ignored, and so are all shortcuts while the resume is open. Clicking or tapping the world during a take also pauses and resumes it (`src/ui/FilmTapLayer.tsx`). Opening the resume pauses the take. Closing it leaves the take paused, and Space resumes it.

For another take, press R and trim the start later, or reload the page to get the slate back. If the browser tab is hidden during a take, the take pauses and waits for Space. A take or tour opened in a background tab also waits, paused, until you press Space.

### What a take shows and hides

A take shows the title, Annika's name and role line, a plain Read resume link, the three destination labels, the panel with objectives, progress, and the Real experience cards, the three mission chips as progress, and the independent-project credit.

These are hidden or left out.

- The tour controls: the chapter indicator, Pause, Restart, and Play it yourself. They come back while the take is paused, when one of them has keyboard focus, and when you click the world after the take has finished (`src/ui/TourBar.tsx`, `src/styles/hud.css`).
- The Guided tour and Film mode buttons in the top bar.
- Help in the panel: the how-to line, the illustration note, the small precision note under each card's statement, Back to map, the Continue button on cards, and the row that reopens cards at the end. Elements marked `film-hide` are switched off by one rule in `src/styles/layout.css`, and the panels leave out their buttons while the timeline is in charge.

### Frame sizes

- **16:9.** Use a 1920 by 1080 viewport, or 1280 by 720. During a take the type and the panel follow the height of the frame, so both sizes show the same composition, with text large enough for a video that will be watched small.
- **9:16.** Use a 1080 by 1920 viewport. The panel becomes a sheet under the island. Any tall window narrower than 2:3 gets the same composition scaled to its height (`src/styles/layout.css`), so a 540 by 960 or 450 by 800 window frames the take the same way.

In Film mode the camera holds the whole island in view for the entire take, at every window size.

The browser's device toolbar gives an exact viewport. In Chrome or Edge, open the developer tools, switch on the device toolbar, choose Responsive, and type the width and height. The browser scales the viewport to fit your screen, so the shape is right even when the recording has fewer pixels. On a display with 2x pixel density, 50% zoom in the device toolbar shows a 1080 by 1920 or 1920 by 1080 viewport at exactly that many screen pixels.

### Recording

- **macOS.** Press Shift-Command-5, choose Record Selected Portion, drag the frame over the page, and press Record. Stop from the menu bar. The file is saved to the Desktop unless you changed that under Options.
- **Windows.** Click the browser window, then press Win+Alt+R to start and stop a recording of that window with the Game Bar. Put the browser in full screen first to leave out its toolbars. To record an exact region, open Snipping Tool, switch to Record, and draw the region.

Turn off reduced motion while recording. If the operating system asks for reduced motion (Reduce motion in the macOS Accessibility settings, or Animation effects switched off in Windows), the site honors it: the avatar and the objects jump to their end positions and the camera does not ease. The timing stays the same, but the movement is gone.

## How it works

One rule runs the whole site. Inputs dispatch actions, one reducer turns actions into state, and everything on screen is drawn from that state.

Four words carry most of it. An action is a small object that names what happened, such as `{ type: 'LAUNCH' }`. The state is one object that describes the whole game. The reducer is a function that takes the current state and an action and returns the next state. A tween is a short, eased change from one value to another.

### One click, end to end

Follow the click that connects Company C in mission one.

1. **Input.** There are two ways to make this click, and both send the same action. In the 3D world, `src/world/NetworkZone.tsx` puts an invisible click box (`HitTarget` from `src/world/kit.tsx`) around each company block. In the HTML panel, `src/ui/panels/MissionPanel.tsx` draws a Company C button. Both call `dispatch({ type: 'CONNECT_COMPANY', index: 2 })`.
2. **State.** `dispatch` belongs to the single `useReducer` in `src/state/GameContext.tsx`. Its reducer, `gameReducer` in `src/state/reducer.ts`, is the only place the game state changes. For this action it checks that the Hub mission is selected, that the index is 0 to 7, and that the company is not already connected. If a check fails it returns the same state object, which is why a repeat click is harmless. Otherwise it returns a new state with `network.connected[2]` set to `true`. When the eighth company connects, it also sets `card` to `'network'` and adds one to `cheers`.
3. **Questions about state.** `src/state/selectors.ts` answers questions such as "is this mission complete?" (`isMissionComplete`), "how many are connected?" (`connectedCount`), and "which one panel is on screen?" (`panelKind`). The reducer and every view use these same functions, so each question has one answer.
4. **HTML.** `src/ui/StagePanel.tsx` shows the panel that `panelKind(state)` names. The mission panel marks Company C as connected and updates its count. The mission chips, the destination labels, and a hidden status line for screen readers read the same state. After the eighth connection `panelKind` returns `'card'`, and `src/ui/panels/EvidenceCard.tsx` shows the Real experience text from `content.ts`.
5. **3D world.** `NetworkZone.tsx` passes `state.network.connected[2]` to that company's block. A short tween (`useTween` in `kit.tsx`) eases the change over about a third of a second: the floor connector turns blue and thickens, the block rises, and a blue cap pops out of its roof. When all eight are connected, the hub's beacon lights, the checkpoint flag rises (`src/world/Checkpoints.tsx`), and the avatar does one small cheer because `src/world/Avatar.tsx` watches `state.cheers`.

Choosing a destination works the same way. Clicking a zone (`src/world/ZoneShell.tsx`), a label above a building, a mission chip, or a mission button dispatches `SELECT_MISSION`. The reducer sets `activeMission` and `avatarStop`, and the avatar walks the ring road to that stop.

### The tour and Film mode are the same game

`src/state/timeline.ts` is a list of rows. Each row is a delay and one of the same actions a visitor can trigger. The last row is only a hold. `src/state/useTourRunner.ts` keeps one timer for the next row and dispatches `TOUR_STEP` when it is due. The reducer looks up that row's action and runs it through `applyMissionAction`, the same rules function it uses for clicks. While the sequence is waiting, running, or paused, visitor clicks on the world are ignored (`isTourBusy`), so the two cannot fight.

Film mode is that same sequence with `mode` set to `'film'`. `src/App.tsx` writes the mode onto the page as `data-mode="film"`, and CSS hides the optional parts. This is why play, the tour, and Film mode cannot disagree about rules or content. `src/state/timeline.test.ts` checks it by replaying the timeline next to a game played by hand.

### The canvas draws only when something changes

The 3D canvas in `src/world/WorldCanvas.tsx` runs on demand (`frameloop="demand"`). It draws a frame only when something asks for one, and otherwise the page sits idle. A state change asks for a frame. Movement comes from short tweens: `useTween` and `usePulse` in `kit.tsx`, the walk in `Avatar.tsx`, and the one camera move in `CameraRig.tsx`. A tween keeps its in-between values in a plain variable, writes them straight onto the three.js objects (position, scale, color), and asks for the next frame until it finishes. It never puts those values into React state, so React does not re-render on every frame.

The scene is built from one shared box shape and one shared cylinder shape, placed from fixed data, most of it in `src/world/layout.ts`. The pixel ratio is capped at 2, the tour pauses when the tab is hidden, and visitors who ask for reduced motion get instant changes.

### File map

```text
./
  index.html               the page; the build inserts the no-JavaScript resume
  vite.config.ts           build and test configuration, and the public-PDF check
  vercel.json              Vercel settings and headers
  scripts/verify-dist.mjs  checks the built dist/ folder
  public/favicon.svg       the only static file
  src/
    main.tsx, App.tsx      entry point; the page's three layers (world, labels, interface)
    content/               content.ts (every career fact), resumeHtml.ts (plain resume)
    state/                 types.ts, reducer.ts, selectors.ts, timeline.ts,
                           useTourRunner.ts, url.ts, GameContext.tsx
    world/                 the 3D island: WorldCanvas.tsx, Scene.tsx, layout.ts (positions
                           and colors), kit.tsx (blocks, tweens, click targets), the three
                           Zone files, Avatar.tsx, avatarConfig.ts, CameraRig.tsx
    ui/                    the HTML interface: TopBar.tsx, StagePanel.tsx, panels/,
                           MissionChips.tsx, TourBar.tsx, Resume.tsx, ResumeDialog.tsx
    styles/                tokens.css (colors, sizes, the font), base.css, layout.css, hud.css,
                           panels.css, resume.css, print.css
    assets/fonts/          the Nunito font file and its license
```

Tests sit next to the files they cover and end in `.test.ts` or `.test.tsx`.

To watch the rule at work, run `npm run dev` and open the browser console. `__NEXT_CHECKPOINT__.getState()` prints the state, and `__NEXT_CHECKPOINT__.dispatch({ type: 'SELECT_MISSION', mission: 'signal' })` sends an action exactly as a click would. This handle exists only in development.

### Modify one feature yourself

**Example 1: hold the cards longer in the tour and Film mode.**

1. Open `src/state/timeline.ts` and change `CARD_HOLD_MS` from `11000` to `12000`. All three cards use it, so the sequence grows by 3 seconds to 58.3 seconds.
2. The Film slate works out its own number and now says "about 60 seconds". The intro's line is plain text, so open `src/content/content.ts` and change `tourNote` to `'Hands-free, about 60 seconds.'`.
3. Run `npx vitest run src/state/timeline.test.ts`, then `npm run check`.

The timeline tests are the guard rails. The sequence must last 40 to 60 seconds, each card must stay up long enough to read its statement and labels at 200 words a minute, and the number in `tourNote` must be within 5 seconds of the real length. Try `13000` to watch the first rule fail, or `8000` to watch the second.

**Example 2, a little harder: give the Launch zone a different color.**

Colors live in two places, because the 3D world and the HTML are drawn by different systems. `src/world/layout.ts` holds them for three.js, and `src/styles/tokens.css` holds them for CSS. Both must change.

1. In `src/world/layout.ts`, add a color to `PALETTE`, for example `violet: '#9b7bff',`. In `MISSION_COLOR`, change `launch: PALETTE.coral` to `launch: PALETTE.violet`. Change the zone's two floor tints, `plazaCoral` and `plazaCoralTop`, to light versions of the new color, for example `'#e3dbff'` and `'#efeaff'`.
2. In `src/styles/tokens.css`, add `--violet: #9b7bff;` and `--violet-soft: #e3dbff;` next to the other accents. In the `[data-mission='launch']` rule, use `var(--violet)` and `var(--violet-soft)`.
3. Run `npm run typecheck`, then look at the result with `npm run dev`.

Here is what else to know.

- The top of the arch, the launch button, the zone outline, and the checkpoint pad and flag all read `MISSION_COLOR.launch`. The chip, the destination label, the panel band, and the card accents read the CSS variable. They follow without further edits.
- Coral stays wherever it is not the mission color: the avatar's accessory, two flowers, the Customer inquiries bar, the flag in the top bar, and the favicon. That is why the example adds a color instead of editing `coral`.
- The soft tint sits behind dark text, so keep it light.
- The names `plazaCoral` and `plazaCoralTop`, and the constant `CORAL` in `src/world/LaunchZone.tsx`, keep their old names. Renaming them is optional, and the type check lists every place to update.
- No automated test looks at colors. Check this one by eye: select the Launch Arch, finish the mission, and look at the zone, the chip, the label, and the card.

## Checks

| Check | Command | What it covers |
| --- | --- | --- |
| Types | `npm run typecheck` | Strict TypeScript over the app, its tests, and the build config. It catches a wrong mission id, a missing content field, or an avatar option that does not exist. |
| Tests | `npm test` | The Vitest files under `src/`. The whole page driven through its real buttons and keys without WebGL (`src/App.test.tsx`): the resume before playing, a full play-through, Replay, a resize in the middle of a mission, the tour and Film mode, mode changes, shortcuts, cleanup of timers and listeners, and the no-WebGL notice. The reducer's game rules: prerequisites, completion, repeated clicks, mode changes, pause, restart, and replay. The selectors that choose the panel. The timeline's order and timing, and its equal result in the tour, in Film mode, and by hand. The tour clock: pause, resume, restart, a hidden tab, and timer cleanup. The URL modes. The content rules listed under "Edit the content". Both resume renderers and the resume sheet. The camera framing at desktop, 16:9, phone, and 9:16 sizes. The avatar's routes. |
| Build | `npm run build` | The type check again, then the production build into `dist/`, including the no-JavaScript resume and the public-PDF check. |
| Built files | `npm run verify:dist` | It reads `dist/` as it would be deployed. Every script, stylesheet, and icon that `index.html` references exists. Only expected file types ship. Any PDF or PNG is linked from the site and is not a copy of the source material. No text file contains anything shaped like a phone number, an email address, or a `tel:` or `mailto:` link. The `<noscript>` resume is present with its LinkedIn link. It prints each file's size, raw and gzipped. |

`npm run check` runs all four in that order and stops at the first failure. The tests run in a simulated browser without WebGL, so none of these checks looks at the rendered 3D scene or at a real browser.

### What was verified before handoff

These results are from 19 November 2026, on the code as delivered. Everything ran on one Mac (Apple silicon) with Node 24.5.0, npm 11.5.1, and headless Google Chrome with WebGL, driven by Playwright. "Production build" means `dist/` served by `npm run preview`.

**Automated checks**

- `npm run check` passed: no type errors, 565 tests in 11 files, a clean build, and a clean `verify:dist`.
- A fresh copy of the project without `node_modules` passed `npm ci` and `npm run check`.
- Built size: 1,280 kB in total, 380 kB gzipped. The page and its styles are 47 kB (11 kB gzipped), the interface script 273 kB (83 kB), the 3D file 920 kB (246 kB), and the font 39 kB.

**Privacy**

- All 89 files of the project, including `dist/` and excluding `node_modules`, were searched for the phone number and the email address from the original resume. Neither appears. No file from the original resume folder or the reference images is in the project.

**In the browser, on the production build**

- Real mouse clicks on the 3D objects completed all three missions at 1440 by 900, and real taps completed them at 390 by 844 with touch emulation. Pressing the feed switch and the launch button early showed the explanation and the next step. Repeat clicks changed nothing. The console stayed clean.
- A grid of clicks on the three data sources (run on the development build) hit the intended source 103 times out of 105, and all 57 repeat clicks on a source that was already on were harmless.
- A double tap on the last button of a panel was harmless at 375 by 553, 360 by 640, 390 by 664, and 390 by 844.
- Keyboard: Space and Escape in the Guided tour, and Space, K, R, and Escape in Film mode, did what the tables above say, including after the resume was opened and closed in the middle of a sequence.
- A Film take, timed from the moment the world was ready: the first card appeared at 7.9 seconds, the finale at 49.0 seconds, and the sequence finished at 55.5 seconds. This was measured once at 1920 by 1080 and once at 1080 by 1920, and frames from both takes were looked at.
- With reduced motion requested, the Guided tour ran to the finale.
- With the 3D file blocked from downloading, the page stayed up, showed its notice, and a mission and the resume still opened. With WebGL switched off, a mission was completed from the panel buttons.
- The resume opened before playing, and printing it to PDF gave one Letter page with LinkedIn as the only contact.
- While nothing was moving, the canvas made 0 draw calls in 5 seconds, both on the intro and inside a mission. At a device pixel ratio of 3 the canvas stayed at twice the window size, so the cap of 2 holds.
- Screenshots were looked at for these window sizes: 1920 by 1080, 1440 by 900, 1280 by 720, 1024 by 768, 768 by 1024, 720 by 450, 640 by 400, 844 by 390, 390 by 844, 390 by 664, 375 by 553, 360 by 640, 320 by 568, and 1080 by 1920. Not every state was looked at in every size.

**Measured earlier, before the last round of fixes**

An independent review measured these on the production build. They were not repeated after the final changes.

- One frame draws about 315 WebGL calls and 4,300 triangles, including the shadow pass. The scene has 221 meshes that share 2 shapes, 60 materials, and 2 lights.
- Memory: 6.6 MB of script memory after loading, and 8.6 to 8.8 MB after four full play-throughs with Replay. No growing number of page elements, listeners, or WebGL objects was found.
- Loading on the local preview with a 390 by 844 phone profile: the first text appeared after about 0.1 seconds and the first frame of the island after about 0.5 seconds. With Chrome's Slow 4G and a four times slower processor emulated, about 2 and 4 seconds. Real network delay is not included.

**Not checked**

- Safari, Firefox, and any browser other than Chrome on a Mac. Windows and Android.
- A real phone or tablet. Touch was emulated in desktop Chrome.
- A real screen reader. Names, roles, and announcements were checked in the page structure only.
- A Vercel deployment. The optional Vercel settings and response headers in `vercel.json` are untested.
- Node 22, a real printer, and a real screen recording. Film mode was checked from timed screenshots, not from a recorded video.
- Frame rate on slow devices.

## Known limits and notes

- **three.js stays on 0.182.** `package.json` asks for `^0.182.0`, which for a 0.x version allows patch releases only, and the lockfile records 0.182.0. From 0.183 on, three.js marks `THREE.Clock` as deprecated and prints a console warning whenever one is created. React Three Fiber 9.8 still creates one. Staying on 0.182 keeps the console clean. Revisit this when React Three Fiber stops using `Clock`.
- **The 3D code is the bulk of the download.** three.js and the world load as a separate file after the page is already readable (the `lazy` import in `src/App.tsx`). That file is roughly three quarters of the shipped bytes, and `npm run verify:dist` prints the current sizes.
- **Without WebGL**, a short notice replaces the island and everything else works: the missions are playable from the panel buttons, and the tour, Film mode, and the resume behave the same. **Without JavaScript**, the page shows the full resume as plain HTML.
- **No analytics, no cookies or browser storage, no backend, no environment variables, and no audio.** The built page requests only its own files. The one outside address is the LinkedIn link.
- **Progress is not saved.** Reloading the page starts again from the mode in the URL.
- **The camera is fixed.** There is no free roaming. On phone-sized windows the camera eases toward the active zone and back, and never in Film mode. On short phones it also eases the island smaller while a Real experience card or the finale takes more of the screen.
- **React stays on 19.3.** React Three Fiber 9.8 accepts React 19.0 to 19.3, so `package.json` asks for `~19.3.1`. Raise it together with React Three Fiber.
- **Small 3D targets on phones.** After the camera moves in, the objects of a mission are still smaller than a comfortable touch target, most of all the three posts of Launch Day. The buttons in the panel do the same things and are full size.
- **Very large text and very high zoom.** The layout is a fixed screen, like a game. It was checked at a 320 pixel wide phone and at 200% browser zoom on a laptop (a 720 by 450 window), where nothing spills off the page and the panel scrolls. At 300% to 400% zoom on a small window, or with the browser's text size set far above normal, parts of the interface overlap.
- **A phone held sideways** gets the side-panel layout in very little height. Everything is reachable, but the panel has to be scrolled.

## Credits

Independent project. Not affiliated with or endorsed by Roblox. Roblox is named only as the company Annika is applying to.

Built with React, TypeScript, Vite, three.js, and React Three Fiber.

The typeface is Nunito by Vernon Adams and the Nunito Project Authors, used under the SIL Open Font License 1.1. The font file and the license text are in `src/assets/fonts/`.

The brief named these as visual references. They were used as inspiration only. No code, model, image, or texture from them is in the app, and every shape is drawn in code from boxes and cylinders. The reference images are not in this repository.

- CSS 3D Lab, floating island and isometric city (https://css3dlab.edgarasneverdauskas.com/): a small stepped island, simple box buildings, and a limited palette.
- Bruno Simon's portfolio (https://bruno-simon.com/): a portfolio as one coherent world with recognizable destinations.
- Fancade by Martin Magni (https://www.fancade.com/press/): block terrain, strong top and side colors, and clear destinations.
- Sokocat Islands by Rising Moon Games (https://store.steampowered.com/app/1592880/): a compact overview, sparse props, and open space around the island.
- Mekorama by Martin Magni (https://www.mekorama.com/press/): the elevated camera and the self-contained diorama.
- Blocky Characters by Kenney (https://kenney.nl/assets/blocky-characters): simple head, torso, and limb proportions.
