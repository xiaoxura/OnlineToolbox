import { countTokens, decode, encode, encodeChat } from 'gpt-tokenizer/encoding/o200k_base'
import { startTokenizerWorker } from './token-counter.worker-core.js'

startTokenizerWorker({ encode, decode, encodeChat, countTokens })
