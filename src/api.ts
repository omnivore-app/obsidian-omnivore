import { Item, ItemFormat, Omnivore } from '@omnivore-app/api'

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
    baseUrl: endpoint,
    timeoutMs: 10000, // 10 seconds
  })

  const response = await omnivore.items.search({
    after,
    first,
    query: `${updatedAt ? 'updated:' + updatedAt : ''} sort:saved-asc ${query}`,
    includeContent,
    format,
  })

  const articles = response.edges.map((e) => e.node)
  return [articles, response.pageInfo.hasNextPage]
}

export const deleteItem = async (
  endpoint: string,
  apiKey: string,
  articleId: string,
) => {
  const omnivore = new Omnivore({
    authToken: apiKey,
    baseUrl: endpoint,
    timeoutMs: 10000, // 10 seconds
  })

  await omnivore.items.delete({ id: articleId })

  return true
}
