// Fails CI when the static LLM pricing table is older than the review's
// freshness window. Prices change without notice; a stale table silently makes
// the cost estimator wrong, so the date is checked rather than remembered.
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const WARN_DAYS = 60
const FAIL_DAYS = 90
const sources = [
  { file: resolve('src/tools/ai/models.js'), label: '大模型价格' },
  { file: resolve('src/tools/ai/embedding-cost.js'), label: 'Embedding 价格' }
]

const today = process.env.DATA_CHECK_DATE ? new Date(`${process.env.DATA_CHECK_DATE}T00:00:00Z`) : new Date()
let failed = false

for (const source of sources) {
  const text = await readFile(source.file, 'utf8')
  const match = /DATA_UPDATED\s*=\s*['"](\d{4}-\d{2}-\d{2})['"]/.exec(text)
  if (!match) {
    console.error(`data-freshness: ${source.label} does not declare DATA_UPDATED`)
    failed = true
    continue
  }
  const date = new Date(`${match[1]}T00:00:00Z`)
  const ageDays = Math.floor((today - date) / 86400000)
  if (ageDays >= FAIL_DAYS) {
    console.error(`data-freshness: ${source.label} is ${ageDays} days old (${match[1]}); update the prices and DATA_UPDATED (limit ${FAIL_DAYS} days)`)
    failed = true
  } else if (ageDays >= WARN_DAYS) {
    console.warn(`data-freshness: warning — ${source.label} is ${ageDays} days old (${match[1]}); refresh it soon`)
  } else {
    console.log(`data-freshness: ${source.label} is ${ageDays} days old (${match[1]})`)
  }
}

if (failed) process.exit(1)
