# Working on Next Checkpoint

This is Annika Dasani's interactive resume: a small 3D island laid out as a trail of four checkpoints (Discover, Build, Ship, Scale), each with a short mission and a passport stamp, plus a guided tour, a recording mode, and a printable resume. The site also demonstrates Roblox Trails, the product idea from her Roblox application. The person you are working with is most likely Annika. She is not a software engineer. Do the technical work yourself, explain what you did in plain language, and show every result in the browser.

## Start

- The project needs Node.js 24. Check with `node --version`.
- Run `npm ci` once, then `npm run dev`, and open http://localhost:5173 for her. Keep the server running while you work.
- Read `README.md` before the first change. It explains the structure, the content rules, and how one click travels through the code.

## Where things are

| To change | Edit |
| --- | --- |
| Any wording or career fact | `src/content/content.ts` |
| The avatar's look | `src/world/avatarConfig.ts` |
| The passport row, the passport view, and the stamp art | `src/ui/Passport.tsx`, `src/ui/Stamp.tsx`, `src/styles/passport.css` |
| Positions and colors in the 3D world | `src/world/layout.ts` |
| Colors and sizes of the interface | `src/styles/tokens.css` |
| Timing of the Guided tour and Film mode | `src/state/timeline.ts` |

The avatar's skin and hair are Annika's choice: tan skin and long black hair. The outfit still follows the brief's suggestion.

## Rules

- **Facts stay true.** The four "Real experience" statements, the results and skills on the checkpoint cards, the numbers, and the resume are confirmed facts about Annika. `src/content/content.test.ts` fails when they drift. If she corrects a fact, change the content and the matching expectation in that test together. Never strengthen a claim on your own. $700M is the billing that was centralized. $360M is additional revenue that was absorbed, not revenue she generated. The gaming project was a concept and a pitch, not a shipped app.
- **No phone number and no personal email address anywhere.** LinkedIn is the only contact. Do not add a PDF download unless she supplies a PDF without those details. The README section "Add a public PDF later" has the steps.
- **No overclaiming.** No sentence may say or imply that she works for Roblox, has an offer, or is endorsed by Roblox, or that she wrote this site's code herself. One exception exists, and it is hers: the "Hired!" sticker in the next rule.
- **The Roblox space is never stamped, and it carries one sticker.** The finale and the passport show one more stamp space, for Roblox. It is not earned, and nothing may turn it into a stamp or say that it was earned. Once the trail is complete it carries a "Hired!" sticker. Annika asked for it on 19 November 2026 as a wish, after confirming that she has not been hired, and the line "Applying for Roblox's Associate Product Manager role." stays beside it. Do not add any other wording about being hired, and do not remove the "applying" line or the "applicant" role line. If she is hired, ask her how she wants the site to say so. "Roblox Trails" is named only as the product idea from her application, never as a Roblox product or feature.
- **No invented popularity.** The trail shows no followers, likes, ratings, or reviews.
- **Lines she removed stay out.** Annika removed the "Illustration only" lines under the missions and the lines under the Discover and Scale statements, and wrote the line under the Build statement herself. Do not add them back or reword them unless she asks.
- **Card skills use the resume's words.** Two skills appear on the cards only, Product Ideation and Operational Strategy. Annika confirmed them for the cards, and they are not on the resume's skill list. Ask her before adding another.
- **Check before showing.** After every change run `npm run check` and fix whatever fails. Then show her the change in the browser, at desktop size and in a phone-sized window.
- **Publishing is her decision.** Pushing to the `main` branch on GitHub updates the public website within a minute or two. Never push unless she asks for it in the current conversation, and first tell her in one or two sentences what will change on the live site.
