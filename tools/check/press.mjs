import { WebSocket } from 'ws';
const PORT=process.argv[2], base=process.argv[3] ?? (process.env.BASE ?? 'http://localhost:3300');
const open = async (path) => {
  const r=await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(base+path)}`,{method:'PUT'});
  const t=await r.json(); const ws=new WebSocket(t.webSocketDebuggerUrl);
  let id=0; const pend=new Map(); await new Promise(res=>ws.on('open',res));
  const send=(m,p={})=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p}))});
  ws.on('message',d=>{const m=JSON.parse(d); if(m.id&&pend.has(m.id)){pend.get(m.id)(m.result);pend.delete(m.id)}});
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  const CPU=Number(process.env.CPU??1); if(CPU>1) await send('Emulation.setCPUThrottlingRate',{rate:CPU});
  await send('Page.navigate',{url:base+path}); await new Promise(x=>setTimeout(x,4500));
  const ev=async(e)=>(await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true}))?.result?.value;
  return { ev, close: async()=>{ws.close(); await fetch(`http://127.0.0.1:${PORT}/json/close/${t.id}`)} };
};
console.log(`CPU ${process.env.CPU??1}倍おそく — 押してから右ペインが見えるまで（ページ内で計測）`);
// 通知は右ペインを持たない（画面そのものが2列）ので、ここには入れない
for (const path of ['/tasks','/deliverables','/team','/decisions','/hire']) {
  const { ev, close } = await open(path);
  const out = await ev(`(async()=>{
    const pick=()=>[...document.querySelectorAll('[role=button]')].filter(e=>e.className.match(/row|card/))[1]
      ?? [...document.querySelectorAll('[role=button]')][1];
    const t=[];
    for(let n=0;n<5;n++){
      const el=pick(); if(!el) return ['押せる行が無い'];
      const t0=performance.now();
      el.click();
      await new Promise(res=>{ const f=()=>{ const a=document.querySelector('aside');
        if(a && a.getBoundingClientRect().width>30) res(); else requestAnimationFrame(f); }; requestAnimationFrame(f); });
      t.push(Math.round(performance.now()-t0));
      const x=document.querySelector('aside button[title=閉じる]'); if(x) x.click();
      await new Promise(r=>setTimeout(r,600));
    }
    return t })()`);
  console.log('  ' + path.padEnd(15), JSON.stringify(out));
  await close();
}
process.exit(0);
