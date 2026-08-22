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
const { ev, close } = await conn(base+'/tasks');
const r1 = await ev(`(async()=>{
  const rows=[...document.querySelectorAll('[role=button]')].filter(e=>e.className.includes('row'));
  rows[1].click();
  const w=[];
  for(let i=0;i<14;i++){ await new Promise(r=>requestAnimationFrame(r));
    w.push(Math.round(document.querySelector('aside')?.getBoundingClientRect().width ?? -1)); }
  return w })()`);
console.log('右ペインが出るときの幅:', JSON.stringify(r1));
const r2 = await ev(`(async()=>{
  document.querySelector('aside button[title=閉じる]').click();
  const w=[]; for(let i=0;i<18;i++){ await new Promise(r=>requestAnimationFrame(r));
    w.push(Math.round(document.querySelector('aside')?.getBoundingClientRect().width ?? -1)); }
  return w })()`);
console.log('閉じるときの幅       :', JSON.stringify(r2));
const r3 = await ev(`(async()=>{
  [...document.querySelectorAll('button')].find(e=>e.title==='左を閉じる').click();
  const w=[]; for(let i=0;i<16;i++){ await new Promise(r=>requestAnimationFrame(r));
    w.push(Math.round(document.querySelector('nav')?.parentElement.getBoundingClientRect().width ?? -1)); }
  return w })()`);
console.log('左レールを閉じるとき :', JSON.stringify(r3));
const r4 = await ev(`(async()=>{
  const ta=document.querySelector('textarea'); ta.focus();
  ta.value='あ\\nい\\nう'; ta.dispatchEvent(new Event('input',{bubbles:true}));
  const h=[]; for(let i=0;i<14;i++){ await new Promise(r=>requestAnimationFrame(r)); h.push(Math.round(ta.getBoundingClientRect().height)); }
  return h })()`);
console.log('入力欄が伸びるとき   :', JSON.stringify(r4));
await close(); process.exit(0);
