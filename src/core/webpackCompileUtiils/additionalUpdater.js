const fs = require('fs')
const fse = require('fs-extra')
const path = require('path')
const UglifyJS = require('uglify-js')

const srcFolder = path.resolve(__dirname, '../../')

const extensionOptionsFolder = path.resolve(srcFolder, './extensionOptions')
const distFolder = path.resolve(srcFolder, '../dist')

const assetsFolder = path.resolve(extensionOptionsFolder, './assets')
const backgroundFolder = path.resolve(extensionOptionsFolder, './backgrounds')
const modulesFolder = path.resolve(srcFolder, './modules')

const extensionConfig = path.resolve(__dirname, '../../../extensionConfig.json')

function mergeBackgrounds() {
  if (fs.existsSync(path.resolve(extensionOptionsFolder, backgroundFolder))) {
    const backgrounds = []

    for (const file of fs.readdirSync(backgroundFolder)) {
      const backgroundFile = fs.readFileSync(`${backgroundFolder}/${file}`, 'utf-8')
      backgrounds.push(backgroundFile)
    }

    const mergedBackgrounds = UglifyJS.minify(backgrounds.join(''))
    fs.writeFileSync(`${distFolder}/background.js`, mergedBackgrounds.code, 'utf-8')
  } else {
    console.warn('Background files have to be in \'working-extension-directory/src/extensionOptions/backgrounds\'')
  }
}

function imagesObject() {
  return fs.readdirSync(assetsFolder).reduce((param, img ) => {
    const size = img.match(/(\d+)/)

    if (size) param[size[0]] = 'assets/' + img
      else {
        for (let asset in param) {
          if (!param[asset]) param[asset] = 'assets/' + img
        }
    }

    return param
  }, {
    16: null,
    32: null,
    48: null,
    128: null
  })
}

function URLs() {
  const modules = fs.readdirSync(modulesFolder)
  return modules.reduce((urls, folderName) => {
    if (!folderName.includes('Module')) return urls

    const folder = path.resolve(modulesFolder, `./${folderName}`)
    const fileName = fs.readdirSync(folder)
      .find(f => f.includes('Module'))

    const module = fs.readFileSync(path.resolve(folder, fileName), 'utf8')

    const url = module.match(/@ModuleDecorator[^]*?url:\s*'([^']*)'/)[1]

    urls.push(url)

    return urls
  }, [])
}

function updaterExtensionAdditional() {
    if (!fs.existsSync(path.resolve(extensionConfig))) throw Error('You must create \'extensionConfig.json\' file in extension directory')

    try {
      fse.copySync(extensionConfig, path.join(distFolder, 'manifest.json'))
    } catch (e) {
      console.error('Error copying file:', e)
    }

    mergeBackgrounds()

    const distManifest = `${distFolder}/manifest.json`
    const manifest = JSON.parse(fs.readFileSync(distManifest, 'utf-8'))

    manifest["content_scripts"] = [
        {
          matches: URLs(),
          js: ["runner.js"]
        }
    ]
    manifest.action["default_icon"] = imagesObject()
    manifest.background = { "service_worker": "background.js" }

    fs.writeFileSync(distManifest, JSON.stringify(manifest, null, 2), 'utf-8')
}

module.exports = updaterExtensionAdditional
