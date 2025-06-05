import { Item } from '@omnivore-app/api'
import { DateTime } from 'luxon'
import {
  addIcon,
  normalizePath,
  Notice,
  Plugin,
  requestUrl,
  stringifyYaml,
  TFile,
  TFolder,
} from 'obsidian'
import { deleteItem, getItems } from './api'
import { DEFAULT_SETTINGS, OmnivoreSettings } from './settings'
import {
  preParseTemplate,
  render,
  renderFilename,
  renderItemContent,
} from './settings/template'
import { OmnivoreSettingTab } from './settingsTab'
import {
  DATE_FORMAT,
  findFrontMatterIndex,
  getQueryFromFilter,
  parseDateTime,
  parseFrontMatterFromContent,
  removeFrontMatterFromContent,
  replaceIllegalCharsFile,
  replaceIllegalCharsFolder,
  setOrUpdateHighlightColors,
} from './util'

export default class OmnivorePlugin extends Plugin {
  settings: OmnivoreSettings

  async onload() {
    await this.loadSettings()
    await this.resetSyncingStateSetting()

    // update version if needed
    const latestVersion = this.manifest.version
    const currentVersion = this.settings.version
    if (latestVersion !== currentVersion) {
      this.settings.version = latestVersion
      await this.saveSettings()
      // show release notes
      const releaseNotes = `Omnivore plugin is upgraded to ${latestVersion}.`
      new Notice(releaseNotes, 10000)
    }

    this.addCommand({
      id: 'sync',
      name: 'Sync new changes',
      callback: async () => {
        await this.fetchOmnivore()
      },
    })

    this.addCommand({
      id: 'deleteArticle',
      name: 'Delete Current Article from Omnivore',
      callback: async () => {
        await this.deleteCurrentItem(this.app.workspace.getActiveFile())
      },
    })

    this.addCommand({
      id: 'resync',
      name: 'Resync all articles',
      callback: async () => {
        this.settings.syncAt = ''
        await this.saveSettings()
        new Notice('Omnivore Last Sync reset')
        await this.fetchOmnivore()
      },
    })

    const iconId = 'Omnivore'
    // add icon
    addIcon(
      iconId,
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path fill="currentColor" d="M15.9 7.801c0 .507-.123 1.12-.248 1.656v.004l-.001.003a2.87 2.87 0 0 1-2.793 2.186h-.036c-1.625 0-2.649-1.334-2.649-2.828v-2.14l-1.21 1.794-.067.055a1.404 1.404 0 0 1-1.793 0l-.065-.053-1.248-1.82v4.414H4.6V6.268c0-.91 1.078-1.439 1.794-.802l.055.048 1.46 2.13a.21.21 0 0 0 .179 0l1.43-2.119.065-.054c.68-.567 1.78-.138 1.78.815v2.536c0 .971.619 1.638 1.46 1.638h.035c.78 0 1.45-.527 1.636-1.277.125-.534.216-1.026.216-1.378-.017-3.835-3.262-6.762-7.188-6.498-3.311.23-5.986 2.905-6.216 6.216A6.705 6.705 0 0 0 8 14.693v1.19a7.895 7.895 0 0 1-7.882-8.44C.39 3.536 3.536.39 7.44.118 12.017-.19 15.88 3.242 15.9 7.8z"/></svg>`,
    )

    // This creates an icon in the left ribbon.
    this.addRibbonIcon(iconId, iconId, async (evt: MouseEvent) => {
      // Called when the user clicks the icon.
      await this.fetchOmnivore()
    })

    // This adds a settings tab so the user can configure various aspects of the plugin
    this.addSettingTab(new OmnivoreSettingTab(this.app, this))

    this.scheduleSync()

    // sync when the app is loaded if syncOnStart is true
    if (this.settings.syncOnStart) {
      await this.fetchOmnivore(false)
    }
  }

  onunload() {}

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())

    // for backward compatibility, replace advanced filter with all filter
    if (this.settings.filter === 'ADVANCED') {
      this.settings.filter = 'ALL'
      console.log(
        'obsidian-omnivore: advanced filter is replaced with all filter',
      )
      const customQuery = this.settings.customQuery
      this.settings.customQuery = `in:all ${
        customQuery ? `(${customQuery})` : ''
      }`
      console.log(
        `obsidian-omnivore: custom query is set to ${this.settings.customQuery}`,
      )
      this.saveSettings()
    }

    // for backward compatibility, set custom query from filter
    if (!this.settings.customQuery) {
      this.settings.customQuery = getQueryFromFilter(this.settings.filter)
      console.log(
        `obsidian-omnivore: custom query is set to ${this.settings.customQuery}`,
      )
      this.saveSettings()
    }
    // initialize css highlight color variables
    setOrUpdateHighlightColors(this.settings.highlightColorMapping)
  }

  async saveSettings() {
    await this.saveData(this.settings)
  }

  async scheduleSync() {
    // clear previous interval
    if (this.settings.intervalId > 0) {
      window.clearInterval(this.settings.intervalId)
    }
    const frequency = this.settings.frequency
    if (frequency > 0) {
      // schedule new interval
      const intervalId = window.setInterval(
        async () => {
          await this.fetchOmnivore(false)
        },
        frequency * 60 * 1000,
      )
      // save new interval id
      this.settings.intervalId = intervalId
      await this.saveSettings()
      // clear interval when plugin is unloaded
      this.registerInterval(intervalId)
    }
  }

  async downloadFileAsAttachment(item: Item): Promise<string> {
    // download pdf from the URL to the attachment folder
    const url = item.url
    const response = await requestUrl({
      url,
      contentType: 'application/pdf',
    })
    const folderName = normalizePath(
      render(
        item,
        this.settings.attachmentFolder,
        this.settings.folderDateFormat,
        this.settings.endpoint,
      ),
    )
    const folder = this.app.vault.getAbstractFileByPath(folderName)
    if (!(folder instanceof TFolder)) {
      await this.app.vault.createFolder(folderName)
    }
    const fileName = normalizePath(`${folderName}/${item.id}.pdf`)
    const file = this.app.vault.getAbstractFileByPath(fileName)
    if (!(file instanceof TFile)) {
      const newFile = await this.app.vault.createBinary(
        fileName,
        response.arrayBuffer,
      )
      return newFile.path
    }
    return file.path
  }

  async fetchOmnivore(manualSync = true) {
    const {
      syncAt,
      apiKey,
      customQuery,
      highlightOrder,
      syncing,
      template,
      folder,
      filename,
      isSingleFile,
      frontMatterVariables,
      frontMatterTemplate,
    } = this.settings

    if (syncing) {
      new Notice('🐢 Already syncing ...')
      return
    }

    if (!apiKey) {
      new Notice('Missing Omnivore api key')
      return
    }

    this.settings.syncing = true
    await this.saveSettings()

    try {
      console.log(`obsidian-omnivore starting sync since: '${syncAt}'`)

      manualSync && new Notice('🚀 Fetching items ...')

      // pre-parse template
      frontMatterTemplate && preParseTemplate(frontMatterTemplate)
      const templateSpans = preParseTemplate(template)
      // check if we need to include content or file attachment
      const includeContent = templateSpans.some(
        (templateSpan) => templateSpan[1] === 'content',
      )
      const includeFileAttachment = templateSpans.some(
        (templateSpan) => templateSpan[1] === 'fileAttachment',
      )

      const size = 15
      for (let after = 0; ; after += size) {
        const [items, hasNextPage] = await getItems(
          this.settings.endpoint,
          apiKey,
          after,
          size,
          parseDateTime(syncAt).toISO() || undefined,
          customQuery,
          includeContent,
          'highlightedMarkdown',
        )

        for (const item of items) {
          const folderName = replaceIllegalCharsFolder(
            normalizePath(render(item, folder, this.settings.folderDateFormat, this.settings.endpoint)),
          )
          const omnivoreFolder =
            this.app.vault.getAbstractFileByPath(folderName)
          if (!(omnivoreFolder instanceof TFolder)) {
            await this.app.vault.createFolder(folderName)
          }
          const fileAttachment =
            item.pageType === 'FILE' && includeFileAttachment
              ? await this.downloadFileAsAttachment(item)
              : undefined
          const content = await renderItemContent(
            item,
            template,
            highlightOrder,
            this.settings.enableHighlightColorRender
              ? this.settings.highlightManagerId
              : undefined,
            this.settings.dateHighlightedFormat,
            this.settings.dateSavedFormat,
            isSingleFile,
            frontMatterVariables,
            frontMatterTemplate,
            this.settings.endpoint,
            fileAttachment,
          )
          // use the custom filename
          const customFilename = replaceIllegalCharsFile(
            renderFilename(item, filename, this.settings.filenameDateFormat, this.settings.endpoint),
          )
          const pageName = `${folderName}/${customFilename}.md`
          const normalizedPath = normalizePath(pageName)
          const omnivoreFile =
            this.app.vault.getAbstractFileByPath(normalizedPath)
          if (omnivoreFile instanceof TFile) {
            // file exists, so we might need to update it
            if (isSingleFile) {
              // sync into a single file
              const existingContent = await this.app.vault.read(omnivoreFile)
              // we need to remove the front matter
              const contentWithoutFrontmatter =
                removeFrontMatterFromContent(content)
              const existingContentWithoutFrontmatter =
                removeFrontMatterFromContent(existingContent)
              // get front matter from content
              let existingFrontMatter =
                parseFrontMatterFromContent(existingContent) || []
              if (!Array.isArray(existingFrontMatter)) {
                // convert front matter to array
                existingFrontMatter = [existingFrontMatter]
              }
              const newFrontMatter = parseFrontMatterFromContent(content)
              if (
                !newFrontMatter ||
                !Array.isArray(newFrontMatter) ||
                newFrontMatter.length === 0
              ) {
                throw new Error('Front matter does not exist in the template')
              }
              let newContentWithoutFrontMatter: string

              // find the front matter with the same id
              const frontMatterIdx = findFrontMatterIndex(
                existingFrontMatter,
                item.id,
              )
              if (frontMatterIdx >= 0) {
                // this article already exists in the file
                // we need to locate the article which is wrapped in comments
                // and replace the content
                const sectionStart = `%%${item.id}_start%%`
                const sectionEnd = `%%${item.id}_end%%`
                const existingContentRegex = new RegExp(
                  `${sectionStart}.*?${sectionEnd}`,
                  's',
                )
                newContentWithoutFrontMatter =
                  existingContentWithoutFrontmatter.replace(
                    existingContentRegex,
                    contentWithoutFrontmatter,
                  )

                existingFrontMatter[frontMatterIdx] = newFrontMatter[0]
              } else {
                // this article doesn't exist in the file
                // prepend the article
                newContentWithoutFrontMatter = `${contentWithoutFrontmatter}\n\n${existingContentWithoutFrontmatter}`
                // prepend new front matter which is an array
                existingFrontMatter.unshift(newFrontMatter[0])
              }

              const newFrontMatterStr = `---\n${stringifyYaml(
                existingFrontMatter,
              )}---`

              await this.app.vault.modify(
                omnivoreFile,
                `${newFrontMatterStr}\n\n${newContentWithoutFrontMatter}`,
              )
              continue
            }
            // sync into separate files
            await this.app.fileManager.processFrontMatter(
              omnivoreFile,
              async (frontMatter) => {
                const id = frontMatter.id
                if (id && id !== item.id) {
                  // this article has the same name but different id
                  const newPageName = `${folderName}/${customFilename}-${item.id}.md`
                  const newNormalizedPath = normalizePath(newPageName)
                  const newOmnivoreFile =
                    this.app.vault.getAbstractFileByPath(newNormalizedPath)
                  if (newOmnivoreFile instanceof TFile) {
                    // a file with the same name and id already exists, so we need to update it
                    const existingContent =
                      await this.app.vault.read(newOmnivoreFile)
                    if (existingContent !== content) {
                      await this.app.vault.modify(newOmnivoreFile, content)
                    }
                    return
                  }
                  // a file with the same name but different id already exists, so we need to create it
                  await this.app.vault.create(newNormalizedPath, content)
                  return
                }
                // a file with the same id already exists, so we might need to update it
                const existingContent = await this.app.vault.read(omnivoreFile)
                if (existingContent !== content) {
                  await this.app.vault.modify(omnivoreFile, content)
                }
              },
            )
            continue
          }
          // file doesn't exist, so we need to create it
          try {
            await this.app.vault.create(normalizedPath, content)
          } catch (error) {
            if (error.toString().includes('File already exists')) {
              new Notice(
                `Skipping file creation: ${normalizedPath}. Please check if you have duplicated article titles and delete the file if needed.`,
              )
            } else {
              throw error
            }
          }
        }

        this.settings.syncAt = DateTime.local().toFormat(DATE_FORMAT)

        if (!hasNextPage) {
          break
        }
      }

      console.log('obsidian-omnivore sync completed', this.settings.syncAt)
      manualSync && new Notice('🎉 Sync completed')
    } catch (e) {
      new Notice('Failed to fetch items')
      console.error(e)
    } finally {
      this.settings.syncing = false
      await this.saveSettings()
    }
  }

  private async deleteCurrentItem(file: TFile | null) {
    if (!file) {
      return
    }
    //use frontmatter id to find the file
    const itemId = this.app.metadataCache.getFileCache(file)?.frontmatter?.id
    if (!itemId) {
      new Notice('Failed to delete article: article id not found')
    }

    try {
      const isDeleted = deleteItem(
        this.settings.endpoint,
        this.settings.apiKey,
        itemId,
      )
      if (!isDeleted) {
        new Notice('Failed to delete article in Omnivore')
      }
    } catch (e) {
      new Notice('Failed to delete article in Omnivore')
      console.error(e)
    }

    await this.app.vault.delete(file)
  }

  private async resetSyncingStateSetting() {
    this.settings.syncing = false
    this.settings.intervalId = 0
    await this.saveSettings()
  }
}
