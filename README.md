# obsidian-omnivore

This plugin imports your saved [Omnivore](https://omnivore.app/) articles and highlights into Obsidian.

## Features

* Import your highlights and saved article
* Create graphs based on Omnivore data
* Filter imported data using Omnivores [advanced search syntax](https://docs.omnivore.app/using/search.html)
* Custom templates for imported data

## Installation

1. Install the plugin from the community or build it from source and load unpacked plugin
2. Sign up for an [Omnivore account](https://omnivore.app)
3. Go to [Omnivore](https://omnivore.app/settings/api) and Create an API key
4. Open settings and add your api key

## Usage

1. The plugin will sync with Omnivore when you click on Omnivore ribbon icon or use the palette command
2. You can also change the API key, the search filter, and how often the plugin syncs with Omnivore by updating the settings
3. The plugin creates a new page for each saved article including metadata, labels. Content you have highlighted in Omnivore, and any notes you added, will be nested in the article page
4. Clicking on the article will open the Omnivore article in a new tab
5. We also create an internal link to each label in the article so you can group articles by label

## Build and install from source

### Build
- Make sure your NodeJS is at least v16 (`node --version`).
- `npm i` or `yarn` to install dependencies.
- `npm run dev` to start compilation in watch mode.

### Manually installing the plugin
- Copy over `main.js`, `styles.css`, `manifest.json` to your vault `VaultFolder/.obsidian/plugins/your-plugin-id/`.
- Reload community plugins, enable this plugin

## Contacts

[Omnivore](https://github.com/omnivore-app)

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License

[MIT](https://choosealicense.com/licenses/mit/)
