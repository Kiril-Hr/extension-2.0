import { realm } from '../../messaging/contract'
import { label } from './services/label'

export function identify(payload: string) {
  return [payload, label, 'handler', realm].join('|')
}
