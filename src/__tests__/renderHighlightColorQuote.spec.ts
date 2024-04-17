import { HighlightRenderOption, formatHighlightQuote } from '../util'
import { HighlightManagerId } from '../settings'

type testCase = {
  quote: string
  template: string
  highlightRenderOption: HighlightRenderOption | null
  expected: string
}

const quote = 'some quote'
const color = 'red'
const templateWithoutBlockQuote = `{{#highlights}}
{{{text}}} 
{{/highlights}}`
const templateWithBlockQuote = `{{#highlights}}
> {{{text}}} 
{{/highlights}}`

const blockQuoteNoHighlightRenderOption = {
  quote: quote,
  template: templateWithBlockQuote,
  highlightRenderOption: null,
  expected: quote,
}

const noBlockQuoteNoHighlightRenderOption = {
  quote: quote,
  template: templateWithoutBlockQuote,
  highlightRenderOption: null,
  expected: quote,
}

const blockQuoteOmnivoreRenderOption = {
  quote: quote,
  template: templateWithBlockQuote,
  highlightRenderOption: {
    highlightManagerId: HighlightManagerId.OMNIVORE,
    highlightColor: color,
  },
  expected: `<mark class="${HighlightManagerId.OMNIVORE} ${HighlightManagerId.OMNIVORE}-${color}">${quote}</mark>`,
}

const blockQuoteMultiLineOmnivoreRenderOption = {
  quote: `${quote}
${quote}`,
  template: templateWithBlockQuote,
  highlightRenderOption: {
    highlightManagerId: HighlightManagerId.OMNIVORE,
    highlightColor: color,
  },
  expected: `<mark class="${HighlightManagerId.OMNIVORE} ${HighlightManagerId.OMNIVORE}-${color}">${quote}</mark>
><mark class="${HighlightManagerId.OMNIVORE} ${HighlightManagerId.OMNIVORE}-${color}"> ${quote}</mark>`,
}

const blockQuoteHighlightrRenderOption = {
  quote: quote,
  template: templateWithBlockQuote,
  highlightRenderOption: {
    highlightManagerId: HighlightManagerId.HIGHLIGHTR,
    highlightColor: color,
  },
  expected: `<mark class="${HighlightManagerId.HIGHLIGHTR}-${color}">${quote}</mark>`,
}

const noBlockQuoteMultiLineOmnivoreRenderOption = {
  quote: `${quote}
${quote}`,
  template: templateWithoutBlockQuote,
  highlightRenderOption: {
    highlightManagerId: HighlightManagerId.OMNIVORE,
    highlightColor: color,
  },
  expected: `<mark class="${HighlightManagerId.OMNIVORE} ${HighlightManagerId.OMNIVORE}-${color}">${quote}</mark>
<mark class="${HighlightManagerId.OMNIVORE} ${HighlightManagerId.OMNIVORE}-${color}">${quote}</mark>`,
}

const blockQuoteEmptyLineOmnivoreRenderOption = {
  quote: `${quote}
  `,
  template: templateWithBlockQuote,
  highlightRenderOption: {
    highlightManagerId: HighlightManagerId.OMNIVORE,
    highlightColor: color,
  },
  expected: `<mark class="${HighlightManagerId.OMNIVORE} ${HighlightManagerId.OMNIVORE}-${color}">${quote}</mark>
>`,
}

const testCases: testCase[] = [
  blockQuoteNoHighlightRenderOption,
  noBlockQuoteNoHighlightRenderOption,
  blockQuoteOmnivoreRenderOption,
  blockQuoteMultiLineOmnivoreRenderOption,
  blockQuoteHighlightrRenderOption,
  noBlockQuoteMultiLineOmnivoreRenderOption,
  blockQuoteEmptyLineOmnivoreRenderOption,
]

describe('formatHighlightQuote', () => {
  test.each(testCases)('should correctly for format %s', (testCase) => {
    const result = formatHighlightQuote(
      testCase.quote,
      testCase.template,
      testCase.highlightRenderOption,
    )
    expect(result).toBe(testCase.expected)
  })
})
