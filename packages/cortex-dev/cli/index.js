#!/usr/bin/env node

import { program } from 'commander'
import ABI from './abi.js'

program
  .addCommand(ABI)

program.parse()
