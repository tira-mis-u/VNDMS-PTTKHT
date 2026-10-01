import {chromium} from 'playwright';import fs from 'node:fs/promises';
const root='/home/user/heatmap-debug/geometry-prototype/solid-candidate';await fs.mkdir(root,{recursive:true});
const regions=[['Hue-DaNang',[108.05,16]],['QuangNgai-KhanhHoa',[109.15,13.5]],['NamBo',[106.45,9.65]],['TayNguyen',[107.8,13.8]],['TayBac',[103.5,21.5]],['DongBac',[106.2,21.5]]];
const b=await chromium.launch({headless:true,args:['--no-sandbox']});const p=await b.newPage({viewport:{width:1042,height:685},deviceScaleFactor:1});p.on('pageerror',e=>console.error('PAGEERROR',e.message));const meta=[];
for(const z of [7,8]){
 const [r,c]=regions[0];await p.goto(`http://127.0.0.1:5173/geometry-prototype.html?region=${r}&zoom=${z}&mode=candidate-solid&candidateZoom=${z}`,{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>document.documentElement.dataset.ready==='true',null,{timeout:90000});
 for(const [region,center] of regions){await p.evaluate(({center,region,z})=>{window.__protoMap.jumpTo({center,zoom:z,bearing:0,pitch:0});window.__setAuditLabel(region,z);},{center,region,z});await p.evaluate(()=>new Promise(resolve=>window.__protoMap.once('idle',resolve)));await p.waitForTimeout(450);const s=await p.screenshot({path:`${root}/${region}-z${z}-solid.png`});const a=await p.evaluate(()=>window.__geometryAudit);meta.push({region,z,center:a.center,actualZoom:a.zoom,loaded:a.loaded,bytes:s.length});console.log(region,z,s.length)}
}
await fs.writeFile(`${root}/metadata.json`,JSON.stringify({purpose:'Diagnostic solid-only partial mainland clip; insert at before water-offset in prototype style only; no temperature',cameraSize:[1042,685],results:meta},null,2));await b.close();
