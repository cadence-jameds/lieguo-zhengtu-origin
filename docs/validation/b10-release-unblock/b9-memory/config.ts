import {mergeConfig} from 'vitest/config';
import base from '../../../../vite.config';
import {memoryPlugin} from './plugin.mjs';
import {b9ProfilePlugin} from '../final-blockers/b9-profile-plugin.mjs';
export default mergeConfig(base,{plugins:[memoryPlugin(),...(process.env.B9_MEMORY_CPU==='1'?[b9ProfilePlugin()]:[])],test:{execArgv:['--expose-gc'],setupFiles:[new URL('./setup.mjs',import.meta.url).pathname]}});
