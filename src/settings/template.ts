import { truncate } from "lodash";
import Mustache from "mustache";
import { stringifyYaml } from "obsidian";
import { Article, HighlightType, PageType } from "../api";
import {
  compareHighlightsInFile,
  formatDate,
  formatHighlightQuote,
  getHighlightLocation,
  removeFrontMatterFromContent,
  siteNameFromUrl,
} from "../util";

type FunctionMap = {
  [key: string]: () => (
    text: string,
    render: (text: string) => string
  ) => string;
};

export const DEFAULT_TEMPLATE = `# {{{title}}}
#Omnivore

[Read on Omnivore]({{{omnivoreUrl}}})
[Read Original]({{{originalUrl}}})

{{#highlights.length}}
## Highlights

{{#highlights}}
> {{{text}}} [⤴️]({{{highlightUrl}}}) {{#labels}} #{{name}} {{/labels}}
{{#note}}

{{{note}}}
{{/note}}

{{/highlights}}
{{/highlights.length}}`;

export interface LabelView {
  name: string;
}

export interface HighlightView {
  text: string;
  highlightUrl: string;
  dateHighlighted: string;
  note?: string;
  labels?: LabelView[];
}

export type ArticleView =
  | {
      id: string;
      title: string;
      omnivoreUrl: string;
      siteName: string;
      originalUrl: string;
      author?: string;
      labels?: LabelView[];
      dateSaved: string;
      highlights: HighlightView[];
      content: string;
      datePublished?: string;
      fileAttachment?: string;
      description?: string;
      note?: string;
      type: PageType;
      dateRead?: string;
      wordsCount?: number;
      readLength?: number;
      state: string;
      dateArchived?: string;
    }
  | FunctionMap;

enum ArticleState {
  Inbox = "INBOX",
  Reading = "READING",
  Completed = "COMPLETED",
  Archived = "ARCHIVED",
}

const getArticleState = (article: Article): string => {
  if (article.isArchived) {
    return ArticleState.Archived;
  }
  if (article.readingProgressPercent > 0) {
    return article.readingProgressPercent === 100
      ? ArticleState.Completed
      : ArticleState.Reading;
  }

  return ArticleState.Inbox;
};

function lowerCase() {
  return function (text: string, render: (text: string) => string) {
    return render(text).toLowerCase();
  };
}

function upperCase() {
  return function (text: string, render: (text: string) => string) {
    return render(text).toUpperCase();
  };
}

function upperCaseFirst() {
  return function (text: string, render: (text: string) => string) {
    const str = render(text);
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  };
}

const functionMap: FunctionMap = {
  lowerCase,
  upperCase,
  upperCaseFirst,
};

export const renderFilename = (
  article: Article,
  filename: string,
  folderDateFormat: string
) => {
  const date = formatDate(article.savedAt, folderDateFormat);
  const renderedFilename = Mustache.render(filename, {
    ...article,
    date,
  });

  // truncate the filename to 100 characters
  return truncate(renderedFilename, {
    length: 100,
  });
};

export const renderAttachmentFolder = (
  article: Article,
  attachmentFolder: string,
  folderDateFormat: string
) => {
  const date = formatDate(article.savedAt, folderDateFormat);
  return Mustache.render(attachmentFolder, {
    ...article,
    date,
  });
};

export const renderLabels = (labels?: LabelView[]) => {
  return labels?.map((l) => ({
    // replace spaces with underscores because Obsidian doesn't allow spaces in tags
    name: l.name.replaceAll(" ", "_"),
  }));
};

export const renderArticleContnet = async (
  article: Article,
  template: string,
  highlightOrder: string,
  dateHighlightedFormat: string,
  dateSavedFormat: string,
  isSingleFile: boolean,
  frontMatterVariables: string[],
  fileAttachment?: string
) => {
  // filter out notes and redactions
  const articleHighlights =
    article.highlights?.filter((h) => h.type === HighlightType.Highlight) || [];
  // sort highlights by location if selected in options
  if (highlightOrder === "LOCATION") {
    articleHighlights.sort((a, b) => {
      try {
        // sort by highlight position percent if available
        if (
          a.highlightPositionPercent !== undefined &&
          b.highlightPositionPercent !== undefined
        ) {
          return a.highlightPositionPercent - b.highlightPositionPercent;
        }
        if (article.pageType === PageType.File) {
          // sort by location in file
          return compareHighlightsInFile(a, b);
        }
        // for web page, sort by location in the page
        return getHighlightLocation(a.patch) - getHighlightLocation(b.patch);
      } catch (e) {
        console.error(e);
        return compareHighlightsInFile(a, b);
      }
    });
  }
  const highlights: HighlightView[] = articleHighlights.map((highlight) => {
    return {
      text: formatHighlightQuote(highlight.quote, template),
      highlightUrl: `https://omnivore.app/me/${article.slug}#${highlight.id}`,
      dateHighlighted: formatDate(highlight.updatedAt, dateHighlightedFormat),
      note: highlight.annotation,
      labels: renderLabels(highlight.labels),
    };
  });
  const dateSaved = formatDate(article.savedAt, dateSavedFormat);
  const siteName =
    article.siteName || siteNameFromUrl(article.originalArticleUrl);
  const publishedAt = article.publishedAt;
  const datePublished = publishedAt
    ? formatDate(publishedAt, dateSavedFormat)
    : undefined;
  const articleNote = article.highlights?.find(
    (h) => h.type === HighlightType.Note
  );
  const dateRead = article.readAt
    ? formatDate(article.readAt, dateSavedFormat)
    : undefined;
  const wordsCount = article.wordsCount;
  const readLength = wordsCount
    ? Math.round(Math.max(1, wordsCount / 235))
    : undefined;
  const articleView: ArticleView = {
    id: article.id,
    title: article.title,
    omnivoreUrl: `https://omnivore.app/me/${article.slug}`,
    siteName,
    originalUrl: article.originalArticleUrl,
    author: article.author,
    labels: renderLabels(article.labels),
    dateSaved,
    highlights,
    content: article.content,
    datePublished,
    fileAttachment,
    description: article.description,
    note: articleNote?.annotation,
    type: article.pageType,
    dateRead,
    wordsCount,
    readLength,
    state: getArticleState(article),
    dateArchived: article.archivedAt,
    ...functionMap,
  };

  const frontMatter: { [id: string]: unknown } = {
    id: article.id, // id is required for deduplication
  };

  for (const item of frontMatterVariables) {
    switch (item) {
      case "title":
        frontMatter[item] = articleView.title;
        break;
      case "author":
        if (articleView.author) {
          frontMatter[item] = articleView.author;
        }
        break;
      case "tags":
        if (articleView.labels && articleView.labels.length > 0) {
          // use label names as tags
          frontMatter[item] = articleView.labels.map((l) => l.name);
        }
        break;
      case "date_saved":
        frontMatter[item] = dateSaved;
        break;
      case "date_published":
        if (datePublished) {
          frontMatter[item] = datePublished;
        }
        break;
    }
  }

  // Build content string based on template
  const content = Mustache.render(template, articleView);
  let contentWithoutFrontMatter = removeFrontMatterFromContent(content);
  let frontMatterYaml = stringifyYaml(frontMatter);
  if (isSingleFile) {
    // wrap the content without front matter in comments
    const sectionStart = `%%${article.id}_start%%`;
    const sectionEnd = `%%${article.id}_end%%`;
    contentWithoutFrontMatter = `${sectionStart}\n${contentWithoutFrontMatter}\n${sectionEnd}`;

    // if single file, wrap the front matter in an array
    frontMatterYaml = stringifyYaml([frontMatter]);
  }

  const frontMatterStr = `---\n${frontMatterYaml}---`;

  return `${frontMatterStr}\n\n${contentWithoutFrontMatter}`;
};

export const renderFolderName = (folder: string, folderDate: string) => {
  return Mustache.render(folder, {
    date: folderDate,
  });
};

export const preParseTemplate = (template: string) => {
  return Mustache.parse(template);
};
