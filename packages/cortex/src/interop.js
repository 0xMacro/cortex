import dayjs from 'dayjs'
import advancedFormat from 'dayjs/plugin/advancedFormat.js'

// Support more date formatting
// https://day.js.org/docs/en/plugin/advanced-format
dayjs.extend(advancedFormat)

export const ADDRESS_REGEX = /^0x[0-9a-f]{40}$/i

export function unescapeString(stringOrTerm) {
  if (typeof stringOrTerm === 'string') {
    return stringOrTerm.replace(/^'/, '').replace(/'$/, '').replace(`\\'`, `'`)
  }
  else if (stringOrTerm[0] === 'address') {
    const addr = unescapeString(stringOrTerm[1])
    return `${addr.slice(0, 6)}..${addr.slice(38, 42)}`
  }
  else if (stringOrTerm[0] === 'eth') {
    const wei = stringOrTerm[1]
    const label = stringOrTerm[2] ? unescapeString(stringOrTerm[2]) : 'ETH'

    let [integer, decimals] =
      wei.length > 18
      ? [wei.slice(0, wei.length - 18) || '0', wei.slice(wei.length - 18).replace(/0+$/, '')]
      : ['0', new Array(18 - wei.length).fill('0').join('') + wei.replace(/0+$/, '')]

    // Attempt to only show 5 decimals
    let rounded = false
    if (decimals.length > 5) {
      let i = 4
      for (; i < decimals.length; i++) {
        if (decimals[i] !== '0') {
          break
        }
      }
      if (decimals[i+1]) {
        // Round decimal
        const nextDigit = +decimals[i+1]
        const overflow = decimals[i] === '9' && nextDigit >= 5
        decimals = decimals.slice(0, overflow ? i - 1 : i) + (
          overflow ? 1 :
          nextDigit >= 5 ? +decimals[i] + 1 :
          decimals[i]
        )
        rounded = true
      }
    }

    return `${rounded ? '~' : ''}${integer}${decimals.length ? '.'+decimals : ''} ${label}`
  }
  else if (stringOrTerm[0] === 'date') {
    let date = stringOrTerm[1]
    // Let a dot (.) pass in case we get a float (we cut off the decimals via parseInt)
    if (/^[0-9.]+$/.test(date)) {
      // Assume date is in seconds. Convert to JS timestamp
      date = parseInt(date, 10) * 1000
    }
    const formatString = unescapeString(stringOrTerm[2])
    return dayjs(date).format(formatString)
  }
  else if (stringOrTerm[0] === 'time') {
    const [, type, time] = stringOrTerm

    const isInterval = typeof type === 'number'

    const factor =
      type === 'seconds' ? 1 :
      type === 'minutes' ? 60 :
      type === 'hours' ? 60 * 60 :
      type === 'days' ? 60 * 60 * 24 :
      isInterval ? type :
      1

    return `${time / factor} ${isInterval ? 'intervals' : type}`
  }
}

export function escapeAtom(string) {
  return startsWithCapitalLetter(string) ? `'${string}'` : string
}

export function startsWithCapitalLetter(word) {
  return word.charCodeAt(0) >= 65 && word.charCodeAt(0) <= 90;
}

export function capitalize(word) {
  return word[0].toUpperCase() + word.slice(1)
}

export function uncapitalize(word) {
  return word[0].toLowerCase() + word.slice(1)
}

export function hexpad(value, numberOfBytes) {
  value = value.replace(/^0x/, '').replace(/[^0-9a-f]/gi, '')

  // 1 byte = 2 hex characters
  const expectedLength = numberOfBytes * 2
  if (value.length < expectedLength) {
    value = new Array(expectedLength - value.length).fill('0').join('') + value
  }

  return '0x' + value
}


/**
 * JSON.stringify, but serializes BigInts and BigNumbers to '123n' strings
 * */
export function stringifyJson(data) {
  return JSON.stringify(data, (key, value) =>
    typeof value === 'bigint'
    ? value.toString() + 'n'
    : value?.type === 'BigNumber' && value?.hex
    ? BigInt(value.hex).toString() + 'n'
    : value
  )
}

/**
 * JSON.parse, but converts '123n' strings to BigInts
 * */
export function parseJson(json) {
  return JSON.parse(json, (key, value) => {
    if (typeof value === 'string' && /^\d+n$/.test(value)) {
      return BigInt(value.substr(0, value.length - 1))
    }
    return value
  })
}

export function encodeEthersContractParams(paramTypes, paramValues) {
  return paramTypes.map((type, i) => {
    const value = paramValues[i]

    let m;
    if (m = type.match(/^bytes([0-9]+)$/)) {
      let byteCount = +m[1]
      console.log('gogo', byteCount, m[1])
      return hexpad(value, byteCount)
    }
    return value
    // TODO: Support more types
  })
}

export function convertEthersContractCallResult(value) {
  if (value?.toBigInt) {
    return value.toBigInt()
  }
  else if (Array.isArray(value)) {
    return value.map(convertEthersContractCallResult)
  }
  else if (typeof value === 'string' && ADDRESS_REGEX.test(value)) {
    return value.toLowerCase()
  }
  return value
}
