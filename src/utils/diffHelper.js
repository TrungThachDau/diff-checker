import { diffWordsWithSpace, diffChars, diffLines } from 'diff'

/**
 * Detects dominant line ending style
 * @param {string} text
 * @returns {'CRLF' | 'LF' | 'CR' | 'Mixed' | 'None'}
 */
export function detectLineEnding(text) {
  if (!text) return 'None'
  const hasCRLF = /\r\n/.test(text)
  const hasLF = /[^\r]\n/.test(text) || text.startsWith('\n')
  const hasCR = /\r[^\n]/.test(text) || (text.endsWith('\r') && !text.endsWith('\r\n'))

  const matches = []
  if (hasCRLF) matches.push('CRLF')
  if (hasLF) matches.push('LF')
  if (hasCR) matches.push('CR')

  if (matches.length === 0) return 'None'
  if (matches.length === 1) return matches[0]
  return 'Mixed'
}

/**
 * Counts occurrences of each line ending
 */
export function countLineEndings(text) {
  if (!text) return { crlf: 0, lf: 0, cr: 0 }
  const crlf = (text.match(/\r\n/g) || []).length
  const withoutCrlf = text.replace(/\r\n/g, '')
  const lf = (withoutCrlf.match(/\n/g) || []).length
  const cr = (withoutCrlf.match(/\r/g) || []).length
  return { crlf, lf, cr }
}

/**
 * Computes side-by-side diff between oldText and newText.
 * Strictly compares CRLF and LF by default without stripping or ignoring line endings.
 */
export function computeDiff(oldText, newText, options = {}) {
  const {
    mode = 'words', // 'words' | 'chars' | 'lines'
    ignoreCase = false,
    ignoreWhitespace = false
  } = options

  const rawOld = oldText || ''
  const rawNew = newText || ''

  // Line ending metadata
  const oldEol = detectLineEnding(rawOld)
  const newEol = detectLineEnding(rawNew)
  const oldEolCounts = countLineEndings(rawOld)
  const newEolCounts = countLineEndings(rawNew)
  const isEolMismatch =
    oldEol !== 'None' &&
    newEol !== 'None' &&
    oldEol !== newEol

  // Mặc định luôn so sánh nghiêm ngặt cả ký tự xuống dòng CRLF và LF (không chuẩn hóa / không bỏ qua)
  const processedOld = rawOld
  const processedNew = rawNew

  const diffOpts = {
    ignoreCase: !!ignoreCase,
    ignoreWhitespace: !!ignoreWhitespace
  }

  let rawChunks
  if (mode === 'chars') {
    rawChunks = diffChars(processedOld, processedNew, diffOpts)
  } else if (mode === 'lines') {
    rawChunks = diffLines(processedOld, processedNew, diffOpts)
  } else {
    // Default words with space
    rawChunks = diffWordsWithSpace(processedOld, processedNew, diffOpts)
  }

  // Build left side (old text) and right side (new text)
  const leftChunks = []
  const rightChunks = []

  let removedCount = 0
  let addedCount = 0
  let unchangedLength = 0
  let diffCount = 0

  let currentDiffId = 1

  for (const chunk of rawChunks) {
    if (chunk.removed) {
      removedCount++
      diffCount++
      leftChunks.push({
        id: `diff-${currentDiffId++}`,
        type: 'removed',
        value: chunk.value,
        isDiff: true
      })
    } else if (chunk.added) {
      addedCount++
      diffCount++
      rightChunks.push({
        id: `diff-${currentDiffId++}`,
        type: 'added',
        value: chunk.value,
        isDiff: true
      })
    } else {
      unchangedLength += chunk.value.length
      leftChunks.push({
        id: `same-l-${leftChunks.length}`,
        type: 'same',
        value: chunk.value,
        isDiff: false
      })
      rightChunks.push({
        id: `same-r-${rightChunks.length}`,
        type: 'same',
        value: chunk.value,
        isDiff: false
      })
    }
  }

  // Calculate similarity percentage (chỉ 100% khi khớp hoàn toàn từng ký tự bao gồm cả CRLF / LF)
  const totalLength = Math.max(processedOld.length, processedNew.length)
  let similarityPercent = 100
  if (totalLength > 0) {
    similarityPercent = Math.max(0, Math.min(100, Math.round((unchangedLength / totalLength) * 100)))
  } else if (processedOld.length === 0 && processedNew.length === 0) {
    similarityPercent = 100
  }

  // Exact match strictly checks CRLF vs LF
  const isExactMatch = rawOld === rawNew

  // Calculate stats
  const oldWords = countWords(processedOld)
  const newWords = countWords(processedNew)
  const oldLines = countLines(processedOld)
  const newLines = countLines(processedNew)

  return {
    rawChunks,
    leftChunks,
    rightChunks,
    stats: {
      similarityPercent: isExactMatch ? 100 : Math.min(similarityPercent, 99),
      diffCount,
      removedCount,
      addedCount,
      oldLength: rawOld.length,
      newLength: rawNew.length,
      oldWords,
      newWords,
      oldLines,
      newLines,
      oldEol,
      newEol,
      oldEolCounts,
      newEolCounts,
      isEolMismatch,
      isExactMatch
    }
  }
}

function countWords(str) {
  if (!str || !str.trim()) return 0
  return str.trim().split(/\s+/).length
}

function countLines(str) {
  if (!str) return 0
  return str.split(/\r\n|\r|\n/).length
}
