import {createServer} from 'vite';
import {persistenceProfilePlugin} from './persistence-profile-plugin.mjs';
const server=await createServer({root:process.cwd(),cacheDir:'.vite-persistence-validation',plugins:process.env.B10_PROFILE==='1'?[persistenceProfilePlugin()]:[],server:{host:'127.0.0.1',port:Number(process.env.B10_PORT??5184),hmr:false,strictPort:true}});
await server.listen();server.printUrls();
