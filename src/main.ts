import { DateTime } from "luxon"
import {
  addIcon,
  App,
  normalizePath,
  Notice,
  Plugin,
  PluginSettingTab,
  requestUrl,
  Setting,
  stringifyYaml,
  TFile,
  TFolder,
} from "obsidian"
import { Article, deleteArticleById, loadArticles, PageType } from "./api"
import {
  DEFAULT_SETTINGS,
  Filter,
  FRONT_MATTER_VARIABLES,
  HighlightOrder,
  OmnivoreSettings,
} from "./settings"
import { FolderSuggest } from "./settings/file-suggest"
import {
  preParseTemplate,
  renderArticleContnet,
  renderFilename,
  renderFolderName,
} from "./settings/template"
import {
  DATE_FORMAT,
  findFrontMatterIndex,
  getQueryFromFilter,
  parseDateTime,
  parseFrontMatterFromContent,
  removeFrontMatterFromContent,
  replaceIllegalChars,
} from "./util"

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
      this.saveSettings()
      // show release notes
      const releaseNotes = `Omnivore plugin is upgraded to ${latestVersion}.
    
    What's new: https://github.com/omnivore-app/obsidian-omnivore/blob/main/CHANGELOG.md
    `
      new Notice(releaseNotes, 10000)
    }

    this.addCommand({
      id: "sync",
      name: "Sync new changes",
      callback: () => {
        this.fetchOmnivore()
      },
    })

    this.addCommand({
        id: "deleteArticle",
        name: "Delete Current Article from Omnivore",
        callback: () => {
          this.deleteCurrentArticle(this.app.workspace.getActiveFile())
        }
    })

    this.addCommand({
      id: "resync",
      name: "Resync all articles",
      callback: () => {
        this.settings.syncAt = ""
        this.saveSettings()
        new Notice("Omnivore Last Sync reset")
        this.fetchOmnivore()
      },
    })

    const iconId = "Omnivore"
    // add icon
    addIcon(
      iconId,
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path fill="currentColor" d="M15.9 7.801c0 .507-.123 1.12-.248 1.656v.004l-.001.003a2.87 2.87 0 0 1-2.793 2.186h-.036c-1.625 0-2.649-1.334-2.649-2.828v-2.14l-1.21 1.794-.067.055a1.404 1.404 0 0 1-1.793 0l-.065-.053-1.248-1.82v4.414H4.6V6.268c0-.91 1.078-1.439 1.794-.802l.055.048 1.46 2.13a.21.21 0 0 0 .179 0l1.43-2.119.065-.054c.68-.567 1.78-.138 1.78.815v2.536c0 .971.619 1.638 1.46 1.638h.035c.78 0 1.45-.527 1.636-1.277.125-.534.216-1.026.216-1.378-.017-3.835-3.262-6.762-7.188-6.498-3.311.23-5.986 2.905-6.216 6.216A6.705 6.705 0 0 0 8 14.693v1.19a7.895 7.895 0 0 1-7.882-8.44C.39 3.536 3.536.39 7.44.118 12.017-.19 15.88 3.242 15.9 7.8z"/></svg>`
    )

    // This creates an icon in the left ribbon.
    this.addRibbonIcon(iconId, iconId, async (evt: MouseEvent) => {
      // Called when the user clicks the icon.
      await this.fetchOmnivore()
    })

    // This adds a settings tab so the user can configure various aspects of the plugin
    this.addSettingTab(new OmnivoreSettingTab(this.app, this))

    this.scheduleSync()

    // sync when the app is loaded
    await this.fetchOmnivore()
  }

  onunload() {}

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
  }

  async saveSettings() {
    await this.saveData(this.settings)
  }

  scheduleSync() {
    // clear previous interval
    if (this.settings.intervalId > 0) {
      window.clearInterval(this.settings.intervalId)
    }
    const frequency = this.settings.frequency
    if (frequency > 0) {
      // schedule new interval
      const intervalId = window.setInterval(async () => {
        await this.fetchOmnivore(false)
      }, frequency * 60 * 1000)
      // save new interval id
      this.settings.intervalId = intervalId
      this.saveSettings()
      // clear interval when plugin is unloaded
      this.registerInterval(intervalId)
    }
  }

  async downloadFileAsAttachment(article: Article): Promise<string> {
    // download pdf from the URL to the attachment folder
    const url = article.url
    const response = await requestUrl({
      url,
      contentType: "application/pdf",
    })
    const folderName = normalizePath(
      renderFolderName(
        article,
        this.settings.attachmentFolder,
        this.settings.folderDateFormat
      )
    )
    const folder = app.vault.getAbstractFileByPath(folderName)
    if (!(folder instanceof TFolder)) {
      await app.vault.createFolder(folderName)
    }
    const fileName = normalizePath(`${folderName}/${article.id}.pdf`)
    const file = app.vault.getAbstractFileByPath(fileName)
    if (!(file instanceof TFile)) {
      const newFile = await app.vault.createBinary(
        fileName,
        response.arrayBuffer
      )
      return newFile.path
    }
    return file.path
  }

  async fetchOmnivore(manualSync = true) {
    const {
      syncAt,
      apiKey,
      filter,
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
      new Notice("🐢 Already syncing ...")
      return
    }

    if (!apiKey) {
      new Notice("Missing Omnivore api key")
      return
    }

    this.settings.syncing = true
    await this.saveSettings()

    try {
      console.log(`obsidian-omnivore starting sync since: '${syncAt}'`)

      manualSync && new Notice("🚀 Fetching articles ...")

      // pre-parse template
      frontMatterTemplate && preParseTemplate(frontMatterTemplate)
      const templateSpans = preParseTemplate(template)
      // check if we need to include content or file attachment
      const includeContent = templateSpans.some(
        (templateSpan) => templateSpan[1] === "content"
      )
      const includeFileAttachment = templateSpans.some(
        (templateSpan) => templateSpan[1] === "fileAttachment"
      )

      const size = 50
      for (
        let hasNextPage = true, articles: Article[] = [], after = 0;
        hasNextPage;
        after += size
      ) {
        [articles, hasNextPage] = await loadArticles(
          this.settings.endpoint,
          apiKey,
          after,
          size,
          parseDateTime(syncAt).toISO() || undefined,
          getQueryFromFilter(filter, customQuery),
          includeContent,
          "highlightedMarkdown"
        )

        for (const article of articles) {
          const folderName = normalizePath(
            renderFolderName(article, folder, this.settings.folderDateFormat)
          )
          const omnivoreFolder =
            this.app.vault.getAbstractFileByPath(folderName)
          if (!(omnivoreFolder instanceof TFolder)) {
            await this.app.vault.createFolder(folderName)
          }
          const fileAttachment =
            article.pageType === PageType.File && includeFileAttachment
              ? await this.downloadFileAsAttachment(article)
              : undefined
          const content = await renderArticleContnet(
            article,
            template,
            highlightOrder,
            this.settings.dateHighlightedFormat,
            this.settings.dateSavedFormat,
            isSingleFile,
            frontMatterVariables,
            frontMatterTemplate,
            fileAttachment
          )
          // use the custom filename
          const customFilename = replaceIllegalChars(
            renderFilename(article, filename, this.settings.filenameDateFormat)
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
                throw new Error("Front matter does not exist in the template")
              }
              let newContentWithoutFrontMatter: string

              // find the front matter with the same id
              const frontMatterIdx = findFrontMatterIndex(
                existingFrontMatter,
                article.id
              )
              if (frontMatterIdx >= 0) {
                // this article already exists in the file
                // we need to locate the article which is wrapped in comments
                // and replace the content
                const sectionStart = `%%${article.id}_start%%`
                const sectionEnd = `%%${article.id}_end%%`
                const existingContentRegex = new RegExp(
                  `${sectionStart}.*?${sectionEnd}`,
                  "s"
                )
                newContentWithoutFrontMatter =
                  existingContentWithoutFrontmatter.replace(
                    existingContentRegex,
                    contentWithoutFrontmatter
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
                existingFrontMatter
              )}---`

              await this.app.vault.modify(
                omnivoreFile,
                `${newFrontMatterStr}\n\n${newContentWithoutFrontMatter}`
              )
              continue
            }
            // sync into separate files
            await this.app.fileManager.processFrontMatter(
              omnivoreFile,
              async (frontMatter) => {
                const id = frontMatter.id
                if (id && id !== article.id) {
                  // this article has the same name but different id
                  const newPageName = `${folderName}/${customFilename}-${article.id}.md`
                  const newNormalizedPath = normalizePath(newPageName)
                  const newOmnivoreFile =
                    this.app.vault.getAbstractFileByPath(newNormalizedPath)
                  if (newOmnivoreFile instanceof TFile) {
                    // a file with the same name and id already exists, so we need to update it
                    const existingContent = await this.app.vault.read(
                      newOmnivoreFile
                    )
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
              }
            )
            continue
          }
          // file doesn't exist, so we need to create it
          try {
            await this.app.vault.create(normalizedPath, content)
          } catch (error) {
            if (error.toString().includes("File already exists")) {
              new Notice(
                `Skipping file creation: ${normalizedPath}. Please check if you have duplicated article titles and delete the file if needed.`
              )
            } else {
              throw error
            }
          }
        }
      }

      manualSync && new Notice("🔖 Articles fetched")
      this.settings.syncAt = DateTime.local().toFormat(DATE_FORMAT)
    } catch (e) {
      new Notice("Failed to fetch articles")
      console.error(e)
    } finally {
      this.settings.syncing = false
      await this.saveSettings()
    }
  }

  private async deleteCurrentArticle(file: TFile | null) {
    if(!file) {
        return
    }
    //use frontmatter id to find the file
    const articleId = this.app.metadataCache.getFileCache(file)?.frontmatter?.id
    if (!articleId) {
        new Notice("Failed to delete article: article id not found")
    }

    try{
        const isDeleted = deleteArticleById(this.settings.endpoint, this.settings.apiKey, articleId)
        if(!isDeleted) {
            new Notice("Failed to delete article in Omnivore")
        }
    } catch (e) {
        new Notice("Failed to delete article in Omnivore")
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

class OmnivoreSettingTab extends PluginSettingTab {
  plugin: OmnivorePlugin

  constructor(app: App, plugin: OmnivorePlugin) {
    super(app, plugin)
    this.plugin = plugin
  }

  display(): void {
    const { containerEl } = this

    containerEl.empty()

    containerEl.createEl("h2", { text: "Settings for Omnivore plugin" })

    new Setting(containerEl)
      .setName("API Key")
      .setDesc(
        createFragment((fragment) => {
          fragment.append(
            "You can create an API key at ",
            fragment.createEl("a", {
              text: "https://omnivore.app/settings/api",
              href: "https://omnivore.app/settings/api",
            })
          )
        })
      )
      .addText((text) =>
        text
          .setPlaceholder("Enter your Omnivore Api Key")
          .setValue(this.plugin.settings.apiKey)
          .onChange(async (value) => {
            this.plugin.settings.apiKey = value
            await this.plugin.saveSettings()
          })
      )

    new Setting(containerEl)
      .setName("Filter")
      .setDesc("Select an Omnivore search filter type. Changing this would reset the 'Last sync' timestamp")
      .addDropdown((dropdown) => {
        dropdown.addOptions(Filter)
        dropdown
          .setValue(this.plugin.settings.filter)
          .onChange(async (value) => {
            this.plugin.settings.filter = value
            this.plugin.settings.syncAt = ""
            await this.plugin.saveSettings()
          })
      })

    new Setting(containerEl)
      .setName("Custom query")
      .setDesc(
        createFragment((fragment) => {
          fragment.append(
            "See ",
            fragment.createEl("a", {
              text: "https://docs.omnivore.app/using/search",
              href: "https://docs.omnivore.app/using/search",
            }),
            " for more info on search query syntax. Make sure your Filter (in the section above) is set to advanced when using a custom query.",
            " Changing this would reset the 'Last Sync' timestamp"
          )
        })
      )
      .addText((text) =>
        text
          .setPlaceholder(
            "Enter an Omnivore custom search query if advanced filter is selected"
          )
          .setValue(this.plugin.settings.customQuery)
          .onChange(async (value) => {
            this.plugin.settings.customQuery = value
            this.plugin.settings.syncAt = ""
            await this.plugin.saveSettings()
          })
      )

    new Setting(containerEl)
      .setName("Last Sync")
      .setDesc("Last time the plugin synced with Omnivore. The 'Sync' command fetches articles updated after this timestamp")
      .addMomentFormat((momentFormat) =>
        momentFormat
          .setPlaceholder("Last Sync")
          .setValue(this.plugin.settings.syncAt)
          .setDefaultFormat("yyyy-MM-dd'T'HH:mm:ss")
          .onChange(async (value) => {
            this.plugin.settings.syncAt = value
            await this.plugin.saveSettings()
          })
      )

    new Setting(containerEl)
      .setName("Highlight Order")
      .setDesc("Select the order in which highlights are applied")
      .addDropdown((dropdown) => {
        dropdown.addOptions(HighlightOrder)
        dropdown
          .setValue(this.plugin.settings.highlightOrder)
          .onChange(async (value) => {
            this.plugin.settings.highlightOrder = value
            await this.plugin.saveSettings()
          })
      })

    new Setting(containerEl)
      .setName("Front Matter")
      .setDesc(
        createFragment((fragment) => {
          fragment.append(
            "Enter the metadata to be used in your note separated by commas. You can also use custom aliases in the format of metatdata::alias, e.g. date_saved::date. ",
            fragment.createEl("br"),
            fragment.createEl("br"),
            "Available metadata can be found at ",
            fragment.createEl("a", {
              text: "Reference",
              href: "https://docs.omnivore.app/integrations/obsidian.html#front-matter",
            }),
            fragment.createEl("br"),
            fragment.createEl("br"),
            "If you want to use a custom front matter template, you can enter it below under the advanced settings"
          )
        })
      )
      .addTextArea((text) => {
        text
          .setPlaceholder("Enter the metadata")
          .setValue(this.plugin.settings.frontMatterVariables.join(","))
          .onChange(async (value) => {
            // validate front matter variables and deduplicate
            this.plugin.settings.frontMatterVariables = value
              .split(",")
              .map((v) => v.trim())
              .filter(
                (v, i, a) =>
                  FRONT_MATTER_VARIABLES.includes(v.split("::")[0]) &&
                  a.indexOf(v) === i
              )
            await this.plugin.saveSettings()
          })
        text.inputEl.setAttr("rows", 4)
        text.inputEl.setAttr("cols", 30)
      })

    new Setting(containerEl)
      .setName("Article Template")
      .setDesc(
        createFragment((fragment) => {
          fragment.append(
            "Enter template to render articles with ",
            fragment.createEl("a", {
              text: "Reference",
              href: "https://docs.omnivore.app/integrations/obsidian.html#controlling-the-layout-of-the-data-imported-to-obsidian",
            }),
            fragment.createEl("br"),
            fragment.createEl("br"),
            "If you want to use a custom front matter template, you can enter it below under the advanced settings"
          )
        })
      )
      .addTextArea((text) => {
        text
          .setPlaceholder("Enter the template")
          .setValue(this.plugin.settings.template)
          .onChange(async (value) => {
            // if template is empty, use default template
            this.plugin.settings.template = value
              ? value
              : DEFAULT_SETTINGS.template
            await this.plugin.saveSettings()
          })
        text.inputEl.setAttr("rows", 25)
        text.inputEl.setAttr("cols", 50)
      })
      .addExtraButton((button) => {
        // add a button to reset template
        button
          .setIcon("reset")
          .setTooltip("Reset template")
          .onClick(async () => {
            this.plugin.settings.template = DEFAULT_SETTINGS.template
            await this.plugin.saveSettings()
            this.display()
            new Notice("Template reset")
          })
      })

    new Setting(containerEl)
      .setName("Frequency")
      .setDesc(
        "Enter the frequency in minutes to sync with Omnivore automatically. 0 means manual sync"
      )
      .addText((text) =>
        text
          .setPlaceholder("Enter the frequency")
          .setValue(this.plugin.settings.frequency.toString())
          .onChange(async (value) => {
            // validate frequency
            const frequency = parseInt(value)
            if (isNaN(frequency)) {
              new Notice("Frequency must be a positive integer")
              return
            }
            // save frequency
            this.plugin.settings.frequency = frequency
            await this.plugin.saveSettings()

            this.plugin.scheduleSync()
          })
      )

    new Setting(containerEl)
      .setName("Folder")
      .setDesc(
        "Enter the folder where the data will be stored. {{{title}}}, {{{dateSaved}}} and {{{datePublished}}} could be used in the folder name"
      )
      .addSearch((search) => {
        new FolderSuggest(this.app, search.inputEl)
        search
          .setPlaceholder("Enter the folder")
          .setValue(this.plugin.settings.folder)
          .onChange(async (value) => {
            this.plugin.settings.folder = value
            await this.plugin.saveSettings()
          })
      })
    new Setting(containerEl)
      .setName("Attachment Folder")
      .setDesc(
        "Enter the folder where the attachment will be downloaded to. {{{title}}}, {{{dateSaved}}} and {{{datePublished}}} could be used in the folder name"
      )
      .addSearch((search) => {
        new FolderSuggest(this.app, search.inputEl)
        search
          .setPlaceholder("Enter the attachment folder")
          .setValue(this.plugin.settings.attachmentFolder)
          .onChange(async (value) => {
            this.plugin.settings.attachmentFolder = value
            await this.plugin.saveSettings()
          })
      })

    new Setting(containerEl)
      .setName("Is Single File")
      .setDesc(
        "Check this box if you want to save all articles in a single file"
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.isSingleFile)
          .onChange(async (value) => {
            this.plugin.settings.isSingleFile = value
            await this.plugin.saveSettings()
          })
      )

    new Setting(containerEl)
      .setName("Filename")
      .setDesc(
        "Enter the filename where the data will be stored. {{id}}, {{{title}}}, {{{dateSaved}}} and {{{datePublished}}} could be used in the filename"
      )
      .addText((text) =>
        text
          .setPlaceholder("Enter the filename")
          .setValue(this.plugin.settings.filename)
          .onChange(async (value) => {
            this.plugin.settings.filename = value
            await this.plugin.saveSettings()
          })
      )

    new Setting(containerEl)
      .setName("Filename Date Format")
      .setDesc(
        createFragment((fragment) => {
          fragment.append(
            "Enter the format date for use in rendered filename. Format ",
            fragment.createEl("a", {
              text: "reference",
              href: "https://moment.github.io/luxon/#/formatting?id=table-of-tokens",
            })
          )
        })
      )
      .addText((text) =>
        text
          .setPlaceholder("yyyy-MM-dd")
          .setValue(this.plugin.settings.filenameDateFormat)
          .onChange(async (value) => {
            this.plugin.settings.filenameDateFormat = value
            await this.plugin.saveSettings()
          })
      )

    new Setting(containerEl)
      .setName("Folder Date Format")
      .setDesc(
        createFragment((fragment) => {
          fragment.append(
            "Enter the format date for use in rendered folder name. Format ",
            fragment.createEl("a", {
              text: "reference",
              href: "https://moment.github.io/luxon/#/formatting?id=table-of-tokens",
            })
          )
        })
      )
      .addText((text) =>
        text
          .setPlaceholder("yyyy-MM-dd")
          .setValue(this.plugin.settings.folderDateFormat)
          .onChange(async (value) => {
            this.plugin.settings.folderDateFormat = value
            await this.plugin.saveSettings()
          })
      )
    new Setting(containerEl)
      .setName("Date Saved Format")
      .setDesc(
        "Enter the date format for dateSaved variable in rendered template"
      )
      .addText((text) =>
        text
          .setPlaceholder("yyyy-MM-dd'T'HH:mm:ss")
          .setValue(this.plugin.settings.dateSavedFormat)
          .onChange(async (value) => {
            this.plugin.settings.dateSavedFormat = value
            await this.plugin.saveSettings()
          })
      )
    new Setting(containerEl)
      .setName("Date Highlighted Format")
      .setDesc(
        "Enter the date format for dateHighlighted variable in rendered template"
      )
      .addText((text) =>
        text
          .setPlaceholder("Date Highlighted Format")
          .setValue(this.plugin.settings.dateHighlightedFormat)
          .onChange(async (value) => {
            this.plugin.settings.dateHighlightedFormat = value
            await this.plugin.saveSettings()
          })
      )

    containerEl.createEl("h5", {
      cls: "omnivore-collapsible",
      text: "Advanced Settings",
    })

    const advancedSettings = containerEl.createEl("div", {
      cls: "omnivore-content",
    })

    new Setting(advancedSettings)
      .setName("API Endpoint")
      .setDesc("Enter the Omnivore server's API endpoint")
      .addText((text) =>
        text
          .setPlaceholder("API endpoint")
          .setValue(this.plugin.settings.endpoint)
          .onChange(async (value) => {
            this.plugin.settings.endpoint = value
            await this.plugin.saveSettings()
          })
      )

    new Setting(advancedSettings)
      .setName("Front Matter Template")
      .setDesc(
        createFragment((fragment) => {
          fragment.append(
            "Enter YAML template to render the front matter with ",
            fragment.createEl("a", {
              text: "Reference",
              href: "https://docs.omnivore.app/integrations/obsidian.html#front-matter-template",
            }),
            fragment.createEl("br"),
            fragment.createEl("br"),
            "We recommend you to use Front Matter section under the basic settings to define the metadata.",
            fragment.createEl("br"),
            fragment.createEl("br"),
            "If this template is set, it will override the Front Matter so please make sure your template is a valid YAML."
          )
        })
      )
      .addTextArea((text) => {
        text
          .setPlaceholder("Enter the template")
          .setValue(this.plugin.settings.frontMatterTemplate)
          .onChange(async (value) => {
            this.plugin.settings.frontMatterTemplate = value
            await this.plugin.saveSettings()
          })

        text.inputEl.setAttr("rows", 10)
        text.inputEl.setAttr("cols", 30)
      })
      .addExtraButton((button) => {
        // add a button to reset template
        button
          .setIcon("reset")
          .setTooltip("Reset front matter template")
          .onClick(async () => {
            this.plugin.settings.frontMatterTemplate =
              DEFAULT_SETTINGS.frontMatterTemplate
            await this.plugin.saveSettings()
            this.display()
            new Notice("Front matter template reset")
          })
      })

    const help = containerEl.createEl("p")
    help.innerHTML = `For more information, please visit our <a href="https://github.com/omnivore-app/obsidian-omnivore">GitHub page</a>, email us at <a href="mailto:feedback@omnivore.app">feedback@omnivore.app</a> or join our <a href="https://discord.gg/h2z5rppzz9">Discord server</a>.`

    // script to make collapsible sections
    const coll = document.getElementsByClassName("omnivore-collapsible")
    let i

    for (i = 0; i < coll.length; i++) {
      coll[i].addEventListener("click", function () {
        this.classList.toggle("omnivore-active")
        const content = this.nextElementSibling
        if (content.style.maxHeight) {
          content.style.maxHeight = null
        } else {
          content.style.maxHeight = "fit-content"
        }
      })
    }
  }
}
