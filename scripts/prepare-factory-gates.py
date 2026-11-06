"""Prepare the shipped textured GLBs without re-exporting or recompressing textures.
Triangle clipping interpolates every vertex attribute (including PBR UVs).
Run on an unprepared factory, also after regenerating the building asset pack.
"""
import json, struct, pathlib, math
ROOT=pathlib.Path(__file__).resolve().parents[1]

def prepare(path):
    raw=path.read_bytes(); length=struct.unpack_from('<I',raw,12)[0]
    j=json.loads(raw[20:20+length]); binary=bytearray(raw[28+length:])
    if any(n.get('name')=='FactoryRollupDoor' for n in j['nodes']): return
    def read(i):
        a=j['accessors'][i]; v=j['bufferViews'][a['bufferView']]
        fmt={5126:'f',5125:'I',5123:'H',5121:'B'}[a['componentType']]
        count={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]; size=struct.calcsize(fmt)*count
        at=v.get('byteOffset',0)+a.get('byteOffset',0)
        return [list(struct.unpack_from('<'+fmt*count,binary,at+k*v.get('byteStride',size))) for k in range(a['count'])]
    def accessor(values,typ='VEC3'):
        while len(binary)%4:binary.append(0)
        at=len(binary); flat=[x for row in values for x in row]
        binary.extend(struct.pack('<'+'f'*len(flat),*flat)); vi=len(j['bufferViews'])
        j['bufferViews'].append({'buffer':0,'byteOffset':at,'byteLength':len(binary)-at,'target':34962})
        a={'bufferView':vi,'componentType':5126,'count':len(values),'type':typ}
        if typ=='VEC3':a.update(min=[min(v[k] for v in values) for k in range(3)],max=[max(v[k] for v in values) for k in range(3)])
        j['accessors'].append(a);return len(j['accessors'])-1
    def primitive(rows,keys,material):
        for row in rows:
            if 'NORMAL' in row:
                normal=row['NORMAL']; length=math.sqrt(sum(v*v for v in normal))
                if length>1e-10:row['NORMAL']=[v/length for v in normal]
        return {'attributes':{key:accessor([r[key] for r in rows],{'POSITION':'VEC3','NORMAL':'VEC3','TEXCOORD_0':'VEC2'}[key]) for key in keys},'material':material,'mode':4}
    def interpolate(a,b,t):return {k:[x+(y-x)*t for x,y in zip(a[k],b[k])] for k in a}
    def clip(poly,axis,value,inside):
        out=[]
        for a,b in zip(poly,poly[1:]+poly[:1]):
            da=(a['POSITION'][axis]-value)*inside; db=(b['POSITION'][axis]-value)*inside
            if da>=-1e-8:out.append(a)
            if (da>=0)!=(db>=0):out.append(interpolate(a,b,da/(da-db)))
        return out
    roof_node=next(n for n in j['nodes'] if n.get('name','').startswith('Atlas_Roof_'))
    roof_primitive=j['meshes'][roof_node['mesh']]['primitives'][0]
    roof_attributes={k:read(v) for k,v in roof_primitive['attributes'].items()}
    roof_indices=[v[0] for v in read(roof_primitive['indices'])] if 'indices' in roof_primitive else range(len(roof_attributes['POSITION']))
    cap=[]
    for i in roof_indices:
        row={k:roof_attributes[k][i][:] for k in roof_attributes}
        row['POSITION']=[.18+row['POSITION'][0]*(1.52/3.08),1.475+row['POSITION'][1]*(.03/.14),.325+row['POSITION'][2]*(2.55/2.25)]
        row['NORMAL']=[row['NORMAL'][0]/(1.52/3.08),row['NORMAL'][1]/(.03/.14),row['NORMAL'][2]/(2.55/2.25)]
        cap.append(row)
    planes=[(0,-.58,1),(0,.94,-1),(1,.25,1),(1,1.46,-1),(2,-.95,1),(2,1.60,-1)]
    def triangles(poly):return [v for i in range(1,len(poly)-1) for v in [poly[0],poly[i],poly[i+1]]]
    door_nodes=[]
    for ni,n in list(enumerate(j['nodes'])):
        if 'mesh' not in n:continue
        name=n.get('name','')
        if 'StripRecess_' in name or 'LightStrip_' in name:n['translation'][1]+=.15
        if 'FactoryDoor_' in name or 'ShutterSlat_' in name:
            door_nodes.append(ni);continue
        if not any(x in name for x in ['ArmouredHull','CeramicHull','FactoryDoorFrame','AtlasUpgrade_factory','Roof_','RoofCeramic','RoofModule']):continue
        mesh=j['meshes'][n['mesh']]; translation=n.get('translation',[0,0,0]); fixed=[]; moving=[]
        for p in mesh['primitives']:
            attrs={k:read(v) for k,v in p['attributes'].items()}; keys=list(attrs)
            idx=[v[0] for v in read(p['indices'])] if 'indices'in p else list(range(len(attrs['POSITION'])))
            outside=[]; shutter=[]
            for off in range(0,len(idx),3):
                poly=[{k:attrs[k][i][:] for k in keys} for i in idx[off:off+3]]
                for r in poly:r['POSITION']=[a+b for a,b in zip(r['POSITION'],translation)]
                center=[sum(r['POSITION'][k] for r in poly)/3 for k in range(3)]
                # Lift only the loading canopy to clear the taller rocket truck.
                if 'AtlasUpgrade' in name and -.90<center[0]<1.25 and 1.34<center[1]<1.51 and 1.39<center[2]<1.83:
                    for row in poly:row['POSITION'][1]+=.15
                if 'AtlasUpgrade' in name and -.64<center[0]<1 and .26<center[1]<1.31 and 1.38<center[2]<1.575:
                    shutter+=poly;continue
                # Subtract a convex cavity: emit outside fragments, pass the
                # remaining polygon to the next plane. No overlapping faces.
                for axis,value,sign in planes:
                    if not poly:break
                    outside+=triangles(clip(poly,axis,value,-sign))
                    poly=clip(poly,axis,value,sign)
            for rows,target in [(outside,fixed),(shutter,moving)]:
                if rows:
                    rows=[{**r,'POSITION':[a-b for a,b in zip(r['POSITION'],translation)]} for r in rows]
                    target.append(primitive(rows,keys,p.get('material',0)))
        if fixed:mesh['primitives']=fixed
        else:n.pop('mesh')
        if moving:
            mi=len(j['meshes']);j['meshes'].append({'primitives':moving})
            door_nodes.append(len(j['nodes']));j['nodes'].append({'name':name+'_moving','mesh':mi,'translation':translation})
    # Close the raised portal roof permanently. Reuse its original UVs and
    # material, batching the cap into the existing roof mesh (no idle draw).
    roof_mesh=j['meshes'][roof_node['mesh']]
    old=roof_mesh['primitives'][0]
    old_attributes={k:read(v) for k,v in old['attributes'].items()}
    rows=[{k:old_attributes[k][i][:] for k in old_attributes} for i in range(len(old_attributes['POSITION']))]
    roof_translation=roof_node.get('translation',[0,0,0])
    for row in cap:row['POSITION']=[v-t for v,t in zip(row['POSITION'],roof_translation)]
    roof_mesh['primitives'][0]=primitive(rows+cap,list(old_attributes),old.get('material',0))
    # Batch the moving source surfaces by their existing PBR material. The
    # closed gate uses fewer draw calls than the original individual slats.
    batches={}
    original_door_nodes=door_nodes[:]
    for ni in original_door_nodes:
        node=j['nodes'][ni]; translation=node.get('translation',[0,0,0])
        for p in j['meshes'][node['mesh']]['primitives']:
            attrs={k:read(v) for k,v in p['attributes'].items()}
            idx=[v[0] for v in read(p['indices'])] if 'indices' in p else range(len(attrs['POSITION']))
            rows=batches.setdefault(p.get('material',0),[])
            for i in idx:
                row={k:attrs[k][i][:] for k in attrs}
                row['POSITION']=[v+t for v,t in zip(row['POSITION'],translation)]
                row['POSITION'][1]=.25+(row['POSITION'][1]-.25)*1.145
                rows.append(row)
        node.pop('mesh')
    door_nodes=[]
    for material,rows in batches.items():
        mi=len(j['meshes']);j['meshes'].append({'primitives':[primitive(rows,list(rows[0]),material)]})
        door_nodes.append(len(j['nodes']));j['nodes'].append({'name':'FactoryShutterSurface_'+str(material),'mesh':mi})
    root=j['nodes'][0];root['children']=[i for i in root['children'] if i not in original_door_nodes]
    root['children'].append(len(j['nodes']))
    j['nodes'].append({'name':'FactoryRollupDoor','children':door_nodes,'extras':{'travel':1.21,'sill':.25}})
    meta_path=path.with_suffix('.json');meta=json.loads(meta_path.read_text())
    nodes=[n for n in j['nodes'] if 'mesh' in n]
    meta['design']['parts']=len(nodes)
    meta['design']['triangles']=round(sum(j['accessors'][p.get('indices',p['attributes']['POSITION'])]['count']/3 for n in nodes for p in j['meshes'][n['mesh']]['primitives']))
    meta['design']['productionGate']={'node':'FactoryRollupDoor','revision':1,'opening':[1.52,1.21],'preparedBy':'scripts/prepare-factory-gates.py'}
    root.setdefault('extras',{})['atlasDesign']=meta['design']
    meta_path.write_text(json.dumps(meta,indent=2,ensure_ascii=False)+'\n')
    j['buffers'][0]['byteLength']=len(binary)
    encoded=json.dumps(j,separators=(',',':')).encode()
    encoded+=b' '*((-len(encoded))%4);binary+=b'\0'*((-len(binary))%4)
    total=12+8+len(encoded)+8+len(binary)
    path.write_bytes(struct.pack('<III',0x46546c67,2,total)+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(binary),0x004e4942)+binary)
    print(path.name,'prepared',len(binary),'bytes')
if __name__=='__main__':
    for team in [0,1]:prepare(ROOT/f'src/assets/reborn/buildings-3d/factory-{team}.glb')
