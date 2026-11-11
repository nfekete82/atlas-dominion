import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
const PORT = Number(process.env.PORT || 8095);
const HOST = process.env.HOST || '127.0.0.1';
const BASE = resolve('dist');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.map': 'application/json', '.png': 'image/png', '.webp':'image/webp', '.svg':'image/svg+xml', '.wav':'audio/wav', '.mp3':'audio/mpeg' };
createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
    if (path === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ ok: true, service: 'sandforge' }));
      return;
    }
    const file = resolve(BASE, '.' + (path === '/' ? '/index.html' : path));
    if (!(file === BASE || file.startsWith(BASE + sep))) { res.writeHead(403).end(); return; }
    const info=await stat(file);
    if (!info.isFile()) { res.writeHead(404).end(); return; }
    const type=mime[extname(file)]||'application/octet-stream';
    // Safari/Chromium HTMLAudioElement needs byte-range requests for
    // reliable seeking and seamless 120s loops. Stream the original MP3
    // directly instead of loading a multi-MB file into the Node heap.
    if(extname(file)==='.mp3'){
      const headers={
        'Content-Type':type,'Cache-Control':'no-cache',
        'X-Content-Type-Options':'nosniff','Accept-Ranges':'bytes'
      };
      const requested=req.headers.range;
      const match=typeof requested==='string'
        ?/^bytes=(\d*)-(\d*)$/.exec(requested):null;
      if(requested&&!match){
        res.writeHead(416,{...headers,'Content-Range':'bytes */'+info.size}).end();return;
      }
      let start=0,end=info.size-1;
      if(match){
        if(match[1]){
          start=Number(match[1]);
          if(match[2])end=Math.min(end,Number(match[2]));
        }else if(match[2]){
          start=Math.max(0,info.size-Number(match[2]));
        }
        if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||
           start<0||start> end||start>=info.size){
          res.writeHead(416,{...headers,'Content-Range':'bytes */'+info.size}).end();return;
        }
        headers['Content-Range']='bytes '+start+'-'+end+'/'+info.size;
      }
      headers['Content-Length']=end-start+1;
      res.writeHead(match?206:200,headers);
      createReadStream(file,{start,end}).pipe(res);return;
    }
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    res.end(await readFile(file));
  } catch { res.writeHead(404).end('Not Found'); }
}).listen(PORT, HOST, () => console.log(`SANDFORGE: BASTION WARS → http://${HOST}:${PORT}`));
