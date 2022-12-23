import { DateTime } from "luxon";
import Mustache from "mustache";
import {
  App,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  addIcon,
  normalizePath,
} from "obsidian";
import {
  Article,
  loadArticles,
  parseDateTime,
  DATE_FORMAT,
  PageType,
  compareHighlightsInFile,
  getHighlightLocation,
} from "./util";

// Remember to rename these classes and interfaces!
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
  filter: Filter;
  syncAt: string;
  frequency: number;
  customQuery: string;
  highlightOrder: HighlightOrder;
  articleTemplate: string;
  highlightTemplate: string;
  syncing: boolean;
  folder: string;
}

const DEFAULT_SETTINGS: Settings = {
  apiKey: "",
  filter: Filter.HIGHLIGHTS,
  syncAt: "",
  frequency: 60,
  customQuery: "",
  articleTemplate: `[{{{title}}}]({{{omnivoreUrl}}})
  site: {{#siteName}}[{{{siteName}}}]{{/siteName}}({{{originalUrl}}})
  {{#author}}
  author: {{{author}}}
  {{/author}}
  {{#labels.length}}
  labels: {{#labels}}[[{{{name}}}]]{{/labels}}
  {{/labels.length}}
  date_saved: {{{dateSaved}}}`,
  highlightTemplate: `> {{{text}}} [⤴️]({{{highlightUrl}}})`,
  highlightOrder: HighlightOrder.TIME,
  syncing: false,
  folder: "Omnivore",
};

export default class OmnivorePlugin extends Plugin {
  settings: Settings;

  async onload() {
    await this.loadSettings();

    const iconId = "obsidian-omnivore";
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

    // When registering intervals, this function will automatically clear the interval when the plugin is disabled.
    if (this.settings.frequency > 0) {
      this.registerInterval(
        window.setInterval(
          () => console.log("setInterval"),
          this.settings.frequency * 60 * 1000
        )
      );
    }
  }

  onunload() {}

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async fetchOmnivore() {
    const {
      syncAt,
      apiKey,
      filter,
      customQuery,
      highlightOrder,
      syncing,
      articleTemplate,
      highlightTemplate,
      folder,
    } = this.settings;

    if (syncing) return;

    if (!apiKey) {
      new Notice("Missing Omnivore api key");

      return;
    }

    this.settings.syncing = true;
    await this.saveSettings();

    const folderName = folder || "Omnivore";
    if (!(await this.app.vault.adapter.exists(normalizePath(folderName)))) {
      await this.app.vault.createFolder(folderName);
    }

    try {
      console.log(`obsidian-omnivore starting sync since: '${syncAt}`);

      new Notice("🚀 Fetching articles ...");

      const size = 50;
      for (
        let hasNextPage = true, articles: Article[] = [], after = 0;
        hasNextPage;
        after += size
      ) {
        [articles, hasNextPage] = await loadArticles(
          apiKey,
          after,
          size,
          parseDateTime(syncAt).toISO(),
          this.getQueryFromFilter(filter, customQuery)
        );

        for (const article of articles) {
          const pageName = `${folderName}/${article.slug}.md`;
          const siteName =
            article.siteName ||
            this.siteNameFromUrl(article.originalArticleUrl);
          const dateSaved = new Date(article.savedAt).toString();
          // Build content string based on template
          let content = Mustache.render(articleTemplate, {
            title: article.title,
            omnivoreUrl: `https://omnivore.app/me/${article.slug}`,
            siteName,
            originalUrl: article.originalArticleUrl,
            author: article.author,
            labels: article.labels,
            dateSaved,
          });

          // sort highlights by location if selected in options
          highlightOrder === HighlightOrder.LOCATION &&
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

          content += "\n\n";

          if (article.highlights && article.highlights.length > 0) {
            content += "## Highlights\n\n";

            for (const highlight of article.highlights) {
              const highlightContent = Mustache.render(highlightTemplate, {
                text: highlight.quote,
                highlightUrl: `https://omnivore.app/me/${article.slug}#${highlight.id}`,
                dateHighlighted: new Date(highlight.updatedAt).toString(),
              });

              content += `${highlightContent}\n\n`;
            }
          }

          await this.app.vault.adapter.write(normalizePath(pageName), content);
        }
      }

      new Notice("🔖 Articles fetched");
      this.settings.syncAt = DateTime.local().toFormat(DATE_FORMAT);
      this.saveSettings();
    } catch (e) {
      new Notice("Failed to fetch articles");
      console.error(e);
    } finally {
      this.settings.syncing = false;
      this.saveSettings();
    }
  }

  getQueryFromFilter(filter: Filter, customQuery: string): string {
    switch (filter) {
      case Filter.ALL:
        return "";
      case Filter.HIGHLIGHTS:
        return `has:highlights`;
      case Filter.ADVANCED:
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

    containerEl.createEl("h2", { text: "Settings for omnivore plugin." });

    new Setting(containerEl)
      .setName("Api Key")
      .setDesc("You can create an API key at https://omnivore.app/settings/api")
      .addText((text) =>
        text
          .setPlaceholder("Enter your Omnivore Api Key")
          .setValue(this.plugin.settings.apiKey)
          .onChange(async (value) => {
            console.log("apiKey: " + value);
            this.plugin.settings.apiKey = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Filter")
      .setDesc("Select an Omnivore search filter type")
      .addDropdown((dropdown) => {
        dropdown.addOptions(Filter);
        dropdown
          .setValue(this.plugin.settings.filter)
          .onChange(async (value: Filter) => {
            console.log("filter: " + value);
            this.plugin.settings.filter = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Custom query")
      .setDesc(
        "See https://omnivore.app/help/search for more info on search query syntax"
      )
      .addText((text) =>
        text
          .setPlaceholder(
            "Enter an Omnivore custom search query if advanced filter is selected"
          )
          .setValue(this.plugin.settings.customQuery)
          .onChange(async (value) => {
            console.log("query: " + value);
            this.plugin.settings.customQuery = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Frequency")
      .setDesc(
        "Enter sync with Omnivore frequency in minutes here or 0 to disable"
      )
      .addText((text) =>
        text
          .setPlaceholder("Enter sync frequency in minutes")
          .setValue(this.plugin.settings.frequency.toString())
          .onChange(async (value) => {
            console.log("frequency: " + value);
            this.plugin.settings.frequency = parseInt(value);
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Last Sync")
      .setDesc("Last time the plugin synced with Omnivore")
      .addMomentFormat((momentFormat) =>
        momentFormat
          .setPlaceholder("Last Sync")
          .setValue(this.plugin.settings.syncAt)
          .setDefaultFormat("yyyy-MM-dd'T'HH:mm:ss")
          .onChange(async (value) => {
            console.log("syncAt: " + value);
            this.plugin.settings.syncAt = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Highlight Order")
      .setDesc("Select the order in which highlights are applied")
      .addDropdown((dropdown) => {
        dropdown.addOptions(HighlightOrder);
        dropdown
          .setValue(this.plugin.settings.highlightOrder)
          .onChange(async (value: HighlightOrder) => {
            console.log("highlightOrder: " + value);
            this.plugin.settings.highlightOrder = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Article Template")
      .setDesc("Enter the template for the article")
      .addTextArea((text) =>
        text
          .setPlaceholder("Enter the article template")
          .setValue(this.plugin.settings.articleTemplate)
          .onChange(async (value) => {
            console.log("articleTemplate: " + value);
            this.plugin.settings.articleTemplate = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Highlight Template")
      .setDesc("Enter the template for the highlight")
      .addTextArea((text) =>
        text
          .setPlaceholder("Enter the highlight template")
          .setValue(this.plugin.settings.highlightTemplate)
          .onChange(async (value) => {
            console.log("highlightTemplate: " + value);
            this.plugin.settings.highlightTemplate = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Folder")
      .setDesc("Enter the folder where the data will be stored")
      .addText((text) =>
        text
          .setPlaceholder("Enter the folder")
          .setValue(this.plugin.settings.folder)
          .onChange(async (value) => {
            console.log("folder: " + value);
            this.plugin.settings.folder = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
