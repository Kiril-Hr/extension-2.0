const path = require("path");
const updaterExtensionAdditional = require("./webpackCompileUtils/additionalUpdater");

const fs = require('fs')

const appRoot = path.resolve(process.cwd());
const babelPath = path.resolve(appRoot, './node_modules');

const optimizationObfuscator = {
    compact: true,
    controlFlowFlatteningThreshold: 0.75,
    controlFlowFlattening: true,
    numbersToExpressions: true,
    simplify: true,
    splitStrings: true,
    stringArrayThreshold: 0.75,
    unicodeEscapeSequence: true,
}

const JavaScriptObfuscatorParams = {
    compact: true,
    controlFlowFlattening: true,
    deadCodeInjection: true,
    stringArray: true,
    rotateStringArray: true,
    selfDefending: true,
    optimization: optimizationObfuscator
}

const TerserPluginParams = {
    terserOptions: {
        format: {
            comments: false,
        },
    },
    extractComments: false,
}

const copyWebpackPlugin = {
    patterns: [
        {
            from: path.resolve(appRoot, './src/extensionOptions/assets'),
            noErrorOnMissing: true,
            to: path.resolve(appRoot, './dist/assets')
        }
    ]
}

const workerEntry = path.resolve(appRoot, 'src/extensionOptions/backgrounds/index.ts')

const hasBackgroundEntry = () => fs.existsSync(workerEntry)

function extensionEntries() {
  const runner = path.resolve(appRoot, 'src/runner.ts')
  return hasBackgroundEntry()
    ? { runner, background: { import: workerEntry, asyncChunks: false, chunkLoading: false } }
    : { runner }
}

const manifestBackgroundUpdater = (compiler) => {
    // Run for every compilation, including watch rebuilds.
    let generated
    let manifestError
    compiler.hooks.beforeCompile.tap('DevExManifest', () => {
      manifestError = undefined
      try {
        generated = updaterExtensionAdditional()
      } catch (error) {
        if (!compiler.watchMode) throw error
        manifestError = error
      }
    })
    compiler.hooks.thisCompilation.tap('DevExBackground', compilation => {
      const { Compilation, sources } = compiler.webpack
      compilation.hooks.afterChunks.tap('DevExBackground', () => {
        const chunk = compilation.namedChunks.get('background')
        if (!chunk || manifestError || !generated.legacyFiles.length) return

        const legacy = new Set(generated.legacyFiles)
        for (const mod of compilation.chunkGraph.getChunkModulesIterable(chunk)) {
          const file = mod.nameForCondition?.()
          if (file && fs.existsSync(file) && legacy.has(fs.realpathSync(file))) {
            compilation.errors.push(new Error('Background imports an auto-executed legacy fragment: ' + file +
              '. Remove the import or move the module outside the top-level backgrounds/*.js directory.'))
          }
        }
      })

      compilation.hooks.processAssets.tap({
        name: 'DevExBackground', stage: Compilation.PROCESS_ASSETS_STAGE_REPORT
      }, () => {
        if (manifestError) return
        const asset = compilation.getAsset('background.js')
        if (asset) {
          compilation.updateAsset(asset.name, new sources.ConcatSource(generated.code, '\n;(() => {\n', asset.source, '\n})()\n'))
        } else {
          compilation.emitAsset('background.js', new sources.RawSource(generated.code))
        }
      })
    })
    compiler.hooks.afterCompile.tap('DevExManifest', compilation => {
        if (manifestError) compilation.errors.push(manifestError)
        if (!fs.existsSync(workerEntry)) compilation.missingDependencies.add(workerEntry)
        for (const file of generated?.dependencies || []) compilation.fileDependencies.add(file)
        const legacy = path.resolve(appRoot, 'extensionConfig.json');
        if (require('fs').existsSync(legacy)) compilation.fileDependencies.add(legacy);
        else compilation.missingDependencies.add(legacy);
        for (const folder of ['src/modules', 'src/extensionOptions/backgrounds', 'src/extensionOptions/assets']) {
            compilation.contextDependencies.add(path.resolve(appRoot, folder));
        }
    });
}

const babelParams = {
    test: /\.tsx?$/,
    use: {
        loader: require.resolve('babel-loader'),
        options: {
            presets: [
                require.resolve('@babel/preset-env'),
                require.resolve('@babel/preset-typescript'),
                require.resolve('@babel/preset-react'),
            ],
            plugins: [
                [require.resolve('@babel/plugin-proposal-decorators'), { legacy: true }],
                [require.resolve('@babel/plugin-proposal-class-properties'), { loose: false }]
            ]
        }
    },
    exclude: /node_modules/,
}

module.exports = {
    hasBackgroundEntry,
    extensionEntries,
    optimizationObfuscator,
    JavaScriptObfuscatorParams,
    TerserPluginParams,
    copyWebpackPlugin,
    manifestBackgroundUpdater,
    babelParams
}
