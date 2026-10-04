document.addEventListener('DOMContentLoaded',()=>{
const B=window.BMS,K=window.Kit;

/* ---------- architecture ---------- */
function arch(){
  const svg=document.getElementById('arch-svg');svg.innerHTML='';const c=K.css,e=(t,a,p)=>K.el(t,a,p||svg);
  const defs=e('defs',{});const mk=e('marker',{id:'ab',viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:7,markerHeight:7,orient:'auto'},defs);e('path',{d:'M0 0L10 5L0 10z',fill:c('--muted')},mk);
  const N=[['in',10,30,150,58,'Driver input','manual panel · auto profile'],['lim',210,30,150,58,'Current limitation','SOP + rate limit'],['sf',410,30,170,58,'Stateflow supervisor','19 states · faults'],
           ['bat',410,160,170,70,'Battery model','2×14 cells · 1-RC · thermal'],['sns',210,160,150,70,'Measurements','V cell · T cell · I · V_link'],['est',10,160,150,70,'SOC / SOH / SOP','EKF ×28 · coulomb ref'],
           ['ui',610,30,140,58,'Web console','FastAPI · MATLAB Engine'],['cont',610,160,140,70,'Contactors','K1 K2 · KP · KM']];
  N.forEach(([id,x,y,w,h,a,b])=>{const hi=id==='sf';e('rect',{x,y,width:w,height:h,rx:8,fill:hi?c('--hv-soft'):c('--surface'),stroke:hi?c('--hv'):c('--ink'),'stroke-width':1.3});
    const t=e('text',{x:x+w/2,y:y+24,'text-anchor':'middle'});t.textContent=a;t.style.font='600 12.5px var(--f-mono)';t.style.fill=c('--ink');
    const t2=e('text',{x:x+w/2,y:y+42,'text-anchor':'middle'});t2.textContent=b;t2.style.fontSize='9.5px';});
  const F=[['M160 59 H210','--hv','I request'],['M360 59 H410','--hv','I limit'],['M495 88 V160','--hv','I_cmd'],['M580 59 H610','--sig',''],['M580 110 H680 V160','--hv','commands'],
           ['M410 195 H360','--sig','cells'],['M210 195 H160','--sig',''],['M85 160 V120 H285 V88','--sig','SOP'],['M360 210 H380 V110 H440 V88','--sig','V, T, faults'],['M680 88 V100','--sig','']];
  F.forEach(([d,col,lab])=>{e('path',{d,fill:'none',stroke:c('--muted'),'stroke-width':1.2,'marker-end':'url(#ab)'});e('path',{d,fill:'none',stroke:c(col),'stroke-width':2.2,class:'flow'})});
  [['I_cmd',502,130],['SOP',92,140],['V, T, flags',446,124],['commands',688,130]].forEach(([s,x,y])=>{const t=e('text',{x,y});t.textContent=s});
  const note=e('text',{x:10,y:290});note.textContent='EKF per cell: state [SOC, V1], OCV/R0/R1/τ1 tables over 22 SOC points × 3 temperatures (293/333/370 K)';
  const note2=e('text',{x:10,y:310});note2.textContent='SOP from available current Imax_dis / Imax_chg and power Pmax, fed back to the current limiter';
  const note3=e('text',{x:10,y:330});note3.textContent='Console: REST commands + WebSocket stream, signal discovery on compiled model, runs saved as .mat + .json';
}
arch();document.addEventListener('themechange',arch);matchMedia('(prefers-color-scheme: dark)').addEventListener('change',arch);

/* ---------- Stateflow + code ---------- */
function showCode(n){const raw=(window.BMS_CODE[n]||'(container state: see its children)');
  const lines=raw.split('\n').filter(l=>!/^\s*%/.test(l)).map(l=>l.replace(/\s*%.*$/,''));
  document.getElementById('code').textContent=lines.join('\n').trim()||'—';document.getElementById('code-title').textContent=n}
const sf=BMSChart(document.getElementById('sf'),showCode);showCode('M_Precharge');
const power=BMSPower(document.getElementById('power'));

/* ---------- replay ---------- */
const T=B.t;
function at(arr,t){let lo=0,hi=T.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(T[m]<=t)lo=m;else hi=m}return arr[lo]}
function edge(ed,t){let v=ed[0][1];for(const p of ed){if(p[0]<=t)v=p[1];else break}return v}
const NAMES=BMS_STATES;
const col=n=>n==='Fault'?'color-mix(in srgb,var(--bad) 35%,var(--surface))':/Precharge/.test(n)?'var(--sig-soft)':/Discharg|Traction/.test(n)?'var(--hv-soft)':/Charg|C_|Regen/.test(n)?'color-mix(in srgb,var(--violet) 25%,var(--surface))':'var(--sunk)';
const strip=document.getElementById('strip');const tEnd=T[T.length-1];
B.state.slice(0,-1).forEach((p,i)=>{const nx=B.state[i+1][0];const n=NAMES[p[1]]||p[1];const s=document.createElement('span');s.style.width=((nx-p[0])/tEnd*100)+'%';s.style.background=col(n);s.title=n+' · '+p[0].toFixed(2)+'–'+nx.toFixed(2)+' s';s.textContent=(nx-p[0])/tEnd>.06?n:'';s.style.cursor='pointer';s.addEventListener('click',()=>set(p[0]+0.05));strip.appendChild(s)});

const ich=Kit.line({el:'#ich',w:600,h:240,cursor:true,x:{min:0,max:74,label:'time [s]',short:'t',unit:'s'},y:{min:-150,max:380,label:'current [A]'},
  series:[{x:T,y:B.Iraw,color:'--muted',label:'request',unit:'A',step:true,width:1.4,dash:'5 4'},{x:T,y:B.Ilim,color:'--sig',label:'limit',unit:'A',width:1.8},{x:T,y:B.Icmd,color:'--hv',label:'I_cmd',unit:'A',width:2.2}]});
Kit.legend('#ich-lg',[{color:'--muted',label:'raw request',dash:1},{color:'--sig',label:'SOP / rate limit'},{color:'--hv',label:'I_cmd to pack'}]);
const vch=Kit.line({el:'#vch',w:600,h:240,cursor:true,x:{min:0,max:74,label:'time [s]',short:'t',unit:'s'},y:{min:55,max:59.5,label:'voltage [V]'},
  series:[{x:T,y:B.Vbus,color:'--hv',label:'V_bus',unit:'V',width:2},{x:T,y:B.Vlink,color:'--sig',label:'V_link',unit:'V',width:1.4,dash:'4 3'}]});
Kit.legend('#vch-lg',[{color:'--hv',label:'V_bus (14 × cell)'},{color:'--sig',label:'V_link (DC link)',dash:1}]);
const soc=Kit.line({el:'#soc',w:600,h:240,cursor:true,x:{min:45,max:74,label:'time [s]',short:'t',unit:'s'},y:{min:99.65,max:100.02,label:'SOC [%]',ticks:4},
  series:[{x:T,y:B.socR,color:'--muted',label:'reference',unit:'%',dp:3,width:3},{x:T,y:B.socK,color:'--hv',label:'EKF',unit:'%',dp:3,width:1.6}]});
Kit.legend('#soc-lg',[{color:'--muted',label:'reference (coulomb)'},{color:'--hv',label:'EKF estimate'}]);
let err=0;for(let i=0;i<T.length;i++){if(T[i]>49)err=Math.max(err,Math.abs(B.socK[i]-B.socR[i]))}document.getElementById('socerr').textContent=err.toFixed(3);
const sop=Kit.line({el:'#sop',w:600,h:240,cursor:true,x:{min:0,max:74,label:'time [s]',short:'t',unit:'s'},y:{min:0,max:105,label:'SOP [%]'},
  series:[{x:T,y:B.sop,color:'--violet',label:'SOP',unit:'%',width:2,fill:true},{x:T,y:B.Pdis.map(v=>v/240),color:'--sig',label:'Pmax_dis / 24 kW',unit:'%',dp:1,width:1.4}]});
Kit.legend('#sop-lg',[{color:'--violet',label:'SOP'},{color:'--sig',label:'available discharge power (% of 24 kW)'}]);

const scrub=document.getElementById('scrub'),tnow=document.getElementById('tnow');
function set(t){t=Math.max(0,Math.min(tEnd,t));scrub.value=t;tnow.textContent='t = '+t.toFixed(1)+' s';
  const code=edge(B.state,t);sf.highlight(code);document.getElementById('sf-active').textContent='active: '+(NAMES[code]||code);
  power.set({code,vlink:at(B.Vlink,t),i:at(B.Icmd,t)});
  [ich,vch,soc,sop].forEach(ch=>ch&&ch.cursor(t));
  if(!window.__picked)showCode(NAMES[code]||'BMS');
}
scrub.addEventListener('input',()=>set(+scrub.value));
let playing=false,sp=5,last=0;const btn=document.getElementById('play');
document.querySelectorAll('[data-sp]').forEach(b=>b.addEventListener('click',()=>{sp=+b.dataset.sp;document.querySelectorAll('[data-sp]').forEach(x=>x.setAttribute('aria-pressed',x===b))}));
btn.addEventListener('click',()=>{playing=!playing;btn.textContent=playing?'❚❚ Pause':'▶ Play';if(playing){if(+scrub.value>=tEnd-0.1)set(0);last=performance.now();requestAnimationFrame(loop)}});
function loop(now){if(!playing)return;const dt=(now-last)/1000;last=now;let t=+scrub.value+dt*sp;
  // skip the long latched-fault wait (operator idle) at 2x the chosen speed
  if(t>1.5&&t<47.5) t+=dt*sp*3;
  if(t>=tEnd){t=tEnd;playing=false;btn.textContent='▶ Play'}set(t);requestAnimationFrame(loop)}
document.getElementById('sf').addEventListener('click',()=>{window.__picked=true});
set(49.2);

/* ---------- drive cycle ---------- */
const cy=B.cycle;const tmax=cy.t[cy.t.length-1];
Kit.line({el:'#cycle',w:1100,h:200,x:{min:0,max:tmax,label:'sample [s]',short:'t',unit:'s',dp:0},y:{min:Math.floor(Math.min(...cy.i)/20)*20,max:Math.ceil(Math.max(...cy.i)/20)*20,label:'current [A]'},
  series:[{x:cy.t,y:cy.i,color:'--hv',label:'I',unit:'A',width:1}]});
});
