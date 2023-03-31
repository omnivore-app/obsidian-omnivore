import { OmnivoreSettings } from "./main";

export const DEFAULT_SETTINGS: OmnivoreSettings = {
  dateHighlightedFormat: "yyyy-MM-dd HH:mm:ss",
  dateSavedFormat: "yyyy-MM-dd HH:mm:ss",
  apiKey: "",
  filter: "HIGHLIGHTS",
  syncAt: "",
  customQuery: "",
  template: `---
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
{{/highlights.length}}`,
  highlightOrder: "LOCATION",
  syncing: false,
  folder: "Omnivore/{{date}}",
  folderDateFormat: "yyyy-MM-dd",
  endpoint: "https://api-prod.omnivore.app/api/graphql",
  filename: "{{{title}}}"
};
