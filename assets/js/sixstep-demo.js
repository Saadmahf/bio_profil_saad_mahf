/* Live voltage-hexagon + inverter demo: SVPWM inside the hexagon vs six-step at the vertices. */
function SixStepDemo(host,opts){
  opts=opts||{};
  const K=window.Kit, NS='http://www.w3.org/2000/svg';
  host.innerHTML=`
  <div class="bench-h"><span><span class="dot-live"></span><b>Voltage plane · αβ</b> &nbsp;V<sub>dc</sub> = 150 V</span>
    <span class="seg" role="group" aria-label="Modulation mode">
      <button type="button" data-m="svpwm" aria-pressed="false">SVPWM</button>
      <button type="button" data-m="six" aria-pressed="false">Six-step</button>
      <button type="button" data-m="auto" aria-pressed="true">Auto</button>
    </span></div>
  <div class="bench-b" style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,.8fr);gap:10px;align-items:center">
    <svg class="chart hexsvg" viewBox="-130 -125 260 250" aria-label="Voltage hexagon"></svg>
    <svg class="chart invsvg" viewBox="0 0 200 230" aria-label="Three-phase inverter switch states"></svg>
  </div>
  <div style="padding:0 14px 6px"><svg class="chart wavesvg" viewBox="0 0 600 120" aria-label="Phase-a pole voltage"></svg></div>
  <div class="bench-f mono" style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
    <span>mode: <b class="m-mode" style="color:var(--ink)">—</b></span><span>m = <b class="m-mi" style="color:var(--ink)">—</b></span><span>sector <b class="m-sec" style="color:var(--ink)">—</b></span><span>|V*| = <b class="m-v" style="color:var(--ink)">—</b> V</span></div>`;
  const hex=host.querySelector('.hexsvg'),inv=host.querySelector('.invsvg'),wave=host.querySelector('.wavesvg');
  const Vdc=150, R=100/ (2*Vdc/3); // px per volt: vertex (2Vdc/3=100V) at 100px
  const e=(t,a,p)=>K.el(t,a,p);
  let refs={};
  function build(){
    hex.innerHTML='';inv.innerHTML='';wave.innerHTML='';
    const c=K.css;
    // hexagon
    const pts=[0,1,2,3,4,5].map(k=>[100*Math.cos(k*Math.PI/3),-100*Math.sin(k*Math.PI/3)]);
    e('polygon',{points:pts.map(p=>p.join(',')).join(' '),fill:c('--sunk'),stroke:c('--ink'),'stroke-width':1.2},hex);
    e('circle',{r:100*Math.sqrt(3)/2,fill:'none',stroke:c('--sig'),'stroke-dasharray':'3 4','stroke-width':1},hex);
    e('circle',{r:100*(2/Math.PI)*1.5,fill:'none',stroke:c('--hv'),'stroke-dasharray':'1 4','stroke-width':1,opacity:.7},hex);
    e('line',{x1:-122,x2:122,y1:0,y2:0,stroke:c('--line')},hex);e('line',{y1:-118,y2:118,x1:0,x2:0,stroke:c('--line')},hex);
    const names=['V1 100','V2 110','V3 010','V4 011','V5 001','V6 101'];
    refs.v=pts.map((p,k)=>{const g=e('g',{},hex);const d=e('circle',{cx:p[0],cy:p[1],r:4.5,fill:c('--surface'),stroke:c('--ink'),'stroke-width':1.2},g);const t=e('text',{x:p[0]*1.17,y:p[1]*1.12+3,'text-anchor':'middle'},g);t.textContent=names[k];t.style.fontSize='8.5px';return d});
    const l1=e('text',{x:-118,y:118},hex);l1.textContent='linear limit Vdc/√3';l1.style.fill=c('--sig');l1.style.fontSize='8.5px';
    refs.trail=e('path',{fill:'none',stroke:c('--hv'),'stroke-width':1.4,opacity:.45},hex);
    refs.ref=e('line',{x1:0,y1:0,stroke:c('--muted'),'stroke-width':1.2,'stroke-dasharray':'3 3'},hex);
    refs.app=e('line',{x1:0,y1:0,stroke:c('--hv'),'stroke-width':3,'stroke-linecap':'round'},hex);
    refs.tip=e('circle',{r:4,fill:c('--hv')},hex);
    // inverter
    e('line',{x1:20,x2:20,y1:20,y2:200,stroke:c('--hv'),'stroke-width':2},inv);
    const tp=e('text',{x:8,y:14},inv);tp.textContent='+Vdc';tp.style.fill=c('--hv');
    e('line',{x1:20,x2:190,y1:20,y2:20,stroke:c('--hv'),'stroke-width':2},inv);
    e('line',{x1:20,x2:190,y1:200,y2:200,stroke:c('--ink'),'stroke-width':2},inv);
    const tn=e('text',{x:8,y:218},inv);tn.textContent='−Vdc';
    refs.sw=[];
    ['a','b','c'].forEach((ph,i)=>{const x=60+i*55;
      e('line',{x1:x,x2:x,y1:20,y2:200,stroke:c('--line'),'stroke-width':2},inv);
      const up=e('rect',{x:x-11,y:45,width:22,height:36,rx:4,fill:c('--surface'),stroke:c('--ink')},inv);
      const dn=e('rect',{x:x-11,y:140,width:22,height:36,rx:4,fill:c('--surface'),stroke:c('--ink')},inv);
      const mid=e('circle',{cx:x,cy:110,r:4,fill:c('--ink')},inv);
      const lab=e('text',{x:x,y:114+16,'text-anchor':'middle'},inv);lab.textContent=ph;
      const s1=e('text',{x:x,y:67,'text-anchor':'middle'},inv);s1.textContent='S'+ph;s1.style.fontSize='9px';
      const s2=e('text',{x:x,y:162,'text-anchor':'middle'},inv);s2.textContent='S'+ph+'′';s2.style.fontSize='9px';
      refs.sw.push({up,dn,mid});
    });
    // wave
    e('line',{x1:0,x2:600,y1:60,y2:60,stroke:c('--line')},wave);
    refs.vw=e('path',{fill:'none',stroke:c('--hv'),'stroke-width':1.2},wave);
    refs.vf=e('path',{fill:'none',stroke:c('--sig'),'stroke-width':2},wave);
    const wl=e('text',{x:4,y:12},wave);wl.textContent='v_a0 switched (orange) · fundamental (teal)';wl.style.fontSize='10px';
  }
  build();
  document.addEventListener('themechange',build);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change',build);

  let mode='auto',theta=0,last=performance.now(),tAuto=0;const trail=[];
  host.querySelectorAll('[data-m]').forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.m;host.querySelectorAll('[data-m]').forEach(x=>x.setAttribute('aria-pressed',x===b));trail.length=0}));
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const states=[[1,0,0],[1,1,0],[0,1,0],[0,1,1],[0,0,1],[1,0,1]];
  function frame(now){
    const dt=Math.min(.05,(now-last)/1000);last=now;
    const w=2*Math.PI*0.45; theta=(theta+w*dt)%(2*Math.PI); tAuto+=dt;
    let m; let six;
    if(mode==='svpwm'){m=0.85;six=false}
    else if(mode==='six'){m=1.15;six=true}
    else{m=0.75+0.42*(0.5-0.5*Math.cos(tAuto*0.5));six=m>1.0}
    const vlin=Vdc/Math.sqrt(3); const vref=m*vlin; // volts (peak phase)
    const rx=vref*R*Math.cos(theta), ry=-vref*R*Math.sin(theta);
    let ax,ay,sec=Math.floor(((theta+Math.PI/6)%(2*Math.PI))/(Math.PI/3));
    if(six){const k=sec%6;ax=100*Math.cos(k*Math.PI/3);ay=-100*Math.sin(k*Math.PI/3)}
    else{// clip to hexagon if needed (minimum-phase-error)
      const lim=100*Math.sqrt(3)/2/Math.cos(((theta%(Math.PI/3))+Math.PI/3)%(Math.PI/3)-Math.PI/6);
      const r=Math.min(Math.hypot(rx,ry),lim);ax=r*Math.cos(theta);ay=-r*Math.sin(theta)}
    refs.ref.setAttribute('x2',rx);refs.ref.setAttribute('y2',ry);
    refs.app.setAttribute('x2',ax);refs.app.setAttribute('y2',ay);refs.tip.setAttribute('cx',ax);refs.tip.setAttribute('cy',ay);
    trail.push([ax,ay]);if(trail.length>140)trail.shift();
    refs.trail.setAttribute('d',trail.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(''));
    const c=K.css; const hv=c('--hv'),sf=c('--surface'),ink=c('--ink');
    refs.v.forEach((d,k)=>d.setAttribute('fill',six&&k===sec%6?hv:sf));
    // switch states
    let st;
    if(six) st=states[sec%6];
    else{const ph=[0,-2*Math.PI/3,2*Math.PI/3].map(p=>Math.cos(theta+p)*Math.min(m,1.15)/Math.sqrt(3)*Math.sqrt(3)/2);const z=-(Math.max(...ph)+Math.min(...ph))/2;const carrier=((now/1000*9)%1);const tri=carrier<.5?carrier*2:2-carrier*2;st=ph.map(v=>(0.5+(v+z))>tri?1:0)}
    refs.sw.forEach((s,i)=>{s.up.setAttribute('fill',st[i]?hv:sf);s.dn.setAttribute('fill',st[i]?sf:ink);s.mid.setAttribute('fill',st[i]?hv:ink)});
    // waveform: one electrical period across 600px ending at current theta
    let d='',f='';
    for(let x=0;x<=600;x+=1){const th=theta-(600-x)/600*2*Math.PI;let v;
      const k=Math.floor((((th+Math.PI/6)%(2*Math.PI))+2*Math.PI)%(2*Math.PI)/(Math.PI/3));
      if(six){v=states[k][0]?1:-1}
      else{const ph=[0,-2*Math.PI/3,2*Math.PI/3].map(p=>Math.cos(th+p)*Math.min(m,1.155)/2);const z=-(Math.max(...ph)+Math.min(...ph))/2;const duty=0.5+ph[0]+z;const car=(x*18/600)%1;const tri=car<.5?car*2:2-car*2;v=duty>tri?1:-1}
      d+=(x?'L':'M')+x+' '+(60-v*42).toFixed(1);
      const fund=six?(4/Math.PI)*Math.cos(th):Math.min(m,1.155)*Math.cos(th)/1.0*0.866;
      f+=(x?'L':'M')+x+' '+(60-fund*42*(six?1:1.155)).toFixed(1);
    }
    refs.vw.setAttribute('d',d);refs.vf.setAttribute('d',f);
    host.querySelector('.m-mode').textContent=six?'six-step':(m>1?'overmodulation':'SVPWM (linear)');
    host.querySelector('.m-mi').textContent=m.toFixed(2);
    host.querySelector('.m-sec').textContent=(sec%6)+1;
    host.querySelector('.m-v').textContent=(six?(2/Math.PI)*Vdc:Math.min(vref,Vdc/Math.sqrt(3)*1.155)).toFixed(0);
    if(!reduce) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
