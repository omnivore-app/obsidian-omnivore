import * as fs from 'fs'
import {
  ILLEGAL_CHAR_REGEX_FILE,
  replaceIllegalCharsFile,
  replaceIllegalCharsFolder,
  REPLACEMENT_CHAR,
} from '../util'

const expectedManualIllegalCharsInFolderName: string[] = [
  '\\',
  '?',
  '*',
  ':',
  '|',
  '"',
  '<',
  '>',
  '\u0000',
  '\u001F',
]

// Adding forward slash too which is not allowed in file names
const expectedManualIllegalChars =
  expectedManualIllegalCharsInFolderName.concat(['/'])

// ZERO WIDTH JOINER and SOFT HYPHEN
const expectedInvisibleChars: string[] = ['­', '‍']

describe('replaceIllegalCharsFolder() does not replace forward slash', () => {
  test('Forward slash is not replaced', () => {
    const input = 'this/that'
    const output = replaceIllegalCharsFolder(input)
    expect(output).toEqual(input)
  })
})

describe('replaceIllegalCharsFolder() removes all expected characters', () => {
  test.each(expectedManualIllegalCharsInFolderName)(
    'Illegal character "%s" is removed',
    (character) => {
      const input = `this${character}string`
      const output = replaceIllegalCharsFolder(input)
      expect(output).not.toContain(character)
    },
  )
})

describe('replaceIllegalCharsFile() removes all expected characters', () => {
  test.each(expectedManualIllegalChars)(
    'Illegal character "%s" is removed',
    (character) => {
      const input = `this${character}string`
      const output = replaceIllegalCharsFile(input)
      expect(output).not.toContain(character)
    },
  )
})

describe('replaceIllegalCharsFile() function replaces illegal characters with replacement char', () => {
  test.each(expectedManualIllegalChars)(
    "Illegal character '%s' is replaced",
    (char) => {
      const input = `this${char}string`
      const expectedOutput = `this${REPLACEMENT_CHAR}string`
      const output = replaceIllegalCharsFile(input)
      expect(output).toEqual(expectedOutput)
    },
  )
})

describe('replaceIllegalCharsFile() function does not modify string without illegal characters', () => {
  test.each(['this_is_a_valid_string', 'this is a valid string'])(
    "String '%s' is not modified",
    (input) => {
      const output = replaceIllegalCharsFile(input)
      expect(output).toEqual(input)
    },
  )
})

describe('replaceIllegalCharsFile() function handles empty string', () => {
  test('Empty string is not modified', () => {
    const input = ''
    const output = replaceIllegalCharsFile(input)
    expect(output).toEqual(input)
  })
})

describe('replaceIllegalCharsFile() function replaces all occurrences of illegal characters', () => {
  test.each(expectedManualIllegalChars)(
    "Illegal character '%s' is replaced",
    (char) => {
      const input = `${char}foo${char}bar`
      const expectedOutput = `${REPLACEMENT_CHAR}foo${REPLACEMENT_CHAR}bar`
      const output = replaceIllegalCharsFile(input)
      expect(output).toEqual(expectedOutput)
      expect(output.match(ILLEGAL_CHAR_REGEX_FILE)).toBeNull()
    },
  )
})

describe('file system behavior with non-alphanumeric characters not in the illegal character list', () => {
  const nonAlphanumericCharactersWithoutIllegal: string[] = Array.from(
    { length: 127 - 32 },
    (_, i) => String.fromCharCode(i + 32),
  )
    .filter((char) => !/^[a-zA-Z0-9]+$/.test(char))
    .map(replaceIllegalCharsFile)

  test.each(nonAlphanumericCharactersWithoutIllegal)(
    "File system allows creation of file with character '%s'",
    (char) => {
      const input = `test${char}test.txt`
      // verify file does not already exist
      expect(fs.existsSync(input)).toBe(false)
      fs.writeFileSync(input, 'test')
      // verify the file exists
      expect(fs.existsSync(input)).toBe(true)
      // remove the file
      fs.unlinkSync(input)
      // verify the file has been deleted
      expect(fs.existsSync(input)).toBe(false)
    },
  )
})

describe('replaceIllegalCharsFile() function removes all occurrences of invisible characters', () => {
  test.each(expectedInvisibleChars)(
    "Invisible character '%s' is replaced",
    (char) => {
      const input = `${char}foo${char}bar`
      const expectedOutput = 'foobar'
      const output = replaceIllegalCharsFile(input)
      expect(output).toEqual(expectedOutput)
      expect(output.match(ILLEGAL_CHAR_REGEX_FILE)).toBeNull()
    },
  )
})
