import { DEFAULT_TEMPLATE } from './template'

export const FRONT_MATTER_VARIABLES = [
  'title',
  'author',
  'tags',
  'date_saved',
  'date_published',
  'omnivore_url',
  'site_name',
  'original_url',
  'description',
  'note',
  'type',
  'date_read',
  'words_count',
  'read_length',
  'state',
  'date_archived',
]

export const DEFAULT_SETTINGS: OmnivoreSettings = {
  dateHighlightedFormat: 'yyyy-MM-dd HH:mm:ss',
  dateSavedFormat: 'yyyy-MM-dd HH:mm:ss',
  apiKey: '',
  filter: 'ALL',
  syncAt: '',
  customQuery: '',
  template: DEFAULT_TEMPLATE,
  highlightOrder: 'LOCATION',
  syncing: false,
  folder: 'Omnivore/{{{date}}}',
  folderDateFormat: 'yyyy-MM-dd',
  endpoint: 'https://api-prod.omnivore.app/api/graphql',
  filename: '{{{title}}}',
  filenameDateFormat: 'yyyy-MM-dd',
  attachmentFolder: 'Omnivore/attachments',
  version: '0.0.0',
  isSingleFile: false,
  frequency: 0,
  intervalId: 0,
  frontMatterVariables: [],
  frontMatterTemplate: '',
}

export enum Filter {
  ALL = 'import all my articles',
  HIGHLIGHTS = 'import just highlights',
  ADVANCED = 'advanced',
}

export enum HighlightOrder {
  LOCATION = 'the location of highlights in the article',
  TIME = 'the time that highlights are updated',
}

export interface OmnivoreSettings {
  apiKey: string
  filter: string
  syncAt: string
  customQuery: string
  highlightOrder: string
  template: string
  syncing: boolean
  folder: string
  folderDateFormat: string
  endpoint: string
  dateHighlightedFormat: string
  dateSavedFormat: string
  filename: string
  attachmentFolder: string
  version: string
  isSingleFile: boolean
  frequency: number
  intervalId: number
  frontMatterVariables: string[]
  frontMatterTemplate: string
  filenameDateFormat: string
}
