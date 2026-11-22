// Characterize the released implementation without making its side effects an API guarantee.
const assert = require('node:assert/strict')
const { Feature, DisableFeatures } = require('../../devxtension/dist')

class Controller {
  record(value) {
    return this.name + value
  }

  dispatch(value) {
    return this.record(value)
  }

  constructor(name) {
    this.name = name
  }
}

const proto = Controller.prototype
const descriptor = Object.getOwnPropertyDescriptor(proto, 'record')
Feature('recording')(proto, 'record', descriptor)

const first = new Controller('first')
const second = new Controller('second')
const invoke = features => DisableFeatures({ method: first.dispatch, features, link: first })('!')

assert.equal(invoke({ recording: false }), 'first!')
assert.equal(second.record('!'), 'second!')

assert.equal(invoke({ recording: true }), undefined)
const disabled = proto.record
assert.notEqual(disabled, descriptor.value)
assert.equal(second.record('!'), undefined)
assert.equal(new Controller('later').record('!'), undefined)

for (const flags of [{ recording: true }, { recording: false }, {}, null]) {
  assert.equal(invoke(flags), undefined)
  assert.equal(proto.record, disabled)
}

assert.equal(disabled.feature, undefined)
assert.equal(descriptor.value.call(first, '!'), 'first!')
console.log('Observed shared prototype mutation, persistent disable, intact captured original and bound callback.')
