import o from 'ospec'
import { createFlow } from '../index.js'

o.spec('Declarative Helpers', () => {

  async function make(flowCode) {
    const flow = await createFlow(flowCode, {
      async onCallFn() {
        throw new Error('Not testing')
      }
    })
    await flow.init('0x0', 10)
    return flow
  }

  o('prompt_once/1', async () => {
    const flow = await make(`prompt :- prompt_once(x), show foo.`)
    o((await flow.matchPrompts( `foo`, 'Out')).length).equals(1)
    o((await flow.matchPrompts( `foo`, 'Out')).length).equals(0)
  })
})
