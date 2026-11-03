import {createServer} from 'vite';
import {runtimeObservationPlugin} from './runtime-observation-plugin.mjs';
const server=await createServer({root:process.cwd(),cacheDir:'.vite-runtime-validation',plugins:process.env.B10_OBSERVE==='1'?[runtimeObservationPlugin()]:[],server:{host:'127.0.0.1',port:Number(process.env.B10_PORT??5186),hmr:false,strictPort:true}});await server.listen();server.printUrls();
