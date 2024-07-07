const fs = require('fs-extra');

async function copyFiles() {
    try {
        await fs.copy('./lib-bild/devex-scripts', './dist/devex-scripts');
        console.log('devex-scripts скопійовано успішно!');

        await fs.copy('./lib-bild/config', './dist/config');
        console.log('config скопійовано успішно!');
    } catch (err) {
        console.error('Сталася помилка під час копіювання файлів:', err);
    }
}

copyFiles();