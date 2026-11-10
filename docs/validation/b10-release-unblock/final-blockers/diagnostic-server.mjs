// Isolated localhost origin, native production SW and immutable build assets.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(process.argv[2]),port=Number(process.env.B10_PRODUCTION_PORT??4219);
const base='/lieguo-zhengtu-origin/';
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp','.webmanifest':'application/manifest+json','.woff2':'font/woff2'};
http.createServer(async(req,res)=>{
 try{
  const u=new URL(req.url,'http://localhost');
  if(!u.pathname.startsWith(base)){res.writeHead(404).end();return;}
  const rel=decodeURIComponent(u.pathname.slice(base.length))||'index.html';
  if(rel.split('/').includes('..')){res.writeHead(403).end();return;}
  const variant=(await fs.readFile(path.join(root,'variant.txt'),'utf8')).trim();
  const mode=(await fs.readFile(path.join(root,'mode.txt'),'utf8')).trim();
  if(mode==='bad-install'&&rel==='sw.js'){
   res.writeHead(200,{'Content-Type':'application/javascript','Cache-Control':'no-store','Service-Worker-Allowed':base});
   res.end("self.addEventListener('install',event=>event.waitUntil(Promise.reject(Error('isolated synthetic install failure'))));");return;
  }
  if(mode==='offline-sw'&&rel==='sw.js'){res.writeHead(503).end();return;}
  if(rel==='__validation/lab.html'){
   res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-store'}).end('<!doctype html><title>Isolated synthetic fixture</title>');return;
  }
  // Existing controlled clients may still need their own build's hashed files.
  let data;
  for(const name of [variant,...(rel.startsWith('assets/')?['before','after']:[])]){
   try{data=await fs.readFile(path.join(root,name,rel));break;}catch{}
  }
  if(!data){res.writeHead(404).end();return;}
  if(rel==='sw.js')data=Buffer.concat([Buffer.from(await fs.readFile(new URL('./sw-lifetime-prefix.js',import.meta.url))),data]);
  res.writeHead(200,{'Content-Type':types[path.extname(rel)]??'application/octet-stream','Cache-Control':'no-store','Service-Worker-Allowed':base}).end(data);
 }catch(error){res.writeHead(500).end(String(error));}
}).listen(port,'127.0.0.1',()=>console.log('B10 isolated production origin on '+port));
