// Regenerates the tool list in README.md from the registry so the docs cannot
// drift when tools are added or renamed. Run with --check in CI.
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { categories, tools } from '../src/tools/registry.js'

const start = '<!-- TOOLS:START -->'
const end = '<!-- TOOLS:END -->'
const path = resolve('README.md')
const markdown = await readFile(path, 'utf8')
const startIndex = markdown.indexOf(start)
const endIndex = markdown.indexOf(end)
if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
  throw new Error(`README.md is missing ${start} / ${end} markers`)
}

const sections = categories.filter(category => category.id !== 'all').map(category => {
  const list = tools.filter(tool => tool.category === category.id)
  return `### ${category.name}（${list.length} 个）\n${list.map(tool => tool.name).join(' · ')}`
})
const generated = `${start}\n${sections.join('\n\n')}\n${end}`
const next = markdown.slice(0, startIndex) + generated + markdown.slice(endIndex + end.length)

if (process.argv.includes('--check')) {
  if (next !== markdown) {
    console.error('README tool list is out of date. Run `npm run readme` and commit the result.')
    process.exit(1)
  }
  console.log('README tool list is in sync with the registry.')
} else {
  await writeFile(path, next)
  console.log(`Updated README tool list (${tools.length} tools, ${sections.length} categories).`)
}
