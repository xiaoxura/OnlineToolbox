import { countTokens, decode, encode, encodeChat } from 'gpt-tokenizer/encoding/cl100k_base'
import { startTokenizerWorker } from './token-counter.worker-core.js'

startTokenizerWorker({ encode, decode, encodeChat, countTokens })
