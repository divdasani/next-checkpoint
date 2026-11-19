/// <reference types="vitest/config" />
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, type HtmlTagDescriptor, type Plugin } from 'vite'
import { content } from './src/content/content.ts'
import { renderStaticResume } from './src/content/resumeHtml.ts'

/**
 * Two small build-time guarantees:
 *  - index.html carries a plain HTML copy of the resume inside <noscript>, generated from
 *    the same content file as the app, so the resume is readable even without JavaScript.
 *  - If a public PDF is configured in the content file, the file must exist in public/,
 *    so a broken download button can never ship.
 */
function staticResume(): Plugin {
  return {
    name: 'next-checkpoint:static-resume',
    buildStart() {
      const pdf = content.resume.publicPdf
      if (!pdf) return
      const file = fileURLToPath(new URL(`./public${pdf.href}`, import.meta.url))
      if (!existsSync(file)) {
        this.error(`content.resume.publicPdf points to "${pdf.href}", but public${pdf.href} does not exist.`)
      }
    },
    transformIndexHtml(html) {
      return html.replace('<!--static-resume-->', () => renderStaticResume(content))
    },
  }
}

/**
 * Tells the browser, in the page itself, about two files it would otherwise only discover
 * after running the main script: the 3D world's code and the font. Both then download
 * alongside the main script, so the island and the final typeface appear sooner.
 */
function earlyDownloads(): Plugin {
  return {
    name: 'next-checkpoint:early-downloads',
    transformIndexHtml: {
      order: 'post',
      handler(_html, context) {
        const tags: HtmlTagDescriptor[] = []
        for (const file of Object.values(context.bundle ?? {})) {
          if (file.type === 'chunk' && file.name === 'WorldCanvas') {
            tags.push({ tag: 'link', attrs: { rel: 'modulepreload', crossorigin: true, href: `/${file.fileName}` }, injectTo: 'head' })
          }
          if (file.type === 'asset' && file.fileName.endsWith('.woff2')) {
            tags.push({
              tag: 'link',
              attrs: { rel: 'preload', as: 'font', type: 'font/woff2', crossorigin: true, href: `/${file.fileName}` },
              injectTo: 'head',
            })
          }
        }
        return tags
      },
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), staticResume(), earlyDownloads()],
  build: {
    // three.js is loaded as its own lazy chunk, which is larger than Vite's default warning size.
    chunkSizeWarningLimit: 1200,
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
    restoreMocks: true,
  },
})
