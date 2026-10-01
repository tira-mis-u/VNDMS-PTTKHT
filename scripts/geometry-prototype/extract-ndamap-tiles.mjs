#!/usr/bin/env node
/**
 * Independent NDAMapVN vector-tile audit. Reads source style/vector tiles directly;
 * does not import or alter production map/heatmap code. Requires @mapbox/vector-tile
 * (already transitively present) and the public project tile style API key.
 */
import fs from 'node:fs/promises';
import { VectorTile } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';
import { gunzipSync } from 'node:zlib';

const API_KEY = process.env.VITE_NDAMAPVN_API_KEY;
if (!API_KEY) throw new Error('Set VITE_NDAMAPVN_API_KEY in the environment; no embedded credential fallback is used.');
const ROOT = new URL('../../', import.meta.url);
const OUT = new URL('../../../heatmap-debug/ndamap-tile-extract.json', import.meta.url);
const regions = [
  ['Hue-DaNang',108.05,16], ['QuangNgai-KhanhHoa',109.15,13.5],
  ['NamBo',106.45,9.65], ['TayNguyen',107.8,13.8],
  ['TayBac',103.5,21.5], ['DongBac',106.2,21.5],
];
const zooms = [7,8,11];
const width=1042, height=685, tileSize=512;
const rad=d=>d*Math.PI/180;
const mercY=lat=>Math.log(Math.tan(Math.PI/4+rad(lat)/2));
function lonTile(lon,z){return (lon+180)/360*2**z}
function latTile(lat,z){return (1-mercY(lat)/Math.PI)/2*2**z}
const wanted = new Map();
for (const [region,lon,lat] of regions) for (const z of zooms) {
  const cx=lonTile(lon,z), cy=latTile(lat,z);
  const dx=width/(tileSize*2), dy=height/(tileSize*2);
  const x0=Math.floor(cx-dx)-1, x1=Math.floor(cx+dx)+1;
  const y0=Math.floor(cy-dy)-1, y1=Math.floor(cy+dy)+1;
  for(let x=x0;x<=x1;x++) for(let y=y0;y<=y1;y++) {
    if(y<0||y>=2**z) continue;
    const xx=((x%(2**z))+(2**z))%(2**z); const k=`${z}/${xx}/${y}`;
    if(!wanted.has(k)) wanted.set(k,{z,x:xx,y,views:[]});
    wanted.get(k).views.push({region,zoom:z});
  }
}
const nationalWindow=process.argv.includes('--national-outline-window');
if(nationalWindow){
 const locator=JSON.parse(await fs.readFile(new URL('../../../heatmap-debug/adm1-dissolved-reference.geojson',import.meta.url),'utf8'));
 const geom=locator.geometry; const polygons=geom.type==='Polygon'?[geom.coordinates]:geom.coordinates;
 const z=11,n=2**z;
 for(const polygon of polygons) for(const ring of polygon) for(let i=1;i<ring.length;i++){
  const a=ring[i-1],b=ring[i],ax=lonTile(a[0],z),ay=latTile(a[1],z),bx=lonTile(b[0],z),by=latTile(b[1],z);
  const steps=Math.max(1,Math.ceil(Math.max(Math.abs(bx-ax),Math.abs(by-ay))*2));
  for(let s=0;s<=steps;s++){
   const x0=ax+(bx-ax)*s/steps,y0=ay+(by-ay)*s/steps;
   for(let dx=-2;dx<=2;dx++)for(let dy=-2;dy<=2;dy++){
    const y=Math.floor(y0)+dy;if(y<0||y>=n)continue;const x=((Math.floor(x0)+dx)%n+n)%n;const k=`${z}/${x}/${y}`;
    if(!wanted.has(k))wanted.set(k,{z,x,y,views:[]});wanted.get(k).views.push({region:'national-boundary-tile-window (ADM1 used only to locate tiles)',zoom:z});
   }
  }
 }
}
const entries=[...wanted.values()]; let finished=0;
const styleResponse=await fetch(`https://maptiles.ndamaps.vn/styles/day-v2/style.json?apikey=${encodeURIComponent(API_KEY)}`);
const style=await styleResponse.json();
const baseSource=style.sources?.basemap;
const tileJsonResponse=await fetch(baseSource.url);
const tileJson=await tileJsonResponse.json();
const output={metadata:{source:'NDAMapVN Day v2 -> basemap -> OpenMapTiles/Planetiler vector tiles',styleSource:baseSource.url.replace(/([?&])apikey=[^&]+/,'$1apikey=REDACTED'),sourceLayerFields:tileJson.vector_layers.filter(x=>['water','boundary','landcover'].includes(x.id)),styleBuild:tileJson['planetiler:buildtime'],sourceMaxZoom:tileJson.maxzoom,tileExtent:4096,zoomSet:zooms,viewport:[width,height],tileSize,generatedAt:new Date().toISOString(),tileCountRequested:entries.length,nationalOutlineWindow:nationalWindow?'z11 tile fetching within +/-2 tile cells of dissolved ADM1 rings; reference used only to locate candidate coverage, never as coastline geometry':null,layers:style.layers.filter(x=>['water','boundary','landcover'].includes(x['source-layer'])).map(({id,type,...rest})=>({id,type,...rest}))},tiles:[]};
async function one(tile){
 const url=`https://maptiles.ndamaps.vn/data/base/${tile.z}/${tile.x}/${tile.y}.pbf?apikey=${encodeURIComponent(API_KEY)}`;
 let response;
 for(let attempt=0;attempt<4;attempt++){
  response=await fetch(url,{headers:{'user-agent':'VNDMS-geometry-audit/1.0'}});
  if(response.ok||response.status!==429) break;
  await new Promise(r=>setTimeout(r,1000*(attempt+1)));
 }
 if(!response.ok) return {z:tile.z,x:tile.x,y:tile.y,status:response.status,views:tile.views,features:[]};
 let bytes=Buffer.from(await response.arrayBuffer());
 if(bytes[0]===0x1f&&bytes[1]===0x8b) bytes=gunzipSync(bytes);
 const vt=new VectorTile(new PbfReader(bytes)); const record={z:tile.z,x:tile.x,y:tile.y,status:response.status,views:tile.views,extent:null,features:[]};
 for(const layerName of ['water','boundary','landcover']){
  const layer=vt.layers[layerName]; if(!layer) continue; record.extent=layer.extent;
  for(let i=0;i<layer.length;i++){
   const f=layer.feature(i); const props=f.properties||{};
   const relevant=(layerName==='water'&&props.class==='ocean') || (layerName==='boundary'&&Number(props.admin_level)===2) || (layerName==='landcover'&&props.class==='island');
   if(!relevant) continue;
   const g=f.toGeoJSON(tile.x,tile.y,tile.z); const polys=g.geometry.type==='Polygon'?[g.geometry.coordinates]:g.geometry.type==='MultiPolygon'?g.geometry.coordinates:[];
   let rings=0, touches={left:0,right:0,top:0,bottom:0}, rawBox=f.bbox();
   for(const ring of f.loadGeometry()){rings++; for(const p of ring){if(p.x===0)touches.left++;if(p.x===layer.extent)touches.right++;if(p.y===0)touches.top++;if(p.y===layer.extent)touches.bottom++;}}
   // geometry type in tile output, properties, MVT-local bounds, ring totals,
   // global lon/lat geometry, plus edge-hit counts from unprojected MVT coords.
   record.features.push({sourceLayer:layerName,featureId:f.id??null,geometryType:g.geometry.type,properties:props,extent:layer.extent,ringCount:rings,mvtBBox:rawBox,tileEdgeVertexCounts:touches,geometry:g.geometry});
  }
 }
 return record;
}
const concurrency=3;
for(let i=0;i<entries.length;i+=concurrency){
 const batch=await Promise.all(entries.slice(i,i+concurrency).map(one)); output.tiles.push(...batch); finished+=batch.length;
 if(finished%30===0||finished===entries.length) console.log(`tiles ${finished}/${entries.length}`);
 await fs.mkdir(new URL('../../../heatmap-debug/',import.meta.url),{recursive:true});
 await fs.writeFile(OUT,JSON.stringify(output));
 await new Promise(r=>setTimeout(r,150));
}
console.log(JSON.stringify({requested:entries.length,returned:output.tiles.length,ok:output.tiles.filter(t=>t.status===200).length,failed:output.tiles.filter(t=>t.status!==200).map(({z,x,y,status})=>({z,x,y,status})),output:OUT.pathname},null,2));
