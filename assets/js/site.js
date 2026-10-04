/* Shared behaviour: theme toggle, French hover hints, lightbox, tiny SVG chart kit. */
(function(){
  const root=document.documentElement;
  const store={get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}}};

  /* ---------- theme ---------- */
  const saved=store.get('theme'); if(saved) root.setAttribute('data-theme',saved);
  function isDark(){return root.getAttribute('data-theme')!=='light'}
  function paintThemeBtn(){document.querySelectorAll('[data-theme-toggle]').forEach(b=>{b.textContent=isDark()?'☾ Dark':'☀ Light';b.setAttribute('aria-label','Switch to '+(isDark()?'light':'dark')+' mode')})}
  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-theme-toggle]'); if(!b) return;
    const next=isDark()?'light':'dark'; root.setAttribute('data-theme',next); store.set('theme',next); paintThemeBtn();
    document.dispatchEvent(new Event('themechange'));
  });

  /* ---------- French hover hints ---------- */
  let frOn=store.get('fr')!=='0';
  const tip=document.createElement('div'); tip.id='fr-tip'; tip.setAttribute('role','tooltip'); tip.innerHTML='<small>FR</small><span></span>';
  function paintFr(){document.body.classList.toggle('fr-on',frOn);document.querySelectorAll('[data-fr-toggle]').forEach(b=>b.setAttribute('aria-pressed',frOn))}
  let cur=null;
  function place(x,y){const w=tip.offsetWidth,h=tip.offsetHeight;let left=x+14,top=y+18;if(left+w>innerWidth-8)left=innerWidth-w-8;if(top+h>innerHeight-8)top=y-h-12;tip.style.left=left+'px';tip.style.top=top+'px'}
  document.addEventListener('mouseover',e=>{
    if(!frOn) return; const el=e.target.closest('[data-fr]');
    if(el===cur) return; cur=el;
    if(!el){tip.classList.remove('on');return}
    tip.querySelector('span').textContent=el.getAttribute('data-fr'); tip.classList.add('on'); place(e.clientX,e.clientY);
  });
  document.addEventListener('mousemove',e=>{if(cur&&frOn)place(e.clientX,e.clientY)});
  document.addEventListener('mouseleave',()=>{cur=null;tip.classList.remove('on')});
  addEventListener('scroll',()=>{if(cur){cur=null;tip.classList.remove('on')}},{passive:true});
  document.addEventListener('click',e=>{const b=e.target.closest('[data-fr-toggle]');if(!b)return;frOn=!frOn;store.set('fr',frOn?'1':'0');paintFr();if(!frOn)tip.classList.remove('on')});

  /* ---------- lightbox ---------- */
  let lb;
  document.addEventListener('click',e=>{
    const t=e.target.closest('[data-zoom]'); if(!t) return;
    if(!lb){lb=document.createElement('dialog');lb.className='lb';lb.innerHTML='<img alt=""><p></p>';lb.addEventListener('click',()=>lb.close());document.body.appendChild(lb)}
    lb.querySelector('img').src=t.getAttribute('data-zoom'); lb.querySelector('img').alt=t.getAttribute('data-cap')||'';
    lb.querySelector('p').textContent=t.getAttribute('data-cap')||''; lb.showModal();
  });

  document.addEventListener('DOMContentLoaded',()=>{document.body.appendChild(tip);paintThemeBtn();paintFr()});
})();

/* ---------- tiny SVG chart kit ---------- */
window.Kit=(function(){
  const NS='http://www.w3.org/2000/svg';
  const css=v=>getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  function el(tag,attrs,parent){const n=document.createElementNS(NS,tag);for(const k in attrs)n.setAttribute(k,attrs[k]);if(parent)parent.appendChild(n);return n}
  function nice(min,max,n){const span=max-min||1;const step0=span/n;const mag=Math.pow(10,Math.floor(Math.log10(step0)));const err=step0/mag;const step=(err>=7.5?10:err>=3.5?5:err>=1.5?2:1)*mag;const out=[];for(let v=Math.ceil(min/step)*step;v<=max+1e-9;v+=step)out.push(+v.toFixed(10));return out}
  function fmt(v){const a=Math.abs(v);return a>=1000?(v/1000)+'k':a<1&&a>0?v.toFixed(2).replace(/0+$/,''):String(+v.toFixed(2))}

  /* line({el, w,h, x:{min,max,label}, y:{min,max,label}, series:[{x:[],y:[],color:'--hv', width, step, dash, label, dots}], bands:[{from,to,color,label}], hlines:[{y,color,label,dash}], hover:true, unitX, unitY}) */
  function line(o){
    const host=typeof o.el==='string'?document.querySelector(o.el):o.el; if(!host) return;
    function draw(){
      host.innerHTML=''; host.style.position='relative';
      const W=o.w||640,H=o.h||260,m={l:54,r:14,t:12,b:34};
      const svg=el('svg',{viewBox:`0 0 ${W} ${H}`,class:'chart',role:'img','aria-label':o.title||'chart'},host);
      const sx=v=>m.l+(v-o.x.min)/(o.x.max-o.x.min)*(W-m.l-m.r);
      const sy=v=>H-m.b-(v-o.y.min)/(o.y.max-o.y.min)*(H-m.t-m.b);
      (o.bands||[]).forEach(b=>{el('rect',{x:sx(b.from),y:m.t,width:Math.max(0,sx(b.to)-sx(b.from)),height:H-m.t-m.b,fill:css(b.color||'--hv-soft'),opacity:b.opacity||.7},svg);if(b.label){const t=el('text',{x:(sx(b.from)+sx(b.to))/2,y:m.t+13,'text-anchor':'middle'},svg);t.textContent=b.label;t.style.fill=css(b.text||'--hv')}});
      nice(o.y.min,o.y.max,o.y.ticks||5).forEach(v=>{el('line',{x1:m.l,x2:W-m.r,y1:sy(v),y2:sy(v),class:'gr'},svg);const t=el('text',{x:m.l-7,y:sy(v)+4,'text-anchor':'end'},svg);t.textContent=fmt(v)});
      nice(o.x.min,o.x.max,o.x.ticks||6).forEach(v=>{const t=el('text',{x:sx(v),y:H-m.b+16,'text-anchor':'middle'},svg);t.textContent=fmt(v);el('line',{x1:sx(v),x2:sx(v),y1:H-m.b,y2:H-m.b+4,class:'ax'},svg)});
      el('line',{x1:m.l,x2:W-m.r,y1:H-m.b,y2:H-m.b,class:'ax'},svg);
      if(o.x.label){const t=el('text',{x:W-m.r,y:H-4,'text-anchor':'end'},svg);t.textContent=o.x.label}
      if(o.y.label){const cy=(m.t+H-m.b)/2;const t=el('text',{x:11,y:cy,'text-anchor':'middle',transform:`rotate(-90 11 ${cy})`},svg);t.textContent=o.y.label}
      (o.hlines||[]).forEach(h=>{el('line',{x1:m.l,x2:W-m.r,y1:sy(h.y),y2:sy(h.y),stroke:css(h.color||'--muted'),'stroke-dasharray':h.dash||'4 4','stroke-width':1},svg);if(h.label){const t=el('text',{x:W-m.r-4,y:sy(h.y)-5,'text-anchor':'end'},svg);t.textContent=h.label}});
      const clip='c'+Math.random().toString(36).slice(2);const cp=el('clipPath',{id:clip},el('defs',{},svg));el('rect',{x:m.l,y:m.t-2,width:W-m.l-m.r,height:H-m.t-m.b+4},cp);
      const g=el('g',{'clip-path':`url(#${clip})`},svg);
      o.series.forEach(s=>{
        if(s.dots){const pts=s.x.map((x,i)=>`M${sx(x).toFixed(1)} ${sy(s.y[i]).toFixed(1)}h0`).join('');el('path',{d:pts,stroke:css(s.color),'stroke-width':s.width||2.4,'stroke-linecap':'round',fill:'none',opacity:s.opacity||.8},g);return}
        let d='';for(let i=0;i<s.x.length;i++){const X=sx(s.x[i]).toFixed(1),Y=sy(s.y[i]).toFixed(1);if(i===0)d+=`M${X} ${Y}`;else if(s.step)d+=`H${X}V${Y}`;else d+=`L${X} ${Y}`}
        if(s.fill){el('path',{d:d+`V${sy(o.y.min<0?0:o.y.min)}H${sx(s.x[0])}Z`,fill:css(s.color),opacity:.12},g)}
        el('path',{d,fill:'none',stroke:css(s.color),'stroke-width':s.width||1.6,'stroke-dasharray':s.dash||'','stroke-linejoin':'round',opacity:s.opacity||1},g);
      });
      if(o.hover!==false){
        const tip=document.createElement('div');tip.className='tip';host.appendChild(tip);
        const cur=el('line',{y1:m.t,y2:H-m.b,stroke:css('--ink'),'stroke-width':1,opacity:0},svg);
        const marks=o.series.filter(s=>!s.dots&&!s.noHover).map(s=>({s,c:el('circle',{r:3.5,fill:css(s.color),opacity:0},svg)}));
        svg.addEventListener('pointermove',ev=>{
          const r=svg.getBoundingClientRect();const px=(ev.clientX-r.left)/r.width*W;const xv=o.x.min+(px-m.l)/(W-m.l-m.r)*(o.x.max-o.x.min);
          if(xv<o.x.min||xv>o.x.max){svg.dispatchEvent(new Event('pointerleave'));return}
          cur.setAttribute('x1',sx(xv));cur.setAttribute('x2',sx(xv));cur.setAttribute('opacity',.35);
          let lines=[`${o.x.short||'x'} = ${xv.toFixed(o.x.dp??1)} ${o.x.unit||''}`];
          marks.forEach(({s,c})=>{let lo=0,hi=s.x.length-1;while(hi-lo>1){const mid=(lo+hi)>>1;if(s.x[mid]<=xv)lo=mid;else hi=mid}const yv=s.y[lo];c.setAttribute('cx',sx(s.x[lo]));c.setAttribute('cy',sy(yv));c.setAttribute('opacity',1);lines.push(`${s.label||''}: ${(+yv).toFixed(s.dp??2)} ${s.unit||''}`)});
          tip.innerHTML=lines.join('<br>');tip.style.left=(sx(xv)/W*r.width)+'px';tip.style.top=(m.t/H*r.height+8)+'px';tip.style.opacity=1;
        });
        svg.addEventListener('pointerleave',()=>{cur.setAttribute('opacity',0);marks.forEach(({c})=>c.setAttribute('opacity',0));tip.style.opacity=0});
      }
      if(o.after) o.after({svg,sx,sy,W,H,m,el,css});
      if(o.cursor){api._c=el('line',{y1:m.t,y2:H-m.b,stroke:css('--hv'),'stroke-width':1.6},svg);api._sx=sx;if(api._x!=null)api.cursor(api._x)}
    }
    const api={redraw:draw,cursor(x){api._x=x;if(api._c){const X=api._sx(Math.max(o.x.min,Math.min(o.x.max,x)));api._c.setAttribute('x1',X);api._c.setAttribute('x2',X)}}};
    draw(); document.addEventListener('themechange',draw);
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change',draw);
    return api;
  }
  function legend(sel,items){const host=document.querySelector(sel);if(!host)return;function p(){host.innerHTML=items.map(i=>`<span><i style="background:${css(i.color)}${i.dash?';background:repeating-linear-gradient(90deg,'+css(i.color)+' 0 4px,transparent 4px 7px)':''}"></i>${i.label}</span>`).join('')}p();document.addEventListener('themechange',p);matchMedia('(prefers-color-scheme: dark)').addEventListener('change',p)}
  return {line,legend,el,css,nice};
})();

/* ---------- project pages: breadcrumb + numbered chapter strip ---------- */
document.addEventListener('DOMContentLoaded',()=>{
  const hero=document.querySelector('.p-hero'); if(!hero) return;
  const MAP={'motor-lab':['P01','IPMSM control lab'],'ev-twin':['P02','EV digital twin'],'bms':['P03','BMS supervisor'],'six-step':['P04','Six-step PMSM'],'can-lab':['P05','CAN / CAN-FD tool'],'power-lab':['P06–P12','Power & embedded projects'],'thermal':['P07','Heat exchanger'],'hv-validation':['L.03','HV DC bus validation']};
  const key=(location.pathname.split('/').pop()||'').replace('.html',''); const m=MAP[key]||['',document.title.split('·')[0].trim()];
  const crumb=hero.querySelector('.crumb');
  if(crumb){crumb.outerHTML=`<nav class="bcrumb" aria-label="Breadcrumb"><a href="../index.html">Saad Mahfoudi</a><i>/</i><a href="../index.html#projects">05 Projects</a><i>/</i><span>${m[0]?m[0]+' · ':''}${m[1]}</span></nav>`}
  const secs=[...document.querySelectorAll('main > section[id]')].filter(s=>s.querySelector('h2'));
  if(secs.length<2) return;
  const strip=document.createElement('nav'); strip.className='chstrip'; strip.setAttribute('aria-label','Chapters');
  strip.innerHTML='<div class="wrap">'+secs.map((s,i)=>{const t=(s.querySelector('.eyebrow')?.textContent||s.querySelector('h2').textContent).replace(/^\s*\d+\s*·\s*/,'').trim();return `<a href="#${s.id}"><b>${String(i+1).padStart(2,'0')}</b>${t.length>26?t.slice(0,24)+'…':t}</a>`}).join('')+'</div>';
  hero.after(strip);
  const links=[...strip.querySelectorAll('a')];
  function spy(){const y=scrollY+innerHeight*.3;let k=-1;secs.forEach((s,i)=>{if(s.offsetTop<=y)k=i});links.forEach((a,i)=>a.setAttribute('aria-current',i===k));const a=links[k];if(a){const w=strip.firstChild;const l=a.offsetLeft-w.scrollLeft;if(l<0||l+a.offsetWidth>w.clientWidth)w.scrollTo({left:a.offsetLeft-20,behavior:'smooth'})}}
  addEventListener('scroll',spy,{passive:true});spy();
});
