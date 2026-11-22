const path = require("path");
const updaterExtensionAdditional = require("./webpackCompileUtils/additionalUpdater");

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

const manifestBackgroundUpdater = (compiler) => {
    // Run for every compilation, including watch rebuilds.
    let dependencies = [];
    compiler.hooks.beforeCompile.tap('DevExManifest', () => { dependencies = updaterExtensionAdditional().dependencies; });
    compiler.hooks.afterCompile.tap('DevExManifest', compilation => {
        dependencies.forEach(file => compilation.fileDependencies.add(file));
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
    optimizationObfuscator,
    JavaScriptObfuscatorParams,
    TerserPluginParams,
    copyWebpackPlugin,
    manifestBackgroundUpdater,
    babelParams
}
