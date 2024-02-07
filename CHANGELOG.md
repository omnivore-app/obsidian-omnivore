## [1.9.3](https://github.com/omnivore-app/obsidian-omnivore/compare/1.9.2...1.9.3) (2024-02-07)


### Bug Fixes

* make siteName and other variables in the article template available in the folder/file name settings ([#190](https://github.com/omnivore-app/obsidian-omnivore/issues/190)) ([6329bb3](https://github.com/omnivore-app/obsidian-omnivore/commit/6329bb397e804891bc6efdfb1a469c7a4dd72559))

## [1.9.2](https://github.com/omnivore-app/obsidian-omnivore/compare/1.9.1...1.9.2) (2024-01-30)


### Bug Fixes

* add updatedAt variable to the article template to get the last u… ([#183](https://github.com/omnivore-app/obsidian-omnivore/issues/183)) ([05079e1](https://github.com/omnivore-app/obsidian-omnivore/commit/05079e1edf3cfba6785de4379f0d3bb85b2450da)), closes [#176](https://github.com/omnivore-app/obsidian-omnivore/issues/176) [#187](https://github.com/omnivore-app/obsidian-omnivore/issues/187)

## [1.9.1](https://github.com/omnivore-app/obsidian-omnivore/compare/1.9.0...1.9.1) (2024-01-11)


### Bug Fixes

* add image to the variables of article template ([0941dc2](https://github.com/omnivore-app/obsidian-omnivore/commit/0941dc2cc73933dc40c5f5930776def1e2847c34))

# [1.9.0](https://github.com/omnivore-app/obsidian-omnivore/compare/1.8.1...1.9.0) (2024-01-04)


### Features

* start to sync when plugin is loaded ([#170](https://github.com/omnivore-app/obsidian-omnivore/issues/170)) ([280f027](https://github.com/omnivore-app/obsidian-omnivore/commit/280f0271c317ef6354fca9cdc8721c8a1d74b963))

## [1.8.1](https://github.com/omnivore-app/obsidian-omnivore/compare/1.8.0...1.8.1) (2023-11-14)


### Bug Fixes

* lint code in CI ([#161](https://github.com/omnivore-app/obsidian-omnivore/issues/161)) ([460c489](https://github.com/omnivore-app/obsidian-omnivore/commit/460c48937f9d2583d43a26398e2b94eff15f0ef8))

# [1.8.0](https://github.com/omnivore-app/obsidian-omnivore/compare/1.7.1...1.8.0) (2023-11-10)


### Bug Fixes

* PDF page numbers start at 1 ([#155](https://github.com/omnivore-app/obsidian-omnivore/issues/155)) ([c69459c](https://github.com/omnivore-app/obsidian-omnivore/commit/c69459cc4ad5c696742dbb2fbf49ffba3bc1c5b5))


### Features

* use id as filename ([#154](https://github.com/omnivore-app/obsidian-omnivore/issues/154)) ([74e255a](https://github.com/omnivore-app/obsidian-omnivore/commit/74e255ab51a389f5c4f8ab25b5f14b0b17be3999))

## [1.7.1](https://github.com/omnivore-app/obsidian-omnivore/compare/1.7.0...1.7.1) (2023-11-06)


### Bug Fixes

* add a lambda function in the template to allow users to format date ([#136](https://github.com/omnivore-app/obsidian-omnivore/issues/136)) ([fb961e7](https://github.com/omnivore-app/obsidian-omnivore/commit/fb961e7de69118eb2dab6512f7b3fcc13c494e1c))

# [1.7.0](https://github.com/omnivore-app/obsidian-omnivore/compare/1.6.3...1.7.0) (2023-11-03)


### Features

* expose positionPercent and positionAnchorIndex variables in highlight template ([#150](https://github.com/omnivore-app/obsidian-omnivore/issues/150)) ([fa3bd32](https://github.com/omnivore-app/obsidian-omnivore/commit/fa3bd3251a520e9cfd0c0cee85b7077632449fd1))

## [1.6.3](https://github.com/omnivore-app/obsidian-omnivore/compare/1.6.2...1.6.3) (2023-09-30)


### Bug Fixes

* file already exists error caused by having duplicate article titles ([8dec30f](https://github.com/omnivore-app/obsidian-omnivore/commit/8dec30fae3d62428d176a524b9f2e4d91fe14b8c))
* ribbon icon stroke color does not match the theme color ([dbe46a8](https://github.com/omnivore-app/obsidian-omnivore/commit/dbe46a835ab96f628823a9dca1d77d845a943549))
* search content was returned if we are syncing a pdf ([3c10e1a](https://github.com/omnivore-app/obsidian-omnivore/commit/3c10e1a1c4183892e82301bf85ab4e1244c22a06))

## [1.6.2](https://github.com/omnivore-app/obsidian-omnivore/compare/1.6.1...1.6.2) (2023-09-26)


### Bug Fixes

* highlight color not available in the template ([e90807d](https://github.com/omnivore-app/obsidian-omnivore/commit/e90807d8ea43a0f0699856f4ea6281839a2c9c64))

## [1.6.1](https://github.com/omnivore-app/obsidian-omnivore/compare/1.6.0...1.6.1) (2023-09-07)


### Bug Fixes

* Update link to search in docs ([558cdc4](https://github.com/omnivore-app/obsidian-omnivore/commit/558cdc46ff2f9cf075c68d6e998b947a9bffec87))

# [1.6.0](https://github.com/omnivore-app/obsidian-omnivore/compare/1.5.3...1.6.0) (2023-08-03)


### Features

* Now I can delete article from omnivore!!! ([3715beb](https://github.com/omnivore-app/obsidian-omnivore/commit/3715beba7d1ee407315a9a7439c6ffce7f1676a2))

## [1.5.3](https://github.com/omnivore-app/obsidian-omnivore/compare/1.5.2...1.5.3) (2023-06-23)


### Bug Fixes

* incorrect highlight position by incorrectly using highlight position percentage which old highlights do not have it ([76a120f](https://github.com/omnivore-app/obsidian-omnivore/commit/76a120f6c8c19d7bbb25093027a8ae2315241ed5))

## [1.5.2](https://github.com/omnivore-app/obsidian-omnivore/compare/1.5.1...1.5.2) (2023-06-22)


### Bug Fixes

* failed to fetch highlight when quote is null ([2dc2fcc](https://github.com/omnivore-app/obsidian-omnivore/commit/2dc2fcc8361f3fec81093ac2febc7fce047515f5))

## [1.5.1](https://github.com/omnivore-app/obsidian-omnivore/compare/1.5.0...1.5.1) (2023-06-21)


### Bug Fixes

* unicode in filename is deleted ([1c7458a](https://github.com/omnivore-app/obsidian-omnivore/commit/1c7458a9eccc9ee4e86de1ff5c75a56835113ce3))

# [1.5.0](https://github.com/omnivore-app/obsidian-omnivore/compare/1.4.3...1.5.0) (2023-06-19)


### Features

* add date format configuration for filename variable ([f1f0a2d](https://github.com/omnivore-app/obsidian-omnivore/commit/f1f0a2d36a119012b07f4d40271e3f09fe3486ce))
* allow dataPublished and dateSaved to be used as filename ([22046e3](https://github.com/omnivore-app/obsidian-omnivore/commit/22046e35326bf7e51ddd193b33949a9c85eea869))
* allow dataPublished and dateSaved to be used as folder name with folder date format ([3f8fb56](https://github.com/omnivore-app/obsidian-omnivore/commit/3f8fb565804db5fb81500b3cfffe32bff736e62a))

## [1.4.3](https://github.com/omnivore-app/obsidian-omnivore/compare/1.4.2...1.4.3) (2023-06-19)


### Bug Fixes

* failed to save note in windows by removing invisible characters in the filename ([cf99fc5](https://github.com/omnivore-app/obsidian-omnivore/commit/cf99fc5c26c12b9164ea689ab220d01c9d6d8810))

## [1.4.2](https://github.com/omnivore-app/obsidian-omnivore/compare/1.4.1...1.4.2) (2023-06-07)


### Bug Fixes

* failed to sync articles to an existing file without front matter ([58dbf98](https://github.com/omnivore-app/obsidian-omnivore/commit/58dbf98cc929ab2feb79623ab8693a7974f1ea6f))

## [1.4.1](https://github.com/omnivore-app/obsidian-omnivore/compare/1.4.0...1.4.1) (2023-06-06)


### Bug Fixes

* replace all reserved characters in filename with - ([582beb3](https://github.com/omnivore-app/obsidian-omnivore/commit/582beb35635ae52e89a8d4edc60efcc3e1dba337))
* test ([815238c](https://github.com/omnivore-app/obsidian-omnivore/commit/815238cca248ff5899b8941fea6410757145d19c))

# [1.4.0](https://github.com/omnivore-app/obsidian-omnivore/compare/1.3.3...1.4.0) (2023-05-31)


### Bug Fixes

* allow adding aliases to the variables in the front matter ([be1d7e5](https://github.com/omnivore-app/obsidian-omnivore/commit/be1d7e5316871e8c740afc8e2c19dbff4f1eeef8))
* download content and file attachment only if included in the template ([dc92a38](https://github.com/omnivore-app/obsidian-omnivore/commit/dc92a38ef1da4cecfc8ad951c7cf1d068b75e6b3))


### Features

* add a optional front matter template under advanced settings ([afde987](https://github.com/omnivore-app/obsidian-omnivore/commit/afde98718d06f021804bfa3232a6b4148eaf10b4))
* add link to our discord server in the settings ([5c3df3d](https://github.com/omnivore-app/obsidian-omnivore/commit/5c3df3d88dee710e542d4e9c64b1fee582a88b29))
* add more variables in the front matter setting ([942b93e](https://github.com/omnivore-app/obsidian-omnivore/commit/942b93e604c65042b3d540896e0579773a8e98e4))

## [1.3.3](https://github.com/omnivore-app/obsidian-omnivore/compare/1.3.2...1.3.3) (2023-05-23)


### Bug Fixes

* truncate filename length to 100 ([12ebcf7](https://github.com/omnivore-app/obsidian-omnivore/commit/12ebcf76638ce336511705b6b433ea989e6a0895))

## [1.3.2](https://github.com/omnivore-app/obsidian-omnivore/compare/1.3.1...1.3.2) (2023-05-23)


### Bug Fixes

* use labels names as tags in the front matter ([0341a4e](https://github.com/omnivore-app/obsidian-omnivore/commit/0341a4ed36c4aef507784dc6ceb1862b2e1dd8d6))

## [1.3.1](https://github.com/omnivore-app/obsidian-omnivore/compare/1.3.0...1.3.1) (2023-05-23)


### Bug Fixes

* add a reset template button to reset the template to default template ([06df987](https://github.com/omnivore-app/obsidian-omnivore/commit/06df987b539cf892bdab6e205cefcf529ffc26f0))
* invalid yaml error when generating the front matter ([10a9b96](https://github.com/omnivore-app/obsidian-omnivore/commit/10a9b9676b2c57e6dcbecb87e2e7530874be8c70))

# [1.3.0](https://github.com/omnivore-app/obsidian-omnivore/compare/1.2.3...1.3.0) (2023-05-18)


### Bug Fixes

* add dateArchived to the exposed variable in the template ([1a67d16](https://github.com/omnivore-app/obsidian-omnivore/commit/1a67d16888f907307dca675f1f80511064414ce5))
* add lowercase, uppercase and uppercasefirst to the function map in the template ([957bbca](https://github.com/omnivore-app/obsidian-omnivore/commit/957bbca049011e250c2f692e2b1db7d44c730d76))
* add state to the exposed variable in the template ([26572b6](https://github.com/omnivore-app/obsidian-omnivore/commit/26572b6385ab44b610e2490229adb86d25e53160))
* add tweet, video and image page type ([ffdcd92](https://github.com/omnivore-app/obsidian-omnivore/commit/ffdcd924787ece94796de57e66f77aa666de07f4))
* add wordsCount and readLength to the exposed variables in the article template ([56813b7](https://github.com/omnivore-app/obsidian-omnivore/commit/56813b7c3c332746ff49efdf3844727a0ba35726))
* allow articles to be synced into a single file and add a toggle in the settings ([4c04f8e](https://github.com/omnivore-app/obsidian-omnivore/commit/4c04f8eee960e263046a5e5ed94dc281c689498b))
* allow frontmatter to be an array ([2b3b0f3](https://github.com/omnivore-app/obsidian-omnivore/commit/2b3b0f34d29ce84e3e35e7ace2a8871314d7a13d))
* allow scheduled sync and set a frequency in minutes ([8800d38](https://github.com/omnivore-app/obsidian-omnivore/commit/8800d3882326add57621400ea0e7aa100828ab6c))
* preparse template before rendering ([c41bc8f](https://github.com/omnivore-app/obsidian-omnivore/commit/c41bc8f1b4b8c70b36989860d3257ad6ae792979))
* show release notes after upgrade ([37382a2](https://github.com/omnivore-app/obsidian-omnivore/commit/37382a2cf594cac10c7b05120dc0742980a4ff84))
* use multiline string for title and author in default template ([c7e5daf](https://github.com/omnivore-app/obsidian-omnivore/commit/c7e5dafa3b692c9d2d958b46ede1783a597f616e))


### Features

* highlight highlights in the exported content in markdown ([6cc1b04](https://github.com/omnivore-app/obsidian-omnivore/commit/6cc1b042bc96db6605ffa5d804159a478abbac45))

## [1.2.3](https://github.com/omnivore-app/obsidian-omnivore/compare/1.2.2...1.2.3) (2023-04-28)


### Bug Fixes

* wrap value in frontmatter with double quotes ([3f996fd](https://github.com/omnivore-app/obsidian-omnivore/commit/3f996fd04e38b1e6c2a116673d8599310230b76f))

## [1.2.2](https://github.com/omnivore-app/obsidian-omnivore/compare/1.2.1...1.2.2) (2023-04-14)


### Bug Fixes

* add dateRead variable in the article template ([8141166](https://github.com/omnivore-app/obsidian-omnivore/commit/8141166de4353edae861b069bc5d7a925323725a))
* add type to the template ([e04f7ab](https://github.com/omnivore-app/obsidian-omnivore/commit/e04f7ab2a32f2bed9ffc0d7f25f6798858ab1aec))
* replace all empty lines with blockquote ">" to preserve paragraphs ([e02e5de](https://github.com/omnivore-app/obsidian-omnivore/commit/e02e5de9cbe8d0ef261b010ed08fbf39e47a95be))

## [1.2.1](https://github.com/omnivore-app/obsidian-omnivore/compare/1.2.0...1.2.1) (2023-04-10)


### Bug Fixes

* sort highlights by position percentage if available ([4a614c7](https://github.com/omnivore-app/obsidian-omnivore/commit/4a614c79f3e6cce1066e68bb91fda0a3dbec1acb))

# [1.2.0](https://github.com/omnivore-app/obsidian-omnivore/compare/1.1.1...1.2.0) (2023-04-05)


### Bug Fixes

* add note variable to the template ([ea65aa6](https://github.com/omnivore-app/obsidian-omnivore/commit/ea65aa6cf50118f8a50197501b2970d3693f9d79))
* make description available in the template ([b8760a2](https://github.com/omnivore-app/obsidian-omnivore/commit/b8760a2030a969727d400d5229b4bba5a9e95e42))


### Features

* download pdf in attachment folder and expose a variable {{{pdfAttachment}}} in the template ([bed8835](https://github.com/omnivore-app/obsidian-omnivore/commit/bed8835c25b7566f1cad43433f94b1cc83a90c3f))

## [1.1.1](https://github.com/omnivore-app/obsidian-omnivore/compare/1.1.0...1.1.1) (2023-03-31)


### Bug Fixes

* add labels of highlights to the template ([4b8aee1](https://github.com/omnivore-app/obsidian-omnivore/commit/4b8aee18dd58662270b981e62ffbd865c3f81c23))

# [1.1.0](https://github.com/omnivore-app/obsidian-omnivore/compare/1.0.6...1.1.0) (2023-03-16)


### Bug Fixes

* make the settings collapsible ([71da2c2](https://github.com/omnivore-app/obsidian-omnivore/commit/71da2c292899f68f873c2b728472304318b9bf3b))
* only add omnivore id to the frontmatter if frontmatter is not in the template ([f46b4fc](https://github.com/omnivore-app/obsidian-omnivore/commit/f46b4fca5065c5d5b93e4acaaacd213c7b8deeff))


### Features

* custom filenames ([650a9ad](https://github.com/omnivore-app/obsidian-omnivore/commit/650a9adc6a8559583604cc18f209bf69757b78c7))

## [1.0.6](https://github.com/omnivore-app/obsidian-omnivore/compare/1.0.5...1.0.6) (2023-02-23)


### Bug Fixes

* sub-folder can be config in folder name setting and {{date}} can be used ([57a45e5](https://github.com/omnivore-app/obsidian-omnivore/commit/57a45e5c761ebac4858787a27364cef44687df85))

## [1.0.5](https://github.com/omnivore-app/obsidian-omnivore/compare/1.0.4...1.0.5) (2023-02-22)


### Bug Fixes

* add available variables to the template config description ([09f8c83](https://github.com/omnivore-app/obsidian-omnivore/commit/09f8c832cecffbc2800d22b1bcc87cb36d34910d))
* add date_published in the frontmatter ([cf61925](https://github.com/omnivore-app/obsidian-omnivore/commit/cf61925243bb6cfccdbc625b6069d54600daf68c))
* remove content from default template ([11a0202](https://github.com/omnivore-app/obsidian-omnivore/commit/11a020294922c7c1caad72063f6544cf2a2cb9e7))
* use default template if empty ([7b4f7e4](https://github.com/omnivore-app/obsidian-omnivore/commit/7b4f7e4321e3b6ee42b1e635300dc8d07c290cd7))
* use omnivore title as the filename and add omnivore id to the frontmatter which is used to deduplicate files with the same name ([8fbf85d](https://github.com/omnivore-app/obsidian-omnivore/commit/8fbf85d86baa23f065e9bf63bd8aef607609392c))

## [1.0.4](https://github.com/omnivore-app/obsidian-omnivore/compare/1.0.3...1.0.4) (2023-02-19)


### Bug Fixes

* create an omnivore file for an existing TFolder ([b7768ff](https://github.com/omnivore-app/obsidian-omnivore/commit/b7768ffed335baec2eb841aeaffd283573a14c8d))

## [1.0.3](https://github.com/omnivore-app/obsidian-omnivore/compare/1.0.2...1.0.3) (2023-02-06)


### Bug Fixes

* potential issues with new release in the community market based on the feedback from Obsidian team ([d987f21](https://github.com/omnivore-app/obsidian-omnivore/commit/d987f21cd2dba39d5bf6cfe76b1a6258b471c415))

## [1.0.2](https://github.com/omnivore-app/obsidian-omnivore/compare/1.0.1...1.0.2) (2023-01-31)


### Bug Fixes

* add back the ribbon icon for the ease of usage ([f1e9eeb](https://github.com/omnivore-app/obsidian-omnivore/commit/f1e9eebd3968d0a56a8109ac8d71751c0c96a323))

# 1.0.0 (2023-01-18)


### Bug Fixes

* generate unicode slug as file name ([2e5fcd6](https://github.com/omnivore-app/obsidian-omnivore/commit/2e5fcd6c503a43e8b8f32d8cdce723c78cfc620f))
