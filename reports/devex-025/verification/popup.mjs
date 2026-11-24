import { background, protocol, strict } from './contract.mjs'

async function probe() {
  const valid = await protocol.client('popup').request('identify', null, background)
  const denied = await strict.client('popup').request('identify', null, background)
  await chrome.runtime.sendMessage({ fixture: true, action: 'popupResult', result: { valid, denied } })
}
void probe()
