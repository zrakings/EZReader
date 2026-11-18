/**
 * A deliberately small, safe RTF text extractor.
 *
 * RTF is not HTML. This parser never emits markup and never executes embedded
 * objects. It preserves paragraphs, line breaks, tabs, unicode escapes and
 * the most common typographic characters while discarding control groups such
 * as fonts, images, headers and field instructions.
 */

const IGNORED_DESTINATIONS = new Set([
  'fonttbl',
  'colortbl',
  'stylesheet',
  'info',
  'pict',
  'object',
  'objdata',
  'header',
  'headerf',
  'headerl',
  'headerr',
  'footer',
  'footerf',
  'footerl',
  'footerr',
  'field',
  'fldinst',
  'listtable',
  'listoverridetable',
  'rsidtbl',
  'generator',
  'xmlnstbl',
  'themedata',
  'colorschememapping',
  'latentstyles',
  'datastore',
  'filetbl',
  'revtbl',
  'panose',
  'bkmkstart',
  'bkmkend',
  'nonshppict',
  'shppict',
])

const SYMBOLS: Record<string, string> = {
  par: '\n',
  line: '\n',
  pard: '\n',
  sect: '\n\n',
  page: '\n\n',
  tab: '\t',
  emdash: '—',
  endash: '–',
  bullet: '•',
  lquote: '‘',
  rquote: '’',
  ldblquote: '“',
  rdblquote: '”',
  '~': ' ',
  '-': '',
  _: '‑',
}

const CP1252: Record<number, string> = {
  0x80: '€',
  0x82: '‚',
  0x83: 'ƒ',
  0x84: '„',
  0x85: '…',
  0x86: '†',
  0x87: '‡',
  0x88: 'ˆ',
  0x89: '‰',
  0x8a: 'Š',
  0x8b: '‹',
  0x8c: 'Œ',
  0x8e: 'Ž',
  0x91: '‘',
  0x92: '’',
  0x93: '“',
  0x94: '”',
  0x95: '•',
  0x96: '–',
  0x97: '—',
  0x98: '˜',
  0x99: '™',
  0x9a: 'š',
  0x9b: '›',
  0x9c: 'œ',
  0x9e: 'ž',
  0x9f: 'Ÿ',
}

export function rtfToText(input: string): string {
  let output = ''
  let index = 0
  let depth = 0
  let ignore = false
  let fallbackSkip = 0
  let unicodeSkip = 1
  let justOpenedGroup = false
  const ignoreStack: boolean[] = []

  const isLetter = (char: string) => /[a-zA-Z]/.test(char)
  const isDigit = (char: string) => /[0-9]/.test(char)

  while (index < input.length) {
    const char = input[index]

    if (fallbackSkip > 0) {
      fallbackSkip -= 1
      index += 1
      continue
    }

    if (char === '{') {
      ignoreStack.push(ignore)
      depth += 1
      justOpenedGroup = true
      index += 1
      continue
    }

    if (char === '}') {
      ignore = ignoreStack.pop() ?? false
      depth = Math.max(0, depth - 1)
      justOpenedGroup = false
      index += 1
      continue
    }

    if (char === '\\') {
      const next = input[index + 1]
      if (next === undefined) break

      if (next === '\\' || next === '{' || next === '}') {
        if (!ignore) output += next
        index += 2
        justOpenedGroup = false
        continue
      }

      if (next === "'") {
        const hex = input.slice(index + 2, index + 4)
        if (/^[0-9a-fA-F]{2}$/.test(hex)) {
          if (!ignore) {
            const code = Number.parseInt(hex, 16)
            output += CP1252[code] ?? String.fromCharCode(code)
          }
          index += 4
        } else {
          index += 2
        }
        justOpenedGroup = false
        continue
      }

      if (next === '~' || next === '-' || next === '_') {
        if (!ignore) output += SYMBOLS[next]
        index += 2
        justOpenedGroup = false
        continue
      }

      if (next === '\r' || next === '\n') {
        index += 2
        continue
      }

      if (isLetter(next)) {
        let cursor = index + 1
        let word = ''
        while (cursor < input.length && isLetter(input[cursor])) {
          word += input[cursor]
          cursor += 1
        }
        let sign = 1
        if (input[cursor] === '-') {
          sign = -1
          cursor += 1
        }
        let numeric = ''
        while (cursor < input.length && isDigit(input[cursor])) {
          numeric += input[cursor]
          cursor += 1
        }
        if (input[cursor] === ' ') cursor += 1
        const number = numeric ? Number(numeric) * sign : null

        if (justOpenedGroup && IGNORED_DESTINATIONS.has(word)) {
          ignore = true
        } else if (word === 'uc' && number !== null) {
          unicodeSkip = Math.max(0, number)
        } else if (word === 'u' && number !== null) {
          if (!ignore) {
            const code = number < 0 ? number + 65536 : number
            output += String.fromCharCode(code)
          }
          fallbackSkip = unicodeSkip
        } else if (!ignore) {
          if (word === 'bin' && number !== null && number > 0) {
            index = cursor + number
            justOpenedGroup = false
            continue
          }
          output += SYMBOLS[word] ?? ''
        }
        index = cursor
        justOpenedGroup = false
        continue
      }

      if (next === '*') {
        // Unknown destination group. Keep its visible text, but do not treat
        // the marker itself as content.
        index += 2
        justOpenedGroup = false
        continue
      }

      if (!ignore && (next === '\n' || next === '\r')) {
        index += 2
        continue
      }

      index += 2
      justOpenedGroup = false
      continue
    }

    if (char === '\r') {
      if (!ignore && input[index + 1] !== '\n') output += '\n'
      index += 1
      justOpenedGroup = false
      continue
    }
    if (char === '\n') {
      if (!ignore) output += '\n'
      index += 1
      justOpenedGroup = false
      continue
    }

    if (!ignore) output += char
    index += 1
    justOpenedGroup = false
  }

  return output
    .replace(/\u0000/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
