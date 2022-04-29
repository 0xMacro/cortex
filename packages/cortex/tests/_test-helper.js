import { setFlowDir } from '@0xmacro/cortex-dev'
export * from '@0xmacro/cortex-dev'

const __dirname = new URL('.', import.meta.url).pathname;

setFlowDir(__dirname + '/integration')
