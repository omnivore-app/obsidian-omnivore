import { diff_match_patch } from "diff-match-patch";
import { DateTime } from "luxon";
import escape from "markdown-escape";
import { requestUrl } from "obsidian";

export const DATE_FORMAT_W_OUT_SECONDS = "yyyy-MM-dd'T'HH:mm";
export const DATE_FORMAT = `${DATE_FORMAT_W_OUT_SECONDS}:ss`;

export interface GetArticleResponse {
  data: {
    article: {
      article: Article;
    };
  };
}

export interface SearchResponse {
  data: {
    search: {
      edges: { node: Article }[];
      pageInfo: {
        hasNextPage: boolean;
      };
    };
  };
}

export enum UpdateReason {
  CREATED = "CREATED",
  UPDATED = "UPDATED",
  DELETED = "DELETED",
}

export interface UpdatesSinceResponse {
  data: {
    updatesSince: {
      edges: { updateReason: UpdateReason; node: { slug: string } }[];
      pageInfo: {
        hasNextPage: boolean;
      };
    };
  };
}

export enum PageType {
  Article = "ARTICLE",
  Book = "BOOK",
  File = "FILE",
  Profile = "PROFILE",
  Unknown = "UNKNOWN",
  Website = "WEBSITE",
  Highlights = "HIGHLIGHTS",
}

export interface Article {
  id: string;
  title: string;
  siteName: string;
  originalArticleUrl: string;
  author: string;
  description: string;
  slug: string;
  labels?: Label[];
  highlights?: Highlight[];
  updatedAt: string;
  savedAt: string;
  pageType: PageType;
  content?: string;
  publishedAt: string;
}

export interface Label {
  name: string;
}

export interface Highlight {
  id: string;
  quote: string;
  annotation: string;
  patch: string;
  updatedAt: string;
}

export interface HighlightPoint {
  left: number;
  top: number;
}

const ENDPOINT = "https://api-prod.omnivore.app/api/graphql";
const requestHeaders = (apiKey: string) => ({
  "Content-Type": "application/json",
  authorization: apiKey,
  "X-OmnivoreClient": "obsidian-plugin",
});

export const loadArticle = async (
  slug: string,
  apiKey: string
): Promise<Article> => {
  const res = await requestUrl({
    url: ENDPOINT,
    headers: requestHeaders(apiKey),
    body: `{"query":"\\n  query GetArticle(\\n    $username: String!\\n    $slug: String!\\n  ) {\\n    article(username: $username, slug: $slug) {\\n      ... on ArticleSuccess {\\n        article {\\n          ...ArticleFields\\n          highlights {\\n            ...HighlightFields\\n          }\\n          labels {\\n            ...LabelFields\\n          }\\n        }\\n      }\\n      ... on ArticleError {\\n        errorCodes\\n      }\\n    }\\n  }\\n  \\n  fragment ArticleFields on Article {\\n    savedAt\\n  }\\n\\n  \\n  fragment HighlightFields on Highlight {\\n  id\\n  quote\\n  annotation\\n  }\\n\\n  \\n  fragment LabelFields on Label {\\n    name\\n  }\\n\\n","variables":{"username":"me","slug":"${slug}"}}`,
    method: "POST",
  });
  const response = res.json as GetArticleResponse;

  return response.data.article.article;
};

export const loadArticles = async (
  endpoint: string,
  apiKey: string,
  after = 0,
  first = 10,
  updatedAt = "",
  query = "",
  includeContent = false,
  format = "html"
): Promise<[Article[], boolean]> => {
  const res = await requestUrl({
    url: endpoint,
    headers: requestHeaders(apiKey),
    body: JSON.stringify({
      query: `
        query Search($after: String, $first: Int, $query: String, $includeContent: Boolean, $format: String) {
          search(first: $first, after: $after, query: $query, includeContent: $includeContent, format: $format) {
            ... on SearchSuccess {
              edges {
                node {
                  id
                  title
                  slug
                  siteName
                  originalArticleUrl
                  url
                  author
                  updatedAt
                  description
                  savedAt
                  pageType
                  content
                  publishedAt
                  highlights {
                    id
                    quote
                    annotation
                    patch
                    updatedAt
                    labels {
                      name
                    }
                  }
                  labels {
                    name
                  }
                }
              }
              pageInfo {
                hasNextPage
              }
            }
            ... on SearchError {
              errorCodes
            }
          }
        }`,
      variables: {
        after: `${after}`,
        first,
        query: `${
          updatedAt ? "updated:" + updatedAt : ""
        } sort:saved-asc ${query}`,
        includeContent,
        format,
      },
    }),
    method: "POST",
  });

  const jsonRes = res.json as SearchResponse;
  const articles = jsonRes.data.search.edges.map((e) => e.node);

  return [articles, jsonRes.data.search.pageInfo.hasNextPage];
};

export const loadDeletedArticleSlugs = async (
  endpoint: string,
  apiKey: string,
  after = 0,
  first = 10,
  updatedAt = ""
): Promise<[string[], boolean]> => {
  const res = await requestUrl({
    url: endpoint,
    headers: requestHeaders(apiKey),
    body: `{"query":"\\n    query UpdatesSince($after: String, $first: Int, $since: Date!) {\\n      updatesSince(first: $first, after: $after, since: $since) {\\n        ... on UpdatesSinceSuccess {\\n          edges {\\n       updateReason\\n        node {\\n              slug\\n        }\\n          }\\n          pageInfo {\\n            hasNextPage\\n          }\\n        }\\n        ... on UpdatesSinceError {\\n          errorCodes\\n        }\\n      }\\n    }\\n  ","variables":{"after":"${after}","first":${first}, "since":"${
      updatedAt || "2021-01-01"
    }"}}`,
    method: "POST",
  });

  const jsonRes = res.json as UpdatesSinceResponse;
  const deletedArticleSlugs = jsonRes.data.updatesSince.edges
    .filter((edge) => edge.updateReason === UpdateReason.DELETED)
    .map((edge) => edge.node.slug);

  return [deletedArticleSlugs, jsonRes.data.updatesSince.pageInfo.hasNextPage];
};

export const getHighlightLocation = (patch: string): number => {
  const dmp = new diff_match_patch();
  const patches = dmp.patch_fromText(patch);
  return patches[0].start1 || 0;
};

export const getHighlightPoint = (patch: string): HighlightPoint => {
  const { bbox } = JSON.parse(patch) as { bbox: number[] };
  if (!bbox || bbox.length !== 4) {
    return { left: 0, top: 0 };
  }
  return { left: bbox[0], top: bbox[1] };
};

export const compareHighlightsInFile = (a: Highlight, b: Highlight): number => {
  // get the position of the highlight in the file
  const highlightPointA = getHighlightPoint(a.patch);
  const highlightPointB = getHighlightPoint(b.patch);
  if (highlightPointA.top === highlightPointB.top) {
    // if top is same, sort by left
    return highlightPointA.left - highlightPointB.left;
  }
  // sort by top
  return highlightPointA.top - highlightPointB.top;
};

export const markdownEscape = (text: string): string => {
  try {
    return escape(text);
  } catch (e) {
    console.error("markdownEscape error", e);
    return text;
  }
};

export const escapeQuotationMarks = (text: string): string => {
  return text.replace(/"/g, '\\"');
};

export const parseDateTime = (str: string): DateTime => {
  const res = DateTime.fromFormat(str, DATE_FORMAT);
  if (res.isValid) {
    return res;
  }
  return DateTime.fromFormat(str, DATE_FORMAT_W_OUT_SECONDS);
};

export const wrapAround = (value: number, size: number): number => {
  return ((value % size) + size) % size;
};

export const unicodeSlug = (str: string, savedAt: string) => {
  return (
    str
      .normalize("NFKD") // using NFKD method returns the Unicode Normalization Form of a given string.
      .replace(/[\u0300-\u036f]/g, "") // remove all previously split accents
      .trim()
      .toLowerCase()
      .replace(
        /[\u2000-\u206F\u2E00-\u2E7F\\'!"#$%&()*+,./:;<=>?@[\]^`{|}~]/g,
        ""
      ) // replace all the symbols with -
      .replace(/\s+/g, "-") // collapse whitespace and replace by -
      .replace(/_/g, "-") // replace _ with -
      .replace(/-+/g, "-") // collapse dashes
      // remove trailing -
      .replace(/-$/g, "")
      .substring(0, 64) +
    "-" +
    new Date(savedAt).getTime().toString(16)
  );
};

export const replaceIllegalChars = (str: string): string => {
  return str.replace(/[/\\?%*:|"<>]/g, "-");
};

export const formatDate = (date: string, format: string): string => {
  return DateTime.fromISO(date).toFormat(format);
};
