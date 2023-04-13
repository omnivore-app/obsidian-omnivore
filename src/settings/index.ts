import { App, PluginSettingTab, Setting } from "obsidian";
import OmnivorePlugin from "src/main";
import { DEFAULT_TEMPLATE } from "src/template";
import { FolderSuggest } from "./file-suggest";

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

export class OmnivoreSettingTab extends PluginSettingTab {
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
              text: "Available variables: id, title, omnivoreUrl, siteName, originalUrl, author, content, description, dateSaved, datePublished, pdfAttachment, note, labels.name, highlights.text, highlights.highlightUrl, highlights.note, highlights.dateHighlighted, highlights.labels.name",
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
