const fs = require('fs')
const path = require('path')
const UglifyJS = require('uglify-js')

const moduleUpdaterPath = path.resolve(__dirname, './backgroundURLUpdater.js')

const appRoot = path.resolve(process.cwd());
const srcFolder = path.resolve(appRoot, './src')

const extensionOptionsFolder = path.resolve(srcFolder, './extensionOptions')
const distFolder = path.resolve(srcFolder, '../dist')

const assetsFolder = path.resolve(extensionOptionsFolder, './assets')
const backgroundFolder = path.resolve(extensionOptionsFolder, './backgrounds')
const modulesFolder = path.resolve(srcFolder, './modules')

const runner = path.resolve(appRoot, './src/runner.ts')

function mergeBackgrounds(modulesURLsUpdaterObj) {
    const backgrounds = []

    const updaterObservedObjName = 'observedURLs'
    const moduleUpdaterFile = fs.readFileSync(moduleUpdaterPath, 'utf-8')
    moduleUpdaterFile.replace(updaterObservedObjName, updaterObservedObjName + '=' + JSON.stringify(modulesURLsUpdaterObj))

    backgrounds.push(moduleUpdaterFile)

    if (fs.existsSync(path.resolve(extensionOptionsFolder, backgroundFolder))) {
        for (const file of fs.readdirSync(backgroundFolder)) {
          const backgroundFile = fs.readFileSync(`${backgroundFolder}/${file}`, 'utf-8')
          backgrounds.push(backgroundFile)
        }
    }

    const mergedBackgrounds = UglifyJS.minify(backgrounds.join(''))
    fs.writeFileSync(`${distFolder}/background.js`, mergedBackgrounds.code, 'utf-8')
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

function getManifest() {
    const fileContent = fs.readFileSync(runner, 'utf-8');

    const manifestString = fileContent.match(/manifest: {[^}]+}/)?.[0];

    if (manifestString) {
        const manifest = JSON.parse(`{${manifestString}}`);
        console.log(manifest);

        return manifest;
    } else {
        console.error('Manifest not found in the file');
    }
}

function manifestConfigure(modulesURLsArray) {
    const distManifestPath = `${distFolder}/manifest.json`
    const manifest = getManifest()

    manifest["content_scripts"] = [
        {
            matches: modulesURLsArray,
            js: ["runner.js"]
        }
    ]
    manifest.action["default_icon"] = imagesObject()
    manifest.background = { "service_worker": "background.js" }
    manifest.manifest_version = 3

    fs.writeFileSync(distManifestPath, JSON.stringify(manifest, null, 2), 'utf-8')
}

function updaterExtensionAdditional() {
    if (!fs.existsSync(path.resolve(runner))) throw Error('You must use \'runner.ts\' file in src directory to setup your extension')

    const modulesURLsArray = URLs()
    const modulesURLsUpdaterObj = modulesURLsArray.reduce((obj, url) => {
        obj[url] = url
        return obj
    }, {})

    mergeBackgrounds(modulesURLsUpdaterObj)
    manifestConfigure(modulesURLsArray)
}

module.exports = updaterExtensionAdditional
