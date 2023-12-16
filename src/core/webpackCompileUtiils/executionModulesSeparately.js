const fs = require('fs')
const path = require('path')

const srcFolder = path.resolve(__dirname, '../../')
const modulesFolder = path.resolve(srcFolder, './modules')

const executingTemplate = (moduleName) => moduleName[0].toUpperCase() + moduleName.slice(1) + '.setup()'

const executeModulesSeparately = () => {
  const modules = fs.readdirSync(modulesFolder)

  for (const moduleName of modules) {
    if (moduleName.includes('Module')) {
      const folder = path.resolve(modulesFolder, `./${moduleName}`)
      const fileName = fs.readdirSync(folder)
        .find(f => f.includes('Module'))

      const modulePath = path.resolve(folder, fileName)
      const moduleFile = fs.readFileSync(modulePath, 'utf8')

      const updatedModule = moduleFile + executingTemplate(moduleName)
      fs.writeFileSync(modulePath, updatedModule, 'utf-8')
    }
  }

}

module.exports = executeModulesSeparately
