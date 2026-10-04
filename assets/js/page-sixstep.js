document.addEventListener('DOMContentLoaded',()=>{
const S=window.SIX,K=window.Kit;


/* ---------- control chain diagram ---------- */
const INFO={
  ref:'Inputs: torque command Te* and rotor speed ω_r. θ_r is the integral of ω_r; everything is sampled by a ZOH at 100 µs.',
  p2:'Part II — flux-weakening controller (Fig. 7, eq. 9–10). Integrates the excess of |V*| over V_lim and pushes i_d* negative; i_q* is clipped to the current circle.',
  pi:'Conventional d/q PI current regulator with threshold anti-windup, ~300 Hz bandwidth.',
  p3:'Part III — voltage-reference modification (Fig. 8, eq. 11–12). Adds each axis’ current error to the other axis’ voltage, bounded by Vclamp3 = 0.5·Vdc.',
  p1:'Part I — dynamic overmodulation (Fig. 5). Inside the hexagon → SVPWM. Outside → nearest vertex, i.e. six-step. Exposes isSixStep for the mode timeline.',
  inv:'Two-level inverter: carrier comparison at 2 kHz with min–max common-mode injection, so a vertex command gives exactly +75 / −75 / −75 V.',
  pm:'PMSM plant in the rotor dq frame (eq. 1) and torque (eq. 2), continuous, solved at a 10 µs fixed step.',
  mem:'Memory block: Part II reads the previous sample’s v_d*, v_q*. This breaks a true algebraic loop, exactly like a digital controller that cannot use a value it has not computed yet.'};
function chain(){
  const svg=document.getElementById('chain');svg.innerHTML='';const c=K.css,e=(t,a,p)=>K.el(t,a,p||svg);
  const defs=e('defs',{});const mk=e('marker',{id:'ar',viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:7,markerHeight:7,orient:'auto'},defs);e('path',{d:'M0 0L10 5L0 10z',fill:c('--muted')},mk);
  e('rect',{x:120,y:40,width:560,height:170,rx:12,fill:'none',stroke:c('--line'),'stroke-dasharray':'5 5'});
  const tl=e('text',{x:132,y:58});tl.textContent='discrete controller · Ts = 100 µs';
  const B=[['ref',10,100,95,60,'Te*, ω_r','θ_r = ∫ω_r'],['p2',140,100,110,60,'Part II','flux weakening'],['pi',275,100,100,60,'PI','current reg.'],['p3',400,100,110,60,'Part III','V-ref modif.'],['p1',535,100,125,60,'Part I','overmod / six-step'],['inv',705,100,110,60,'Inverter','2-level, 2 kHz'],['pm',845,100,140,60,'PMSM','dq plant, 10 µs'],['mem',275,10,100,30,'Memory','z⁻¹']];
  B.forEach(([id,x,y,w,h,a,b])=>{const g=e('g',{tabindex:0,role:'button','aria-label':a});g.style.cursor='pointer';
    const hi=id==='p1'||id==='p2'||id==='p3';
    e('rect',{x,y,width:w,height:h,rx:8,fill:hi?c('--hv-soft'):c('--surface'),stroke:hi?c('--hv'):c('--ink'),'stroke-width':1.3},g);
    const t1=e('text',{x:x+w/2,y:y+(h>40?26:19),'text-anchor':'middle'},g);t1.textContent=a;t1.style.font='600 13px var(--f-mono)';t1.style.fill=c('--ink');
    if(h>40){const t2=e('text',{x:x+w/2,y:y+44,'text-anchor':'middle'},g);t2.textContent=b}
    const pick=()=>{document.getElementById('chain-info').textContent=INFO[id]};g.addEventListener('click',pick);g.addEventListener('keydown',ev=>{if(ev.key==='Enter')pick()});});
  const L=[[105,130,140,130],[250,130,275,130],[375,130,400,130],[510,130,535,130],[660,130,705,130],[815,130,845,130]];
  L.forEach(([x1,y1,x2,y2])=>{e('line',{x1,y1,x2,y2,stroke:c('--muted'),'stroke-width':1.4,'marker-end':'url(#ar)'});e('line',{x1,y1,x2:x2-6,y2,stroke:c('--hv'),'stroke-width':2.2,class:'flow'})});
  // feedback i_dq
  e('path',{d:'M915 160 V250 H325 V160',fill:'none',stroke:c('--muted'),'stroke-width':1.4,'marker-end':'url(#ar)'});
  e('path',{d:'M915 160 V250 H325 V166',fill:'none',stroke:c('--sig'),'stroke-width':2.2,class:'flow'});
  e('path',{d:'M325 250 H195 V160',fill:'none',stroke:c('--muted'),'stroke-width':1.4,'marker-end':'url(#ar)'});
  const fb=e('text',{x:560,y:268,'text-anchor':'middle'});fb.textContent='i_d, i_q feedback (ZOH @ Ts)';
  // v* to memory to part II
  e('path',{d:'M325 100 V40',fill:'none',stroke:c('--muted'),'stroke-width':1.2,'marker-end':'url(#ar)'});
  e('path',{d:'M275 25 H195 V100',fill:'none',stroke:c('--muted'),'stroke-width':1.2,'marker-end':'url(#ar)'});
  const vt=e('text',{x:385,y:30});vt.textContent='v_d*, v_q* (previous sample)';
}
chain();document.addEventListener('themechange',chain);matchMedia('(prefers-color-scheme: dark)').addEventListener('change',chain);
SixStepDemo(document.getElementById('demo'));

/* ---------- condition 3 ---------- */
const c3=S.c3;
Kit.line({el:'#c3i',w:600,h:260,x:{min:0,max:500,label:'time [ms]',short:'t',unit:'ms'},y:{min:-40,max:25,label:'current [A]'},
  bands:[{from:100,to:300,color:'--hv-soft',label:'torque pulse',opacity:.5}],
  series:[{x:c3.t,y:c3.iq,color:'--hv',label:'i_q',unit:'A',width:1.3},{x:c3.t,y:c3.id,color:'--sig',label:'i_d',unit:'A',width:1.3}]});
Kit.legend('#c3i-lg',[{color:'--hv',label:'i_q'},{color:'--sig',label:'i_d'}]);
Kit.line({el:'#c3t',w:600,h:260,x:{min:0,max:500,label:'time [ms]',short:'t',unit:'ms'},y:{min:-20,max:65,label:'torque [Nm]'},
  series:[{x:c3.t,y:c3.Tes,color:'--muted',label:'Te*',unit:'Nm',dash:'5 4',step:true,width:1.6},{x:c3.t,y:c3.Te,color:'--violet',label:'Te',unit:'Nm',width:1.3}]});
Kit.legend('#c3t-lg',[{color:'--muted',label:'Te* command',dash:1},{color:'--violet',label:'Te simulated'}]);
document.getElementById('teavg').textContent=S.kpi.TeAvgPulse.toFixed(1);
document.getElementById('sixfrac').textContent=Math.round(S.kpi.sixFrac);

// hexagon scatter with replay
let shown=c3.vd.length;
function hexDraw(){return Kit.line({el:'#hexplot',w:420,h:420,hover:false,x:{min:-120,max:120,label:'v_α [V]'},y:{min:-120,max:120,label:'v_β [V]'},
  series:[{x:c3.vd.slice(0,shown),y:c3.vq.slice(0,shown),color:'--hv',dots:true,width:3,opacity:.55}],
  after:({svg,sx,sy,el,css})=>{
    const pts=[0,1,2,3,4,5].map(k=>`${sx(100*Math.cos(k*Math.PI/3))},${sy(100*Math.sin(k*Math.PI/3))}`).join(' ');
    el('polygon',{points:pts,fill:'none',stroke:css('--ink'),'stroke-width':1},svg);
    const vx=c3.vd.slice(0,shown),vy=c3.vq.slice(0,shown);
    el('path',{d:vx.map((x,i)=>`M${sx(x).toFixed(1)} ${sy(vy[i]).toFixed(1)}h0`).join(''),stroke:css('--hv'),'stroke-width':9,'stroke-linecap':'round',opacity:.35},svg);
    el('circle',{cx:sx(0),cy:sy(0),r:sx(86.6)-sx(0),fill:'none',stroke:css('--sig'),'stroke-dasharray':'4 4'},svg);
    el('circle',{cx:sx(0),cy:sy(0),r:sx(95.5)-sx(0),fill:'none',stroke:css('--hv'),'stroke-dasharray':'1 4'},svg);
    const t=el('text',{x:sx(-112),y:sy(-108)},svg);t.textContent='dashed: linear limit 86.6 V · dotted: six-step 95.5 V';
    if(shown<c3.vd.length){const i=shown-1;el('circle',{cx:sx(c3.vd[i]),cy:sy(c3.vq[i]),r:6,fill:css('--hv')},svg);const tt=el('text',{x:sx(60),y:sy(112)},svg);tt.textContent='t = '+(i*0.2).toFixed(0)+' ms'}
  }})}
let hx=hexDraw(),playing=false;
document.getElementById('hexplay').addEventListener('click',function(){if(playing)return;playing=true;this.setAttribute('aria-pressed','true');shown=1;
  const step=()=>{shown=Math.min(c3.vd.length,shown+18);hx.redraw();if(shown<c3.vd.length)requestAnimationFrame(step);else{playing=false;this.setAttribute('aria-pressed','false')}};requestAnimationFrame(step)});

const ia=S.iabc;
Kit.line({el:'#iabc',w:600,h:260,x:{min:140,max:200,label:'time [ms]',short:'t',unit:'ms'},y:{min:-45,max:45,label:'current [A]'},
  series:[{x:ia.t,y:ia.a,color:'--hv',label:'i_a',unit:'A'},{x:ia.t,y:ia.b,color:'--sig',label:'i_b',unit:'A'},{x:ia.t,y:ia.c,color:'--violet',label:'i_c',unit:'A'}]});
Kit.legend('#iabc-lg',[{color:'--hv',label:'i_a'},{color:'--sig',label:'i_b'},{color:'--violet',label:'i_c'}]);

/* ---------- switched voltage ---------- */
function stepChart(sel,ed,a,b,color){const x=ed.map(p=>p[0]),y=ed.map(p=>p[1]);
  Kit.line({el:sel,w:600,h:200,x:{min:a,max:b,label:'time [ms]',short:'t',unit:'ms',dp:2},y:{min:-90,max:90,label:'v_a0 [V]',ticks:4},series:[{x,y,color,step:true,label:'v_a0',unit:'V',width:1.4}]})}
stepChart('#pwmS',S.pwmS,30,45,'--sig');stepChart('#pwmX',S.pwmX,150,165,'--hv');
Kit.line({el:'#ma',w:1100,h:200,x:{min:0,max:500,label:'time [ms]',short:'t',unit:'ms'},y:{min:-1.6,max:1.6,label:'m_a',ticks:4},
  hlines:[{y:1,color:'--muted',label:'carrier saturation ±1'},{y:-1,color:'--muted'}],
  series:[{x:S.ma.t,y:S.ma.m,color:'--violet',label:'m_a',dp:3,width:1.2}]});

/* ---------- capability ---------- */
const cap=S.cap;
Kit.line({el:'#capT',w:600,h:260,x:{min:0,max:2500,label:'speed [rpm]',short:'n',unit:'rpm',dp:0},y:{min:20,max:70,label:'torque [Nm]'},
  series:[{x:cap.n,y:cap.Tc,color:'--muted',label:'linear',unit:'Nm',width:2},{x:cap.n,y:cap.Ts,color:'--hv',label:'six-step',unit:'Nm',width:2.4}],
  bands:[{from:S.kpi.baseConv,to:S.kpi.baseSix,color:'--hv-soft'}]});
Kit.line({el:'#capP',w:600,h:260,x:{min:0,max:2500,label:'speed [rpm]',short:'n',unit:'rpm',dp:0},y:{min:0,max:9,label:'power [kW]'},
  series:[{x:cap.n,y:cap.Pc,color:'--muted',label:'linear',unit:'kW',width:2},{x:cap.n,y:cap.Ps,color:'--hv',label:'six-step',unit:'kW',width:2.4,fill:true}]});
Kit.legend('#cap-lg',[{color:'--muted',label:'linear SVPWM, V_lim = Vdc/√3'},{color:'--hv',label:'six-step, V_lim = 2Vdc/π'}]);
document.getElementById('k1').innerHTML=Math.round(S.kpi.baseConv)+' <em>→</em> '+Math.round(S.kpi.baseSix);
document.getElementById('k2').textContent=S.kpi.dT2500.toFixed(1);
document.getElementById('k3').innerHTML=S.kpi.Pmax_c.toFixed(2)+' <em>→</em> '+S.kpi.Pmax_s.toFixed(2)+' kW';

/* ---------- condition 1 ---------- */
const c1=S.c1;
Kit.line({el:'#c1',w:1100,h:260,x:{min:0,max:60,label:'time [ms]',short:'t',unit:'ms'},y:{min:-30,max:60,label:'current [A]'},
  series:[{x:c1.t,y:c1.iqN,color:'--muted',label:'i_q without III',unit:'A',dash:'4 3'},{x:c1.t,y:c1.iqW,color:'--hv',label:'i_q with III',unit:'A',width:2},
          {x:c1.t,y:c1.idN,color:'--muted',label:'i_d without III',unit:'A',dash:'1 3'},{x:c1.t,y:c1.idW,color:'--sig',label:'i_d with III',unit:'A',width:2}]});
Kit.legend('#c1-lg',[{color:'--hv',label:'i_q with Part III'},{color:'--sig',label:'i_d with Part III'},{color:'--muted',label:'without Part III',dash:1}]);

/* ---------- firmware ---------- */
const M=S.mode;const tmax=Math.max(...M.t);
const gx=M.geom.map(p=>p[0]),gy=M.geom.map(p=>p[1]*0.9+1.2),hx2=M.hyst.map(p=>p[0]),hy=M.hyst.map(p=>p[1]*0.9);
Kit.line({el:'#mode',w:600,h:260,x:{min:0,max:Math.min(tmax,400),label:'time [ms]',short:'t',unit:'ms'},y:{min:-0.2,max:2.3,label:'flag (offset)',ticks:3},
  series:[{x:gx,y:gy,color:'--hv',step:true,label:'geometric',width:1.4},{x:hx2,y:hy,color:'--sig',step:true,label:'hysteresis',width:2},{x:M.t,y:M.mi,color:'--violet',label:'filtered m',dp:3,width:1.2,opacity:.8}],
  hlines:[{y:M.hi,color:'--violet',label:'enter 1.00'},{y:M.lo,color:'--violet',dash:'2 4'}],
  after:({svg,sx,sy,el})=>{[['exact test',2.17],['hysteresis',0.97]].forEach(([s,y])=>{const t=el('text',{x:sx(6),y:sy(y)},svg);t.textContent=s})}});
Kit.legend('#mode-lg',[{color:'--hv',label:'exact hexagon test'},{color:'--sig',label:'firmware hysteresis'},{color:'--violet',label:'filtered modulation index'}]);
document.getElementById('trans').textContent=S.kpi.geomTrans+' → '+S.kpi.hystTrans+' mode switches';
const Z=S.zoh;
Kit.line({el:'#zoh',w:600,h:260,x:{min:-100,max:100,label:'time [µs] (0 = Ts grid)',short:'t',unit:'µs',dp:1},y:{min:-90,max:90,label:'v_a0 [V]',ticks:4},
  series:[{x:Z.q.map(p=>p[0]),y:Z.q.map(p=>p[1]),color:'--muted',step:true,label:'ZOH',unit:'V',width:2,dash:'5 4'},{x:Z.x.map(p=>p[0]),y:Z.x.map(p=>p[1]),color:'--hv',step:true,label:'exact instant',unit:'V',width:2.2}]});
Kit.legend('#zoh-lg',[{color:'--muted',label:'ZOH on the 100 µs grid',dash:1},{color:'--hv',label:'exact sector-crossing instant'}]);
});
