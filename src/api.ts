import {
  Omnivore,
  OmnivoreErrorCode,
  PageType,
  isOmnivoreError,
} from '@omnivore-app/api'
import { requestUrl } from 'obsidian'

export interface SearchResponse {
  data: {
    search: {
      edges: { node: Article }[]
      pageInfo: {
        hasNextPage: boolean
      }
    }
  }
}

export interface DeleteArticleResponse {
  data: {
    setBookmarkArticle: {
      bookmarkedArticle: {
        id: string
      }
    }
  }
}

// export enum PageType {
//   Article = 'ARTICLE',
//   Book = 'BOOK',
//   File = 'FILE',
//   Profile = 'PROFILE',
//   Unknown = 'UNKNOWN',
//   Website = 'WEBSITE',
//   Tweet = 'TWEET',
//   Video = 'VIDEO',
//   Image = 'IMAGE',
// }

export interface Article {
  id: string
  title: string
  siteName: string | null
  originalArticleUrl: string | null
  author?: string | null
  description?: string | null
  slug: string
  labels?: Label[] | null
  highlights?: Highlight[] | null
  updatedAt: string | null
  savedAt: string
  pageType: PageType
  content: string | null
  publishedAt?: string | null
  url: string
  image?: string | null
  readAt?: string | null
  wordsCount?: number | null
  readingProgressPercent: number
  isArchived: boolean
  archivedAt?: string | null
  contentReader?: string | null
}

export interface Label {
  name: string
}

export enum HighlightType {
  Highlight = 'HIGHLIGHT',
  Note = 'NOTE',
  Redaction = 'REDACTION',
}

export interface Highlight {
  id: string
  quote: string | null
  annotation: string | null
  patch: string | null
  updatedAt: string | null
  labels?: Label[] | null
  type: 'HIGHLIGHT' | 'NOTE' | 'REDACTION'
  highlightPositionPercent: number | null
  color?: string | null
  highlightPositionAnchorIndex: number | null
}

const requestHeaders = (apiKey: string) => ({
  'Content-Type': 'application/json',
  authorization: apiKey,
  'X-OmnivoreClient': 'obsidian-plugin',
})

export const loadArticles = async (
  endpoint: string,
  apiKey: string,
  after = 0,
  first = 10,
  updatedAt = '',
  query = '',
  includeContent = false,
  format = 'html',
): Promise<[Article[], boolean]> => {
  // const res = await requestUrl({
  //   url: endpoint,
  //   headers: requestHeaders(apiKey),
  //   body: JSON.stringify({
  //     query: `
  //       query Search($after: String, $first: Int, $query: String, $includeContent: Boolean, $format: String) {
  //         search(first: $first, after: $after, query: $query, includeContent: $includeContent, format: $format) {
  //           ... on SearchSuccess {
  //             edges {
  //               node {
  //                 id
  //                 title
  //                 slug
  //                 siteName
  //                 originalArticleUrl
  //                 url
  //                 image
  //                 author
  //                 updatedAt
  //                 description
  //                 savedAt
  //                 pageType
  //                 content
  //                 publishedAt
  //                 readAt
  //                 wordsCount
  //                 isArchived
  //                 readingProgressPercent
  //                 archivedAt
  //                 contentReader
  //                 highlights {
  //                   id
  //                   quote
  //                   annotation
  //                   patch
  //                   updatedAt
  //                   type
  //                   highlightPositionPercent
  //                   highlightPositionAnchorIndex
  //                   labels {
  //                     name
  //                   }
  //                   color
  //                 }
  //                 labels {
  //                   name
  //                 }
  //               }
  //             }
  //             pageInfo {
  //               hasNextPage
  //             }
  //           }
  //           ... on SearchError {
  //             errorCodes
  //           }
  //         }
  //       }`,
  //     variables: {
  //       after: `${after}`,
  //       first,
  //       query: `${
  //         updatedAt ? 'updated:' + updatedAt : ''
  //       } sort:saved-asc ${query}`,
  //       includeContent,
  //       format,
  //     },
  //   }),
  //   method: 'POST',
  // })

  // const jsonRes = res.json as SearchResponse
  // const articles = jsonRes.data.search.edges.map((e) => e.node)

  // return [articles, jsonRes.data.search.pageInfo.hasNextPage]

  const omnivore = new Omnivore({
    authToken: apiKey,
    baseUrl: endpoint,
    timeoutMs: 10000,
  })

  try {
    const response = await omnivore.items.search({
      after: `${after}`,
      first,
      query: `${updatedAt ? 'updated:' + updatedAt : ''} sort:saved-asc ${query}`,
      includeContent,
      format: format as 'html' | 'markdown',
    })

    const articles = response.edges.map((e) => e.node)
    return [articles, response.pageInfo.hasNextPage]
  } catch (error: unknown) {
    if (isOmnivoreError(error)) {
      switch (error.code) {
        case OmnivoreErrorCode.GraphQLError:
          console.error('GraphQL error:', error)
          break
        case OmnivoreErrorCode.NetworkError:
          console.error('Network error:', error)
          break
      }
    }
  }

  return [[], false]
}

export const deleteArticleById = async (
  endpoint: string,
  apiKey: string,
  articleId: string,
) => {
  const res = await requestUrl({
    url: endpoint,
    headers: requestHeaders(apiKey),
    body: JSON.stringify({
      query: `
              mutation SetBookmarkArticle($input: SetBookmarkArticleInput!) {
                  setBookmarkArticle(input: $input) {
                      ... on SetBookmarkArticleSuccess {
                          bookmarkedArticle {
                              id
                          }
                      }
                      ... on SetBookmarkArticleError {
                          errorCodes
                      }
                  }
              }`,
      variables: {
        input: {
          articleID: articleId,
          bookmark: false,
        },
      },
    }),
    method: 'POST',
  })

  const jsonRes = res.json as DeleteArticleResponse
  if (jsonRes.data.setBookmarkArticle.bookmarkedArticle.id === articleId) {
    return true
  }

  return false
}
