import { createExtensionFactory } from 'devxtension'
import { HelloModule } from './modules/hello'

createExtensionFactory([HelloModule])({
  params: {
    manifest: {
      name: 'DevEx hello',
      version: '1.0.0',
      description: 'A minimal DevEx extension',
      permissions: [],
      host_permissions: ['https://example.com/*'],
      action: { default_title: 'DevEx hello' }
    }
  }
})
