// Checks the production build in dist/ before it is deployed.
// Run with: npm run build && npm run verify:dist
//
// It confirms that:
//  1. index.html exists and every script, stylesheet, and icon it references is in dist/.
//  2. Only expected file types ship. Source material (the resume DOCX and PDF, reference
//     images) must never reach the build.
//  3. No phone number, email address, or tel: / mailto: link appears in any shipped text
//     file, and no shipped PDF or image is a copy of the working material kept beside this folder.
//     This is a safety net, not proof: it cannot recognise every way a number can be
//     written, and it cannot read the visible text of a PDF. The content tests
//     (src/content/content.test.ts) scan the source files as well.
//  4. The no-JavaScript resume copy is present in index.html.
// It then prints the size of every shipped file, raw and gzipped.

import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, dirname, extname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const problems = []
const fail = (message) => problems.push(message)

if (!existsSync(join(dist, 'index.html'))) {
  console.error('dist/index.html not found. Run "npm run build" first.')
  process.exit(1)
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    return entry.isDirectory() ? walk(path) : [path]
  })
}

const files = walk(dist)
const rel = (path) => relative(dist, path).split('\\').join('/')
const html = readFileSync(join(dist, 'index.html'), 'utf8')

// 1. Every local asset referenced by index.html exists.
const references = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
  .map((match) => match[1])
  .filter((url) => url.startsWith('/') && !url.startsWith('//'))
for (const url of references) {
  const path = join(dist, url.split(/[?#]/)[0])
  if (!existsSync(path)) fail(`index.html references ${url}, which is not in dist/`)
}
if (!references.some((url) => url.endsWith('.js'))) fail('index.html does not reference a script bundle')
if (!references.some((url) => url.endsWith('.css'))) fail('index.html does not reference a stylesheet')

// 2. Only expected file types ship.
const TEXT_TYPES = new Set(['.html', '.js', '.css', '.svg', '.json', '.txt', '.webmanifest', '.map'])
const OTHER_ALLOWED = new Set(['.ico', '.png', '.pdf', '.woff2'])
const shippedText = files.filter((file) => TEXT_TYPES.has(extname(file)))
const allText = shippedText.map((file) => readFileSync(file, 'utf8')).join('\n')
const shippedBinaries = []

for (const file of files) {
  const type = extname(file).toLowerCase()
  const name = rel(file)
  if (!TEXT_TYPES.has(type) && !OTHER_ALLOWED.has(type)) fail(`Unexpected file type in dist/: ${name}`)
  if (type === '.pdf' || type === '.png') {
    // A PDF or image may ship only when the site actually links to it on purpose.
    const base = name.split('/').pop()
    if (!allText.includes(base)) fail(`${name} is in dist/ but nothing links to it. Remove it from public/.`)
    else {
      shippedBinaries.push(file)
      console.log(`note: ${name} ships and is linked from the site. Make sure it is approved for the public.`)
    }
  }
}

// 3. No phone numbers or email addresses in shipped text.
// Separators between the groups of a phone number: space, dot, hyphen, or a typographic dash.
const SEP = '[\\s.\\u2010-\\u2015-]'
const PHONE = new RegExp(
  `(?<![\\w.+*/-])(?:\\+?1${SEP}?)?(?:\\(\\d{3}\\)\\s?|\\d{3}${SEP})\\d{3}${SEP}\\d{4}(?![\\w.+*/-])`,
  'g',
)
// Ten or eleven bare digits. Only checked in index.html: script bundles are full of long numbers.
const BARE_DIGITS = /(?<![\w.#-])\d{10,11}(?![\w.-])/g
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}/g
// A link that dials or opens the mail program, whatever number or address follows it.
const CONTACT_LINK = /(?<![a-z])(?:tel:\s*[+(\d]|mailto:\s*[\w%])/gi
for (const file of shippedText) {
  const text = readFileSync(file, 'utf8')
  for (const match of text.match(PHONE) ?? []) fail(`Phone-number-like text "${match}" in ${rel(file)}`)
  for (const match of text.match(EMAIL) ?? []) fail(`Email-address-like text "${match}" in ${rel(file)}`)
  if (CONTACT_LINK.test(text)) fail(`A tel: or mailto: link in ${rel(file)}`)
  CONTACT_LINK.lastIndex = 0
  if (rel(file) === 'index.html') {
    for (const match of text.match(BARE_DIGITS) ?? []) fail(`A ${match.length}-digit number in index.html: is it a phone number?`)
  }
}

// A shipped PDF or image must not be a copy of the working material (the original resume and
// the reference images). Those folders sit beside this one only on the computer the site was
// built on. Where they are absent, this check has nothing to compare.
const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex')
const sourceFiles = ['source-resume', 'reference-images']
  .map((folder) => join(dist, '..', '..', folder))
  .filter((folder) => existsSync(folder))
  .flatMap((folder) => walk(folder))
const sourceByHash = new Map(sourceFiles.map((path) => [sha256(path), path]))
for (const file of shippedBinaries) {
  const source = sourceByHash.get(sha256(file))
  if (source) fail(`${rel(file)} is a byte-for-byte copy of ${basename(source)} from the source material. It must not ship.`)
  if (extname(file).toLowerCase() === '.pdf') {
    // Only links and document properties are plain bytes in a PDF. Its visible text is compressed,
    // so passing this does not show that the PDF is free of contact details.
    const bytes = readFileSync(file, 'latin1')
    if (bytes.search(EMAIL) !== -1 || bytes.search(CONTACT_LINK) !== -1) {
      fail(`${rel(file)} holds an email address or a tel: or mailto: link. Use a public version without them.`)
    }
  }
}

// 4. The static resume is in the page for visitors without JavaScript.
const noscript = html.match(/<noscript>([\s\S]*?)<\/noscript>/)?.[1] ?? ''
if (!noscript.includes('Annika Dasani')) fail('The <noscript> resume copy is missing from index.html')
if (!noscript.includes('linkedin.com/in/annikadasani')) fail('The <noscript> resume has no LinkedIn link')
if (html.includes('<!--static-resume-->')) fail('The static resume placeholder was not replaced at build time')

// Sizes, measured from the files on disk. 1 kB is 1000 bytes here, as in Vite's own report.
const kb = (bytes) => `${(bytes / 1000).toFixed(1)} kB`
console.log('\nShipped files (raw / gzip):')
let totalRaw = 0
let totalGzip = 0
for (const file of files.sort()) {
  const raw = statSync(file).size
  const gzip = gzipSync(readFileSync(file)).length
  totalRaw += raw
  totalGzip += gzip
  console.log(`  ${rel(file).padEnd(44)} ${kb(raw).padStart(10)} / ${kb(gzip).padStart(9)}`)
}
console.log(`  ${'total'.padEnd(44)} ${kb(totalRaw).padStart(10)} / ${kb(totalGzip).padStart(9)}`)

if (problems.length > 0) {
  console.error(`\n${problems.length} problem(s) found:`)
  for (const problem of problems) console.error(`  - ${problem}`)
  process.exit(1)
}
const binaryNote =
  shippedBinaries.length === 0
    ? 'no PDF or image ships'
    : `${shippedBinaries.length} PDF or image file(s) ship and their visible content was NOT inspected: ${shippedBinaries.map(rel).join(', ')}`
console.log(
  `\ndist/ looks good: assets resolve, no phone or email in ${shippedText.length} text files, ${binaryNote}, static resume present.`,
)
