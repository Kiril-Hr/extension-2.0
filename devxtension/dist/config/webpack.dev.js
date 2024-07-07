const path = require('path')
const Dotenv = require('dotenv-webpack')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const { copyWebpackPlugin, manifestBackgroundUpdater, babelParams} = require("./webpack.configuration");

const appRoot = path.resolve(process.cwd());

const Plugins = [
    new CopyWebpackPlugin(copyWebpackPlugin),
    new Dotenv(),
    manifestBackgroundUpdater
]

module.exports = {
    mode: 'development',
    performance: { hints: false, maxEntrypointSize: 512000, maxAssetSize: 512000 },
    devtool: 'inline-source-map',
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
    plugins: Plugins,
}
