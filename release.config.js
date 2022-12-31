module.exports = {
  branches: 'master',
  plugins: [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',
    '@semantic-release/changelog',
    ['@semantic-release/npm', { npmPublish: false }],
    [
      '@semantic-release/exec',
      {
        prepareCmd:
          'npm run version',
      },
    ],
    [
      '@semantic-release/git',
      {
        assets: ['CHANGELOG.md', 'package.json', 'manifest.json', 'style.css'],
        message:
          'chore(release): ${nextRelease.version}\n\n${nextRelease.notes}',
      },
    ],
    [
      '@semantic-release/github',
      {
        assets: ['main.js', 'manifest.json', 'style.css'],
      },
    ],
  ],
}
