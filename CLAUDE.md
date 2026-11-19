# Working on Next Checkpoint

This is Annika Dasani's interactive resume: a small 3D island with three missions, a guided tour, a recording mode, and a printable resume. The person you are working with is most likely Annika. She is not a software engineer. Do the technical work yourself, explain what you did in plain language, and show every result in the browser.

## Start

- The project needs Node.js 24. Check with `node --version`.
- Run `npm ci` once, then `npm run dev`, and open http://localhost:5173 for her. Keep the server running while you work.
- Read `README.md` before the first change. It explains the structure, the content rules, and how one click travels through the code.

## Where things are

| To change | Edit |
| --- | --- |
| Any wording or career fact | `src/content/content.ts` |
| The avatar's look | `src/world/avatarConfig.ts` |
| Positions and colors in the 3D world | `src/world/layout.ts` |
| Colors and sizes of the interface | `src/styles/tokens.css` |
| Timing of the Guided tour and Film mode | `src/state/timeline.ts` |

The avatar's skin and hair colors are placeholders. Nobody has asked Annika what she wants yet, so ask her early.

## Rules

- **Facts stay true.** The three "Real experience" statements, the numbers, and the resume are confirmed facts about Annika. `src/content/content.test.ts` fails when they drift. If she corrects a fact, change the content and the matching expectation in that test together. Never strengthen a claim on your own. $700M is the billing that was centralized. $360M is additional revenue that was absorbed, not revenue she generated. The gaming project was a concept and a pitch, not a shipped app.
- **No phone number and no personal email address anywhere.** LinkedIn is the only contact. Do not add a PDF download unless she supplies a PDF without those details. The README section "Add a public PDF later" has the steps.
- **No overclaiming.** Nothing may say or imply that she works for Roblox, has an offer, or is endorsed by Roblox, or that she wrote this site's code herself.
- **Check before showing.** After every change run `npm run check` and fix whatever fails. Then show her the change in the browser, at desktop size and in a phone-sized window.
- **Publishing is her decision.** Pushing to the `main` branch on GitHub updates the public website within a minute or two. Never push unless she asks for it in the current conversation, and first tell her in one or two sentences what will change on the live site.
