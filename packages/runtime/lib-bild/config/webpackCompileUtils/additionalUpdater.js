const fs = require('fs')
const path = require('path')
const UglifyJS = require('uglify-js')
const ts = require('typescript')
const { contentScriptForPatterns } = require('./runtimeToChromePatterns')
const { readProjectManifest } = require('./factoryManifest')
let manifestDependencies = []
let hasGlobalParticipants = false

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

    const legacyFiles = []
    const moduleUpdaterFile = fs.readFileSync(moduleUpdaterPath, 'utf-8')
    const compiledMatcher = path.resolve(__dirname, '../../core/commonUtils/checkURL.utils.js')
    const { checkUrl } = require(fs.existsSync(compiledMatcher) ? compiledMatcher : path.resolve(__dirname, '../../../dist/core/commonUtils/checkURL.utils.js'))
    const configuredUpdater = moduleUpdaterFile.replace(
        'const observedURLs = {}',
        'const observedURLs = ' + JSON.stringify(modulesURLsUpdaterObj)
    ).replace('__DEVEX_RUNTIME_URL_MATCHER__', checkUrl.toString())
     .replace('const observeGlobalRoutes = false', 'const observeGlobalRoutes = ' + hasGlobalParticipants)
    if (configuredUpdater === moduleUpdaterFile) throw new Error('Cannot inject URL patterns into background updater')
    backgrounds.push(configuredUpdater)

    if (fs.existsSync(path.resolve(extensionOptionsFolder, backgroundFolder))) {
        for (const file of fs.readdirSync(backgroundFolder)) {
          if (!file.endsWith('.js') || !fs.statSync(path.join(backgroundFolder, file)).isFile()) continue
          const backgroundFile = fs.readFileSync(`${backgroundFolder}/${file}`, 'utf-8')
          backgrounds.push(backgroundFile)
          legacyFiles.push(fs.realpathSync(path.join(backgroundFolder, file)))
        }
    }

    const mergedBackgrounds = UglifyJS.minify(backgrounds.join('\n;\n'))
    if (mergedBackgrounds.error) throw mergedBackgrounds.error
    return { code: mergedBackgrounds.code, legacyFiles }
}

function imagesObject() {
  return fs.readdirSync(assetsFolder).filter(img => /\.(png|jpe?g|gif)$/i.test(img)).reduce((param, img ) => {
    const size = img.match(/(\d+)/)

    if (size) param[size[0]] = 'assets/' + img
      else {
        for (let asset in param) {
          if (!param[asset]) param[asset] = 'assets/' + img
        }
    }

    return param
  }, {})
}

function URLs() {
  if (!fs.existsSync(modulesFolder)) return []
  const patterns = new Set()
  function scan(folder) {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const file = path.join(folder, entry.name)
      if (entry.isDirectory()) { scan(file); continue }
      if (!/\.tsx?$/.test(entry.name)) continue
      const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
      const constants = new Map()
      function collect(node) {
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) constants.set(node.name.text, node.initializer)
        ts.forEachChild(node, collect)
      }
      collect(source)
      function stringValue(node, seen = new Set()) {
        if (!node) return undefined
        if (ts.isStringLiteralLike(node)) return node.text
        if (ts.isIdentifier(node) && !seen.has(node.text)) {
          seen.add(node.text); return stringValue(constants.get(node.text), seen)
        }
      }
      function visit(node) {
        if (ts.isCallExpression(node) && node.expression.getText(source) === 'ModuleDecorator') {
          const options = node.arguments[0]
          const url = options && ts.isObjectLiteralExpression(options) && options.properties.find(p => p.name && p.name.getText(source).replace(/['"]/g, '') === 'url')
          const pattern = url && stringValue(url.initializer)
          if (!pattern) throw new Error(`ModuleDecorator URL must be a static string or local constant: ${file}`)
          patterns.add(pattern)
        }
        ts.forEachChild(node, visit)
      }
      visit(source)
    }
  }
  scan(modulesFolder)
  return [...patterns]
}

function getManifest() {
    const result = readProjectManifest(appRoot)
    manifestDependencies = result.dependencies
    hasGlobalParticipants = result.hasGlobalParticipants
    return result.manifest
}

function manifestConfigure(modulesURLsArray) {
    const distManifestPath = path.join(distFolder, 'manifest.json')
    const manifest = getManifest()
    if (!manifest.action) manifest.action = {}
    let generatedScript
    if (modulesURLsArray.length) {
       generatedScript = contentScriptForPatterns(modulesURLsArray)
       manifest.content_scripts = [...(manifest.content_scripts || []), generatedScript]
    }
    if (hasGlobalParticipants) {
      const globalMatches = [...new Set((manifest.host_permissions || []).map(pattern => {
        if (pattern === '<all_urls>') return pattern
        const match = pattern.match(/^(\*|https?|file|ftp):\/\/([^/]*)(\/.*)$/)
        if (!match) throw new Error(`Invalid host permission for global modules: ${pattern}`)
        // Chrome host permissions grant the origin; their path is not a route.
        return `${match[1]}://${match[2]}/*`
      }))]
      const scripts = manifest.content_scripts || []
      let generated = generatedScript
      if (!generated) { generated = {matches:[],js:['runner.js']}; scripts.push(generated) }
      generated.matches = [...new Set([...generated.matches,...globalMatches])]
      if (!generated.matches.length) throw new Error('Global widgets/manifest modules need host_permissions or module URL scopes for content-script injection')
      if (generated.exclude_matches) {
        generated.exclude_matches = generated.exclude_matches.filter(excluded => !globalMatches.some(scope => {
          if (scope === '<all_urls>') return true
          const a = scope.match(/^([^:]+):\/\/([^/]*)(\/.*)$/), b = excluded.match(/^([^:]+):\/\/([^/]*)(\/.*)$/)
          return a && b && (a[1] === b[1] || a[1] === '*' && ['http','https'].includes(b[1])) &&
            (a[2] === '*' || a[2] === b[2] || a[2].startsWith('*.') && (b[2] === a[2].slice(2) || b[2].endsWith(a[2].slice(1))))
        }))
        if (!generated.exclude_matches.length) delete generated.exclude_matches
      }
      manifest.content_scripts = scripts
    }
    if (fs.existsSync(assetsFolder) && !manifest.action.default_icon) {
      const icons = imagesObject()
      if (Object.keys(icons).length) manifest.action.default_icon = icons
    }
    if (modulesURLsArray.length || hasGlobalParticipants) {
      manifest.permissions = [...new Set([...(manifest.permissions || []), 'webNavigation'])]
    }
    manifest.background = { service_worker: 'background.js' }
    manifest.manifest_version = 3
    fs.mkdirSync(distFolder, { recursive: true })
    fs.writeFileSync(distManifestPath, JSON.stringify(manifest, null, 2), 'utf8')
}

function updaterExtensionAdditional() {
    if (!fs.existsSync(path.resolve(runner))) throw Error('You must use \'runner.ts\' file in src directory to setup your extension')

    const modulesURLsArray = URLs()
    const modulesURLsUpdaterObj = modulesURLsArray.reduce((obj, url) => {
        obj[url] = url
        return obj
    }, {})

    manifestConfigure(modulesURLsArray)
    return { ...mergeBackgrounds(modulesURLsUpdaterObj), dependencies: manifestDependencies }
}

module.exports = updaterExtensionAdditional
