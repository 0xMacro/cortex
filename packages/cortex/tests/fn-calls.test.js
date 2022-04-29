import o from 'ospec'
import { createFlow } from '../index.js'

o.spec('Function calls', () => {

  async function make(flowCode, onCallFn) {
    const flow = await createFlow(flowCode, { onCallFn })
    await flow.init('0xbeef', 10)
    return flow
  }

  o('basic', async () => {
    const flow = await make(`
        address(foo, '0xfeed').
        abi(foo, [
          inc(uint256): uint256
        ]).
      `,
      async function onCallFn({ args }) {
        return [args[0] + 1n]
      }
    )
    const [{ Out }] = await flow.query(`call_fn(foo, inc(5), [Out]).`)
    o(Out).equals(6n)
  })

  o('tuple input', async () => {
    let caughtArgs, caughtParamTypes
    const flow = await make(`
        address(foo, '0xfeed').
        abi(foo, [
          add(tuple(uint8, uint8)): uint8
        ]).
      `,
      async function onCallFn({ args, paramTypes }) {
        caughtArgs = args
        caughtParamTypes = paramTypes
        return [args[0][0] + args[0][1]]
      }
    )
    const [{ Out }] = await flow.query(`call_fn(foo, add(tuple(5, 7)), [Out]).`)
    o(Out).equals(12n)

    o(caughtArgs).deepEquals([[5n, 7n]])
    o(caughtParamTypes).deepEquals(['tuple(uint8,uint8)'])
  })

  o('tuple output', async () => {
    const flow = await make(`
        address(foo, '0xfeed').
        abi(foo, [
          half(uint): tuple(uint, uint)
        ]).
      `,
      async function onCallFn({ args, paramTypes }) {
        return [args[0] / 2n, args[0] / 2n]
      }
    )
    const [{ X, Y }] = await flow.query(`call_fn(foo, half(30), [X, Y]).`)
    o(X).equals(15n)
    o(Y).equals(15n)
  })
})
