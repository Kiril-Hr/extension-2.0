import { listen, send } from 'spike-transport'

listen('probe', (_, sender) => {
  const count = Number(document.documentElement.dataset.calls || 0) + 1
  document.documentElement.dataset.calls = String(count)
  return { url: location.href, sender }
})
send('identify', null).then(result => {
  document.documentElement.dataset.identity = JSON.stringify(result)
})
