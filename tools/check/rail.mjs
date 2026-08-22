import { WebSocket } from 'ws';
const PORT=process.argv[2], W=Number(process.argv[3]), H=Number(process.argv[4]);
const urls=process.argv.slice(5);
const probe = `(() => {
  const vis=(el)=>{const cs=getComputedStyle(el);return cs.display!=='none'&&cs.visibility!=='hidden'&&cs.opacity!=='0'};
  const out={ell:[],text:[],rail:null,docw:document.documentElement.scrollWidth};
  for (const el of document.querySelectorAll('body *')) {
    if(!vis(el))continue; const cs=getComputedStyle(el), r=el.getBoundingClientRect();
    if(!r.width||!r.height)continue;
    if(cs.textOverflow==='ellipsis'&&el.scrollWidth>el.clientWidth+1&&el.clientWidth&&!el.classList.contains('clip'))
      out.ell.push((el.textContent||'').trim().slice(0,40)+' -'+(el.scrollWidth-el.clientWidth)+'px');
    if(!el.children.length){const t=(el.textContent||'').trim(); if(t)out.text.push(t.slice(0,50));}
  }
  const b=[...document.querySelectorAll('button')].find(e=>e.title==='左を閉じる');
  const wrap = document.querySelector('nav[aria-label]')?.parentElement;
  out.rail = (wrap && wrap.getBoundingClientRect().width > 4) ? 'open' : 'closed';
  out.reachable = b ? !b.closest('[inert]') : false;
  return out;
})()`;
for (const url of urls) {
  const r=await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(url)}`,{method:'PUT'});
  const t=await r.json(); const ws=new WebSocket(t.webSocketDebuggerUrl);
  let id=0; const pend=new Map(); const errs=[];
  await new Promise(res=>ws.on('open',res));
  const send=(m,p={})=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p}))});
  ws.on('message',d=>{const m=JSON.parse(d); if(m.id&&pend.has(m.id)){pend.get(m.id)(m.result);pend.delete(m.id)}
    if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errs.push(m.params.args.map(a=>a.value??'').join(' ').slice(0,150));});
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:W,height:H,deviceScaleFactor:1,mobile:false});
  await send('Page.enable'); await send('Page.navigate',{url});
  await new Promise(x=>setTimeout(x,3000));
  const a=(await send('Runtime.evaluate',{expression:probe,returnByValue:true}))?.result?.value;
  await send('Runtime.evaluate',{expression:`[...document.querySelectorAll('button')].find(e=>e.title==='左を閉じる')?.click()`});
  await new Promise(x=>setTimeout(x,1200));
  const b=(await send('Runtime.evaluate',{expression:probe,returnByValue:true}))?.result?.value;
  const path=url.replace(/^https?:\/\/[^/]+/,'');
  const L=[];
  if(!a||!b){L.push('  取得できず');}
  else{
    if(b.rail!=='closed')L.push('  レールが閉じない');
    if(b.reachable)L.push('  閉じているのに中のボタンがまだ触れる');
    const sb=new Set(b.text); const lost=a.text.filter(t=>!sb.has(t));
    if(lost.length)L.push(`  [レール閉] 消えた文字 ${lost.length}件: ${lost.slice(0,5).map(t=>'「'+t+'」').join(' ')}`);
    for(const e of b.ell)L.push(`  [レール閉] …で切れ 「${e}」`);
    if(b.docw>W)L.push(`  [レール閉] 横スクロール ${b.docw}px`);
  }
  for(const e of errs.slice(0,2))L.push('  ERR '+e);
  console.log(L.length?`✗ ${path}\n${L.join('\n')}`:`✓ ${path}`);
  ws.close(); await fetch(`http://127.0.0.1:${PORT}/json/close/${t.id}`);
}
process.exit(0);
