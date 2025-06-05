import { Item, ItemFormat, Omnivore } from '@omnivore-app/api'
import { requestUrl } from 'obsidian'

export enum HighlightColors {
  Yellow = 'yellow',
  Red = 'red',
  Green = 'green',
  Blue = 'blue',
}

interface GetContentResponse {
  data: {
    libraryItemId: string
    downloadUrl: string
    error?: string
  }[]
}

export const baseUrl = (endpoint: string) => endpoint.replace(/\/api\/graphql$/, '')

const getContent = async (
  endpoint: string,
  apiKey: string,
  libraryItemIds: string[],
): Promise<GetContentResponse> => {
  const response = await requestUrl({
    url: `${baseUrl(endpoint)}/api/content`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: apiKey,
    },
    body: JSON.stringify({ libraryItemIds, format: 'highlightedMarkdown' }),
  })

  return response.json
}

const downloadFromUrl = async (url: string): Promise<string> => {
  try {
    // polling until download is ready or failed
    const response = await requestUrl({
      url,
    })
    return response.text
  } catch (error) {
    // retry after 1 second if download returns 404
    if (error.status === 404) {
      await sleep(1000)
      return downloadFromUrl(url)
    }

    throw error
  }
}

const fetchContentForItems = async (
  endpoint: string,
  apiKey: string,
  items: Item[],
) => {
  const content = await getContent(
    endpoint,
    apiKey,
    items.map((a) => a.id),
  )

  await Promise.allSettled(
    content.data.map(async (c) => {
      if (c.error) {
        console.error('Error fetching content', c.error)
        return
      }

      const item = items.find((i) => i.id === c.libraryItemId)
      if (!item) {
        console.error('Item not found', c.libraryItemId)
        return
      }

      // timeout if download takes too long
      item.content = await Promise.race([
        downloadFromUrl(c.downloadUrl),
        new Promise<string>(
          (_, reject) => setTimeout(() => reject('Timeout'), 600_000), // 10 minutes
        ),
      ])
    }),
  )
}

export const getItems = async (
  endpoint: string,
  apiKey: string,
  after = 0,
  first = 10,
  updatedAt = '',
  query = '',
  includeContent = false,
  format: ItemFormat = 'html',
): Promise<[Item[], boolean]> => {
  const omnivore = new Omnivore({
    authToken: apiKey,
    baseUrl: baseUrl(endpoint),
    timeoutMs: 10000, // 10 seconds
  })

  const response = await omnivore.items.search({
    after,
    first,
    query: `${updatedAt ? 'updated:' + updatedAt : ''} sort:saved-asc ${query}`,
    includeContent: false,
    format,
  })

  const items = response.edges.map((e) => e.node)
  if (includeContent && items.length > 0) {
    try {
      await fetchContentForItems(endpoint, apiKey, items)
    } catch (error) {
      console.error('Error fetching content', error)
    }
  }

  return [items, response.pageInfo.hasNextPage]
}

export const deleteItem = async (
  endpoint: string,
  apiKey: string,
  articleId: string,
) => {
  const omnivore = new Omnivore({
    authToken: apiKey,
    baseUrl: baseUrl(endpoint),
    timeoutMs: 10000, // 10 seconds
  })

  await omnivore.items.delete({ id: articleId })

  return true
}
