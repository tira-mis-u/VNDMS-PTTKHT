#!/usr/bin/env python3
"""Build experimental z7/z8 mainland polygon candidates from NDAMapVN source tiles.
This is an offline prototype artifact, not imported by production code.
"""
import json,time,tracemalloc
from pathlib import Path
from shapely.geometry import shape,Point,mapping
from shapely.ops import unary_union,polygonize
ROOT=Path(__file__).resolve().parents[2]
extract=Path('/home/user/heatmap-debug/ndamap-tile-extract.json')
outdir=Path(__file__).resolve().parent/'generated-candidates';outdir.mkdir(exist_ok=True)
data=json.loads(extract.read_text());anchor=Point(108.05,16)
tracemalloc.start();t0=time.perf_counter();stats=[]
for z in (7,8,11):
 tiles=[t for t in data['tiles'] if t['z']==z]
 oceans=[shape(f['geometry']) for t in tiles for f in t['features'] if f['sourceLayer']=='water' and f['properties'].get('class')=='ocean']
 borders=[shape(f['geometry']) for t in tiles for f in t['features'] if f['sourceLayer']=='boundary' and f['properties'].get('admin_level')==2 and f['properties'].get('maritime')!=1 and f['properties'].get('disputed')!=1]
 if not oceans: stats.append({'z':z,'candidate':'NONE','reason':'No ocean geometry returned'});continue
 # Exact-coordinate unary_union dissolves duplicate/shared tile-edge segments;
 # no tolerance snapping or buffer. Tile windows are selected independently.
 ocean=unary_union(oceans)
 noded=unary_union([ocean.boundary,*borders])
 pieces=list(polygonize(noded))
 candidates=[p for p in pieces if p.covers(anchor)]
 if len(candidates)!=1:
  stats.append({'z':z,'polygonizedCount':len(pieces),'candidate':'NONE','anchorMatches':len(candidates),'oceanFeatures':len(oceans),'landBorderFeatures':len(borders)});continue
 p=candidates[0]
 props={'candidate':'NDAMapVN-derived partial mainland; ocean class polygon boundaries plus admin_level=2 lines','zoom':z,'anchorUsedOnlyToSelectVietnamFace':[108.05,16],'tileFeatures':len(oceans),'boundaryFeatures':len(borders),'limitations':'not canonical: island assignment/coverage and z11 continuity unresolved; not production input'}
 path=outdir/f'vietnam-mainland-candidate-z{z}.geojson'
 path.write_text(json.dumps({'type':'FeatureCollection','name':f'NDAMapVN-partial-mainland-z{z}','features':[{'type':'Feature','properties':props,'geometry':mapping(p)}]},separators=(',',':')))
 stats.append({'z':z,'file':str(path),'polygonizedCount':len(pieces),'anchorMatches':len(candidates),'geometryType':p.geom_type,'valid':p.is_valid,'closed':p.exterior.is_closed,'holes':len(p.interiors),'areaDegreesSquared':p.area,'boundaryCoordinates':len(p.exterior.coords),'tileOceanFeatures':len(oceans),'adminLevel2Features':len(borders),'missingTiles':sum(t['status']!=200 for t in tiles),'bounds':list(p.bounds),'selectedContainsAllSixViewAnchors':all(p.covers(Point(x,y)) for x,y in [(108.05,16),(109.15,13.5),(106.45,9.65),(107.8,13.8),(103.5,21.5),(106.2,21.5)])})
cur,peak=tracemalloc.get_traced_memory();report={'algorithm':'unary_union(ocean boundaries + land admin_level=2 lines) -> polygonize; select face covering Hue-DaNang camera center; no coordinate perturbation','performance':{'wallSeconds':round(time.perf_counter()-t0,3),'peakPythonBytes':peak,'currentPythonBytes':cur},'results':stats,'status':'prototype-only; not validated for production'}
Path('/home/user/heatmap-debug/partial-candidate-build.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
