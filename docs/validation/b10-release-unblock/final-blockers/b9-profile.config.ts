import {mergeConfig} from 'vitest/config';
import base from '../../../../vite.config';
import {b9ProfilePlugin} from './b9-profile-plugin.mjs';
export default mergeConfig(base,{plugins:[b9ProfilePlugin()],test:{setupFiles:[new URL('./b9-profile.setup.mjs',import.meta.url).pathname]}});
