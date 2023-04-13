import { DateTime } from "luxon";
import {
  addIcon,
  normalizePath,
  Notice,
  Plugin,
  requestUrl,
  TFile,
  TFolder,
} from "obsidian";
import { Article, loadArticles } from "./api";
import {
  DEFAULT_SETTINGS,
  OmnivoreSettings,
  OmnivoreSettingTab,
} from "./settings";
import {
  renderArticleContnet,
  renderAttachmentFolder,
  renderFilename,
  renderFolderName,
} from "./template";
import {
  DATE_FORMAT,
  formatDate,
  getQueryFromFilter,
  parseDateTime,
  replaceIllegalChars,
} from "./util";

export const downloadFileAsAttachment = async (
  article: Article,
  attachmentFolder: string,
  folderDateFormat: string
): Promise<string> => {
  // download pdf from the URL to the attachment folder
  const url = article.url;
  const response = await requestUrl({
    url,
    contentType: "application/pdf",
  });
  const folderName = normalizePath(
    renderAttachmentFolder(article, attachmentFolder, folderDateFormat)
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
};

export default class OmnivorePlugin extends Plugin {
  settings: OmnivoreSettings;

  async onload() {
    await this.loadSettings();
    await this.resetSyncingStateSetting();
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
      attachmentFolder,
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
          const content = await renderArticleContnet(
            article,
            template,
            highlightOrder,
            this.settings.dateHighlightedFormat,
            this.settings.dateSavedFormat,
            attachmentFolder,
            folderDateFormat
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
