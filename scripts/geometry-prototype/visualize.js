import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
const API_KEY=import.meta.env.VITE_NDAMAPVN_API_KEY?.trim();
if(!API_KEY)throw new Error('Set VITE_NDAMAPVN_API_KEY through the local environment; no embedded credential fallback is used.');
const styleUrl=`https://maptiles.ndamaps.vn/styles/day-v2/style.json?apikey=${encodeURIComponent(API_KEY)}`;
const cfg={
 'Hue-DaNang':{center:[108.05,16]},'QuangNgai-KhanhHoa':{center:[109.15,13.5]},
 'NamBo':{center:[106.45,9.65]},'TayNguyen':{center:[107.8,13.8]},
 'TayBac':{center:[103.5,21.5]},'DongBac':{center:[106.2,21.5]},
};
const qs=new URLSearchParams(location.search),region=qs.get('region')||'Hue-DaNang',zoom=+(qs.get('zoom')||8),mode=qs.get('mode')||'combined',candidateZoom=+(qs.get('candidateZoom')||zoom);
const map=new maplibregl.Map({container:'map',style:styleUrl,center:cfg[region]?.center||cfg['Hue-DaNang'].center,zoom,attributionControl:false,canvasContextAttributes:{preserveDrawingBuffer:true}});window.__protoMap=map;
const badge=document.getElementById('badge');badge.textContent=`Prototype-only · ${region} · z${zoom} · ${mode} · MapLibre source overlay`;
function fc(features){return {type:'FeatureCollection',features:features.map(f=>({type:'Feature',id:f.id,properties:f.properties||{},geometry:f.geometry}))};}
map.once('load',async()=>{
 await new Promise(r=>setTimeout(r,1800));
 const sourceFeatures=(layer,filter)=>{try{return map.querySourceFeatures('basemap',{sourceLayer:layer,filter}).map(f=>f.toJSON?f.toJSON():{type:'Feature',properties:f.properties,geometry:f.geometry});}catch{return[]}};
 const water=sourceFeatures('water',['==',['get','class'],'ocean']);
 const borders=sourceFeatures('boundary',['==',['get','admin_level'],2]);
 const islands=sourceFeatures('landcover',['==',['get','class'],'island']);
 let adm1=[];try{const res=await fetch('/src/data/gis/geoBoundaries-VNM-ADM1_simplified.json');const gj=await res.json();adm1=gj.features;}catch{}
 let candidate=[];if(mode==='candidate-solid'){try{const res=await fetch(`/scripts/geometry-prototype/generated-candidates/vietnam-mainland-candidate-z${candidateZoom}.geojson`);candidate=(await res.json()).features||[];}catch{}}
 map.addSource('audit-ocean',{type:'geojson',data:fc(water)});map.addSource('audit-boundary',{type:'geojson',data:fc(borders)});map.addSource('audit-island',{type:'geojson',data:fc(islands)});map.addSource('audit-adm1',{type:'geojson',data:{type:'FeatureCollection',features:adm1}});
 if(candidate.length){map.addSource('audit-candidate',{type:'geojson',data:{type:'FeatureCollection',features:candidate}});const before=map.getLayer('water-offset')?'water-offset':undefined;map.addLayer({id:'audit-candidate-solid',type:'fill',source:'audit-candidate',paint:{'fill-color':'#ff0000','fill-opacity':1}},before);}
 if(['combined','adm1'].includes(mode))map.addLayer({id:'audit-adm1-line',type:'line',source:'audit-adm1',paint:{'line-color':'#ff00a8','line-width':2}});
 if(['combined','ocean'].includes(mode))map.addLayer({id:'audit-ocean-line',type:'line',source:'audit-ocean',paint:{'line-color':'#00ffff','line-width':2,'line-opacity':0.95}});
 if(['combined','boundary'].includes(mode))map.addLayer({id:'audit-boundary-line',type:'line',source:'audit-boundary',paint:{'line-color':'#ffe000','line-width':2,'line-opacity':0.95}});
 if(['combined','islands'].includes(mode))map.addLayer({id:'audit-island-fill',type:'fill',source:'audit-island',paint:{'fill-color':'#47ff00','fill-opacity':0.55}});
 const sources={water,borders,islands,adm1};
 window.__setAuditLabel=(r,z)=>{window.__geometryAudit.region=r;window.__geometryAudit.zoom=z;badge.textContent=`Prototype-only · ${r} · z${z} · ${window.__geometryAudit.mode} · MapLibre source overlay`;};
 window.__refreshGeometryAudit=()=>{sources.water=sourceFeatures('water',['==',['get','class'],'ocean']);sources.borders=sourceFeatures('boundary',['==',['get','admin_level'],2]);sources.islands=sourceFeatures('landcover',['==',['get','class'],'island']);map.getSource('audit-ocean').setData(fc(sources.water));map.getSource('audit-boundary').setData(fc(sources.borders));map.getSource('audit-island').setData(fc(sources.islands));window.__geometryAudit.loaded={ocean:sources.water.length,boundaryAdmin2:sources.borders.length,island:sources.islands.length,adm1:sources.adm1.length};window.__geometryAudit.center=map.getCenter().toArray();window.__geometryAudit.zoom=map.getZoom();badge.textContent=`Prototype-only · ${window.__geometryAudit.region} · z${Math.round(map.getZoom())} · ${window.__geometryAudit.mode} · MapLibre source overlay`;return window.__geometryAudit;};
 window.__setAuditMode=(m)=>{for(const [id,on] of [['audit-adm1-line',['combined','adm1'].includes(m)],['audit-ocean-line',['combined','ocean'].includes(m)],['audit-boundary-line',['combined','boundary'].includes(m)],['audit-island-fill',['combined','islands'].includes(m)],['audit-candidate-solid',m==='candidate-solid']])if(map.getLayer(id))map.setLayoutProperty(id,'visibility',on?'visible':'none');window.__geometryAudit.mode=m;badge.textContent=`Prototype-only · ${window.__geometryAudit.region} · z${Math.round(map.getZoom())} · ${m} · MapLibre source overlay`;};
 window.__geometryAudit={region,zoom,mode,center:map.getCenter().toArray(),loaded:{ocean:water.length,boundaryAdmin2:borders.length,island:islands.length,adm1:adm1.length},layers:map.getStyle().layers.filter(l=>['water-offset','water','boundary-land-level-2','landcover-island'].includes(l.id)).map(l=>({id:l.id,type:l.type,sourceLayer:l['source-layer'],filter:l.filter}))};
 document.documentElement.dataset.ready='true';
});
