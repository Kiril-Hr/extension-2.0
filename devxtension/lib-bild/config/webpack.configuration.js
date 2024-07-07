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
            to: path.resolve(appRoot, './dist/assets')
        }
    ]
}

const manifestBackgroundUpdater = () => {
    return updaterExtensionAdditional()
}

const babelParams = {
    test: /\.ts$/,
    use: {
        loader: path.resolve(babelPath, 'babel-loader'),
        options: {
            presets: [
                path.resolve(babelPath, '@babel/preset-env'),
                path.resolve(babelPath, '@babel/preset-typescript'),
            ],
            plugins: [
                [path.resolve(babelPath, '@babel/plugin-proposal-decorators'), { legacy: true }],
                path.resolve(babelPath, '@babel/plugin-proposal-class-properties')
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