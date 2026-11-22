const fs = require('fs');
const path = require('path');

function getEntryPoints(dir, prefix = '') {
    const entries = {};
    const files = fs.readdirSync(dir);

    files.forEach(file => {
        const fullPath = path.join(dir, file);
        const key = prefix ? `${prefix}/${file}` : file;

        if (fs.statSync(fullPath).isDirectory()) {
            Object.assign(entries, getEntryPoints(fullPath, key));
        } else if (!file.includes('tsconfig')) {
            const entryName = path.relative(__dirname, fullPath).replace(/\\/g, '/').split('/').slice(2).join('/').replace('.ts', '');
            const entryValue = path.relative(__dirname, fullPath).replace(/\\/g, '/').replace('.ts', '').split('/').slice(1).join('/');

            entries[entryName] = entryValue
        }
    });

    return entries;
}

const entryPoints = getEntryPoints(path.resolve(__dirname, '../../src'));

console.log(entryPoints)

module.exports = entryPoints