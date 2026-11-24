const path = require('path')
const TerserPlugin = require('terser-webpack-plugin')
const JavaScriptObfuscator = require('webpack-obfuscator')
const Dotenv = require('dotenv-webpack')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const { JavaScriptObfuscatorParams, hasBackgroundEntry, extensionEntries, copyWebpackPlugin, manifestBackgroundUpdater, TerserPluginParams, babelParams } = require("./webpack.configuration");

const appRoot = path.resolve(process.cwd());

const Plugins = [
    // The legacy post-transform can lose captured bindings in asynchronous messaging callbacks.
    ...(hasBackgroundEntry() ? [] : [new JavaScriptObfuscator(JavaScriptObfuscatorParams, ['background.js'])]),
    new CopyWebpackPlugin(copyWebpackPlugin),
    new Dotenv(),
    manifestBackgroundUpdater
]

module.exports = {
    mode: 'production',
    performance: { hints: false, maxEntrypointSize: 512000, maxAssetSize: 512000 },
    devtool: false,
    entry: extensionEntries,
    output: {
        path: path.resolve(appRoot, './dist'),
        filename: '[name].js',
    },
    module: {
        rules: [ babelParams ],
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
    },
    optimization: {
        minimize: true,
        minimizer: [ new TerserPlugin(TerserPluginParams) ],
    },
    plugins: Plugins,
}
