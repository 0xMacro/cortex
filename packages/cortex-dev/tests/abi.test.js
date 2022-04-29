import o from 'ospec'
import { convertABIToPrologCode } from '../src/abi.js'

o.spec('ABI helpers', () => {

  o('no params', () => {
    const result = convertABIToPrologCode([
      {
        "inputs": [],
        "name": "owner",
        "outputs": [
          {
            "internalType": "address",
            "name": "",
            "type": "address"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [],
        "name": "decimals",
        "outputs": [
          {
            "internalType": "uint8",
            "name": "",
            "type": "uint8"
          }
        ],
        "stateMutability": "pure",
        "type": "function"
      },
      {
        "inputs": [],
        "name": "pay",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
      },
      {
        "inputs": [],
        "name": "renounceOwnership",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      },
    ])

    o(result).deepEquals([
      'owner: address / view',
      'decimals: uint8 / pure',
      'pay: payable',
      'renounceOwnership'
    ])
  })

  o('basic', () => {
    const result = convertABIToPrologCode([
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "tokenHolder",
            "type": "address"
          }
        ],
        "name": "balanceOf",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
    ])

    o(result).deepEquals([
      'balanceOf(address): uint256 / view',
    ])
  })

  o('escape atom', () => {
    const result = convertABIToPrologCode([
      {
        "inputs": [],
        "name": "INITIAL_SUPPLY",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
    ])

    o(result).deepEquals([
      `'INITIAL_SUPPLY': uint256 / view`,
    ])
  })

  o('array', () => {
    const result = convertABIToPrologCode([
      {
        "inputs": [],
        "name": "defaultOperators",
        "outputs": [
          {
            "internalType": "address[]",
            "name": "",
            "type": "address[]"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
    ])

    o(result).deepEquals([
      `defaultOperators: array(address) / view`,
    ])
  })

  o('tuple param', () => {
    const result = convertABIToPrologCode([
      {
        "inputs": [
          {
            "components": [
              {
                "internalType": "bytes32[]",
                "name": "proof",
                "type": "bytes32[]"
              },
              {
                "internalType": "uint32",
                "name": "startDate",
                "type": "uint32"
              },
              {
                "internalType": "bool",
                "name": "paid",
                "type": "bool"
              },
            ],
            "internalType": "struct MyContract.UserData",
            "name": "userData",
            "type": "tuple"
          }
        ],
        "name": "claim",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      },
    ])

    o(result).deepEquals([
      `claim(tuple(array(bytes32), uint32, bool))`,
    ])
  })

  o('tuple return', () => {})
})
