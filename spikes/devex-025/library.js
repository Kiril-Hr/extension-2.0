import { defineExtensionMessaging } from '@webext-core/messaging'

const messenger = defineExtensionMessaging({ logger: null })
export const listen = (name, handle) => messenger.onMessage(name, message => handle(message.data, message.sender))
export const send = messenger.sendMessage
