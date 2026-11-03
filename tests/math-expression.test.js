import { describe, expect, it } from 'vitest'
import { evaluateExpression } from '../src/tools/math/expression.js'

describe('calculator expression parser', () => {
  it('evaluates arithmetic with precedence and parentheses', () => {
    expect(evaluateExpression('1+2*3')).toBe(7)
    expect(evaluateExpression('(1+2)*3')).toBe(9)
    expect(evaluateExpression('2×3÷4−1')).toBe(0.5)
  })

  it('supports unary signs and right-associative powers', () => {
    expect(evaluateExpression('-2^2')).toBe(-4)
    expect(evaluateExpression('(-2)^2')).toBe(4)
    expect(evaluateExpression('2^3^2')).toBe(512)
    expect(evaluateExpression('2^-3')).toBe(0.125)
  })

  it('supports the keypad functions and constants', () => {
    expect(evaluateExpression('√(9)')).toBe(3)
    expect(evaluateExpression('sin(0)')).toBe(0)
    expect(evaluateExpression('cos(0)')).toBe(1)
    expect(evaluateExpression('log(1000)')).toBe(3)
    expect(evaluateExpression('ln(e)')).toBe(1)
    expect(evaluateExpression('π')).toBe(Math.PI)
    expect(evaluateExpression('e')).toBe(Math.E)
  })

  it('keeps scientific-notation literals intact', () => {
    expect(evaluateExpression('1e-7')).toBe(1e-7)
    expect(evaluateExpression('1e-7+1')).toBe(1.0000001)
  })

  it('treats a trailing percent as percentage and an inner percent as modulo', () => {
    expect(evaluateExpression('10%3')).toBe(1)
    expect(evaluateExpression('50%')).toBe(0.5)
    expect(evaluateExpression('(50)%')).toBe(0.5)
    expect(evaluateExpression('50%%')).toBe(0.005)
    expect(evaluateExpression('10%3%')).toBe(0.01)
  })

  it('rejects malformed or unsupported expressions', () => {
    expect(() => evaluateExpression('')).toThrow()
    expect(() => evaluateExpression('1+')).toThrow()
    expect(() => evaluateExpression('2^')).toThrow()
    expect(() => evaluateExpression('foo(1)')).toThrow()
    expect(() => evaluateExpression('alert(1)')).toThrow()
    expect(() => evaluateExpression('1;2')).toThrow()
  })

  it('does not execute arbitrary code', () => {
    expect(() => evaluateExpression('globalThis.process')).toThrow()
    expect(() => evaluateExpression('constructor')).toThrow()
  })
})
