import { DateTime } from "luxon";
import Mustache from "mustache";
import {
  addIcon,
  App,
  normalizePath,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  stringifyYaml,
  TFile,
  TFolder,
} from "obsidian";
import {
  Article,
  compareHighlightsInFile,
  DATE_FORMAT,
  formatDate,
  getHighlightLocation,
  loadArticles,
  PageType,
  parseDateTime,
  replaceIllegalChars,
} from "./util";
import { FolderSuggest } from "./settings/file-suggest";

enum Filter {
  ALL = "import all my articles",
  HIGHLIGHTS = "import just highlights",
  ADVANCED = "advanced",
}

enum HighlightOrder {
  LOCATION = "the location of highlights in the article",
  TIME = "the time that highlights are updated",
}

interface Settings {
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
}
const DEFAULT_SETTINGS: Settings = {
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
> {{{text}}} [⤴️]({{{highlightUrl}}})
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
  filename: "{{{title}}}",
};

export default class OmnivorePlugin extends Plugin {
  settings: Settings;

  async onload() {
    await this.loadSettings();

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

  getFilename(article: Article) {
    const { filename, folderDateFormat } = this.settings;
    const date = formatDate(article.savedAt, folderDateFormat);
    return Mustache.render(filename, {
      ...article,
      date,
    });
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
    } = this.settings;

    if (syncing) return;

    if (!apiKey) {
      new Notice("Missing Omnivore api key");

      return;
    }

    this.settings.syncing = true;
    await this.saveSettings();

    try {
      console.log(`obsidian-omnivore starting sync since: '${syncAt}'`);

      new Notice("🚀 Fetching articles ...");

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
          this.getQueryFromFilter(filter, customQuery),
          true,
          "markdown"
        );

        for (const article of articles) {
          const folderDate = formatDate(
            article.savedAt,
            this.settings.folderDateFormat
          );
          const folderName = Mustache.render(folder, {
            date: folderDate,
          });
          const omnivoreFolder = app.vault.getAbstractFileByPath(
            normalizePath(folderName)
          );
          if (!(omnivoreFolder instanceof TFolder)) {
            await this.app.vault.createFolder(folderName);
          }

          // sort highlights by location if selected in options
          highlightOrder === "LOCATION" &&
            article.highlights?.sort((a, b) => {
              try {
                if (article.pageType === PageType.File) {
                  // sort by location in file
                  return compareHighlightsInFile(a, b);
                }
                // for web page, sort by location in the page
                return (
                  getHighlightLocation(a.patch) - getHighlightLocation(b.patch)
                );
              } catch (e) {
                console.error(e);
                return compareHighlightsInFile(a, b);
              }
            });
          const highlights = article.highlights?.map((highlight) => {
            return {
              text: highlight.quote,
              highlightUrl: `https://omnivore.app/me/${article.slug}#${highlight.id}`,
              dateHighlighted: formatDate(
                highlight.updatedAt,
                this.settings.dateHighlightedFormat
              ),
              note: highlight.annotation,
            };
          });
          const dateFormat = this.settings.dateSavedFormat;
          const dateSaved = formatDate(article.savedAt, dateFormat);
          const siteName =
            article.siteName ||
            this.siteNameFromUrl(article.originalArticleUrl);
          const publishedAt = article.publishedAt;
          const datePublished = publishedAt
            ? formatDate(publishedAt, dateFormat)
            : null;
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
          // use the custom filename
          const filename = replaceIllegalChars(this.getFilename(article));
          const pageName = `${folderName}/${filename}.md`;
          const normalizedPath = normalizePath(pageName);
          const omnivoreFile = app.vault.getAbstractFileByPath(normalizedPath);
          try {
            if (omnivoreFile instanceof TFile) {
              await app.fileManager.processFrontMatter(
                omnivoreFile,
                async (frontMatter) => {
                  const id = frontMatter.id;
                  if (id && id !== article.id) {
                    // this article has the same name but different id
                    const newPageName = `${folderName}/${filename}-${article.id}.md`;
                    const newNormalizedPath = normalizePath(newPageName);
                    const newOmnivoreFile =
                      app.vault.getAbstractFileByPath(newNormalizedPath);
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

  getQueryFromFilter(filter: string, customQuery: string): string {
    switch (filter) {
      case "ALL":
        return "";
      case "HIGHLIGHTS":
        return `has:highlights`;
      case "ADVANCED":
        return customQuery;
      default:
        return "";
    }
  }

  siteNameFromUrl(originalArticleUrl: string): string {
    try {
      return new URL(originalArticleUrl).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
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
              href: "https://github.com/janl/mustache.js/#templates",
            }),
            fragment.createEl("p", {
              text: "Available variables: id, title, omnivoreUrl, siteName, originalUrl, author, content, dateSaved, labels.name, highlights.text, highlights.highlightUrl, highlights.note, highlights.dateHighlighted",
            }),
            fragment.createEl("p", {
              text: "Please note that id in the frontmatter is required for the plugin to work properly.",
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
        text.inputEl.setAttr("rows", 10);
        text.inputEl.setAttr("cols", 40);
      });

    new Setting(generalSettings)
      .setName("Folder")
      .setDesc(
        "Enter the folder where the data will be stored. {{date}} could be used in the folder name"
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
      .setName("Filename")
      .setDesc(
        "Enter the filename where the data will be stored. {{{title}}} and {{date}} could be used in the filename"
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
            console.log("endpoint: " + value);
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
