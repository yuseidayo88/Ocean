import { WebSocket } from 'ws';
const PORT=process.argv[2], url=process.argv[3], click=process.argv[4];
const r=await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(url)}`,{method:'PUT'});
const t=await r.json(); const ws=new WebSocket(t.webSocketDebuggerUrl);
let id=0; const pend=new Map(); const reqs=[]; await new Promise(res=>ws.on('open',res));
const send=(m,p={})=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p}))});
ws.on('message',d=>{const m=JSON.parse(d);
  if(m.id&&pend.has(m.id)){pend.get(m.id)(m.result);pend.delete(m.id)}
  if(m.method==='Network.requestWillBeSent') reqs.push(m.params.request.url.replace(/^https?:\/\/[^/]+/,''));});
await send('Runtime.enable'); await send('Network.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
await send('Page.navigate',{url}); await new Promise(x=>setTimeout(x,3500));
const ev=async(e)=>(await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true}))?.result?.value;
reqs.length=0;
const t0 = await ev(`(async()=>{const t0=performance.now(); ${click}; await new Promise(r=>requestAnimationFrame(r)); return Math.round(performance.now()-t0)})()`);
await new Promise(x=>setTimeout(x,1500));
console.log(`${url.replace(/^https?:\/\/[^/]+/,'')} → 押してから ${t0}ms / 通信 ${reqs.length?JSON.stringify(reqs):'なし'}`);
ws.close(); await fetch(`http://127.0.0.1:${PORT}/json/close/${t.id}`); process.exit(0);
