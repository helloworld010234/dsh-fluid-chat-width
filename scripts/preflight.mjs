#!/usr/bin/env node
/**
 * Preflight for dsh-fluid-chat-width: the checks the market catalogue runs on
 * every submission, run locally instead so a rejected PR is not the first time
 * anyone hears about it.
 *
 * Six checks, no dependencies:
 *   1. package.json parses, and is not private (npm refuses to publish those).
 *   2. `dsh.bundle.patch` is declared and the file it names exists.
 *      Declaring only `dsh.client` is the single most common rejection reason —
 *      that alone is not installable via `dsh plugin add`.
 *   3. cordis.patch.yml parses and its insert row names this package.
 *   4. `dsh.client` is well formed when present.
 *   5. client.js honours the ModuleLoader contract: it calls load(), the id
 *      matches the package name, and the factory returns an object whose
 *      `apply` is a function. An empty exports object fails plugin validation
 *      and kills web boot.
 *   6. The files `files[]` promises actually exist, so `npm pack` does not
 *      publish an empty shell.
 */
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(fileURLToPath(import.meta.url)).replace(/\/scripts$/, '')
const fail = []
const pass = []

const check = (ok, label, detail) => {
  if (ok) pass.push(label)
  else fail.push(detail ? `${label} — ${detail}` : label)
}

const read = (file) => readFileSync(join(root, file), 'utf8')

/* 1 — manifest ------------------------------------------------------------ */
let pkg = null
try {
  pkg = JSON.parse(read('package.json'))
  check(true, 'package.json parses')
} catch (error) {
  check(false, 'package.json parses', error.message)
}

if (pkg) {
  check(pkg.private !== true, 'not private (npm can publish it)',
    'package.json sets "private": true, which npm refuses to publish')
  check(typeof pkg.name === 'string' && pkg.name.length > 0, 'has a name')
  check(/^\d+\.\d+\.\d+/.test(pkg.version ?? ''), 'has a semver version',
    `got ${JSON.stringify(pkg.version)}`)
  check(pkg.license !== undefined, 'declares a license')

  /* 2 — dsh.bundle is what makes it installable -------------------------- */
  const patch = pkg.dsh?.bundle?.patch
  check(typeof patch === 'string' && patch.length > 0,
    'declares dsh.bundle.patch',
    pkg.dsh?.client
      ? 'only dsh.client is declared — that alone is not installable via `dsh plugin add`'
      : 'neither dsh.bundle nor dsh.client is declared')
  if (typeof patch === 'string') {
    check(existsSync(join(root, patch)), `patch file exists (${patch})`,
      'dsh.bundle.patch points at a file that is not in the package')

    /* 3 — the patch must name this package ------------------------------- */
    try {
      const yml = read(patch)
      const insertRow = yml.match(/name:\s*['"]?([^'"\n]+?)['"]?\s*$/m)
      check(insertRow !== null, `${patch} has an insert row with a name`,
        'no `name:` line found; the patch would insert nothing loadable')
      if (insertRow && pkg) {
        check(insertRow[1] === pkg.name, `${patch} names this package`,
          `patch says "${insertRow[1]}", package.json says "${pkg.name}"`)
      }
    } catch (error) {
      check(false, `${patch} is readable`, error.message)
    }
  }

  /* 4 — dsh.client shape -------------------------------------------------- */
  if (pkg.dsh?.client !== undefined) {
    check(pkg.dsh.client.platform === 'web', 'dsh.client.platform is "web"',
      `got ${JSON.stringify(pkg.dsh.client.platform)}`)
    check(Array.isArray(pkg.dsh.client.inject ?? []), 'dsh.client.inject is an array')
  }

  /* 6 — files[] resolves -------------------------------------------------- */
  const files = pkg.files ?? []
  if (files.length > 0) {
    const missing = files.filter((f) => !existsSync(join(root, f)))
    check(missing.length === 0, `files[] all exist (${files.length} entries)`,
      `missing: ${missing.join(', ')} — npm pack would ship without them`)
  }
}

/* 5 — ModuleLoader contract ------------------------------------------------ */
if (existsSync(join(root, 'client.js'))) {
  try {
    let captured = null
    const sandbox = { __ModuleLoader__: { load: (o) => { captured = o } } }
    new Function('window', read('client.js'))(sandbox)
    check(captured !== null, 'client.js calls __ModuleLoader__.load()',
      'the browser half never registers itself')
    if (captured) {
      if (pkg) {
        check(captured.id === pkg.name, 'client.js load id matches package name',
          `load id "${captured.id}" vs package name "${pkg.name}"`)
      }
      const exported = captured.factory(() => {
        throw new Error('client.js required a module; it should need none')
      })
      check(exported !== null && typeof exported === 'object',
        'client factory returns an exports object')
      check(typeof exported?.apply === 'function',
        'client exports apply()',
        'an exports object without apply fails plugin validation and kills web boot')
    }
  } catch (error) {
    check(false, 'client.js evaluates', error.message)
  }
}

/* report ------------------------------------------------------------------ */
for (const line of pass) console.log(`  ok   ${line}`)
for (const line of fail) console.error(`  FAIL ${line}`)

if (fail.length > 0) {
  console.error(`\n${fail.length} check(s) failed; not publishing.`)
  process.exit(1)
}
console.log(`\n${pass.length} checks passed.`)
