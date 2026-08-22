import { WebSocket } from 'ws';
const PORT=process.argv[2], base=process.argv[3];
for (const p of process.argv.slice(4)) {
  const url=base+p;
  const r=await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(url)}`,{method:'PUT'});
  const t=await r.json(); const ws=new WebSocket(t.webSocketDebuggerUrl);
  let id=0; const pend=new Map(); await new Promise(res=>ws.on('open',res));
  const send=(m,q={})=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:q}))});
  ws.on('message',d=>{const m=JSON.parse(d); if(m.id&&pend.has(m.id)){pend.get(m.id)(m.result);pend.delete(m.id)}});
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url}); await new Promise(x=>setTimeout(x,3500));
  await send('Performance.enable');
  const a=(await send('Performance.getMetrics')).metrics;
  await new Promise(x=>setTimeout(x,3000));
  const b=(await send('Performance.getMetrics')).metrics;
  const g=(m,k)=>m.find(x=>x.name===k)?.value ?? 0;
  const dur = g(b,'Timestamp')-g(a,'Timestamp');
  const cpu = ((g(b,'TaskDuration')-g(a,'TaskDuration'))/dur*100);
  const layout = ((g(b,'LayoutDuration')-g(a,'LayoutDuration'))/dur*100);
  const style  = ((g(b,'RecalcStyleDuration')-g(a,'RecalcStyleDuration'))/dur*100);
  const nodes = g(b,'Nodes');
  const circles=(await send('Runtime.evaluate',{expression:"document.querySelectorAll('circle').length + '/' + document.querySelectorAll('animateTransform,animate').length",returnByValue:true})).result.value;
  console.log(`${p.padEnd(16)} CPU ${cpu.toFixed(0).padStart(3)}%  レイアウト ${layout.toFixed(1)}%  スタイル ${style.toFixed(1)}%  節点 ${nodes}  circle/animate ${circles}`);
  ws.close(); await fetch(`http://127.0.0.1:${PORT}/json/close/${t.id}`);
}
process.exit(0);
