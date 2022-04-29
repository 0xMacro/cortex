import fs from 'fs'
import path from 'path'
import { program } from 'commander'
import { convertABIToPrologCode, uncapitalize } from '../index.js'

const ABI = program.command('abi')
export default ABI

ABI
  .command('convert <file>')
  .description('Convert an ABI JSON file to Cortex')
  .action((file) => {
    const json = JSON.parse(fs.readFileSync(path.join(process.cwd(), file)))
    const code = `abi(${uncapitalize(json.contractName)}, [\n${
      convertABIToPrologCode(json.abi)
        .map(line => '  '+line)
        .join(',\n')
      }\n]).`
    console.log(code)
  })
