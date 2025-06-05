import {
  App,
  ColorComponent,
  Notice,
  PluginSettingTab,
  Setting,
} from 'obsidian'
import OmnivorePlugin from './main'
import { FolderSuggest } from './settings/file-suggest'
import {
  DEFAULT_SETTINGS,
  FRONT_MATTER_VARIABLES,
  Filter,
  HighlightManagerId,
  HighlightOrder,
} from './settings'
import { getQueryFromFilter, setOrUpdateHighlightColors } from './util'
import { HighlightColors } from './api'

export class OmnivoreSettingTab extends PluginSettingTab {
  plugin: OmnivorePlugin

  constructor(app: App, plugin: OmnivorePlugin) {
    super(app, plugin)
    this.plugin = plugin
  }

  display(): void {
    const { containerEl } = this

    containerEl.empty()

    /**
     * General Options
     **/
    new Setting(containerEl)
      .setName('API Key')
      .setDesc(
        createFragment((fragment) => {
          fragment.append(
            'You can create an API key at ',
            fragment.createEl('a', {
              text: 'https://omnivore.mydomain.com/settings/api',
              href: 'https://omnivore.mydomain.com/settings/api',
            }),
          )
        }),
      )
      .addText((text) =>
        text
          .setPlaceholder('Enter your Omnivore Api Key')
          .setValue(this.plugin.settings.apiKey)
          .onChange(async (value) => {
            this.plugin.settings.apiKey = value
            await this.plugin.saveSettings()
          }),
      )
    new Setting(containerEl)
      .setName('API Endpoint')
      .setDesc("Enter the Omnivore server's API endpoint")
      .addText((text) =>
        text
          .setPlaceholder('API endpoint')
          .setValue(this.plugin.settings.endpoint)
          .onChange(async (value) => {
            this.plugin.settings.endpoint = value
            await this.plugin.saveSettings()
          }),
      )

    /**
     * Query Options
     **/
    containerEl.createEl('h3', { text: 'Query' })

    new Setting(containerEl)
      .setName('Filter')
      .setDesc(
        "Select an Omnivore search filter type. Changing this would update the 'Custom Query' accordingly and reset the 'Last sync' timestamp",
      )
      .addDropdown((dropdown) => {
        dropdown.addOptions(Filter)
        dropdown
          .setValue(this.plugin.settings.filter)
          .onChange(async (value) => {
            this.plugin.settings.filter = value
            this.plugin.settings.customQuery = getQueryFromFilter(value)
            this.plugin.settings.syncAt = ''
            await this.plugin.saveSettings()
            this.display()
          })
      })

    new Setting(containerEl)
      .setName('Custom Query')
      .setDesc(
        createFragment((fragment) => {
          fragment.append(
            'See ',
            fragment.createEl('a', {
              text: 'https://github.com/omnivore-app/docs.omnivore/tree/main/docs/using/search',
              href: 'https://github.com/omnivore-app/docs.omnivore/tree/main/docs/using/search',
            }),
            " for more info on search query syntax. Changing this would reset the 'Last Sync' timestamp",
          )
        }),
      )
      .addText((text) =>
        text
          .setPlaceholder(
            'Enter an Omnivore custom search query if advanced filter is selected',
          )
          .setValue(this.plugin.settings.customQuery)
          .onChange(async (value) => {
            this.plugin.settings.customQuery = value
            this.plugin.settings.syncAt = ''
            await this.plugin.saveSettings()
          }),
      )

    /**
     * Sync Options, such as folder location, file format, etc.
     **/
    containerEl.createEl('h3', { text: 'Sync' })

    new Setting(containerEl)
      .setName('Sync on startup')
      .setDesc(
        'Check this box if you want to sync with Omnivore when the app is loaded',
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.syncOnStart)
          .onChange(async (value) => {
            this.plugin.settings.syncOnStart = value
            await this.plugin.saveSettings()
          }),
      )
    new Setting(containerEl)
      .setName('Frequency')
      .setDesc(
        'Enter the frequency in minutes to sync with Omnivore automatically. 0 means manual sync',
      )
      .addText((text) =>
        text
          .setPlaceholder('Enter the frequency')
          .setValue(this.plugin.settings.frequency.toString())
          .onChange(async (value) => {
            // validate frequency
            const frequency = parseInt(value)
            if (isNaN(frequency)) {
              new Notice('Frequency must be a positive integer')
              return
            }
            // save frequency
            this.plugin.settings.frequency = frequency
            await this.plugin.saveSettings()

            this.plugin.scheduleSync()
          }),
      )

    new Setting(containerEl)
      .setName('Last Sync')
      .setDesc(
        "Last time the plugin synced with Omnivore. The 'Sync' command fetches articles updated after this timestamp",
      )
      .addMomentFormat((momentFormat) =>
        momentFormat
          .setPlaceholder('Last Sync')
          .setValue(this.plugin.settings.syncAt)
          .setDefaultFormat("yyyy-MM-dd'T'HH:mm:ss")
          .onChange(async (value) => {
            this.plugin.settings.syncAt = value
            await this.plugin.saveSettings()
          }),
      )

    new Setting(containerEl)
      .setName('Is Single File')
      .setDesc(
        'Check this box if you want to save all articles in a single file',
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.isSingleFile)
          .onChange(async (value) => {
            this.plugin.settings.isSingleFile = value
            await this.plugin.saveSettings()
          }),
      )

    new Setting(containerEl)
      .setName('Folder')
      .setDesc(
        'Enter the folder where the data will be stored. {{{title}}}, {{{dateSaved}}} and {{{datePublished}}} could be used in the folder name',
      )
      .addSearch((search) => {
        new FolderSuggest(this.app, search.inputEl)
        search
          .setPlaceholder('Enter the folder')
          .setValue(this.plugin.settings.folder)
          .onChange(async (value) => {
            this.plugin.settings.folder = value
            await this.plugin.saveSettings()
          })
      })
    new Setting(containerEl)
      .setName('Folder Date Format')
      .setDesc(
        createFragment((fragment) => {
          fragment.append(
            'If date is used as part of folder name, specify the format date for use. Format ',
            fragment.createEl('a', {
              text: 'reference',
              href: 'https://moment.github.io/luxon/#/formatting?id=table-of-tokens',
            }),
          )
        }),
      )
      .addText((text) =>
        text
          .setPlaceholder('yyyy-MM-dd')
          .setValue(this.plugin.settings.folderDateFormat)
          .onChange(async (value) => {
            this.plugin.settings.folderDateFormat = value
            await this.plugin.saveSettings()
          }),
      )

    new Setting(containerEl)
      .setName('Attachment Folder')
      .setDesc(
        'Enter the folder where the attachment will be downloaded to. {{{title}}}, {{{dateSaved}}} and {{{datePublished}}} could be used in the folder name',
      )
      .addSearch((search) => {
        new FolderSuggest(this.app, search.inputEl)
        search
          .setPlaceholder('Enter the attachment folder')
          .setValue(this.plugin.settings.attachmentFolder)
          .onChange(async (value) => {
            this.plugin.settings.attachmentFolder = value
            await this.plugin.saveSettings()
          })
      })

    new Setting(containerEl)
      .setName('Filename')
      .setDesc(
        'Enter the filename where the data will be stored. {{id}}, {{{title}}}, {{{dateSaved}}} and {{{datePublished}}} could be used in the filename',
      )
      .addText((text) =>
        text
          .setPlaceholder('Enter the filename')
          .setValue(this.plugin.settings.filename)
          .onChange(async (value) => {
            this.plugin.settings.filename = value
            await this.plugin.saveSettings()
          }),
      )

    new Setting(containerEl)
      .setName('Filename Date Format')
      .setDesc(
        createFragment((fragment) => {
          fragment.append(
            'If date is used as part of file name, specify the format date for use. Format ',
            fragment.createEl('a', {
              text: 'reference',
              href: 'https://moment.github.io/luxon/#/formatting?id=table-of-tokens',
            }),
          )
        }),
      )
      .addText((text) =>
        text
          .setPlaceholder('yyyy-MM-dd')
          .setValue(this.plugin.settings.filenameDateFormat)
          .onChange(async (value) => {
            this.plugin.settings.filenameDateFormat = value
            await this.plugin.saveSettings()
          }),
      )

    /**
     * Article Render Options
     **/
    containerEl.createEl('h3', { text: 'Article' })

    new Setting(containerEl)
      .setName('Front Matter')
      .setDesc(
        createFragment((fragment) => {
          fragment.append(
            'Enter the metadata to be used in your note separated by commas. You can also use custom aliases in the format of metatdata::alias, e.g. date_saved::date. ',
            fragment.createEl('br'),
            fragment.createEl('br'),
            'Available metadata can be found at ',
            fragment.createEl('a', {
              text: 'Reference',
              href: 'https://github.com/omnivore-app/docs.omnivore/tree/main/docs/integrations/obsidian.md#front-matter',
            }),
            fragment.createEl('br'),
            fragment.createEl('br'),
            'If you want to use a custom front matter template, you can enter it below under the advanced settings',
          )
        }),
      )
      .addTextArea((text) => {
        text
          .setPlaceholder('Enter the metadata')
          .setValue(this.plugin.settings.frontMatterVariables.join(','))
          .onChange(async (value) => {
            // validate front matter variables and deduplicate
            this.plugin.settings.frontMatterVariables = value
              .split(',')
              .map((v) => v.trim())
              .filter(
                (v, i, a) =>
                  FRONT_MATTER_VARIABLES.includes(v.split('::')[0]) &&
                  a.indexOf(v) === i,
              )
            await this.plugin.saveSettings()
          })
        text.inputEl.setAttr('rows', 4)
        text.inputEl.setAttr('cols', 30)
      })

    new Setting(containerEl)
      .setName('Article Template')
      .setDesc(
        createFragment((fragment) => {
          fragment.append(
            'Enter template to render articles with ',
            fragment.createEl('a', {
              text: 'Reference',
              href: 'https://github.com/omnivore-app/docs.omnivore/tree/main/docs/integrations/obsidian.md#controlling-the-layout-of-the-data-imported-to-obsidian',
            }),
            fragment.createEl('br'),
            fragment.createEl('br'),
            'If you want to use a custom front matter template, you can enter it below under the advanced settings',
          )
        }),
      )
      .addTextArea((text) => {
        text
          .setPlaceholder('Enter the template')
          .setValue(this.plugin.settings.template)
          .onChange(async (value) => {
            // if template is empty, use default template
            this.plugin.settings.template = value
              ? value
              : DEFAULT_SETTINGS.template
            await this.plugin.saveSettings()
          })
        text.inputEl.setAttr('rows', 25)
        text.inputEl.setAttr('cols', 50)
      })
      .addExtraButton((button) => {
        // add a button to reset template
        button
          .setIcon('reset')
          .setTooltip('Reset template')
          .onClick(async () => {
            this.plugin.settings.template = DEFAULT_SETTINGS.template
            await this.plugin.saveSettings()
            this.display()
            new Notice('Template reset')
          })
      })

    new Setting(containerEl)
      .setName('Date Saved Format')
      .setDesc(
        'Enter the date format for dateSaved variable in rendered template',
      )
      .addText((text) =>
        text
          .setPlaceholder("yyyy-MM-dd'T'HH:mm:ss")
          .setValue(this.plugin.settings.dateSavedFormat)
          .onChange(async (value) => {
            this.plugin.settings.dateSavedFormat = value
            await this.plugin.saveSettings()
          }),
      )

    new Setting(containerEl)
      .setName('Date Highlighted Format')
      .setDesc(
        'Enter the date format for dateHighlighted variable in rendered template',
      )
      .addText((text) =>
        text
          .setPlaceholder('Date Highlighted Format')
          .setValue(this.plugin.settings.dateHighlightedFormat)
          .onChange(async (value) => {
            this.plugin.settings.dateHighlightedFormat = value
            await this.plugin.saveSettings()
          }),
      )

    /**
     * Highlight Render Options in Article
     **/
    containerEl.createEl('h4', { text: 'Highlights' })

    new Setting(containerEl)
      .setName('Highlight Order')
      .setDesc('Select the order in which highlights are applied')
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
      .setName('Render Highlight Color')
      .setDesc(
        'Check this box if you want to render highlights with color used in the Omnivore App',
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableHighlightColorRender)
          .onChange(async (value) => {
            this.plugin.settings.enableHighlightColorRender = value
            await this.plugin.saveSettings()
            this.displayBlock(renderHighlightConfigContainer, value)
          }),
      )

    const renderHighlightConfigContainer = containerEl.createEl('div')
    this.displayBlock(
      renderHighlightConfigContainer,
      this.plugin.settings.enableHighlightColorRender,
    )
    new Setting(renderHighlightConfigContainer)
      .setName('Use Highlightr for Highlight styling')
      .setDesc(
        createFragment((fragment) => {
          fragment.append(
            fragment.createEl('a', {
              text: 'Highlightr',
              href: 'https://github.com/chetachiezikeuzor/Highlightr-Plugin',
            }),
            ' is a community plugin for managing highlight style and hotkeys',
            fragment.createEl('br'),
            "Check this if you'd like to delegate configuration of highlight color and styling to it",
            fragment.createEl('br'),
            'Ensure to select "css-class" as the highlight-method in the highlightr plugin',
          )
        }),
      )
      .addToggle((toggle) =>
        toggle
          .setValue(
            this.plugin.settings.highlightManagerId ==
              HighlightManagerId.HIGHLIGHTR,
          )
          .onChange(async (value) => {
            this.plugin.settings.highlightManagerId = value
              ? HighlightManagerId.HIGHLIGHTR
              : HighlightManagerId.OMNIVORE
            await this.plugin.saveSettings()
            this.displayBlock(omnivoreHighlightConfigContainer, !value)
          }),
      )

    const omnivoreHighlightConfigContainer =
      renderHighlightConfigContainer.createEl('div', {
        cls: 'omnivore-highlight-config-container',
      })
    this.displayBlock(
      omnivoreHighlightConfigContainer,
      this.plugin.settings.highlightManagerId == HighlightManagerId.OMNIVORE,
    )
    const highlighterSetting = new Setting(omnivoreHighlightConfigContainer)
    const colorPickers: { [color in string]: ColorComponent } = {}

    highlighterSetting
      .setName('Configure highlight colors')
      .setDesc(
        'Configure how the highlight colors in Omnivore should render in notes',
      )
      .addButton((button) => {
        button.setButtonText('Save')
        button.setTooltip('Save highlight color setting')
        button.setClass('omnivore-btn')
        button.setClass('omnivore-btn-primary')
        button.onClick(async (e) => {
          const highlightColorMapping =
            this.plugin.settings.highlightColorMapping
          Object.entries(colorPickers).forEach(([color, picker]) => {
            highlightColorMapping[color as HighlightColors] = picker.getValue()
          })
          setOrUpdateHighlightColors(highlightColorMapping)
          await this.plugin.saveSettings()
          new Notice('Saved highlight color settings')
        })
      })

    const getPenIcon = (hexCode: string) =>
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill=${hexCode} stroke=${hexCode} stroke-width="0" stroke-linecap="round" stroke-linejoin="round"><path d="M20.707 5.826l-3.535-3.533a.999.999 0 0 0-1.408-.006L7.096 10.82a1.01 1.01 0 0 0-.273.488l-1.024 4.437L4 18h2.828l1.142-1.129l3.588-.828c.18-.042.345-.133.477-.262l8.667-8.535a1 1 0 0 0 .005-1.42zm-9.369 7.833l-2.121-2.12l7.243-7.131l2.12 2.12l-7.242 7.131zM4 20h16v2H4z"/></svg>`

    const colorMap = this.plugin.settings.highlightColorMapping
    Object.entries(colorMap).forEach(([colorName, hexCode]) => {
      let penIcon = getPenIcon(hexCode)
      const settingItem = omnivoreHighlightConfigContainer.createEl('div')
      settingItem.addClass('omnivore-highlight-setting-item')
      const colorIcon = settingItem.createEl('span')
      colorIcon.addClass('omnivore-highlight-setting-icon')
      colorIcon.innerHTML = penIcon

      const colorSetting = new Setting(settingItem)
        .setName(colorName)
        .setDesc(hexCode)

      colorSetting.addColorPicker((colorPicker) => {
        colorPicker.setValue(hexCode)
        colorPickers[colorName] = colorPicker
        colorPicker.onChange((v) => {
          penIcon = getPenIcon(v)
          colorIcon.innerHTML = penIcon
          colorSetting.setDesc(v)
        })
      })
    })

    /**
     * Advanced Settings
     **/
    containerEl.createEl('h3', {
      cls: 'omnivore-collapsible',
      text: 'Advanced Settings',
    })

    const advancedSettings = containerEl.createEl('div', {
      cls: 'omnivore-content',
    })

    new Setting(advancedSettings)
      .setName('Front Matter Template')
      .setDesc(
        createFragment((fragment) => {
          fragment.append(
            'Enter YAML template to render the front matter with ',
            fragment.createEl('a', {
              text: 'Reference',
              href: 'https://github.com/omnivore-app/docs.omnivore/tree/main/docs/integrations/obsidian.md#front-matter-template',
            }),
            fragment.createEl('br'),
            fragment.createEl('br'),
            'We recommend you to use Front Matter section under the basic settings to define the metadata.',
            fragment.createEl('br'),
            fragment.createEl('br'),
            'If this template is set, it will override the Front Matter so please make sure your template is a valid YAML.',
          )
        }),
      )
      .addTextArea((text) => {
        text
          .setPlaceholder('Enter the template')
          .setValue(this.plugin.settings.frontMatterTemplate)
          .onChange(async (value) => {
            this.plugin.settings.frontMatterTemplate = value
            await this.plugin.saveSettings()
          })

        text.inputEl.setAttr('rows', 10)
        text.inputEl.setAttr('cols', 30)
      })
      .addExtraButton((button) => {
        // add a button to reset template
        button
          .setIcon('reset')
          .setTooltip('Reset front matter template')
          .onClick(async () => {
            this.plugin.settings.frontMatterTemplate =
              DEFAULT_SETTINGS.frontMatterTemplate
            await this.plugin.saveSettings()
            this.display()
            new Notice('Front matter template reset')
          })
      })

    const help = containerEl.createEl('p')
    help.innerHTML = `For more information, please visit our <a href="https://github.com/omnivore-app/obsidian-omnivore">GitHub page</a>, email us at <a href="mailto:feedback@omnivore.app">feedback@omnivore.app</a> or join our <a href="https://discord.gg/h2z5rppzz9">Discord server</a>.`

    // script to make collapsible sections
    const coll = document.getElementsByClassName('omnivore-collapsible')
    let i

    for (i = 0; i < coll.length; i++) {
      coll[i].addEventListener('click', function () {
        this.classList.toggle('omnivore-active')
        const content = this.nextElementSibling
        if (content.style.maxHeight) {
          content.style.maxHeight = null
        } else {
          content.style.maxHeight = 'fit-content'
        }
      })
    }
  }

  displayBlock(block: HTMLElement, display: boolean) {
    block.style.display = display ? 'block' : 'none'
  }
}
