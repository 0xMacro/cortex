import fs from 'fs'
import path from 'path'
import isEqual from 'lodash/isEqual.js'
import { defaultAbiCoder as AbiCoder, Interface } from '@ethersproject/abi'
import { BN, Account, Address, pubToAddress, toBuffer } from 'ethereumjs-util'
import { getOpcodesForHF } from '@ethereumjs/vm/dist/evm/opcodes/index.js'

import TX from '@ethereumjs/tx'
const { Transaction } = TX
import evm from '@ethereumjs/vm'
const { default: VM } = evm
import ejs from '@ethereumjs/common'
const { default: Common, Chain, Hardfork } = ejs

import { createFlow, convertEthersContractCallResult } from '@0xmacro/cortex'

let flowsDir = ''
export function setFlowDir(newDir) {
  flowsDir = newDir
}

const findCache = {}
const readCache = {}

/**
 * Looks up and reads a file based on a relative path.
 * Designed to be fast and easy to use in a test environment.
 *
 * If a flow directory is set, generateFlowCode joins that directory
 * with the given relative path.
 *
 * If no flow directory is set, it searches for a `flows/` directory,
 * starting with the current working directory and moving upwards.
 * */
export function generateFlowCode(flowFileRelative, interpolations={}) {
  let flowFile = ''
  if (flowsDir) {
    flowFile = path.join(flowsDir, flowFileRelative)
  }
  else {
    let cacheKey = process.cwd() + flowFileRelative
    if (findCache[cacheKey]) {
      flowFile = findCache[cacheKey]
    }
    else {
      let estimatedProjectDir = process.cwd()
      let exists = false

      while (true) {
        flowFile = path.join(estimatedProjectDir, 'flows', flowFileRelative)
        exists = fs.existsSync(flowFile)

        if (exists || estimatedProjectDir === path.sep) {
          break
        }
        estimatedProjectDir = path.dirname(estimatedProjectDir)
      }

      if (exists) {
        findCache[cacheKey] = flowFile
      }
      else {
        throw new Error(`[cortex-dev] Could not find flow file: ${JSON.stringify(flowFileRelative)}`)
      }
    }
  }

  if (readCache[flowFile]) {
    return readCache[flowFile]
  }

  let code = fs.readFileSync(flowFile, 'utf8')

  for (let prop in interpolations) {
    let value = interpolations[prop]
    if (!value?.toString || value.toString() === '[object Object]') {
      console.warn(`[cortex-dev][warning] Improper interpolation value: ${JSON.stringify(value)}`)
    }
    code = code.replace(`{{${prop}}}`, (value ?? '').toString())
  }

  readCache[flowFile] = code
  return code
}


export async function createTestFlow(code) {
  return await createFlow(code, {
    async onCallFn({ env, block, contractAddress, functionSig, args, paramTypes, returnType, value, mutability }) {
      const cacheKey = functionSig + (
        paramTypes.length == 0
        ? ''
        : AbiCoder.encode(paramTypes, args)
      )
      // console.log("Cache key", cacheKey)

      if (mutability.view && block.cache[cacheKey]) {
        // console.log("onCallFn (cache hit)", functionSig, contractAddress)
        return block.cache[cacheKey]
      }

      try {
        const callArgs = [contractAddress, returnType.length ? `${functionSig}: ${returnType[0]}` : functionSig, args]
        const result = (
          mutability.view
          ? await env.signer.get(...callArgs)
          : (await env.signer.call(...callArgs, value)).returnValue
        ).map(convertEthersContractCallResult)

        block.cache[cacheKey] = result
        return result
      }
      catch(err) {
        if (err instanceof EVM.RevertError) {
          console.log(`Contract reverted: '${err.message}'`)
          throw err
        }
        else {
          console.log('Unexpected contract call error', err)
          throw err
        }
      }
    },
  })
}

export async function createHardhatFlow(code, { debug, contracts, onCallHttp }={}) {
  contracts = contracts || []

  return await createFlow(code, {

    onCallHttp,

    async onCallFn({ block, env, contractAddress, functionSig, args, returnType, value, mutability }) {
      // TODO: Cache view functions by block
      const contract = contracts.find(c =>
        c.address.toLowerCase() === contractAddress.toLowerCase()
      )
      if (!contract) {
        let message = `[createHardhatFlow] No provided contract for address: ${contractAddress}`
        message += `\nProvided addresses:`
        message += contracts.map(c => '\n  ' + JSON.stringify(c.address)).join('')

        // TODO: Figure out why async errors don't propagate in Tau
        console.error(message)
        throw new Error(message)
      }
      try {
        if (debug) {
          console.log("onCallFn", functionSig, !!contract.functions[functionSig], args)
        }
        const result = await contract.connect(env.signer).functions[functionSig](...args)
        return convertEthersContractCallResult(result)
      }
      catch(err) {
        if (err instanceof EVM.RevertError) {
          console.log(`Contract reverted: '${err.message}'`)
          throw err
        }
        else {
          console.log('Unexpected contract call error', err)
          throw err
        }
      }
    },
  })
}


class RevertError extends Error {}

export class EVM {
  static RevertError = RevertError
  accounts = []

  async init() {
    const common = new Common({ chain: Chain.Mainnet, hardfork: Hardfork.Berlin })
    this.vm = new VM({ common })
    for (let i=0; i < keyPairs.length; i++) {
      await this.makeAccount(i, 123)
    }
  }

  async deploy(bytecode, paramTypes, params, {value=0}={}) {
    const {createdAddress} = await this.runTx(0, {
      value,
      gasPrice: 1,
      gasLimit: 2e6,
      data: bytecode + AbiCoder.encode(paramTypes, params).slice(2),
    })
    return createdAddress
  }

  async get(accountIndex, contractAddr, fnSigAndReturnType, args) {
    const [fnSig, returnType] = fnSigAndReturnType.trim().split(/: ?/)

    const account = this.accounts[accountIndex]
    const from = Address.fromPrivateKey(account.privateKeyBuf)
    const calldata = getCalldata(fnSig, args)
    // console.log("?>", contractAddr.toString(), fnSig, returnType, calldata)

    const result = await this.vm.runCall({
      to: typeof contractAddr === 'string' ? Address.fromString(contractAddr) : contractAddr,
      caller: account.addressObject,
      origin: account.addressObject,
      data: Buffer.from(calldata.slice(2), 'hex'),
    })

    if (result.execResult.exceptionError) {
      console.error("Get call error:", result.execResult.exceptionError, result.execResult)
      throw result.execResult.exceptionError
    }

    return AbiCoder.decode(returnTypeForAbiEncoder(returnType), result.execResult.returnValue)
  }

  async call(accountIndex, contract, fnSigAndMaybeReturnType, args, value) {
    const [fnSig, returnType] = fnSigAndMaybeReturnType.trim().split(/: ?/)
    const calldata = getCalldata(fnSig, args)
    // console.log("!>", fnSig, calldata, value)
    const tx = await this.runTx(accountIndex, {
      to: contract,
      gasPrice: "0x09184e72a000",
      gasLimit: "0x90710",
      data: calldata,
      value: '0x' + (value || 0n).toString(16),
    })

    const returnValue = returnType
      ? AbiCoder.decode(returnTypeForAbiEncoder(returnType), result.execResult.returnValue)
      : []

    return { tx, returnValue }
  }

  async runTx(index, txData) {
    const account = this.accounts[index]
    const tx = Transaction.fromTxData({
      ...txData,
      nonce: `0x${account.nonce.toString(16)}`,
    }).sign(account.privateKeyBuf)

    account.nonce += 1

    const results = await this.vm.runTx({ tx })
    const returnValue = results.execResult.returnValue.toString('hex')

    if (results.execResult?.exceptionError) {
      if (returnValue) {
        const message = AbiCoder.decode(['string'], Buffer.from(returnValue, 'hex').slice(4))
        throw new RevertError(message)
      }
      else {
        console.error("Transaction error:", results.execResult.exceptionError, returnValue, results.execResult)
        throw results.execResult.exceptionError
      }
    }

    // console.log('Gas used:', results.gasUsed.toString())
    // console.log('Returned:', results.execResult.returnValue.toString('hex'))
    // if (results.createdAddress) console.log('Deployed contract:', results.createdAddress.toString('hex'))

    return { createdAddress: results.createdAddress, results, returnValue }
  }

  async makeAccount(index, balance) {
    const keyPair = keyPairs[index]
    const account = Account.fromAccountData({
      nonce: 0,
      balance: new BN(10).pow(new BN(18)).mul(new BN(balance))
    })
    const privateKeyBuf = toBuffer(keyPair.privateKey)
    const publicKeyBuf = toBuffer(keyPair.publicKey)
    const address = new Address(pubToAddress(publicKeyBuf, true))
    this.accounts[index] = {
      get: this.get.bind(this, index),
      call: this.call.bind(this, index),
      nonce: 0,
      address: address.toString(),
      addressObject: address,
      privateKeyBuf
    }

    await this.vm.stateManager.putAccount(address, account)
  }
}


function getCalldata(fnSig, args) {
  fnSig = fnSig.replace(/ /g, '')
  const abi = new Interface([
    `function ${fnSig}`
  ])
  return abi.getSighash(fnSig) + AbiCoder.encode(abi.functions[fnSig].inputs, args).slice(2)
}

function returnTypeForAbiEncoder(returnType) {
  let match = returnType.match(/^tuple\((.*)\)$/)
  if (match) {
    return match[1].split(',')
  }
  return [returnType]
}

//
// To create more:
// let privateKey = require('crypto').randomBytes(32).toString('hex')
// let publicKey = require('ethereumjs-util').privateToPublic(Buffer.from(privateKey, 'hex')).toString('hex')
//
export let keyPairs = [{
  "privateKey": "0x91463bbcaeae78f3240d374119ef0fba1e8ad1092b3cce86647e610fd8847053",
  "publicKey": "0xa7e52349b1b244bd230854bb9bb50e5675c9c681939a46866276af97501350039f9a4d417c0e3ef6679157bde0e22a97f3e34f48c3649fa5165b52796ddaadd2"
}, {
  "privateKey": "0x0b27f73ace16341c109c46e795d8f31de7988ddb1ac8175940fe5f3656827f9a",
  "publicKey": "0x415f2ceca7307f4da2f2334696b6cee105ba6654b7cd8e57ac0c236f116808efee029b6cd7b537abcb9772dc408f0400bd8b1f72a43c5b6f8d5fda309bc2a989"
}, {
  "privateKey": "0x4bf160df21a9a88adf9a76caa55ca8c35cc8c2527f98feb047eb2cca570011be",
  "publicKey": "0x455aeb1dd326f5eb513720e608a1cc8ffa6ef325717086419c24d67a7bd79861cfd33cac02c30edd6af1a7ad3aaafef24a77b34b4d012b2456a7905b7015020a"
}, {
  "privateKey": "0xe2f0aab298f015cf371ac7554f76670d60c5928f2c5a7b4f84212947255074f5",
  "publicKey": "0xbc71f21d631f532a5d403123709bd7faa347a337f1a33fce0b4ba497bf196e7128e06973ddb1e5eafc17feebd9bbf42d39fb97362e5394a10d7983db21018a22"
}, {
  "privateKey": "0x011efa7e46629b84171385ab8952e01ef25cce3d85af18eeba674eb9c3201580",
  "publicKey": "0x7e1e120f940d782e8f667230b9a08c1f98e60ec58d629bd9c279bf07c62ab69581cbae0ace829b749d889b12128fd2e23ac48e1da4e8ae250b09ae0e64d17c17"
}]
