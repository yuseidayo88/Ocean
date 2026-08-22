import { WebSocket } from 'ws';
const PORT=process.argv[2], base=process.argv[3];
const conn = async (url) => {
  const r=await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(url)}`,{method:'PUT'});
  const t=await r.json(); const ws=new WebSocket(t.webSocketDebuggerUrl);
  let id=0; const pend=new Map(); await new Promise(res=>ws.on('open',res));
  const send=(m,p={})=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p}))});
  ws.on('message',d=>{const m=JSON.parse(d); if(m.id&&pend.has(m.id)){pend.get(m.id)(m.result);pend.delete(m.id)}});
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  await send('Page.enable'); await send('Page.navigate',{url});
  await new Promise(x=>setTimeout(x,3500));
  const ev=async(e)=>(await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true}))?.result?.value;
  return { ev, close: async()=>{ws.close(); await fetch(`http://127.0.0.1:${PORT}/json/close/${t.id}`)} };
};

// 1) 行を押してから右ペインが出るまで
{
  const { ev, close } = await conn(base+'/tasks');
  const out = await ev(`(async()=>{
    const rows=[...document.querySelectorAll('[role=button]')].filter(e=>e.className.includes('row'));
    const t=[];
    for (let n=0;n<5;n++){
      const target=rows[n%3];
      const t0=performance.now();
      target.click();
      await new Promise(res=>{
        const check=()=>{ if(document.querySelector('aside')) res(); else requestAnimationFrame(check); };
        requestAnimationFrame(check);
      });
      t.push(Math.round(performance.now()-t0));
      // 閉じる
      document.querySelector('aside button[title=閉じる]')?.click();
      await new Promise(r=>setTimeout(r,450));
    }
    return t;
  })()`);
  console.log('行を押す → 右ペインが出る (ms):', JSON.stringify(out));
  await close();
}

// 2) 画面のなめらかさ: 1秒間に描けたフレーム数（何もしていないとき）
for (const p of ['/home','/tasks','/team','/deliverables']) {
  const { ev, close } = await conn(base+p);
  const fps = await ev(`(async()=>{let n=0;const t0=performance.now();
    await new Promise(res=>{const f=()=>{n++; if(performance.now()-t0<1000) requestAnimationFrame(f); else res();};requestAnimationFrame(f)});
    return n})()`);
  console.log(`${p.padEnd(15)} 何もしないとき ${fps} fps`);
  await close();
}
process.exit(0);
