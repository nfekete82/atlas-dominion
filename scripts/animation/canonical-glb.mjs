/** GLTFExporter encodes PNGs concurrently, so image bufferViews can finish in
 * different orders. Repack those chunks in image-index order for byte-identical
 * offline builds. Geometry, materials, accessors and image bytes stay unchanged. */
export function canonicalizeGlb(input){
 const jsonLength=input.readUInt32LE(12),data=JSON.parse(input.subarray(20,20+jsonLength)),binary=input.subarray(28+jsonLength);
 if(data.buffers.length!==1||data.buffers[0].uri)throw Error('Expected a self-contained single-buffer GLB');
 const images=[...new Set((data.images??[]).map(i=>i.bufferView))];
 const order=data.bufferViews.map((_,i)=>i).filter(i=>!images.includes(i)).concat(images),mapping=new Map(order.map((old,i)=>[old,i]));
 const chunks=[];let offset=0;
 data.bufferViews=order.map(index=>{const view=data.bufferViews[index],bytes=binary.subarray(view.byteOffset??0,(view.byteOffset??0)+view.byteLength),padding=(4-bytes.length%4)%4,result={...view,byteOffset:offset};chunks.push(bytes,Buffer.alloc(padding));offset+=bytes.length+padding;return result;});
 for(const accessor of data.accessors??[]){if(accessor.bufferView!==undefined)accessor.bufferView=mapping.get(accessor.bufferView);if(accessor.sparse)for(const part of [accessor.sparse.indices,accessor.sparse.values])part.bufferView=mapping.get(part.bufferView);}
 for(const image of data.images??[])image.bufferView=mapping.get(image.bufferView);
 data.buffers[0].byteLength=offset;
 const encoded=Buffer.from(JSON.stringify(data)),json=Buffer.concat([encoded,Buffer.alloc((4-encoded.length%4)%4,32)]),bin=Buffer.concat(chunks),header=Buffer.alloc(20),binHeader=Buffer.alloc(8);
 header.write('glTF');header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+bin.length,8);header.writeUInt32LE(json.length,12);header.write('JSON',16);binHeader.writeUInt32LE(bin.length);binHeader.write('BIN\0',4);
 return Buffer.concat([header,json,binHeader,bin]);
}
