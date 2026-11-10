import {mergeConfig} from 'vitest/config';
import base from '../../../../vite.config';
const config=mergeConfig(base,{});config.test!.include=['docs/validation/b10-release-unblock/final-blockers/clone-benchmark.test.ts'];export default config;
