import { DateTime } from 'luxon'
import { DEFAULT_SETTINGS } from '../settings'
import { formatDate } from '../util'

const jsDate = new Date('2023-02-18 13:02:08.169')
const apiDate = jsDate.toISOString() // API returns ISO 8601 date strings

type testCase = {
  format: string
  date: string
  expected: string
}

const luxonHierarchicalFormatWithTime = {
  date: apiDate,
  expected: '2023/2023-02/2023-02-18/130208',
  format: 'yyyy/yyyy-MM/yyyy-MM-dd/HHmmss',
}
const luxonHierarchicalFormat = {
  date: apiDate,
  expected: '2023/2023-02/2023-02-18',
  format: 'yyyy/yyyy-MM/yyyy-MM-dd',
}
const defaultDateHighlightedFormatTestCase: testCase = {
  date: apiDate,
  expected: '2023-02-18 13:02:08',
  format: DEFAULT_SETTINGS.dateHighlightedFormat,
}
const defaultDateSavedFormatTestCase: testCase = {
  date: apiDate,
  expected: '2023-02-18 13:02:08',
  format: DEFAULT_SETTINGS.dateSavedFormat,
}
const defaultFolderDateFormatTestCase: testCase = {
  date: apiDate,
  expected: '2023-02-18',
  format: DEFAULT_SETTINGS.folderDateFormat,
}
const testCases: testCase[] = [
  defaultDateHighlightedFormatTestCase,
  defaultDateSavedFormatTestCase,
  defaultFolderDateFormatTestCase,
  luxonHierarchicalFormat,
  luxonHierarchicalFormatWithTime,
]
describe('ensure default formats are as expected', () => {
  test('dateHighlightedFormat', () => {
    expect(DEFAULT_SETTINGS.dateHighlightedFormat).toBe('yyyy-MM-dd HH:mm:ss')
  })
  test('dateSavedFormat', () => {
    expect(DEFAULT_SETTINGS.dateSavedFormat).toBe('yyyy-MM-dd HH:mm:ss')
  })
  test('folderDateFormat', () => {
    expect(DEFAULT_SETTINGS.folderDateFormat).toBe('yyyy-MM-dd')
  })
})

describe('formatDate on known formats', () => {
  test.each(testCases)('should correctly format %s', (testCase) => {
    const result = formatDate(testCase.date, testCase.format)
    expect(result).toBe(testCase.expected)
  })
})

function generateRandomISODateStrings(quantity: number): string[] {
  const randomISODateStrings: string[] = []
  const timeZones = Intl.DateTimeFormat().resolvedOptions().timeZone.split(',')

  for (let i = 0; i < quantity; i++) {
    const date = new Date(
      Date.UTC(
        Math.floor(Math.random() * (2038 - 1970) + 1970),
        Math.floor(Math.random() * 12),
        Math.floor(Math.random() * 28),
        Math.floor(Math.random() * 24),
        Math.floor(Math.random() * 60),
        Math.floor(Math.random() * 60),
        Math.floor(Math.random() * 1000),
      ),
    )

    // Randomly select a timezone from the available time zones
    const randomTimeZone =
      timeZones[Math.floor(Math.random() * timeZones.length)]

    // Convert the generated date to the randomly selected timezone
    // const dateTimeWithZone = DateTime.fromJSDate(date, { zone: randomTimeZone }).toUTC();
    const jsDateTimeWithZone = new Date(
      date.toLocaleString('en-US', { timeZone: randomTimeZone }),
    )
    const luxonDate = DateTime.fromJSDate(jsDateTimeWithZone)
    randomISODateStrings.push(luxonDate.toISO() as string)
  }

  return randomISODateStrings
}

describe('formatDate on random dates', () => {
  test.each(generateRandomISODateStrings(100))(
    'should correctly format %s',
    (date) => {
      const result = formatDate(date, 'yyyy-MM-dd HH:mm:ss')
      // test with regex to ensure the format is correct
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    },
  )
})

function getCasesWithRandomDates(
  testFormats: string[],
  quantity = 10,
): {
  date: string
  luxonFormat: string
}[] {
  return testFormats.flatMap((luxonFormat) =>
    generateRandomISODateStrings(quantity).map((date) => ({
      date,
      luxonFormat,
    })),
  )
}

describe('round trip on random dates', () => {
  const testFormats = [
    defaultDateHighlightedFormatTestCase.format,
    defaultDateSavedFormatTestCase.format,
    defaultFolderDateFormatTestCase.format,
  ]
  // generate permutations of testCases.formats and 10 generated each
  const casesWithRandomDates = getCasesWithRandomDates(testFormats)
  test.each(casesWithRandomDates)(
    'should be unchanged after round trip %s',
    (testCase) => {
      const result = formatDate(testCase.date, testCase.luxonFormat)
      const result2 = formatDate(result, testCase.luxonFormat)
      expect(result2).toBe(result)
    },
  )

  const atypicalFormats = [
    luxonHierarchicalFormat.format,
    luxonHierarchicalFormatWithTime.format,
  ]
  test.each(getCasesWithRandomDates(atypicalFormats))(
    'should be unchanged after round trip with atypical format %s',
    (testCase) => {
      const formattedDate = formatDate(testCase.date, testCase.luxonFormat)
      const parsedDate = DateTime.fromFormat(
        formattedDate,
        testCase.luxonFormat,
      )
      expect(parsedDate.isValid).toBe(true)
    },
  )
})
