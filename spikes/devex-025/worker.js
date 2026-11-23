import { listen, send } from 'spike-transport'

const boot = crypto.randomUUID()
listen('identify', (_, sender) => ({ boot, sender }))
listen('popup', (_, sender) => {
  globalThis.popupSender = sender
  return { boot }
})
globalThis.probe = target => send('probe', null, target)
globalThis.openPopup = () => chrome.action.openPopup()
