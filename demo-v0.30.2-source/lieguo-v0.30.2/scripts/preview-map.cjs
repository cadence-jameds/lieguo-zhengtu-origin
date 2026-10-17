// One-off preview. The ground and trees are drawn by the site's TerrainCache.
const fs=require('fs');
const path=require('path');
const ts=require('typescript');
const {createCanvas,DOMMatrix,loadImage}=require('@napi-rs/canvas');
const sourceRoot=path.resolve(process.cwd(),'src/game');
const modules=new Map();
function load(relative){
  const filename=path.resolve(sourceRoot,relative);
  if(modules.has(filename))return modules.get(filename).exports;
  const module={exports:{}};modules.set(filename,module);
  const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const localRequire=(name)=>name.endsWith('.json')?{default:JSON.parse(fs.readFileSync(path.resolve(path.dirname(filename),name),'utf8'))}:name.startsWith('.')?load(path.relative(sourceRoot,path.resolve(path.dirname(filename),name+'.ts'))):require(name);
  new Function('require','module','exports',code)(localRequire,module,module.exports);
  return module.exports;
}
global.document={createElement:(tag)=>{if(tag!=='canvas')throw Error(tag);return createCanvas(1,1)}};
global.DOMMatrix=DOMMatrix;
const {TerrainCache,CHUNK_SIZE,CHUNK_ORIGIN_X}=load('terrainCache.ts');
const {flatProject}=load('mapProjection.ts');
const {waterAt}=load('terrainRegions.ts');

const {drawWorldScenery}=load('worldScenery.ts');
const {mountainAnchors}=load('terrainRegions.ts');
(async()=>{
 const seed=902,version=1; const session=load('mapSession.ts');const t0=performance.now();session.terrainOverview({seed,terrainVersion:version});console.log('overview cold ms',performance.now()-t0);const t1=performance.now();session.terrainOverview({seed,terrainVersion:version});console.log('overview warm ms',performance.now()-t1); const saved=session.sessionTerrain({seed,terrainVersion:version});if(saved!==session.sessionTerrain({seed,terrainVersion:version}))throw Error('session cache lost');
 const forest=await loadImage(path.resolve(sourceRoot,'../../public/art/world-trees-0299.webp'));
 const mountain=await loadImage(path.resolve(sourceRoot,'../../public/art/world-mountains-0299.webp'));
 const ground=await loadImage(path.resolve(sourceRoot,'../../public/art/world-terrain-023.webp'));
 const details=await loadImage(path.resolve(sourceRoot,'../../public/art/world-details-0299.webp'));
 const cache=new TerrainCache();cache.setGroundTexture(ground);cache.setBankTexture(details);
 const anchor=mountainAnchors(seed,version)[8];
 for(const [label,center,z,W,H] of [['close',anchor,1,1200,800],['far',anchor,.3,1200,800],['edge',{x:-47,y:128},.8,800,600],['mobile',{x:93,y:70},.9,390,650]]){
  const canvas=createCanvas(W,H),ctx=canvas.getContext('2d'),q=flatProject(center),camera={...q,z};ctx.fillStyle='#29392d';ctx.fillRect(0,0,W,H);
  const {terrainChunks,CHUNK_WIDTH,CHUNK_HEIGHT}=load('terrainCache.ts');
  for(const p of terrainChunks(q.x,q.y,z,W,H)){
   const at=flatProject(p),chunk=cache.get(p.x,p.y,seed,z,false,1,version);
   ctx.drawImage(chunk.image,(at.x-q.x-352)*z+W/2,(at.y-q.y-64)*z+H/2,CHUNK_WIDTH*z,CHUNK_HEIGHT*z);
  }
  const backup=createCanvas(W,H);backup.getContext('2d').drawImage(canvas,0,0); const times=[]; for(let run=0;run<6;run++){ctx.clearRect(0,0,W,H);ctx.drawImage(backup,0,0);const t=performance.now();drawWorldScenery(ctx,{seed,version,nodes:[],camera,width:W,height:H,forest,mountain,details});times.push(performance.now()-t);} console.log(label,JSON.stringify(times));
  fs.writeFileSync(path.resolve(process.cwd(),'docs/validation/v0.30.0/map-')+label+'.png',canvas.toBuffer('image/png'));
 }
 console.log('scenery cache',JSON.stringify(load('worldScenery.ts').sceneryCacheStats()));
})();
