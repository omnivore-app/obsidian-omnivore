export const mockObsidianApp = {
  // Mock implementation of the App API
  app: {
    platform: () => 'desktop',
    plugins: {
      getPlugins: () => [],
      isEnabled: () => true,
    },
  },

  // Mock implementation of the Workspace API
  workspace: {
    onLayoutReady: (callback: () => void) => {
      setTimeout(callback, 0)
    },
    getLeavesOfType: () => [],
    getConfig: () => ({}),
  },

  // Mock implementation of the MarkdownView API
  markdownView: {
    getMode: () => 'source',
    getMarkdown: () => '',
  },
}

// Mock implementation of the Obsidian global object
export const obsidian = {
  ...mockObsidianApp,
}
