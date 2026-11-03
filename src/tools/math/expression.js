// Safe expression evaluator for the calculator.
//
// The deployed site sends a CSP without 'unsafe-eval', so `new Function()` is
// blocked by the browser and every expression used to render "Error". This
// recursive-descent parser only understands numbers, the operators the keypad
// exposes and a fixed function table, so it does not need eval at all.

const FUNCTIONS = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  log: Math.log10,
  ln: Math.log,
  sqrt: Math.sqrt
}

function tokenize(source) {
  const tokens = []
  let index = 0
  while (index < source.length) {
    const char = source[index]
    if (/\s/.test(char)) {
      index += 1
      continue
    }
    if (char === 'π') {
      tokens.push({ type: 'number', value: Math.PI })
      index += 1
      continue
    }
    if (char === '√') {
      tokens.push({ type: 'identifier', value: 'sqrt' })
      index += 1
      continue
    }
    if (/[0-9.]/.test(char)) {
      const match = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(source.slice(index))
      if (!match) throw new Error(`无法识别的数字：${source.slice(index)}`)
      tokens.push({ type: 'number', value: Number(match[0]) })
      index += match[0].length
      continue
    }
    if (/[a-zA-Z]/.test(char)) {
      const match = /^[a-zA-Z]+/.exec(source.slice(index))
      tokens.push({ type: 'identifier', value: match[0].toLowerCase() })
      index += match[0].length
      continue
    }
    if ('+-*/^%(),'.includes(char)) {
      tokens.push({ type: 'operator', value: char })
      index += 1
      continue
    }
    throw new Error(`不支持的字符：${char}`)
  }
  tokens.push({ type: 'eof', value: '' })
  return tokens
}

class Parser {
  constructor(tokens) {
    this.tokens = tokens
    this.index = 0
  }

  peek() {
    return this.tokens[this.index]
  }

  matchOperator(value) {
    const token = this.peek()
    if (token.type === 'operator' && token.value === value) {
      this.index += 1
      return true
    }
    return false
  }

  expectOperator(value) {
    if (!this.matchOperator(value)) throw new Error(`缺少“${value}”`)
  }

  parseExpression() {
    let value = this.parseTerm()
    for (;;) {
      if (this.matchOperator('+')) value += this.parseTerm()
      else if (this.matchOperator('-')) value -= this.parseTerm()
      else return value
    }
  }

  parseTerm() {
    let value = this.parseUnary()
    for (;;) {
      if (this.matchOperator('*')) value *= this.parseUnary()
      else if (this.matchOperator('/')) value /= this.parseUnary()
      else if (this.matchOperator('%')) value %= this.parseUnary()
      else return value
    }
  }

  parseUnary() {
    if (this.matchOperator('+')) return this.parseUnary()
    if (this.matchOperator('-')) return -this.parseUnary()
    return this.parsePower()
  }

  parsePower() {
    const base = this.parsePrimary()
    if (!this.matchOperator('^')) return base
    // Right-associative, and the exponent may be negative: 2^-3.
    return base ** this.parseUnary()
  }

  parsePrimary() {
    const token = this.peek()
    if (token.type === 'number') {
      this.index += 1
      return token.value
    }
    if (token.type === 'identifier') {
      this.index += 1
      if (token.value === 'e') return Math.E
      if (token.value === 'pi') return Math.PI
      const fn = FUNCTIONS[token.value]
      if (!fn) throw new Error(`不支持的函数：${token.value}`)
      this.expectOperator('(')
      const argument = this.parseExpression()
      this.expectOperator(')')
      return fn(argument)
    }
    if (this.matchOperator('(')) {
      const value = this.parseExpression()
      this.expectOperator(')')
      return value
    }
    throw new Error('表达式不完整')
  }

  expectEnd() {
    if (this.peek().type !== 'eof') throw new Error('表达式无法解析')
  }
}

export function evaluateExpression(expression) {
  let source = String(expression ?? '')
    .trim()
    .replaceAll('×', '*')
    .replaceAll('÷', '/')
    .replaceAll('−', '-')
  if (!source) throw new Error('表达式为空')

  // A trailing percent is a postfix percentage (50% → 0.5), matching the
  // keypad's label. A percent between operands stays the modulo operator.
  let scale = 1
  const trailing = /(%+)$/.exec(source)
  if (trailing) {
    scale = 100 ** trailing[1].length
    source = source.slice(0, -trailing[1].length)
  }

  const parser = new Parser(tokenize(source))
  const value = parser.parseExpression()
  parser.expectEnd()
  return value / scale
}
