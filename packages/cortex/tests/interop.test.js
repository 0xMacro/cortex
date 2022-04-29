import o from 'ospec'
import { unescapeString } from '../index.js'

o.spec('unescapeString', () => {

  o('strips quotes', () => {
    o(unescapeString(`'hello'`)).equals('hello')
  })

  o('formats addresses', () => {
    const addr = '0x1234567890beefbeefbeefbeefbeef0987654321'
    o(unescapeString(['address', addr])).equals('0x1234..4321')
  })

  o('formats eth', () => {
    o(unescapeString(['eth', '760000000000000000000'])).equals( '760 ETH')
    o(unescapeString(['eth', '765000000000000000000'])).equals( '765 ETH')
    o(unescapeString(['eth',  '65120000000000000000'])).equals( '65.12 ETH')
    o(unescapeString(['eth',   '5120000000000000000'])).equals( '5.12 ETH')
    o(unescapeString(['eth',    '123000000000000000'])).equals( '0.123 ETH')
    o(unescapeString(['eth',    '123450000000000000'])).equals( '0.12345 ETH')
    o(unescapeString(['eth',    '123456780987654321'])).equals('~0.12346 ETH')
    o(unescapeString(['eth',     '23456780987654321'])).equals('~0.02346 ETH')
    o(unescapeString(['eth',        '56780987654321'])).equals('~0.00006 ETH')
    o(unescapeString(['eth',         '6780987654321'])).equals('~0.000007 ETH')
    o(unescapeString(['eth',             '987654321'])).equals('~0.000000001 ETH') // Edge case!
    o(unescapeString(['eth',              '87654321'])).equals('~0.00000000009 ETH')
    o(unescapeString(['eth',                     '1'])).equals( '0.000000000000000001 ETH')
  })

  o('formats dates', () => {
    // Convert to seconds, which is what the EVM uses
    // Pass as string, which is what cortex does
    const timestamp = '' + (1648149131913 / 1000)

    // The expected date
    const date = new Date(timestamp * 1000)

    // Tedious interpolation to make this test work across timezones
    o(unescapeString(['date', timestamp, 'YYYY-MM-DD HH:mm:ss'])).equals(`2022-03-${date.getDate()} ${date.getHours()}:12:11`)
  })

  o.only('formats time', () => {
    const time = 60n * 60n * 24n * 120n / 100n

    // Tedious interpolation to make this test work across timezones
    o(unescapeString(['time', 'days', time])).equals(`1.2 days`)
  })
})
