import Mustache from "mustache";
import { stringifyYaml } from "obsidian";
import { Article, HighlightType, PageType } from "./api";
import { downloadFileAsAttachment } from "./main";
import {
  compareHighlightsInFile,
  formatDate,
  getHighlightLocation,
  siteNameFromUrl,
} from "./util";

export const DEFAULT_TEMPLATE = `---
id: {{{id}}}
title: {{{title}}}
{{#author}}
author: {{{author}}}
{{/author}}
{{#labels.length}}
tags:
{{#labels}} - {{{name}}}
{{/labels}}
{{/labels.length}}
date_saved: {{{dateSaved}}}
{{#datePublished}}
date_published: {{{datePublished}}}
{{/datePublished}}
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

export const renderArticleContnet = async (
  article: Article,
  template: string,
  highlightOrder: string,
  dateHighlightedFormat: string,
  dateSavedFormat: string,
  attachmentFolder: string,
  folderDateFormat: string
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
  const highlights = articleHighlights.map((highlight) => {
    return {
      text: highlight.quote,
      highlightUrl: `https://omnivore.app/me/${article.slug}#${highlight.id}`,
      dateHighlighted: formatDate(highlight.updatedAt, dateHighlightedFormat),
      note: highlight.annotation,
      labels: highlight.labels?.map((l) => ({
        name: l.name,
      })),
    };
  });
  const dateSaved = formatDate(article.savedAt, dateSavedFormat);
  const siteName =
    article.siteName || siteNameFromUrl(article.originalArticleUrl);
  const publishedAt = article.publishedAt;
  const datePublished = publishedAt
    ? formatDate(publishedAt, dateSavedFormat)
    : null;
  const articleNote = article.highlights?.find(
    (h) => h.type === HighlightType.Note
  );
  // Build content string based on template
  let content = Mustache.render(template, {
    id: article.id,
    title: article.title,
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
    pdfAttachment:
      article.pageType === PageType.File
        ? await downloadFileAsAttachment(
            article,
            attachmentFolder,
            folderDateFormat
          )
        : undefined,
    description: article.description,
    note: articleNote?.annotation,
    type: article.pageType,
  });

  const frontmatterRegex = /^(---[\s\S]*?---)/gm;
  // get the frontmatter from the content
  const frontmatter = content.match(frontmatterRegex);
  if (frontmatter) {
    // replace the id in the frontmatter
    content = content.replace(
      frontmatter[0],
      frontmatter[0].replace('id: ""', `id: ${article.id}`)
    );
  } else {
    // if the content doesn't have frontmatter, add it
    const frontmatter = {
      id: article.id,
    };
    const frontmatterYaml = stringifyYaml(frontmatter);
    const frontmatterString = `---\n${frontmatterYaml}---`;
    content = `${frontmatterString}\n\n${content}`;
  }
  return content;
};

export const renderFolderName = (folder: string, folderDate: string) => {
  return Mustache.render(folder, {
    date: folderDate,
  });
};
