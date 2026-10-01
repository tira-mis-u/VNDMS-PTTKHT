import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const base='http://127.0.0.1:5173/geometry-prototype.html';
const regions=[['Hue-DaNang',[108.05,16]],['QuangNgai-KhanhHoa',[109.15,13.5]],['NamBo',[106.45,9.65]],['TayNguyen',[107.8,13.8]],['TayBac',[103.5,21.5]],['DongBac',[106.2,21.5]]];
const out='/home/user/heatmap-debug/geometry-prototype'; await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']}); const page=await browser.newPage({viewport:{width:1042,height:685},deviceScaleFactor:1});
const failed=[];page.on('pageerror',e=>console.error('PAGEERROR',e.message));page.on('console',m=>{if(m.type()==='error')console.error('CONSOLE',m.text())});page.on('response',r=>{if(r.status()>=400)failed.push({status:r.status(),url:r.url().replace(/apikey=[^&]+/,'apikey=REDACTED')})});
const [r0,c0]=regions[0];await page.goto(`${base}?region=${r0}&zoom=7&mode=combined`,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.documentElement.dataset.ready==='true',null,{timeout:90000});
const audit=[];
for(const [region,center] of regions)for(const zoom of [7,8,11]){
 // Move the independent prototype map to each fixed camera.
 await page.evaluate(async({center,zoom})=>{const m=window.__protoMap; m.jumpTo({center,zoom,bearing:0,pitch:0});await new Promise(resolve=>{if(m.loaded()&&m.isSourceLoaded('basemap'))resolve();else m.once('idle',resolve)});},{center,zoom});
 await page.waitForTimeout(900);
 const record=await page.evaluate(({region,zoom})=>{window.__setAuditLabel(region,zoom);return window.__refreshGeometryAudit();},{region,zoom});
 for(const mode of ['base','combined']){
  await page.evaluate(m=>window.__setAuditMode(m),mode);await page.waitForTimeout(180);
  await page.screenshot({path:`${out}/${region}-z${zoom}-${mode}.png`});
 }
 audit.push({region,requestedZoom:zoom,camera:record.center,actualZoom:record.zoom,loaded:record.loaded,requestErrors:failed.slice()});
 console.log(region,zoom,record.loaded);
}
await fs.writeFile(`${out}/capture-metadata.json`,JSON.stringify({viewport:[1042,685],zooms:[7,8,11],results:audit,errors:failed},null,2));
await browser.close();
