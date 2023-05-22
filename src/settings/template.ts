import Mustache from "mustache";
import { stringifyYaml } from "obsidian";
import { Article, HighlightType, PageType } from "../api";
import {
  compareHighlightsInFile,
  formatDate,
  formatHighlightQuote,
  getHighlightLocation,
  parseFrontMatterFromContent,
  removeFrontMatterFromContent,
  siteNameFromUrl,
} from "../util";
import YAML from "yaml";

type FunctionMap = {
  [key: string]: () => (
    text: string,
    render: (text: string) => string
  ) => string;
};

export const DEFAULT_TEMPLATE = `---
{{frontMatter}}
---

# {{{title}}}
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
      frontMatter: string;
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
  return Mustache.render(filename, {
    ...article,
    date,
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
  frontMatterItems: string[],
  dateHighlightedFormat: string,
  dateSavedFormat: string,
  isSingleFile: boolean,
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
  let frontMatterDict: { [id: string]: any } = {};

  for (const item of frontMatterItems) {
    switch (item) {
      case "title":
        frontMatterDict["title"] = article.title;
        break;
      case "author":
        frontMatterDict["author"] = article.author;
        break;
      case "labels":
        frontMatterDict["labels"] = article.labels?.map((l) => {
          return {
            name: l.name.replace(" ", "_"),
          };
        });
        break;
      case "date_saved":
        frontMatterDict["date_saved"] = dateSaved;
        break;
      case "date_published":
        frontMatterDict["date_published"] = datePublished;
        break;
    }
  }

  const frontMatterVars = YAML.stringify(frontMatterDict);
  const articleView: ArticleView = {
    id: article.id,
    title: article.title,
    frontMatter: frontMatterVars,
    omnivoreUrl: `https://omnivore.app/me/${article.slug}`,
    siteName,
    originalUrl: article.originalArticleUrl,
    author: article.author,
    labels: article.labels?.map((l) => {
      return {
        name: l.name.replace(" ", "_"),
      };
    }),
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
  console.log("article view:", articleView);
  // Build content string based on template
  const content = Mustache.render(template, articleView);

  // get the front matter from the content
  let frontMatter = parseFrontMatterFromContent(content);
  if (!frontMatter) {
    // if no front matter, add the id
    frontMatter = {
      id: article.id,
    };
  }

  let contentWithoutFrontMatter = removeFrontMatterFromContent(content);
  if (isSingleFile) {
    // wrap the content without front matter in comments
    const sectionStart = `%%${article.id}_start%%`;
    const sectionEnd = `%%${article.id}_end%%`;
    contentWithoutFrontMatter = `${sectionStart}\n${contentWithoutFrontMatter}\n${sectionEnd}`;

    // if single file, wrap the front matter in an array
    frontMatter = [frontMatter];
  }

  const frontMatterYaml = stringifyYaml(frontMatter);
  const frontMatterStr = `---\n${frontMatterYaml}---`;

  return `${frontMatterStr}\n\n${contentWithoutFrontMatter}`;
};

export const renderFolderName = (folder: string, folderDate: string) => {
  return Mustache.render(folder, {
    date: folderDate,
  });
};

export const preParseTemplate = (template: string) => {
  Mustache.parse(template);
};
