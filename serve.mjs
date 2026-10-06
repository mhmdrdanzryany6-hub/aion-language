import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const allowed=new Set(['playground.html','playground.mjs','playground-worker.mjs','api.mjs','diagnostic.mjs','lexer.mjs','parser.mjs','types.mjs','compiler.mjs','values.mjs','stdlib.mjs','vm.mjs','formatter.mjs']);
const server=http.createServer((req,res)=>{const name=new URL(req.url,'http://localhost').pathname.slice(1)||'playground.html';if(!allowed.has(name)){res.writeHead(404);res.end('Not found');return;}res.setHeader('Content-Type',name.endsWith('.html')?'text/html; charset=utf-8':'text/javascript; charset=utf-8');res.setHeader('X-Content-Type-Options','nosniff');fs.createReadStream(path.join(root,name)).pipe(res);});
server.listen(Number(process.env.AION_PORT??4173),'127.0.0.1',()=>console.log(`AION Lab: http://127.0.0.1:${server.address().port}`));
server.on('error',e=>{console.error(e.message);process.exitCode=1;});
