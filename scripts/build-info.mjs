// Stamps every build with its date, commit and branch. The result is written to
// .build-info.json once, then reused by Vite (footer placeholders), the service
// worker manifest (dist/version.json) and the SEO page generator, so all
// surfaces report the same deployment instead of three slightly different
// timestamps.
import { execFileSync } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

function git(args) {
  try {
    return execFileSync('git', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000
    }).trim()
  } catch {
    // Source archives and some CI checkouts have no .git directory. The date is
    // still useful without a commit, so this is not fatal.
    return ''
  }
}

export function collectBuildInfo() {
  return {
    builtAt: new Date().toISOString(),
    commit: git(['rev-parse', 'HEAD']),
    commitShort: git(['rev-parse', '--short=7', 'HEAD']),
    commitDate: git(['log', '-1', '--format=%cI']),
    branch: git(['rev-parse', '--abbrev-ref', 'HEAD'])
  }
}

export async function writeBuildInfo() {
  const info = collectBuildInfo()
  await writeFile(resolve('.build-info.json'), `${JSON.stringify(info, null, 2)}\n`)
  return info
}

const isEntryPoint = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isEntryPoint) {
  const info = await writeBuildInfo()
  const commit = info.commitShort ? ` · ${info.commitShort}` : ''
  console.log(`build-info: ${info.builtAt}${commit}`)
}
