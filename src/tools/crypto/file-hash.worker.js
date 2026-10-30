// Worker for file hashing: reading and digesting a multi-gigabyte file on the
// main thread would freeze the page, so the chunk loop runs here.
import { digestFile } from '../../utils/hash.js'

self.onmessage = async event => {
  const { id, file, algorithm } = event.data
  try {
    const digest = await digestFile(file, algorithm, {
      onProgress: (loaded, total) => self.postMessage({ id, type: 'progress', loaded, total })
    })
    self.postMessage({ id, type: 'done', digest })
  } catch (error) {
    self.postMessage({ id, type: 'error', message: error instanceof Error ? error.message : String(error) })
  }
}
