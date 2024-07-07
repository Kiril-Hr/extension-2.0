#! /usr/bin/env node
const spawn = require("cross-spawn");

const [task] = process.argv.slice(2);
const devConfig = require.resolve(`../config/webpack.dev.js`);
const prodConfig = require.resolve(`../config/webpack.prod.js`);

let result;
switch (task) {
    case "dev": {
        result = spawn.sync(
            "webpack",
            ["--config", devConfig, "--progress", "--watch"],
            { stdio: "inherit" }
        );
        break;
    }
    case "build": {
        result = spawn.sync(
            "webpack",
            ["--config", prodConfig, "--progress"],
            { stdio: "inherit" }
        );
        break;
    }
    default:
        console.log(`Unknown script "${task}".`);
}

if (result.signal) {
    process.exit(1);
}

process.exit(result.status);