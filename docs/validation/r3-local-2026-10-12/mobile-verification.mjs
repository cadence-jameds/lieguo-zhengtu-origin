import path from 'node:path';
export default async function(page,context,outDir){
 await page.setViewportSize({width:390,height:844});
 await page.locator('.game-shell.mobile-layout').waitFor();
 await page.screenshot({path:path.join(outDir,'20-mobile-map.png'),fullPage:true});
 const cdp=await context.newCDPSession(page);
 await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
 const b=await page.locator('.map-overlay').boundingBox();
 const touch=(id,x,y)=>({id,x,y,radiusX:2,radiusY:2,force:1});
 const before=await page.locator('.map-overlay').evaluate(e=>JSON.parse(e.dataset.camera));
 const x=b.x+b.width*.5,y=b.y+b.height*.5;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch(1,x,y)]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[touch(1,x-60,y+40)]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await page.evaluate(()=>new Promise(requestAnimationFrame));
 const afterDrag=await page.locator('.map-overlay').evaluate(e=>JSON.parse(e.dataset.camera));
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch(1,x-40,y),touch(2,x+40,y)]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[touch(1,x-80,y),touch(2,x+80,y)]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await page.evaluate(()=>new Promise(requestAnimationFrame));
 const afterPinch=await page.locator('.map-overlay').evaluate(e=>JSON.parse(e.dataset.camera));
 await page.screenshot({path:path.join(outDir,'21-mobile-touch-pinch.png'),fullPage:true});
 const overflow=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth,touchPoints:navigator.maxTouchPoints}));
 await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:false});await cdp.detach();
 await page.setViewportSize({width:1440,height:1000});
 return {type:'Chrome desktop with mobile viewport and trusted CDP touch emulation; not physical phone',before,afterDrag,afterPinch,dragChanged:before.x!==afterDrag.x||before.y!==afterDrag.y,pinchChanged:afterPinch.z>afterDrag.z,overflow};
}
