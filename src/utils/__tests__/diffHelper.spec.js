import { describe, it, expect } from 'vitest'
import {
  detectLineEnding,
  countLineEndings,
  computeDiff
} from '../diffHelper.js'

describe('diffHelper', () => {
  describe('detectLineEnding', () => {
    it('returns "None" for empty, null, or undefined strings', () => {
      expect(detectLineEnding('')).toBe('None')
      expect(detectLineEnding(null)).toBe('None')
      expect(detectLineEnding(undefined)).toBe('None')
    })

    it('returns "None" for single-line text without newlines', () => {
      expect(detectLineEnding('Hello world')).toBe('None')
    })

    it('detects CRLF line endings', () => {
      expect(detectLineEnding('Line 1\r\nLine 2\r\nLine 3')).toBe('CRLF')
    })

    it('detects LF line endings', () => {
      expect(detectLineEnding('Line 1\nLine 2\nLine 3')).toBe('LF')
    })

    it('detects standalone CR line endings', () => {
      expect(detectLineEnding('Line 1\rLine 2\rLine 3')).toBe('CR')
    })

    it('detects Mixed line endings', () => {
      expect(detectLineEnding('Line 1\r\nLine 2\nLine 3')).toBe('Mixed')
      expect(detectLineEnding('Line 1\rLine 2\nLine 3')).toBe('Mixed')
    })
  })

  describe('countLineEndings', () => {
    it('returns zeroes for empty or null text', () => {
      expect(countLineEndings('')).toEqual({ crlf: 0, lf: 0, cr: 0 })
      expect(countLineEndings(null)).toEqual({ crlf: 0, lf: 0, cr: 0 })
    })

    it('counts occurrences of CRLF, LF, and CR correctly', () => {
      const text = 'A\r\nB\r\nC\nD\r'
      const counts = countLineEndings(text)
      expect(counts.crlf).toBe(2)
      expect(counts.lf).toBe(1)
      expect(counts.cr).toBe(1)
    })
  })

  describe('computeDiff', () => {
    it('handles both empty inputs correctly', () => {
      const result = computeDiff('', '')
      expect(result.stats.similarityPercent).toBe(100)
      expect(result.stats.isExactMatch).toBe(true)
      expect(result.stats.diffCount).toBe(0)
      expect(result.leftChunks).toHaveLength(0)
      expect(result.rightChunks).toHaveLength(0)
    })

    it('detects exact matches with 100% similarity', () => {
      const text = 'Hello world\nThis is a test.'
      const result = computeDiff(text, text)
      expect(result.stats.similarityPercent).toBe(100)
      expect(result.stats.isExactMatch).toBe(true)
      expect(result.stats.diffCount).toBe(0)
      expect(result.stats.removedCount).toBe(0)
      expect(result.stats.addedCount).toBe(0)
    })

    it('strictly differentiates CRLF and LF (does not treat as exact match)', () => {
      const textCRLF = 'Line 1\r\nLine 2'
      const textLF = 'Line 1\nLine 2'
      const result = computeDiff(textCRLF, textLF)

      expect(result.stats.isExactMatch).toBe(false)
      expect(result.stats.isEolMismatch).toBe(true)
      expect(result.stats.oldEol).toBe('CRLF')
      expect(result.stats.newEol).toBe('LF')
      expect(result.stats.similarityPercent).toBeLessThan(100)
      expect(result.stats.diffCount).toBeGreaterThan(0)
    })

    it('identifies removed and added chunks in words mode', () => {
      const oldText = 'The quick brown fox'
      const newText = 'The fast brown dog'
      const result = computeDiff(oldText, newText, { mode: 'words' })

      expect(result.stats.isExactMatch).toBe(false)
      expect(result.stats.removedCount).toBeGreaterThan(0)
      expect(result.stats.addedCount).toBeGreaterThan(0)

      const removedChunks = result.leftChunks.filter((c) => c.isDiff)
      const addedChunks = result.rightChunks.filter((c) => c.isDiff)
      expect(removedChunks.length).toBeGreaterThan(0)
      expect(addedChunks.length).toBeGreaterThan(0)
    })

    it('supports chars comparison mode', () => {
      const oldText = 'cat'
      const newText = 'car'
      const result = computeDiff(oldText, newText, { mode: 'chars' })

      expect(result.stats.isExactMatch).toBe(false)
      const diffLeft = result.leftChunks.filter((c) => c.isDiff)
      const diffRight = result.rightChunks.filter((c) => c.isDiff)

      expect(diffLeft.some((c) => c.value === 't')).toBe(true)
      expect(diffRight.some((c) => c.value === 'r')).toBe(true)
    })

    it('supports lines comparison mode', () => {
      const oldText = 'Apple\nBanana\nCherry'
      const newText = 'Apple\nBlueberry\nCherry'
      const result = computeDiff(oldText, newText, { mode: 'lines' })

      expect(result.stats.isExactMatch).toBe(false)
      expect(result.stats.diffCount).toBeGreaterThan(0)
    })

    it('respects ignoreCase option', () => {
      const oldText = 'hello WORLD'
      const newText = 'HELLO world'

      const strictResult = computeDiff(oldText, newText, { ignoreCase: false })
      const ignoreCaseResult = computeDiff(oldText, newText, { ignoreCase: true })

      expect(strictResult.stats.diffCount).toBeGreaterThan(0)
      expect(ignoreCaseResult.stats.diffCount).toBe(0)
    })

    it('respects ignoreWhitespace option in lines mode', () => {
      const oldText = 'hello world\n'
      const newText = '  hello world  \n'

      const strictResult = computeDiff(oldText, newText, { mode: 'lines', ignoreWhitespace: false })
      const ignoreWhitespaceResult = computeDiff(oldText, newText, { mode: 'lines', ignoreWhitespace: true })

      expect(strictResult.stats.diffCount).toBeGreaterThan(0)
      expect(ignoreWhitespaceResult.stats.diffCount).toBe(0)
    })

    it('computes accurate word, line, and character counts', () => {
      const oldText = 'One two three\nFour five'
      const newText = 'One'
      const result = computeDiff(oldText, newText)

      expect(result.stats.oldWords).toBe(5)
      expect(result.stats.oldLines).toBe(2)
      expect(result.stats.oldLength).toBe(oldText.length)

      expect(result.stats.newWords).toBe(1)
      expect(result.stats.newLines).toBe(1)
      expect(result.stats.newLength).toBe(newText.length)
    })
  })
})
