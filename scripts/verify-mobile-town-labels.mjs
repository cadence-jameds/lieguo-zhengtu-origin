import fs from 'node:fs';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const modulePath=process.env.PLAYWRIGHT_MODULE??'/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const {chromium}=await import(pathToFileURL(modulePath));
const output='docs/validation/mobile-town-labels';fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox']});
const results=[],errors=[];
async function open(phase,width,query=''){
 const ctx=await browser.newContext({viewport:{width,height:width===320?568:width===1440?900:844},serviceWorkers:'block',reducedMotion:'reduce'}),page=await ctx.newPage();page.setDefaultTimeout(8000);
 page.on('pageerror',e=>errors.push(String(e)));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
 await page.goto(`http://127.0.0.1:${phase==='before'?4181:4175}/docs/validation/city-ui-integration/preview.html?${query}`);await page.locator('.resource-parcel').first().waitFor();return {ctx,page};
}
async function measure(page){
 await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode().catch(()=>{}))));
 return page.evaluate(async()=>{
  const scene=document.querySelector('.town-composition,.outskirts-composition'),sceneRect=scene.getBoundingClientRect(),rect=e=>{const r=e.getBoundingClientRect();return {x:r.x-sceneRect.x,y:r.y-sceneRect.y,w:r.width,h:r.height};};
  const rows=[],masks=[];
  for(const e of scene.querySelectorAll('.town-lot,.resource-parcel')){
   const sprite=e.querySelector('img.building-sprite,svg.building-sprite,img');const row={id:e.dataset.testid,classes:e.className,button:rect(e),art:e.querySelector('.town-building-art')?rect(e.querySelector('.town-building-art')):null};
   if(sprite){
    let source=sprite,sx=0,sy=0,sw,sh;
    if(sprite.tagName.toLowerCase()==='svg'){const v=sprite.viewBox.baseVal;source=new Image();source.src=sprite.querySelector('image').getAttribute('href');await source.decode();sx=v.x;sy=v.y;sw=v.width;sh=v.height;}else {sw=sprite.naturalWidth;sh=sprite.naturalHeight;if(!sw)throw Error('Broken image '+sprite.src);}
    const r=rect(sprite),c=document.createElement('canvas');c.width=Math.ceil(r.w);c.height=Math.ceil(r.h);
    const context=c.getContext('2d'),style=getComputedStyle(sprite),matrix=new DOMMatrix(style.transform==='none'?undefined:style.transform),angle=Math.atan2(matrix.b,matrix.a),rawW=parseFloat(style.width),rawH=parseFloat(style.height),factor=r.w/(Math.abs(Math.cos(angle))*rawW+Math.abs(Math.sin(angle))*rawH);
    const pl=parseFloat(style.paddingLeft)*factor,pr=parseFloat(style.paddingRight)*factor,pt=parseFloat(style.paddingTop)*factor,pb=parseFloat(style.paddingBottom)*factor,scale=Math.min((rawW*factor-pl-pr)/sw,(rawH*factor-pt-pb)/sh),dw=sw*scale,dh=sh*scale;
    context.save();context.translate(r.w/2,r.h/2);context.rotate(angle);context.drawImage(source,sx,sy,sw,sh,-dw/2+(pl-pr)/2,-dh/2+(pt-pb)/2,dw,dh);context.restore();const data=context.getImageData(0,0,c.width,c.height).data;let x0=c.width,y0=c.height,x1=0,y1=0;const mask=new Set();
    for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(data[(y*c.width+x)*4+3]>96){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x+1);y1=Math.max(y1,y+1);mask.add(`${Math.round(r.x)+x},${Math.round(r.y)+y}`);}
    row.visible={x:r.x+x0,y:r.y+y0,w:x1-x0,h:y1-y0};row.src=new URL(source.src).pathname;row.artPixels=mask.size;masks.push({id:row.id,mask});
   }rows.push(row);
  }
  const collisions=[];for(let i=0;i<masks.length;i++)for(let j=i+1;j<masks.length;j++){
   const [a,b]=masks[i].mask.size<masks[j].mask.size?[masks[i],masks[j]]:[masks[j],masks[i]];let pixels=0;for(const key of a.mask)if(b.mask.has(key))pixels++;
   if(pixels)collisions.push({a:a.id,b:b.id,pixels,fraction:pixels/a.mask.size});
  }
  const badges=[...scene.querySelectorAll('.town-level-anchor .town-level,.town-gate>.town-level')].map(e=>{
   const anchor=e.closest('.town-level-anchor'),lot=anchor?[...scene.querySelectorAll('.town-lot')].find(l=>l.style.left===anchor.style.left&&l.style.top===anchor.style.top):null,s=getComputedStyle(e);
   return {id:lot?.dataset.testid??'gate',text:e.textContent,level:e.querySelector('b')?.textContent??e.textContent,rect:rect(e),background:s.backgroundColor,color:s.color,numberColor:getComputedStyle(e.querySelector('b')??e).color,radius:s.borderRadius,pointer:s.pointerEvents,nameVisible:e.querySelector('.town-name')?getComputedStyle(e.querySelector('.town-name')).display!=='none':false,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth};
  });
  return {width:sceneRect.width,height:sceneRect.height,rows,collisions,badges,overflow:document.documentElement.scrollWidth>innerWidth+1,lowerNames:[...scene.querySelectorAll('.town-lot.built .town-label')].filter(e=>getComputedStyle(e).display!=='none').length,outerLabels:[...scene.querySelectorAll('.parcel-label')].map(e=>({text:e.textContent,rect:rect(e),background:getComputedStyle(e).backgroundColor,color:getComputedStyle(e).color}))};
 });
}
function sameGeometry(a,b,art=true){assert.equal(a.width,b.width);assert.equal(a.height,b.height);assert.equal(a.rows.length,b.rows.length);for(let i=0;i<a.rows.length;i++){assert.deepEqual(a.rows[i].button,b.rows[i].button,'plot geometry changed');if(art){assert.deepEqual(a.rows[i].visible,b.rows[i].visible,'visible silhouette changed');assert.equal(a.rows[i].src,b.rows[i].src);}}}
function labels(g,names){
 assert(!g.overflow);assert.equal(g.lowerNames,0);
 for(const badge of g.badges){assert.equal(badge.background,'rgba(255, 244, 223, 0.91)');assert.equal(badge.color,'rgb(74, 65, 41)');assert.equal(badge.numberColor,badge.color);assert.equal(badge.pointer,'none');assert.equal(badge.nameVisible,names);assert(badge.scrollWidth<=badge.clientWidth+1,'label overflow');
  if(!names){assert(Math.abs(badge.rect.w-badge.rect.h)<.1,'noncircular badge');assert.equal(badge.radius,'50%');}
  if(badge.id!=='gate'){const visible=g.rows.find(r=>r.id===badge.id).visible;assert(Math.abs(badge.rect.x+badge.rect.w/2-visible.x-visible.w/2)<Math.max(8,visible.w*.15),'silhouette center x '+badge.id);assert(Math.abs(badge.rect.y+badge.rect.h/2-visible.y-visible.h/2)<Math.max(8,visible.h*.17),'silhouette center y '+badge.id);}
 }
}

function capsuleCollisions(g){ const overlaps=[];for(let i=0;i<g.badges.length;i++)for(let j=i+1;j<g.badges.length;j++){const a=g.badges[i],b=g.badges[j],w=Math.min(a.rect.x+a.rect.w,b.rect.x+b.rect.w)-Math.max(a.rect.x,b.rect.x),h=Math.min(a.rect.y+a.rect.h,b.rect.y+b.rect.h)-Math.max(a.rect.y,b.rect.y);if(w>0&&h>0)overlaps.push({a:a.id,b:b.id,area:w*h});}assert.deepEqual(overlaps,[],'capsule collision');return overlaps;}
async function capture(page,name){await page.screenshot({path:`${output}/${name}.jpg`,type:'jpeg',quality:88});}
async function test(name,fn){try{const data=await fn();results.push({name,status:'PASS',...data});console.log('PASS',name);}catch(e){results.push({name,status:'FAIL',error:String(e)});console.log('FAIL',name,String(e));}}
for(const width of [320,390,1440])await test(`geometry-${width}`,async()=>{
 const before=await open('before',width,'vacant=1'),after=await open('after',width,'vacant=1'),pairs={};
 try{
 for(const district of ['outskirts','town']){
  if(district==='town')for(const {page} of [before,after])await page.getByRole('tab',{name:'城內',exact:true}).click();
  for(const mode of width===1440?['desktop']:['close','panorama']){
   if(mode==='panorama')for(const {page} of [before,after])await page.locator('.scene-view-shortcut').click();
   const a=await measure(before.page),b=await measure(after.page);sameGeometry(a,b,district==='outskirts'||mode!=='close');if(district==='outskirts')assert.deepEqual(a.outerLabels,b.outerLabels);
   if(district==='town'){
    labels(b,width===1440);if(width===1440)capsuleCollisions(b);assert(['1','9','10','15'].every(level=>b.badges.some(x=>x.level===level)));
    if(mode==='close')for(const r of b.rows.filter(r=>r.art)){const old=a.rows.find(x=>x.id===r.id);const large=/town-center|building-castle/.test(r.classes);assert(large?r.visible.w===old.visible.w:r.visible.w>old.visible.w*1.1,'close silhouette scaling');}
   }
   pairs[`${district}-${mode}`]={before:a,after:b};
   if(district==='town'&&mode==='panorama'){
    await after.page.locator('.label-toggle').click();const named=await measure(after.page);labels(named,true);capsuleCollisions(named);pairs[`${district}-${mode}`].names=named;
    await after.page.locator('.label-toggle').click();
   }
   if(district==='town'&&(mode==='close'||width===1440)){await capture(before.page,`before-${width}-town`);await capture(after.page,`after-${width}-town`);}
   if(width===390){if(district==='outskirts'&&mode==='close')await capture(after.page,'after-390-outskirts');if(district==='town'&&mode==='panorama')await capture(after.page,'after-390-panorama');}
  }
  if(width!==1440)for(const {page} of [before,after])await page.locator('.scene-view-shortcut').click();
 }
 // Same visual center in both label modes, with no duplicate lower names.
 const first=await measure(after.page);await after.page.locator('.label-toggle').click();const toggled=await measure(after.page);labels(toggled,width!==1440);
 for(let i=0;i<first.badges.length;i++){const a=first.badges[i].rect,b=toggled.badges[i].rect;assert(Math.abs(a.x+a.w/2-b.x-b.w/2)<.1);assert(Math.abs(a.y+a.h/2-b.y-b.h/2)<.1);}
 if(width===390)await capture(after.page,'after-390-names-gate');
 // Click through a badge, then scroll to an empty plot and operate its unchanged button.
 const center=after.page.locator('.town-lot.town-center');await center.scrollIntoViewIfNeeded();await center.click();assert(await after.page.locator('dialog').isVisible());await after.page.getByRole('button',{name:'關閉對話框',exact:true}).click();
 await after.page.locator('.town-gate').click();assert(await after.page.locator('dialog').isVisible());await after.page.getByRole('button',{name:'關閉對話框',exact:true}).click();
 const vacant=after.page.locator('.town-lot.vacant').first();await vacant.click();assert(await after.page.locator('dialog').isVisible());
 return {pairs,toggledLabels:toggled.badges,clicks:['building','gate','vacant']};
 }finally{await before.ctx.close();await after.ctx.close();}
});
for(const civ of ['civ_zhongguo','civ_byzantium','civ_frankia','civ_britannia','civ_japan','civ_mongolia'])for(const age of [0,1,2,3])for(const variant of ['complete','building-audit'])await test(`art-${civ}-${age}-${variant}`,async()=>{
 const {ctx,page}=await open('after',390,`civ=${civ}&age=${age}&vacant=1&state=${variant}`),baseline=await open('before',390,`civ=${civ}&age=${age}&vacant=1&state=${variant}`);
 try{
 for(const p of [page,baseline.page])await p.getByRole('tab',{name:'城內',exact:true}).click();const before=await measure(baseline.page),after=await measure(page);labels(after,false);sameGeometry(before,after,false);assert(!after.badges.some(x=>after.rows.find(r=>r.id===x.id)?.classes.includes('building-mint')));
 // Compare opaque silhouette intersections, never transparent image rectangles.
 for(const c of after.collisions){const old=before.collisions.find(x=>x.a===c.a&&x.b===c.b)?.fraction??0;assert(c.fraction<=Math.max(.12,old+.02),`severe silhouette collision ${JSON.stringify(c)}`);}
 await page.locator('.label-toggle').click();const names=await measure(page);labels(names,true);
 const overlaps=capsuleCollisions(names);
 return {before,after,names,overlaps};
 }finally{await ctx.close();await baseline.ctx.close();}
});
for(const state of ['construction','queued'])await test(state,async()=>{
 const {ctx,page}=await open('after',390,`state=${state}`);try{await page.getByRole('tab',{name:'城內',exact:true}).click();const g=await measure(page);labels(g,false);assert.equal(g.badges.find(b=>b.id==='town-anchor-0').level,'14');assert(g.badges.some(b=>b.level==='10'));assert.equal(await page.locator('.town-lot.constructing').count(),state==='construction'?2:4);return {badges:g.badges};}finally{await ctx.close();}
});
await browser.close();const report={baseline:'7f184d526019d40caf370d2b0fe3ed3ba7e8c66a',status:results.every(r=>r.status==='PASS')&&!errors.length?'PASS':'FAIL',method:'Rendered image/SVG alpha>96 at CSS pixel resolution; object-fit contain, CSS padding and sprite rotation applied; transparent padding excluded; pairwise opaque silhouette intersections; computed styles, geometry and actual dialogs.',physicalPhone:'待驗',results,errors};fs.writeFileSync(`${output}/browser-result.json`,JSON.stringify(report));console.log(JSON.stringify({status:report.status,passed:results.filter(r=>r.status==='PASS').length,failed:results.filter(r=>r.status==='FAIL').map(r=>({name:r.name,error:r.error})),errors}));if(report.status!=='PASS')process.exitCode=1;
