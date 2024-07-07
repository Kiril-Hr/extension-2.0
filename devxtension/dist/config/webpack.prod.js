const path = require('path')
const TerserPlugin = require('terser-webpack-plugin')
const JavaScriptObfuscator = require('webpack-obfuscator')
const Dotenv = require('dotenv-webpack')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const { JavaScriptObfuscatorParams, copyWebpackPlugin, manifestBackgroundUpdater, TerserPluginParams, babelParams } = require("./webpack.configuration");

const appRoot = path.resolve(process.cwd());

const Plugins = [
    new JavaScriptObfuscator(JavaScriptObfuscatorParams),
    new CopyWebpackPlugin(copyWebpackPlugin),
    new Dotenv(),
    manifestBackgroundUpdater
]

module.exports = {
    mode: 'production',
    performance: { hints: false, maxEntrypointSize: 512000, maxAssetSize: 512000 },
    devtool: false,
    entry: path.resolve(appRoot, './src/runner.ts'),
    output: {
        path: path.resolve(appRoot, './dist'),
        filename: 'runner.js',
    },
    module: {
        rules: [ babelParams ],
    },
    resolve: {
        extensions: ['.ts', '.js'],
    },
    optimization: {
        minimize: true,
        minimizer: [ new TerserPlugin(TerserPluginParams) ],
    },
    plugins: Plugins,
}
