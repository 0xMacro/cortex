import o from 'ospec'
import { createFlow } from '../index.js'

o.spec('Big numbers', () => {

  async function make(flowCode) {
    const flow = await createFlow(flowCode, {
      async onCallFn() {
        throw new Error('Not testing')
      }
    })
    await flow.init('0x0', 10)
    return flow
  }

  o('Used by default', async () => {
    const flow = await make(`prompt :- X is 8 + 2, show abc(X).`)
    const [{ N }] = await flow.matchPrompts(`abc(N)`, 'N')
    o(N).equals(10n)
  })

  o('Serialized as BigInt strings', async () => {
    const flow = await make(`prompt :- X is 8 + 2, show abc(X).`)
    const prompts = await flow.getPrompts()
    o(prompts.length).equals(1)
    o(prompts[0]).deepEquals(['abc', '10'])
  })
})
