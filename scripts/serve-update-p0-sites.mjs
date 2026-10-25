// Local-only browser verification server; never used by the production game.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(process.argv[2]??'/tmp/update-p0-browser'),port=Number(process.env.UPDATE_P0_PORT??4219),base='/lieguo-zhengtu-origin/';
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2','.webmanifest':'application/manifest+json'};
http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://127.0.0.1');if(!url.pathname.startsWith(base)){res.writeHead(404).end();return;}
 const rel=decodeURIComponent(url.pathname.slice(base.length))||'index.html';if(rel.split('/').includes('..')){res.writeHead(403).end();return;}
 const variant=(await fs.readFile(path.join(root,'variant.txt'),'utf8')).trim(),mode=(await fs.readFile(path.join(root,'mode.txt'),'utf8')).trim();
 if(rel==='sw.js'&&mode==='offline-sw'){res.writeHead(503,{'Cache-Control':'no-store'}).end();return;}
 if(rel==='sw.js'&&mode==='bad-install'){res.writeHead(200,{'Content-Type':'application/javascript','Cache-Control':'no-store','Service-Worker-Allowed':base});res.end("self.addEventListener('install',event=>event.waitUntil(Promise.reject(Error('synthetic install failure'))));");return;}
 if(rel==='sw.js'&&mode==='slow-sw')await new Promise(resolve=>setTimeout(resolve,16000));
 if(rel==='sw.js'&&mode==='candidate-sw')await new Promise(resolve=>setTimeout(resolve,3000));
 let data;for(const name of [variant,...(rel.startsWith('assets/')?['before','patched-old','after','same-version']:[])]){try{data=await fs.readFile(path.join(root,name,rel));break;}catch{}}
 if(!data){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':types[path.extname(rel)]??'application/octet-stream','Cache-Control':'no-store','Service-Worker-Allowed':base});res.end(data);
}catch{res.writeHead(500).end();}}).listen(port,'127.0.0.1',()=>console.log('Local P0 verification server: '+port));
