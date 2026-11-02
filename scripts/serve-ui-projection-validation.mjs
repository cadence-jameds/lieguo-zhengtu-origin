// Sole dev server for the synthetic native harness; avoid HMR/dependency reload
// races and do not run a second Vite process sharing its optimizer cache.
import {createServer} from 'vite';
const server=await createServer({root:process.cwd(),server:{host:'127.0.0.1',port:5184,hmr:false,strictPort:true}});
await server.listen();server.printUrls();
