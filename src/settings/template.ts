import { PageType } from '@omnivore/api'
import { truncate } from 'lodash'
import Mustache from 'mustache'
import { parseYaml, stringifyYaml } from 'obsidian'
import { Article, HighlightType } from '../api'
import {
  compareHighlightsInFile,
  formatDate,
  formatHighlightQuote,
  getHighlightLocation,
  removeFrontMatterFromContent,
  siteNameFromUrl,
  snakeToCamelCase,
} from '../util'

type FunctionMap = {
  [key: string]: () => (
    text: string,
    render: (text: string) => string,
  ) => string
}

export const DEFAULT_TEMPLATE = `# {{{title}}}
#Omnivore

[Read on Omnivore]({{{omnivoreUrl}}})
[Read Original]({{{originalUrl}}})

{{#highlights.length}}
## Highlights

{{#highlights}}
> {{{text}}} [⤴️]({{{highlightUrl}}}) {{#labels}} #{{name}} {{/labels}} ^{{{highlightID}}}
{{#note}}

{{{note}}}
{{/note}}

{{/highlights}}
{{/highlights.length}}`

export interface LabelView {
  name: string
}

export interface HighlightView {
  text: string
  highlightUrl: string
  highlightID: string
  dateHighlighted: string
  note?: string
  labels?: LabelView[]
  color: string
  positionPercent: number
  positionAnchorIndex: number
}

export type ArticleView =
  | {
      id: string
      title: string
      omnivoreUrl: string
      siteName: string
      originalUrl: string
      author?: string
      labels?: LabelView[]
      dateSaved: string
      highlights: HighlightView[]
      content?: string
      datePublished?: string
      fileAttachment?: string
      description?: string
      note?: string
      type: PageType
      dateRead?: string
      wordsCount?: number
      readLength?: number
      state: string
      dateArchived?: string
      image?: string
      updatedAt: string
    }
  | FunctionMap

export type View =
  | {
      id: string
      title: string
      omnivoreUrl: string
      siteName: string
      originalUrl: string
      author: string
      date: string
      dateSaved: string
      datePublished?: string
      type: PageType
      dateRead?: string
      state: string
      dateArchived?: string
    }
  | FunctionMap

enum ArticleState {
  Inbox = 'INBOX',
  Reading = 'READING',
  Completed = 'COMPLETED',
  Archived = 'ARCHIVED',
}

const getArticleState = (article: Article): string => {
  if (article.isArchived) {
    return ArticleState.Archived
  }
  if (article.readingProgressPercent > 0) {
    return article.readingProgressPercent === 100
      ? ArticleState.Completed
      : ArticleState.Reading
  }

  return ArticleState.Inbox
}

function lowerCase() {
  return function (text: string, render: (text: string) => string) {
    return render(text).toLowerCase()
  }
}

function upperCase() {
  return function (text: string, render: (text: string) => string) {
    return render(text).toUpperCase()
  }
}

function upperCaseFirst() {
  return function (text: string, render: (text: string) => string) {
    const str = render(text)
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
  }
}

function formatDateFunc() {
  return function (text: string, render: (text: string) => string) {
    // get the date and format from the text
    const [dateVariable, format] = text.split(',', 2)
    const date = render(dateVariable)
    if (!date) {
      return ''
    }
    // format the date
    return formatDate(date, format)
  }
}

const functionMap: FunctionMap = {
  lowerCase,
  upperCase,
  upperCaseFirst,
  formatDate: formatDateFunc,
}

const getOmnivoreUrl = (article: Article) => {
  return `https://omnivore.app/me/${article.slug}`
}

export const renderFilename = (
  article: Article,
  filename: string,
  dateFormat: string,
) => {
  const renderedFilename = render(article, filename, dateFormat)

  // truncate the filename to 100 characters
  return truncate(renderedFilename, {
    length: 100,
  })
}

export const renderLabels = (labels?: LabelView[]) => {
  return labels?.map((l) => ({
    // replace spaces with underscores because Obsidian doesn't allow spaces in tags
    name: l.name.replaceAll(' ', '_'),
  }))
}

export const renderArticleContnet = async (
  article: Article,
  template: string,
  highlightOrder: string,
  dateHighlightedFormat: string,
  dateSavedFormat: string,
  isSingleFile: boolean,
  frontMatterVariables: string[],
  frontMatterTemplate: string,
  fileAttachment?: string,
) => {
  // filter out notes and redactions
  const articleHighlights =
    article.highlights?.filter((h) => h.type === HighlightType.Highlight) || []
  // sort highlights by location if selected in options
  if (highlightOrder === 'LOCATION') {
    articleHighlights.sort((a, b) => {
      try {
        if (article.pageType === 'FILE') {
          // sort by location in file
          return compareHighlightsInFile(a, b)
        }
        // for web page, sort by location in the page
        return getHighlightLocation(a.patch) - getHighlightLocation(b.patch)
      } catch (e) {
        console.error(e)
        return compareHighlightsInFile(a, b)
      }
    })
  }
  const highlights: HighlightView[] = articleHighlights.map((highlight) => {
    return {
      text: formatHighlightQuote(highlight.quote, template),
      highlightUrl: `https://omnivore.app/me/${article.slug}#${highlight.id}`,
      highlightID: highlight.id.slice(0, 8),
      dateHighlighted: highlight.updatedAt
        ? formatDate(highlight.updatedAt, dateHighlightedFormat)
        : '',
      note: highlight.annotation ?? undefined,
      labels: renderLabels(highlight.labels || []),
      color: highlight.color ?? 'yellow',
      positionPercent: highlight.highlightPositionPercent || 0,
      positionAnchorIndex: highlight.highlightPositionAnchorIndex
        ? highlight.highlightPositionAnchorIndex + 1
        : 0, // PDF page numbers start at 1
    }
  })
  const dateSaved = formatDate(article.savedAt, dateSavedFormat)
  const siteName =
    article.siteName || siteNameFromUrl(article.originalArticleUrl || '')
  const publishedAt = article.publishedAt
  const datePublished = publishedAt
    ? formatDate(publishedAt, dateSavedFormat).trim()
    : undefined
  const articleNote = article.highlights?.find(
    (h) => h.type === HighlightType.Note,
  )
  const dateRead = article.readAt
    ? formatDate(article.readAt, dateSavedFormat).trim()
    : undefined
  const wordsCount = article.wordsCount
  const readLength = wordsCount
    ? Math.round(Math.max(1, wordsCount / 235))
    : undefined
  const articleView: ArticleView = {
    id: article.id,
    title: article.title,
    omnivoreUrl: `https://omnivore.app/me/${article.slug}`,
    siteName,
    originalUrl: article.originalArticleUrl || article.url,
    author: article.author || 'unknown-author',
    labels: renderLabels(article.labels || []),
    dateSaved,
    highlights,
    content:
      article.contentReader === 'WEB'
        ? article.content || undefined
        : undefined,
    datePublished,
    fileAttachment,
    description: article.description || undefined,
    note: articleNote?.annotation ?? undefined,
    type: article.pageType,
    dateRead,
    wordsCount: article.wordsCount || undefined,
    readLength,
    state: getArticleState(article),
    dateArchived: article.archivedAt || undefined,
    image: article.image || undefined,
    updatedAt: article.updatedAt || '',
    ...functionMap,
  }

  let frontMatter: { [id: string]: unknown } = {
    id: article.id, // id is required for deduplication
  }

  // if the front matter template is set, use it
  if (frontMatterTemplate) {
    const frontMatterTemplateRendered = Mustache.render(
      frontMatterTemplate,
      articleView,
    )
    try {
      // parse the front matter template as yaml
      const frontMatterParsed = parseYaml(frontMatterTemplateRendered)

      frontMatter = {
        ...frontMatterParsed,
        ...frontMatter,
      }
    } catch (error) {
      // if there's an error parsing the front matter template, log it
      console.error('Error parsing front matter template', error)
      // and add the error to the front matter
      frontMatter = {
        ...frontMatter,
        omnivore_error:
          'There was an error parsing the front matter template. See console for details.',
      }
    }
  } else {
    // otherwise, use the front matter variables
    for (const item of frontMatterVariables) {
      // split the item into variable and alias
      const aliasedVariables = item.split('::')
      const variable = aliasedVariables[0]
      // we use snake case for variables in the front matter
      const articleVariable = snakeToCamelCase(variable)
      // use alias if available, otherwise use variable
      const key = aliasedVariables[1] || variable
      if (
        variable === 'tags' &&
        articleView.labels &&
        articleView.labels.length > 0
      ) {
        // tags are handled separately
        // use label names as tags
        frontMatter[key] = articleView.labels.map((l) => l.name)
        continue
      }

      const value = (articleView as any)[articleVariable]
      if (value) {
        // if variable is in article, use it
        frontMatter[key] = value
      }
    }
  }

  // Build content string based on template
  const content = Mustache.render(template, articleView)
  let contentWithoutFrontMatter = removeFrontMatterFromContent(content)
  let frontMatterYaml = stringifyYaml(frontMatter)
  if (isSingleFile) {
    // wrap the content without front matter in comments
    const sectionStart = `%%${article.id}_start%%`
    const sectionEnd = `%%${article.id}_end%%`
    contentWithoutFrontMatter = `${sectionStart}\n${contentWithoutFrontMatter}\n${sectionEnd}`

    // if single file, wrap the front matter in an array
    frontMatterYaml = stringifyYaml([frontMatter])
  }

  const frontMatterStr = `---\n${frontMatterYaml}---`

  return `${frontMatterStr}\n\n${contentWithoutFrontMatter}`
}

export const render = (
  article: Article,
  template: string,
  dateFormat: string,
) => {
  const dateSaved = formatDate(article.savedAt, dateFormat)
  const datePublished = article.publishedAt
    ? formatDate(article.publishedAt, dateFormat).trim()
    : undefined
  const dateArchived = article.archivedAt
    ? formatDate(article.archivedAt, dateFormat).trim()
    : undefined
  const dateRead = article.readAt
    ? formatDate(article.readAt, dateFormat).trim()
    : undefined
  const view: View = {
    ...article,
    siteName:
      article.siteName || siteNameFromUrl(article.originalArticleUrl || ''),
    author: article.author || 'unknown-author',
    omnivoreUrl: getOmnivoreUrl(article),
    originalUrl: article.originalArticleUrl || article.url,
    date: dateSaved,
    dateSaved,
    datePublished,
    dateArchived,
    dateRead,
    type: article.pageType,
    state: getArticleState(article),
    ...functionMap,
  }
  return Mustache.render(template, view)
}

export const preParseTemplate = (template: string) => {
  return Mustache.parse(template)
}
