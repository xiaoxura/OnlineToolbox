// Reference data for the AI tools: model ids, context windows and list prices.
//
// Prices are USD per 1,000,000 tokens, read from each vendor's published
// pricing page on 2026-09-15. They drift, and several vendors bill by tier
// rather than a flat rate — the per-provider notes below carry those caveats,
// and every price stays editable in the cost estimator, so a stale row
// degrades into a wrong default rather than a wrong answer.
//
// Anthropic rows are first-party API rates. Partner-operated platforms
// (Bedrock, Vertex AI, Microsoft Foundry) price separately.

export const DATA_UPDATED = '2026-09-15'

export const PRICING_SOURCES = [
  { name: 'Anthropic', url: 'https://www.anthropic.com/pricing' },
  { name: 'OpenAI', url: 'https://developers.openai.com/api/docs/pricing' },
  { name: 'Google Gemini', url: 'https://ai.google.dev/gemini-api/docs/pricing' },
  { name: 'DeepSeek', url: 'https://api-docs.deepseek.com/quick_start/pricing' },
  { name: 'xAI', url: 'https://docs.x.ai/docs/models' },
  { name: 'Mistral', url: 'https://mistral.ai/pricing/api' }
]

// Anthropic's published prompt-cache economics, as multipliers on the input
// price. Kept as ratios so a price edit stays coherent.
export const CACHE_WRITE_MULTIPLIER = 1.25
export const CACHE_READ_MULTIPLIER = 0.1

export const providers = [
  { id: 'anthropic', name: 'Anthropic' },
  { id: 'openai', name: 'OpenAI' },
  { id: 'google', name: 'Google' },
  { id: 'deepseek', name: 'DeepSeek' },
  { id: 'xai', name: 'xAI' },
  { id: 'mistral', name: 'Mistral' }
]

// Billing caveats that apply to a whole vendor rather than one model.
export const providerNotes = {
  openai: '输入超过 272K token 时，整个请求按输入 2× / 输出 1.5× 计费；Batch 与 Flex 为 5 折。',
  google: 'Batch 与 Flex 为 5 折；Gemini 3.8 Flash 为促销价，2027-01-01 起翻倍。',
  deepseek: '采用峰谷计价：表中为高峰价，非高峰时段半价（UTC 01:00–04:00、06:00–10:00 的周一至周五为高峰）。',
  xai: '表中为 200K 以内档位；prompt 超过 200K 时整个请求费率翻倍。Batch 仅 8 折且只对部分模型生效。',
  mistral: '官方未公布上下文窗口，故留空；缓存输入仅给出「输入节省 90%」的笼统说明，无逐模型价格。',
  anthropic: '缓存写入按输入价 1.25×、缓存读取按 0.1× 计费。'
}

// `context` is the input context window in tokens (null = vendor does not
// publish one). `cachedInput` is the published cached-read price; null means
// "derive it from CACHE_READ_MULTIPLIER".
export const models = [
  // --- Anthropic -----------------------------------------------------------
  { provider: 'anthropic', name: 'Claude Fable 5.1', id: 'claude-fable-5-1', context: 1_000_000, input: 10, output: 50, cachedInput: null, tags: ['旗舰', '推理'] },
  { provider: 'anthropic', name: 'Claude Fable 5', id: 'claude-fable-5', context: 1_000_000, input: 10, output: 50, cachedInput: null, tags: ['旗舰'] },
  { provider: 'anthropic', name: 'Claude Opus 5', id: 'claude-opus-5', context: 1_000_000, input: 5, output: 25, cachedInput: null, tags: ['旗舰'] },
  { provider: 'anthropic', name: 'Claude Opus 4.8', id: 'claude-opus-4-8', context: 1_000_000, input: 5, output: 25, cachedInput: null, tags: [] },
  { provider: 'anthropic', name: 'Claude Opus 4.7', id: 'claude-opus-4-7', context: 1_000_000, input: 5, output: 25, cachedInput: null, tags: [] },
  { provider: 'anthropic', name: 'Claude Opus 4.6', id: 'claude-opus-4-6', context: 1_000_000, input: 5, output: 25, cachedInput: null, tags: [] },
  { provider: 'anthropic', name: 'Claude Sonnet 5', id: 'claude-sonnet-5', context: 1_000_000, input: 2, output: 10, cachedInput: null, tags: ['均衡'] },
  { provider: 'anthropic', name: 'Claude Sonnet 4.6', id: 'claude-sonnet-4-6', context: 1_000_000, input: 3, output: 15, cachedInput: null, tags: [] },
  { provider: 'anthropic', name: 'Claude Haiku 4.5', id: 'claude-haiku-4-5', context: 200_000, input: 1, output: 5, cachedInput: null, tags: ['轻量'] },

  // --- OpenAI --------------------------------------------------------------
  { provider: 'openai', name: 'GPT-6 Astra', id: 'gpt-6-astra', context: 1_050_000, input: 10, output: 50, cachedInput: 1, tags: ['旗舰'] },
  { provider: 'openai', name: 'GPT-5.6 Sol', id: 'gpt-5.6-sol', context: 1_050_000, input: 4, output: 20, cachedInput: 0.4, tags: [] },
  { provider: 'openai', name: 'GPT-5.6 Terra', id: 'gpt-5.6-terra', context: 1_050_000, input: 2, output: 12, cachedInput: 0.2, tags: ['均衡'] },
  { provider: 'openai', name: 'GPT-5.6 Luna', id: 'gpt-5.6-luna', context: 1_050_000, input: 0.2, output: 1.2, cachedInput: 0.02, tags: ['轻量'] },

  // --- Google --------------------------------------------------------------
  { provider: 'google', name: 'Gemini 3.1 Pro', id: 'gemini-3.1-pro-preview', context: 1_048_576, input: 2, output: 12, cachedInput: 0.2, tags: ['旗舰'], note: 'prompt 超过 200K 时按输入 $4 / 输出 $18 计费' },
  { provider: 'google', name: 'Gemini 3.8 Flash', id: 'gemini-3.8-flash', context: 1_048_576, input: 0.75, output: 3.75, cachedInput: 0.075, tags: ['轻量'], note: '促销价，2027-01-01 起翻倍' },
  { provider: 'google', name: 'Gemini 3.5 Flash-Lite', id: 'gemini-3.5-flash-lite', context: 1_048_576, input: 0.3, output: 2.5, cachedInput: 0.03, tags: ['轻量'] },
  { provider: 'google', name: 'Gemini 3.1 Flash-Lite', id: 'gemini-3.1-flash-lite', context: 1_048_576, input: 0.25, output: 1.5, cachedInput: 0.025, tags: ['轻量'] },

  // --- DeepSeek ------------------------------------------------------------
  { provider: 'deepseek', name: 'DeepSeek-V4-Pro', id: 'deepseek-v4-pro', context: 1_000_000, input: 1.32, output: 3.96, cachedInput: 0.044, tags: ['旗舰'] },
  { provider: 'deepseek', name: 'DeepSeek-V4.1-Flash', id: 'deepseek-flash', context: 1_000_000, input: 0.3, output: 1.2, cachedInput: 0.006, tags: ['轻量'] },

  // --- xAI -----------------------------------------------------------------
  { provider: 'xai', name: 'Grok 4.6', id: 'grok-4.6', context: 500_000, input: 2, output: 6, cachedInput: 0.5, tags: ['旗舰'], note: '无 Batch 折扣' },
  { provider: 'xai', name: 'Grok 4.3', id: 'grok-4.3', context: 1_000_000, input: 1.25, output: 2.5, cachedInput: 0.2, tags: [] },
  { provider: 'xai', name: 'Grok Build 0.1', id: 'grok-build-0.1', context: 256_000, input: 1, output: 2, cachedInput: 0.2, tags: ['轻量'] },

  // --- Mistral -------------------------------------------------------------
  { provider: 'mistral', name: 'Mistral Medium 3.5', id: 'mistral-medium-latest', context: null, input: 1.5, output: 7.5, cachedInput: null, tags: [] },
  { provider: 'mistral', name: 'Mistral Large 3', id: 'mistral-large-latest', context: null, input: 0.5, output: 1.5, cachedInput: null, tags: [] },
  { provider: 'mistral', name: 'Mistral Small 4', id: 'mistral-small-latest', context: null, input: 0.15, output: 0.6, cachedInput: null, tags: ['轻量'] }
]

export const modelById = id => models.find(model => model.id === id)

export const modelsByProvider = providerId => models.filter(model => model.provider === providerId)

export const providerName = id => providers.find(provider => provider.id === id)?.name || id

// Cached-read price: the vendor's published number when there is one,
// otherwise the vendor's stated multiplier on the (possibly edited) input
// price — Anthropic publishes the 0.1x rule, Mistral a general "-90% input".
export function cachedInputPrice(model, inputPrice) {
  if (!model) return 0
  if (typeof model.cachedInput === 'number') return model.cachedInput
  return (inputPrice ?? model.input ?? 0) * CACHE_READ_MULTIPLIER
}

// Format a token count for display: 1_000_000 -> "1M", 200_000 -> "200K".
export function formatTokens(value) {
  if (value === null || value === undefined) return '—'
  if (!Number.isFinite(value)) return '—'
  if (value >= 1_000_000) return `${Number((value / 1_000_000).toFixed(2))}M`
  if (value >= 1_000) return `${Number((value / 1_000).toFixed(1))}K`
  return String(value)
}

// Format a USD amount, keeping small numbers readable instead of rounding
// them to "$0.00" — sub-cent costs are the normal case for a single call.
export function formatCost(value) {
  if (!Number.isFinite(value)) return '—'
  if (value === 0) return '$0'
  if (value < 0.0001) return `$${value.toExponential(2)}`
  if (value < 0.01) return `$${value.toFixed(6)}`
  if (value < 1) return `$${value.toFixed(4)}`
  return `$${value.toFixed(2)}`
}
