import { DEFAULT_TEMPLATE } from "./template";

export const DEFAULT_SETTINGS: OmnivoreSettings = {
  dateHighlightedFormat: "yyyy-MM-dd HH:mm:ss",
  dateSavedFormat: "yyyy-MM-dd HH:mm:ss",
  apiKey: "",
  filter: "HIGHLIGHTS",
  syncAt: "",
  customQuery: "",
  template: DEFAULT_TEMPLATE,
  highlightOrder: "LOCATION",
  syncing: false,
  folder: "Omnivore/{{{date}}}",
  folderDateFormat: "yyyy-MM-dd",
  endpoint: "https://api-prod.omnivore.app/api/graphql",
  filename: "{{{title}}}",
  attachmentFolder: "Omnivore/attachments",
};

export enum Filter {
  ALL = "import all my articles",
  HIGHLIGHTS = "import just highlights",
  ADVANCED = "advanced",
}

export enum HighlightOrder {
  LOCATION = "the location of highlights in the article",
  TIME = "the time that highlights are updated",
}

export interface OmnivoreSettings {
  apiKey: string;
  filter: string;
  syncAt: string;
  customQuery: string;
  highlightOrder: string;
  template: string;
  syncing: boolean;
  folder: string;
  folderDateFormat: string;
  endpoint: string;
  dateHighlightedFormat: string;
  dateSavedFormat: string;
  filename: string;
  attachmentFolder: string;
}
