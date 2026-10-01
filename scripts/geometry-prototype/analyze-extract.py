#!/usr/bin/env python3
"""Offline topology/source audit for extract-ndamap-tiles.mjs output.
Requires Shapely 2.x; deliberately does not modify production geometry.
"""
import json, collections, time, tracemalloc
from pathlib import Path
from shapely.geometry import shape, Point, Polygon, MultiPolygon, LineString, MultiLineString
from shapely.ops import unary_union, polygonize
ROOT=Path(__file__).resolve().parents[2]
EXTRACT=Path('/home/user/heatmap-debug/ndamap-tile-extract.json')
ADM1=ROOT/'src/data/gis/geoBoundaries-VNM-ADM1_simplified.json'
started=time.perf_counter(); tracemalloc.start()
data=json.loads(EXTRACT.read_text())
result={'extractMetadata':data['metadata'],'zooms':{},'sourceLayerTotals':{},'adm1Reference':{}}
selectedCandidates={}
allf=[(t,f) for t in data['tiles'] for f in t['features']]
for sl in ['water','boundary','landcover']:
 fs=[(t,f) for t,f in allf if f['sourceLayer']==sl]
 result['sourceLayerTotals'][sl]={'featureRecords':len(fs),'geometryTypes':dict(collections.Counter(f['geometryType'] for _,f in fs)),'distinctTileCount':len({(t['z'],t['x'],t['y']) for t,f in fs}),'propertyCombinations':[{'properties':dict(k),'count':v} for k,v in collections.Counter(tuple(sorted(f['properties'].items())) for _,f in fs).most_common()]}
for z in [7,8,11]:
 tiles=[t for t in data['tiles'] if t['z']==z]
 fs=[(t,f) for t in tiles for f in t['features']]
 ocean=[(t,f) for t,f in fs if f['sourceLayer']=='water' and f['properties'].get('class')=='ocean']
 borders=[(t,f) for t,f in fs if f['sourceLayer']=='boundary']
 islands=[(t,f) for t,f in fs if f['sourceLayer']=='landcover']
 polys=[]; invalid=[]; unclosed=0; ringcount=0; rawedge={k:0 for k in ['left','right','top','bottom']}
 for t,f in ocean:
  g=shape(f['geometry']); polys.append(g)
  if not g.is_valid: invalid.append({'tile':[z,t['x'],t['y'],'id',f['featureId']],'reason':g.is_valid})
  coords=f['geometry']['coordinates']; polysNested=[coords] if f['geometryType']=='Polygon' else coords
  for poly in polysNested:
   for ring in poly:
    ringcount+=1
    if len(ring)<4 or ring[0]!=ring[-1]: unclosed+=1
  for edge in rawedge: rawedge[edge]+=f['tileEdgeVertexCounts'][edge]
 merged=unary_union(polys) if polys else None
 bprops=collections.Counter(tuple(sorted(f['properties'].items())) for _,f in borders)
 land_lines=[shape(f['geometry']) for _,f in borders if f['properties'].get('admin_level')==2 and f['properties'].get('maritime')!=1 and f['properties'].get('disputed')!=1]
 polygonized=list(polygonize(unary_union(([merged.boundary] if merged else [])+land_lines)))
 anchor=Point(108.05,16); matches=[p for p in polygonized if p.covers(anchor)]
 if len(matches)==1: selectedCandidates[z]=matches[0]

 bkeys=sorted({k for _,f in borders for k in f['properties']})
 islandprops=collections.Counter(tuple(sorted(f['properties'].items())) for _,f in islands)
 result['zooms'][str(z)]={'tilesRequested':len(tiles),'tilesHTTP200':sum(t['status']==200 for t in tiles),'tilesNon200':[{k:t[k] for k in ('z','x','y','status')} for t in tiles if t['status']!=200],
  'polygonize':{'polygonCount':len(polygonized),'vietnamAnchor':[108.05,16],'anchorMatchCount':len(matches),'candidateType':matches[0].geom_type if len(matches)==1 else None,'candidateValid':matches[0].is_valid if len(matches)==1 else None,'candidateRingClosed':matches[0].exterior.is_closed if len(matches)==1 else None,'candidateHoles':len(matches[0].interiors) if len(matches)==1 else None,'candidateAreaDegreesSquared':matches[0].area if len(matches)==1 else None,'candidateBounds':list(matches[0].bounds) if len(matches)==1 else None,'largestPolygon':{'areaDegreesSquared':max((p.area for p in polygonized),default=0),'bounds':list(max(polygonized,key=lambda p:p.area).bounds) if polygonized else None}},
  'ocean':{'featureFragments':len(ocean),'geometryTypes':dict(collections.Counter(f['geometryType'] for _,f in ocean)),'featuresWithIds':sum(f['featureId'] is not None for _,f in ocean),'distinctIds':len({f['featureId'] for _,f in ocean if f['featureId'] is not None}),'ringCount':ringcount,'unclosedRings':unclosed,'invalidInputPolygons':len(invalid),'inputInvalidExamples':invalid[:5],'tileEdgeVertexCounts':rawedge,'dissolvedGeometryType':merged.geom_type if merged else None,'dissolvedComponentCount':len(merged.geoms) if merged and hasattr(merged,'geoms') else (1 if merged else 0),'dissolvedValid':bool(merged.is_valid) if merged else None,'dissolvedHoles':sum(len(p.interiors) for p in ([merged] if merged.geom_type=='Polygon' else merged.geoms) if isinstance(p,Polygon)) if merged else None,'bounds':list(merged.bounds) if merged else None},
  'boundaryLevel2':{'features':len(borders),'geometryTypes':dict(collections.Counter(f['geometryType'] for _,f in borders)),'propertyKeys':bkeys,'propertyValueCounts':{k:dict(collections.Counter(str(f['properties'].get(k)) for _,f in borders)) for k in bkeys},'propertiesObserved':[dict(f['properties']) for _,f in borders[:10]],'hasCountryOrIsoAttributes':any(k.lower() in {'country','iso','iso_a2','iso_a3','adm0_a3'} for k in bkeys)},
  'island':{'featureRecords':len(islands),'geometryTypes':dict(collections.Counter(f['geometryType'] for _,f in islands)),'propertyKeys':sorted({k for _,f in islands for k in f['properties']}),'propertyValueCounts':{k:dict(collections.Counter(str(f['properties'].get(k)) for _,f in islands)) for k in sorted({k for _,f in islands for k in f['properties']})}},
 }
if 7 in selectedCandidates and 8 in selectedCandidates:
 a,b=selectedCandidates[7],selectedCandidates[8]
 result['zoomCandidateDelta']={'comparedZooms':[7,8],'symmetricDifferenceAreaDegreesSquared':a.symmetric_difference(b).area,'hausdorffDistanceDegrees':a.hausdorff_distance(b),'note':'source-derived mainland candidates only; these are not screen-space edge-error metrics and do not establish coastline acceptance'}
else: result['zoomCandidateDelta']='NOT MEASURABLE: a closed anchor-selected candidate is missing at one or more zooms'
# ADM1 input source is evaluated only as an independent land-outline/reference candidate.
adm=json.loads(ADM1.read_text()); geoms=[shape(f['geometry']) for f in adm['features'] if f.get('geometry')]
merged=unary_union(geoms)
result['adm1Reference']={'path':str(ADM1),'crs':adm.get('crs'),'features':len(adm['features']),'geometryTypes':dict(collections.Counter(g.geom_type for g in geoms)),'invalidFeatureCount':sum(not g.is_valid for g in geoms),'closedRings':sum(1 for g in geoms for p in ([g] if isinstance(g,Polygon) else g.geoms if isinstance(g,MultiPolygon) else []) for r in [p.exterior,*p.interiors] if r.is_closed),'ringCount':sum(1+len(p.interiors) for g in geoms for p in ([g] if isinstance(g,Polygon) else g.geoms if isinstance(g,MultiPolygon) else [])),'dissolvedType':merged.geom_type,'dissolvedComponents':len(merged.geoms) if hasattr(merged,'geoms') else 1,'dissolvedValid':merged.is_valid,'bounds':list(merged.bounds),'vertices':sum(len(r.coords) for g in geoms for p in ([g] if isinstance(g,Polygon) else g.geoms if isinstance(g,MultiPolygon) else []) for r in [p.exterior,*p.interiors]),'edgeComparisonStatus':'NOT MEASURABLE: no complete, country-attributed NDAMapVN territory polygon or trusted raster ground-truth mask was reconstructed'}
current,peak=tracemalloc.get_traced_memory(); result['processing']={'wallSeconds':round(time.perf_counter()-started,3),'pythonPeakMemoryBytes':peak,'pythonCurrentBytes':current,'geometryMetricCRS':'WGS84 lon/lat from MVT conversion; topology tests are planar in lon/lat, no distance metrics reported'}
out=Path('/home/user/heatmap-debug/geometry-prototype-audit.json');out.write_text(json.dumps(result,indent=2)); print(out); print(json.dumps({'processing':result['processing'],'adm1':result['adm1Reference'],'zooms':{z:{'tiles':x['tilesRequested'],'ok':x['tilesHTTP200'],'ocean':x['ocean'],'boundary':x['boundaryLevel2'],'island':x['island']} for z,x in result['zooms'].items()}},indent=2))
