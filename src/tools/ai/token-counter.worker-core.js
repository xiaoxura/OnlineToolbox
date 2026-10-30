// Shared message handling for the per-encoding token-count workers. Each worker
// entry imports exactly one vocabulary, so the emitted chunk only carries the
// BPE table it actually needs (o200k alone is ~1 MB gzip).
export function startTokenizerWorker(tokenizer) {
  function pieceOf(id) {
    try {
      const text = tokenizer.decode([id])
      if (!text || text.includes('�')) return `<0x${id.toString(16).toUpperCase()}>`
      return text
    } catch {
      return `<0x${id.toString(16).toUpperCase()}>`
    }
  }

  self.onmessage = async event => {
    const { id, mode, text, messages, chatModel, limit = 400 } = event.data || {}
    try {
      let ids
      let plain = 0
      if (mode === 'chat') {
        ids = tokenizer.encodeChat(messages, chatModel)
        plain = tokenizer.countTokens(messages.map(message => message.content).join('\n'))
      } else {
        ids = tokenizer.encode(text)
      }
      const pieces = ids.slice(0, limit).map(tokenId => pieceOf(tokenId))
      self.postMessage({ id, type: 'done', ids, plain, pieces })
    } catch (error) {
      self.postMessage({ id, type: 'error', message: error instanceof Error ? error.message : String(error) })
    }
  }
}
