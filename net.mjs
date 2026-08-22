import { WebSocket } from 'ws';
const PORT=process.argv[2], url=process.argv[3];
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
await ev(`[...document.querySelectorAll('[role=button]')].filter(e=>e.className.includes('row'))[1].click()`);
await new Promise(x=>setTimeout(x,1500));
console.log('行を1回押したときに飛ぶ通信:', reqs.length ? reqs : '（なし）');
ws.close(); await fetch(`http://127.0.0.1:${PORT}/json/close/${t.id}`); process.exit(0);
