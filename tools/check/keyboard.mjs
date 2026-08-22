import { WebSocket } from 'ws';
const PORT=process.argv[2], url=process.argv[3] ?? (process.env.BASE ?? 'http://localhost:3300') + '/tasks';
const r=await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(url)}`,{method:'PUT'});
const t=await r.json(); const ws=new WebSocket(t.webSocketDebuggerUrl);
let id=0; const pend=new Map(); await new Promise(res=>ws.on('open',res));
const send=(m,p={})=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p}))});
ws.on('message',d=>{const m=JSON.parse(d); if(m.id&&pend.has(m.id)){pend.get(m.id)(m.result);pend.delete(m.id)}});
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
await send('Page.enable'); await send('Page.navigate',{url});
await new Promise(x=>setTimeout(x,3000));
const key=async(k,code,vk)=>{ for(const type of ['keyDown','keyUp'])
  await send('Input.dispatchKeyEvent',{type,key:k,code,windowsVirtualKeyCode:vk,nativeVirtualKeyCode:vk}); };
const ev=async(e)=>(await send('Runtime.evaluate',{expression:e,returnByValue:true}))?.result?.value;
await ev('document.body.focus()');
// Tab を押していって、表の行に到達するまでの回数
let hops=0, hit=null;
for (let i=0;i<40;i++){ await key('Tab','Tab',9); hops++;
  const info = await ev(`(()=>{const a=document.activeElement;return a?a.tagName.toLowerCase()+'|'+(a.getAttribute('role')||'')+'|'+(a.textContent||'').trim().slice(0,24):'none'})()`);
  if (info.startsWith('div|button')) { hit={hops,info}; break; }
}
console.log('行にたどり着くまで Tab', hit ? `${hit.hops}回 → ${hit.info}` : '到達できず');
if (hit) {
  await key('Enter','Enter',13);
  await new Promise(x=>setTimeout(x,900));
  console.log('Enter で開いたか:', await ev("document.querySelectorAll('aside').length>0"), '| URL:', await ev('location.search'));
  await key('Escape','Escape',27);
  await new Promise(x=>setTimeout(x,900));
  console.log('Esc で閉じたか  :', await ev("document.querySelectorAll('aside').length===0"), '| URL:', await ev('location.search'));
  console.log('青い輪が出るか  :', await ev("(()=>{const a=document.activeElement;return a?getComputedStyle(a).outlineColor+' '+getComputedStyle(a).outlineWidth:'none'})()"));
}
ws.close(); await fetch(`http://127.0.0.1:${PORT}/json/close/${t.id}`); process.exit(0);
