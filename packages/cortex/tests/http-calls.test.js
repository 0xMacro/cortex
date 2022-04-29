import o from 'ospec'
import { createFlow } from '../index.js'

o.spec('HTTP calls', () => {

  async function make(flowCode, onCallHttp) {
    const flow = await createFlow(flowCode, { onCallHttp })
    await flow.init('0xbeef', 10)
    return flow
  }

  o('get', async () => {
    let caughtMethod
    const flow = await make(`
        oracle(foo, r, 'example.com').
        bar(Out) :- get_http(foo, '/a/b' ++ '/c', Out).
      `,
      async function onCallHttp({ method, url, options }) {
        caughtMethod = method
        return [200, {}, { x: { y: [10, 20, url] } }]
      }
    )

    const [{ Out }] = await flow.query(`bar(Out).`)
    o(Out).deepEquals({ x: { y: [10, 20, 'https://example.com/a/b/c'] } })
    o(caughtMethod).equals('GET')
  })

  o('options parsing', async () => {
    let caughtOptions
    const flow = await make(`
        oracle(foo, r, 'example.com').
        bar(Out) :- get_http(foo, '/a/b' ++ '/c', Out, [a: 10, b: [20, 30]]).
      `,
      async function onCallHttp({ url, options }) {
        caughtOptions = options
        return [200, {}, 9]
      }
    )
    await flow.query(`bar(Out).`)

    o(caughtOptions).deepEquals({
      a: 10n,
      b: [20n, 30n]
    })
  })
})
