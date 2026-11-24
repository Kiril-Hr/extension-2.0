// This isolated-world probe sends exactly once on the loopback fixture page.
import { identify } from 'fixture-client'

const state = { sends: 0, callbacks: 0 }
const expose = () => { document.documentElement.dataset.probe = JSON.stringify(state) }
const send = chrome.runtime.sendMessage.bind(chrome.runtime)

chrome.runtime.sendMessage = (message, callback) => {
  state.sends++
  state.submit = Date.now()
  return send(message, response => {
    state.callback = Date.now()
    state.callbacks++
    state.nativeError = chrome.runtime.lastError?.message
    state.validReply = response?.value === 'identified' || response?.result?.value === 'identified'
    expose()
    callback(response)
  })
}

document.addEventListener('cold-start-probe', async () => {
  state.start = Date.now()
  const result = await identify()
  state.settle = Date.now()
  state.result = result.ok && result.value === 'identified' ? 'success' : result.code || 'invalid'
  expose()
}, { once: true })

expose()
