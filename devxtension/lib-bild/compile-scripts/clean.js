const fs = require('fs');
const path = require('path');

// Always remove only this package's generated output, independent of shell/cwd.
fs.rmSync(path.resolve(__dirname, '../../dist'), { recursive: true, force: true });
