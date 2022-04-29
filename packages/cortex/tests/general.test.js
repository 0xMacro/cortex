import o from 'ospec'
import { createFlow } from '../index.js'

o.spec('General', () => {

  async function make(flowCode) {
    const flow = await createFlow(flowCode, {
      async onCallFn() {
        throw new Error('Not testing')
      }
    })
    await flow.init('0x0', 10)
    return flow
  }

  o('Orders prompts correctly', async () => {
    const flow = await make(`
      prompt :- show a, show [b, c], show d.
      prompt :- show [e, f].
      prompt :- show g.
    `)
    const prompts = await flow.getPrompts()
    o(prompts).deepEquals(['a', 'b', 'c', 'd', 'e', 'f', 'g'])
  })
})
