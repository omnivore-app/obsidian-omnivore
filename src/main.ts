import { DateTime } from "luxon";
import {
  addIcon,
  App,
  normalizePath,
  Notice,
  parseYaml,
  Plugin,
  PluginSettingTab,
  requestUrl,
  Setting,
  TFile,
  TFolder,
} from "obsidian";
import { Article, loadArticles, PageType } from "./api";
import {
  DEFAULT_SETTINGS,
  Filter,
  HighlightOrder,
  OmnivoreSettings,
} from "./settings";
import { FolderSuggest } from "./settings/file-suggest";
import {
  preParseTemplate,
  renderArticleContnet,
  renderAttachmentFolder,
  renderFilename,
  renderFolderName,
} from "./settings/template";
import {
  DATE_FORMAT,
  formatDate,
  getQueryFromFilter,
  parseDateTime,
  replaceIllegalChars,
} from "./util";

export default class OmnivorePlugin extends Plugin {
  settings: OmnivoreSettings;

  async onload() {
    await this.loadSettings();
    await this.resetSyncingStateSetting();

    // update version if needed
    const latestVersion = this.manifest.version;
    const currentVersion = this.settings.version;
    if (latestVersion !== currentVersion) {
      this.settings.version = latestVersion;
      this.saveSettings();
      // show release notes
      const releaseNotes = `Omnivore plugin is upgraded to ${latestVersion}.
    
    What's new: https://github.com/omnivore-app/obsidian-omnivore/blob/main/CHANGELOG.md
    `;
      new Notice(releaseNotes, 10000);
    }

    this.addCommand({
      id: "sync",
      name: "Sync",
      callback: () => {
        this.fetchOmnivore();
      },
    });

    this.addCommand({
      id: "resync",
      name: "Resync all articles",
      callback: () => {
        this.settings.syncAt = "";
        this.saveSettings();
        new Notice("Omnivore Last Sync reset");
        this.fetchOmnivore();
      },
    });

    const iconId = "Omnivore";
    // add icon
    addIcon(
      iconId,
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="100%" height="100%" viewBox="0 0 21 21" version="1.1">
    <g id="surface1">
    <path style=" stroke:none;fill-rule:evenodd;fill:rgb(63.137255%,62.352941%,61.176471%);fill-opacity:1;" d="M 9.839844 0.0234375 C 15.9375 -0.382812 21.058594 4.171875 21.140625 10.269531 C 21.140625 10.921875 20.976562 11.734375 20.816406 12.464844 C 20.410156 14.253906 18.785156 15.472656 16.992188 15.472656 L 16.914062 15.472656 C 14.71875 15.472656 13.253906 13.601562 13.253906 11.566406 L 13.253906 9.292969 L 11.953125 11.242188 L 11.871094 11.324219 C 11.140625 11.972656 10.082031 11.972656 9.351562 11.324219 L 9.1875 11.242188 L 7.808594 9.210938 L 7.808594 14.496094 L 5.9375 14.496094 L 5.9375 8.15625 C 5.9375 6.855469 7.484375 6.042969 8.539062 7.015625 L 8.621094 7.097656 L 10.488281 9.859375 L 12.441406 7.179688 L 12.519531 7.097656 C 13.496094 6.285156 15.121094 6.933594 15.121094 8.316406 L 15.121094 11.570312 C 15.121094 12.789062 15.851562 13.601562 16.910156 13.601562 L 16.992188 13.601562 C 17.964844 13.601562 18.777344 12.953125 19.023438 12.058594 C 19.183594 11.328125 19.265625 10.757812 19.265625 10.269531 C 19.265625 5.308594 15.039062 1.570312 10 1.898438 C 5.6875 2.140625 2.195312 5.636719 1.871094 9.863281 C 1.542969 14.90625 5.53125 19.132812 10.488281 19.132812 L 10.488281 21 C 4.390625 21 -0.410156 15.878906 -0.00390625 9.78125 C 0.40625 4.578125 4.554688 0.351562 9.839844 0.0234375 Z M 9.839844 0.0234375 "/>
    </g>
    </svg>`
    );

    // This creates an icon in the left ribbon.
    this.addRibbonIcon(iconId, iconId, async (evt: MouseEvent) => {
      // Called when the user clicks the icon.
      await this.fetchOmnivore();
    });

    // This adds a settings tab so the user can configure various aspects of the plugin
    this.addSettingTab(new OmnivoreSettingTab(this.app, this));
  }

  onunload() {}

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async downloadFileAsAttachment(article: Article): Promise<string> {
    // download pdf from the URL to the attachment folder
    const url = article.url;
    const response = await requestUrl({
      url,
      contentType: "application/pdf",
    });
    const folderName = normalizePath(
      renderAttachmentFolder(
        article,
        this.settings.attachmentFolder,
        this.settings.folderDateFormat
      )
    );
    const folder = app.vault.getAbstractFileByPath(folderName);
    if (!(folder instanceof TFolder)) {
      await app.vault.createFolder(folderName);
    }
    const fileName = normalizePath(`${folderName}/${article.id}.pdf`);
    const file = app.vault.getAbstractFileByPath(fileName);
    if (!(file instanceof TFile)) {
      const newFile = await app.vault.createBinary(
        fileName,
        response.arrayBuffer
      );
      return newFile.path;
    }
    return file.path;
  }

  isArticleInFile(frontMatter: unknown, id: string): boolean {
    // check if frontMatter is an array
    if (!Array.isArray(frontMatter)) {
      return false;
    }
    // check if id is in frontMatter
    return frontMatter.some((f: { id: string }) => f.id === id);
  }

  getFrontMatterFromContent(content: string): unknown | undefined {
    // get front matter yaml from content
    const frontMatter = content.match(/^---\n(.*)\n---\n/);
    if (!frontMatter) {
      return undefined;
    }
    // parse yaml
    return parseYaml(frontMatter[1]);
  }

  async fetchOmnivore() {
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
      folderDateFormat,
      isSingleFile,
    } = this.settings;

    if (syncing) {
      new Notice("🐢 Already syncing ...");
      return;
    }

    if (!apiKey) {
      new Notice("Missing Omnivore api key");

      return;
    }

    this.settings.syncing = true;
    await this.saveSettings();

    try {
      console.log(`obsidian-omnivore starting sync since: '${syncAt}'`);

      new Notice("🚀 Fetching articles ...");

      // pre-parse template
      preParseTemplate(template);

      const size = 50;
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
          parseDateTime(syncAt).toISO(),
          getQueryFromFilter(filter, customQuery),
          true,
          "markdown"
        );

        for (const article of articles) {
          const folderDate = formatDate(
            article.savedAt,
            this.settings.folderDateFormat
          );
          const folderName = normalizePath(
            renderFolderName(folder, folderDate)
          );
          const omnivoreFolder =
            this.app.vault.getAbstractFileByPath(folderName);
          if (!(omnivoreFolder instanceof TFolder)) {
            await this.app.vault.createFolder(folderName);
          }
          const fileAttachment =
            article.pageType === PageType.File
              ? await this.downloadFileAsAttachment(article)
              : undefined;
          const content = await renderArticleContnet(
            article,
            template,
            highlightOrder,
            this.settings.dateHighlightedFormat,
            this.settings.dateSavedFormat,
            isSingleFile,
            fileAttachment
          );
          // use the custom filename
          const customFilename = replaceIllegalChars(
            renderFilename(article, filename, folderDateFormat)
          );
          const pageName = `${folderName}/${customFilename}.md`;
          const normalizedPath = normalizePath(pageName);
          const omnivoreFile =
            this.app.vault.getAbstractFileByPath(normalizedPath);
          try {
            if (omnivoreFile instanceof TFile) {
              // file exists, so we might need to update it
              if (isSingleFile) {
                // a single file is used to store all articles
                // we need to check if the article already exists in the file
                await this.app.fileManager.processFrontMatter(
                  omnivoreFile,
                  async (frontMatter) => {
                    // we need to remove the front matter
                    const contentWithoutFrontmatter = content.replace(
                      /^---\n.*\n---\n/,
                      ""
                    );
                    if (this.isArticleInFile(frontMatter, article.id)) {
                      // this article already exists in the file
                      // we need to locate the article and update it
                      const existingContent = await this.app.vault.read(
                        omnivoreFile
                      );
                      const newContent = existingContent.replace(
                        new RegExp(
                          `^---\nid:\n- ${article.id}\n.*\n---\n`,
                          "m"
                        ),
                        contentWithoutFrontmatter
                      );
                      await this.app.vault.modify(omnivoreFile, newContent);
                      return;
                    }
                    // this article doesn't exist in the file
                    // append the article
                    await this.app.vault.append(
                      omnivoreFile,
                      contentWithoutFrontmatter
                    );
                    // append generated front matter
                    const newFrontMatter =
                      this.getFrontMatterFromContent(content);
                    frontMatter.push(
                      Array.isArray(newFrontMatter)
                        ? newFrontMatter[0]
                        : newFrontMatter
                    );
                    console.log(frontMatter);
                  }
                );
              } else {
                await this.app.fileManager.processFrontMatter(
                  omnivoreFile,
                  async (frontMatter) => {
                    const id = frontMatter.id;
                    if (id && id !== article.id) {
                      // this article has the same name but different id
                      const newPageName = `${folderName}/${customFilename}-${article.id}.md`;
                      const newNormalizedPath = normalizePath(newPageName);
                      const newOmnivoreFile =
                        this.app.vault.getAbstractFileByPath(newNormalizedPath);
                      if (newOmnivoreFile instanceof TFile) {
                        // a file with the same name and id already exists, so we need to update it
                        const existingContent = await this.app.vault.read(
                          newOmnivoreFile
                        );
                        if (existingContent !== content) {
                          await this.app.vault.modify(newOmnivoreFile, content);
                        }
                        return;
                      }
                      // a file with the same name but different id already exists, so we need to create it
                      await this.app.vault.create(newNormalizedPath, content);
                      return;
                    }
                    // a file with the same id already exists, so we might need to update it
                    const existingContent = await this.app.vault.read(
                      omnivoreFile
                    );
                    if (existingContent !== content) {
                      await this.app.vault.modify(omnivoreFile, content);
                    }
                  }
                );
              }
            } else if (!omnivoreFile) {
              // file doesn't exist, so we need to create it
              await this.app.vault.create(normalizedPath, content);
            }
          } catch (e) {
            console.error(e);
          }
        }
      }

      new Notice("🔖 Articles fetched");
      this.settings.syncAt = DateTime.local().toFormat(DATE_FORMAT);
    } catch (e) {
      new Notice("Failed to fetch articles");
      console.error(e);
    } finally {
      this.settings.syncing = false;
      await this.saveSettings();
    }
  }

  private async resetSyncingStateSetting() {
    this.settings.syncing = false;
    await this.saveSettings();
  }
}

class OmnivoreSettingTab extends PluginSettingTab {
  plugin: OmnivorePlugin;

  constructor(app: App, plugin: OmnivorePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    containerEl.createEl("h2", { text: "Settings for Omnivore plugin" });

    // create a group of general settings
    containerEl.createEl("h3", {
      cls: "omnivore-collapsible",
      text: "General Settings",
    });

    const generalSettings = containerEl.createEl("div", {
      cls: "omnivore-content",
    });

    new Setting(generalSettings)
      .setName("API Key")
      .setDesc(
        createFragment((fragment) => {
          fragment.append(
            "You can create an API key at ",
            fragment.createEl("a", {
              text: "https://omnivore.app/settings/api",
              href: "https://omnivore.app/settings/api",
            })
          );
        })
      )
      .addText((text) =>
        text
          .setPlaceholder("Enter your Omnivore Api Key")
          .setValue(this.plugin.settings.apiKey)
          .onChange(async (value) => {
            this.plugin.settings.apiKey = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(generalSettings)
      .setName("Filter")
      .setDesc("Select an Omnivore search filter type")
      .addDropdown((dropdown) => {
        dropdown.addOptions(Filter);
        dropdown
          .setValue(this.plugin.settings.filter)
          .onChange(async (value) => {
            this.plugin.settings.filter = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(generalSettings)
      .setName("Custom query")
      .setDesc(
        createFragment((fragment) => {
          fragment.append(
            "See ",
            fragment.createEl("a", {
              text: "https://omnivore.app/help/search",
              href: "https://omnivore.app/help/search",
            }),
            " for more info on search query syntax"
          );
        })
      )
      .addText((text) =>
        text
          .setPlaceholder(
            "Enter an Omnivore custom search query if advanced filter is selected"
          )
          .setValue(this.plugin.settings.customQuery)
          .onChange(async (value) => {
            this.plugin.settings.customQuery = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(generalSettings)
      .setName("Last Sync")
      .setDesc("Last time the plugin synced with Omnivore")
      .addMomentFormat((momentFormat) =>
        momentFormat
          .setPlaceholder("Last Sync")
          .setValue(this.plugin.settings.syncAt)
          .setDefaultFormat("yyyy-MM-dd'T'HH:mm:ss")
          .onChange(async (value) => {
            this.plugin.settings.syncAt = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(generalSettings)
      .setName("Highlight Order")
      .setDesc("Select the order in which highlights are applied")
      .addDropdown((dropdown) => {
        dropdown.addOptions(HighlightOrder);
        dropdown
          .setValue(this.plugin.settings.highlightOrder)
          .onChange(async (value) => {
            this.plugin.settings.highlightOrder = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(generalSettings)
      .setName("Template")
      .setDesc(
        createFragment((fragment) => {
          fragment.append(
            "Enter template to render articles with ",
            fragment.createEl("a", {
              text: "Reference",
              href: "https://docs.omnivore.app/integrations/obsidian.html#controlling-the-layout-of-the-data-imported-to-obsidian",
            })
          );
        })
      )
      .addTextArea((text) => {
        text
          .setPlaceholder("Enter the template")
          .setValue(this.plugin.settings.template)
          .onChange(async (value) => {
            // TODO: validate template
            // if template is empty, use default template
            this.plugin.settings.template = value
              ? value
              : DEFAULT_SETTINGS.template;
            await this.plugin.saveSettings();
          });
        text.inputEl.setAttr("rows", 30);
        text.inputEl.setAttr("cols", 60);
      });

    new Setting(generalSettings)
      .setName("Folder")
      .setDesc(
        "Enter the folder where the data will be stored. {{{date}}} could be used in the folder name"
      )
      .addSearch((search) => {
        new FolderSuggest(this.app, search.inputEl);
        search
          .setPlaceholder("Enter the folder")
          .setValue(this.plugin.settings.folder)
          .onChange(async (value) => {
            this.plugin.settings.folder = value;
            await this.plugin.saveSettings();
          });
      });
    new Setting(generalSettings)
      .setName("Attachment Folder")
      .setDesc(
        "Enter the folder where the attachment will be downloaded to. {{{date}}} could be used in the folder name"
      )
      .addSearch((search) => {
        new FolderSuggest(this.app, search.inputEl);
        search
          .setPlaceholder("Enter the attachment folder")
          .setValue(this.plugin.settings.attachmentFolder)
          .onChange(async (value) => {
            this.plugin.settings.attachmentFolder = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(generalSettings)
      .setName("Is Single File")
      .setDesc(
        "Check this box if you want to save all articles in a single file"
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.isSingleFile)
          .onChange(async (value) => {
            this.plugin.settings.isSingleFile = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(generalSettings)
      .setName("Filename")
      .setDesc(
        "Enter the filename where the data will be stored. {{{title}}} and {{{date}}} could be used in the filename"
      )
      .addText((text) =>
        text
          .setPlaceholder("Enter the filename")
          .setValue(this.plugin.settings.filename)
          .onChange(async (value) => {
            this.plugin.settings.filename = value;
            await this.plugin.saveSettings();
          })
      );
    new Setting(generalSettings)
      .setName("Folder Date Format")
      .setDesc(
        createFragment((fragment) => {
          fragment.append(
            "Enter the format date for use in rendered template. Format ",
            fragment.createEl("a", {
              text: "reference",
              href: "https://moment.github.io/luxon/#/formatting?id=table-of-tokens",
            })
          );
        })
      )
      .addText((text) =>
        text
          .setPlaceholder("yyyy-MM-dd")
          .setValue(this.plugin.settings.folderDateFormat)
          .onChange(async (value) => {
            this.plugin.settings.folderDateFormat = value;
            await this.plugin.saveSettings();
          })
      );
    new Setting(generalSettings).setName("Date Saved Format").addText((text) =>
      text
        .setPlaceholder("yyyy-MM-dd'T'HH:mm:ss")
        .setValue(this.plugin.settings.dateSavedFormat)
        .onChange(async (value) => {
          this.plugin.settings.dateSavedFormat = value;
          await this.plugin.saveSettings();
        })
    );
    new Setting(generalSettings)
      .setName("Date Highlighted Format")
      .addText((text) =>
        text
          .setPlaceholder("Date Highlighted Format")
          .setValue(this.plugin.settings.dateHighlightedFormat)
          .onChange(async (value) => {
            this.plugin.settings.dateHighlightedFormat = value;
            await this.plugin.saveSettings();
          })
      );

    containerEl.createEl("h3", {
      cls: "omnivore-collapsible",
      text: "Advanced Settings",
    });

    const advancedSettings = containerEl.createEl("div", {
      cls: "omnivore-content",
    });

    new Setting(advancedSettings)
      .setName("API Endpoint")
      .setDesc("Enter the Omnivore server's API endpoint")
      .addText((text) =>
        text
          .setPlaceholder("API endpoint")
          .setValue(this.plugin.settings.endpoint)
          .onChange(async (value) => {
            this.plugin.settings.endpoint = value;
            await this.plugin.saveSettings();
          })
      );

    const help = containerEl.createEl("p");
    help.innerHTML = `For more information, please visit the <a href="https://github.com/omnivore-app/obsidian-omnivore/blob/master/README.md">plugin's GitHub page</a> or email us at <a href="mailto:feedback@omnivore.app">feedback@omnivore.app</a>.`;

    // script to make collapsible sections
    const coll = document.getElementsByClassName("omnivore-collapsible");
    let i;

    for (i = 0; i < coll.length; i++) {
      coll[i].addEventListener("click", function () {
        this.classList.toggle("omnivore-active");
        const content = this.nextElementSibling;
        if (content.style.maxHeight) {
          content.style.maxHeight = null;
        } else {
          content.style.maxHeight = "fit-content";
        }
      });
    }
  }
}
