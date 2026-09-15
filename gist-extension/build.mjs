import { build, context } from 'esbuild'
import { cpSync, mkdirSync } from 'node:fs'

const watch = process.argv.includes('--watch')

mkdirSync('dist', { recursive: true })
cpSync('manifest.json', 'dist/manifest.json')
cpSync('src/content.css', 'dist/content.css')

const options = {
  entryPoints: ['src/background.ts', 'src/content.ts'],
  outdir: 'dist',
  bundle: true,
  format: 'iife',
  target: 'chrome110',
  sourcemap: true
}

if (watch) {
  const ctx = await context(options)
  await ctx.watch()
  console.log('watching for changes...')
} else {
  await build(options)
  console.log('build complete -> dist/')
}
