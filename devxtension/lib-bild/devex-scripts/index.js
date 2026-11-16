#! /usr/bin/env node
const spawn = require("cross-spawn");

const [task] = process.argv.slice(2);
const devConfig = require.resolve(`../config/webpack.dev.js`);
const prodConfig = require.resolve(`../config/webpack.prod.js`);

let result;
switch (task) {
    case "dev": {
        result = spawn.sync(
            process.execPath,
            [require.resolve('webpack-cli/bin/cli.js'), "--config", devConfig, "--watch"],
            { stdio: "inherit" }
        );
        break;
    }
    case "build": {
        result = spawn.sync(
            process.execPath,
            [require.resolve('webpack-cli/bin/cli.js'), "--config", prodConfig],
            { stdio: "inherit" }
        );
        break;
    }
    default:
        console.error(`Unknown script "${task}". Use dev or build.`);
        process.exit(1);
}

if (result.error || result.signal) {
    if (result.error) console.error(result.error);
    process.exit(1);
}

process.exit(result.status);
