/* BMS diagrams: power-path schematic (contactors/precharge) and the real BMS_Supervisor Stateflow chart. */
const BMS_STATES={1:'Standby',2:'Shutdown',10:'M_Idle',11:'M_Precharge',12:'C_Normal',13:'C_Balancing',14:'M_Discharging',15:'M_Stop',20:'A_Precharge',21:'D_Standby',22:'D_Traction',23:'D_Regen',99:'Fault'};
const BMS_PARENT={C_Normal:'M_Charging',C_Balancing:'M_Charging',D_Standby:'A_Drive',D_Traction:'A_Drive',D_Regen:'A_Drive'};

function BMSPower(host,opts){
  opts=opts||{};const K=window.Kit;
  host.innerHTML=`<svg class="chart" viewBox="0 0 640 300" aria-label="Pack power path with contactors and precharge"></svg>`;
  const svg=host.querySelector('svg');let R={};let state={code:1,vlink:0,i:0};
  function build(){
    svg.innerHTML='';const c=K.css,e=(t,a)=>K.el(t,a,svg);
    const txt=(x,y,s,o)=>{const t=e('text',Object.assign({x,y},o||{}));t.textContent=s;return t};
    // two packs of 14 cells
    R.cells=[];
    [0,1].forEach(p=>{const x0=30+p*95;e('rect',{x:x0-8,y:28,width:66,height:214,rx:8,fill:c('--sunk'),stroke:c('--line')});
      txt(x0+25,20,'Pack '+(p+1),{'text-anchor':'middle'});
      for(let k=0;k<14;k++){const r=e('rect',{x:x0,y:36+k*14.4,width:50,height:11,rx:2,fill:c('--sig-soft'),stroke:c('--sig'),'stroke-width':.6});R.cells.push(r)}
      txt(x0+25,258,'14S · 50 Ah',{'text-anchor':'middle'});
    });
    // rails
    const pos=c('--hv'),neg=c('--ink');
    e('path',{d:'M55 28 V10 H265',stroke:pos,'stroke-width':2,fill:'none'});e('path',{d:'M150 28 V10',stroke:pos,'stroke-width':2,fill:'none'});
    e('path',{d:'M55 242 V284 H600',stroke:neg,'stroke-width':2,fill:'none'});e('path',{d:'M150 242 V284',stroke:neg,'stroke-width':2,fill:'none'});
    // pack contactors K1 K2 drawn as switch symbols on +
    R.k=[ [55,10],[150,10] ].map((p,i)=>{const g=K.el('g',{},svg);K.el('circle',{cx:p[0]-0,cy:p[1],r:0},g);return g});
    function sw(x,y,label){const g=K.el('g',{},svg);K.el('circle',{cx:x,cy:y,r:3,fill:c('--surface'),stroke:c('--ink')},g);K.el('circle',{cx:x+30,cy:y,r:3,fill:c('--surface'),stroke:c('--ink')},g);
      const blade=K.el('line',{x1:x+3,y1:y,x2:x+29,y2:y-14,stroke:c('--ink'),'stroke-width':2.2,'stroke-linecap':'round'},g);const t=K.el('text',{x:x+15,y:y+16,'text-anchor':'middle'},g);t.textContent=label;return {g,blade,x,y}}
    e('rect',{x:262,y:0,width:40,height:20,fill:c('--surface')});
    R.K12=sw(265,10,'K1/K2');
    e('path',{d:'M295 10 H330',stroke:pos,'stroke-width':2,fill:'none'});
    // main contactor KM (top) and precharge branch (bottom)
    e('path',{d:'M330 10 V-0 M330 10 H350',stroke:pos,'stroke-width':2,fill:'none'});
    R.KM=sw(350,10,'KM main');e('path',{d:'M380 10 H470',stroke:pos,'stroke-width':2,fill:'none'});
    e('path',{d:'M330 10 V62 H350',stroke:pos,'stroke-width':2,fill:'none'});
    R.KP=sw(350,62,'KP pre');
    e('path',{d:'M380 62 H392',stroke:pos,'stroke-width':2,fill:'none'});
    e('rect',{x:392,y:55,width:40,height:14,rx:2,fill:c('--surface'),stroke:c('--ink')});txt(412,85,'R_pre',{'text-anchor':'middle'});
    e('path',{d:'M432 62 H470 V10',stroke:pos,'stroke-width':2,fill:'none'});
    e('path',{d:'M470 10 H600',stroke:pos,'stroke-width':2,fill:'none'});
    // DC link cap
    e('path',{d:'M500 10 V128 M500 152 V284',stroke:c('--ink'),'stroke-width':1.6,fill:'none'});
    e('line',{x1:484,x2:516,y1:128,y2:128,stroke:c('--ink'),'stroke-width':3});e('line',{x1:484,x2:516,y1:152,y2:152,stroke:c('--ink'),'stroke-width':3});
    txt(522,132,'C_link');R.vl=txt(522,148,'V_link 0.0 V',{});R.vl.style.fill=c('--sig');
    // load
    e('rect',{x:560,y:100,width:70,height:80,rx:8,fill:c('--sunk'),stroke:c('--line')});
    R.load=txt(595,136,'Load',{'text-anchor':'middle'});R.load2=txt(595,152,'inverter',{'text-anchor':'middle'});
    e('path',{d:'M600 10 V100 M600 180 V284',stroke:c('--ink'),'stroke-width':1.6,fill:'none'});
    // flow paths
    R.flowMain=e('path',{d:'M55 28 V10 H600 V100',stroke:pos,'stroke-width':3,fill:'none',class:'flow',opacity:0});
    R.flowPre=e('path',{d:'M55 28 V10 H330 V62 H470 V10 H500 V128',stroke:pos,'stroke-width':3,fill:'none',class:'flow',opacity:0});
    R.state=txt(320,270,'',{'text-anchor':'middle'});R.state.style.font='600 12px var(--f-mono)';
    R.ib=txt(320,252,'',{'text-anchor':'middle'});
    paint();
  }
  function setBlade(s,closed){s.blade.setAttribute('y2',closed?s.y:s.y-14);s.blade.setAttribute('stroke',closed?K.css('--hv'):K.css('--ink'))}
  function paint(){
    const n=BMS_STATES[state.code]||'—';const c=K.css;
    const pre=/Precharge/.test(n), drive=/Discharging|Traction|D_Standby|C_|Charging|Regen|M_Stop/.test(n), fault=n==='Fault';
    setBlade(R.K12,pre||drive);setBlade(R.KM,drive);setBlade(R.KP,pre);
    R.flowPre.setAttribute('opacity',pre?1:0);
    const flowing=drive&&Math.abs(state.i)>0.5;R.flowMain.setAttribute('opacity',flowing?1:0);
    const charging=/C_|Charging|Regen/.test(n)&&!/Discharg/.test(n);
    R.flowMain.style.animationDirection=charging?'reverse':'normal';
    R.state.textContent='state: '+n;R.state.style.fill=fault?c('--bad'):c('--ink');
    R.ib.textContent=state.i?('I_cmd '+state.i.toFixed(1)+' A'):'';
    R.vl.textContent='V_link '+(state.vlink||0).toFixed(1)+' V';
    R.load.textContent=charging?'Charger':'Load';R.load2.textContent=charging?'(regen/charge)':'inverter';
    const lvl=(state.v||4.2);const cf=fault?c('--bad'):c('--sig');
    R.cells.forEach(r=>{r.setAttribute('stroke',cf)});
  }
  build();document.addEventListener('themechange',build);matchMedia('(prefers-color-scheme: dark)').addEventListener('change',build);
  const api={set(s){Object.assign(state,s);paint()}};
  if(opts.auto){ // looped demo sequence for the home page
    const seq=[[1,0,0,1400],[11,30,0,700],[11,52,0,700],[11,57,0,600],[14,58.9,60,2600],[15,58.6,0,500],[12,58.6,-40,2200],[99,0,0,1500]];let k=0;
    const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
    function step(){const s=seq[k%seq.length];api.set({code:s[0],vlink:s[1],i:s[2]});k++;if(!reduce)setTimeout(step,s[3])}step();
  }
  return api;
}

function BMSChart(host,onPick){
  const K=window.Kit;
  host.innerHTML=`<svg class="chart" viewBox="0 0 900 520" aria-label="BMS_Supervisor Stateflow chart"></svg>`;
  const svg=host.querySelector('svg');let boxes={},active=null;
  const S=[ // name,x,y,w,h,level
    ['BMS',8,8,884,504,0],['Operating',22,36,700,468,1],
    ['Standby',42,78,120,46,2],['Shutdown',42,430,120,46,2],
    ['Manual',190,66,262,420,2],['M_Idle',212,104,108,40,3],['M_Precharge',212,176,108,40,3],['M_Discharging',212,262,108,40,3],
    ['M_Charging',334,234,104,128,3],['C_Normal',344,266,84,32,4],['C_Balancing',344,312,84,32,4],['M_Stop',262,420,130,40,3],
    ['Auto',474,66,236,300,2],['A_Precharge',494,104,120,40,3],['A_Drive',494,172,200,180,3],['D_Standby',534,204,120,34,4],['D_Traction',504,292,86,34,4],['D_Regen',598,292,86,34,4],
    ['Fault',748,214,128,64,1]];
  const T=[ // x1,y1,x2,y2,label,lx,ly
    [162,100,190,100,'enable ∧ manual',176,94],
    [162,112,474,112,'',0,0],
    [102,124,102,430,'',0,0],[150,452,190,452,'',0,0],
    [266,144,266,176,'chg/dch req',272,164],
    [242,216,242,262,'V_link ≥ 0.95·V_bus',248,244],
    [320,196,334,250,'',0,0],
    [266,302,300,420,'V_min ≤ 2.80 V',190,372],
    [386,362,350,420,'end of charge',360,392],
    [300,420,300,144,'',0,0],
    [386,298,386,312,'',0,0],
    [554,144,554,172,'≥0.5 s ∧ V_link ok',560,162],
    [580,238,550,292,'I_cmd > 10 A',505,268],[610,238,640,292,'I_cmd < −10 A',620,268],
    [722,236,748,236,'OC ≥ 50 ms · OV/UV/OT/UT/SNS ≥ 0.5 s',728,206],
    [748,262,722,262,'',0,0]];
  function build(){
    svg.innerHTML='';const c=K.css;boxes={};
    const defs=K.el('defs',{},svg);const mk=K.el('marker',{id:'ah',viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:7,markerHeight:7,orient:'auto-start-reverse'},defs);K.el('path',{d:'M0 0L10 5L0 10z',fill:c('--muted')},mk);
    S.forEach(([n,x,y,w,h,l])=>{const g=K.el('g',{tabindex:l>=2?0:-1,role:'button','aria-label':n},svg);g.style.cursor=l>=1?'pointer':'default';
      const r=K.el('rect',{x,y,width:w,height:h,rx:l<=1?14:9,fill:l<=1?'none':c('--surface'),stroke:n==='Fault'?c('--bad'):c(l<=2?'--muted':'--line'),'stroke-width':l<=2?1.4:1.1},g);
      if(n==='Fault')r.setAttribute('fill',c('--surface'));
      const t=K.el('text',{x:x+8,y:y+16},g);t.textContent=n;t.style.font=(l<=2?'600 12px ':'500 11px ')+'var(--f-mono)';t.style.fill=c(n==='Fault'?'--bad':'--ink');
      boxes[n]={r,t,l};g.addEventListener('click',ev=>{ev.stopPropagation();onPick&&onPick(n)});g.addEventListener('keydown',ev=>{if(ev.key==='Enter')onPick&&onPick(n)});
    });
    T.forEach(([x1,y1,x2,y2,lab,lx,ly])=>{K.el('line',{x1,y1,x2,y2,stroke:c('--muted'),'stroke-width':1.1,'marker-end':'url(#ah)'},svg);if(lab){const t=K.el('text',{x:lx,y:ly},svg);t.textContent=lab;t.style.fontSize='9.5px'}});
    // default transitions dots
    [[46,90],[216,116],[498,116],[538,216],[348,278]].forEach(([x,y])=>K.el('circle',{cx:x-10,cy:y,r:3.5,fill:c('--ink')},svg));
    if(active) highlight(active);
  }
  function highlight(code){
    active=code;const c=K.css;const n=BMS_STATES[code];
    Object.entries(boxes).forEach(([k,b])=>{if(b.l<1)return;const on=k===n||k===BMS_PARENT[n]||(k==='Manual'&&/^M_|^C_/.test(n))||(k==='Auto'&&/^A_|^D_/.test(n))||(k==='Operating'&&n!=='Fault');
      const base=k==='Fault'?c('--surface'):(b.l<=1?'none':c('--surface'));
      b.r.setAttribute('fill',on&&b.l>=2?(k===n?(n==='Fault'?c('--bad'):c('--hv')):c('--hv-soft')):(k==='Fault'&&n==='Fault'?c('--bad'):base));
      b.t.style.fill=(k===n&&b.l>=1&&(n!=='Fault'||k==='Fault'))?(b.l>=2||k==='Fault'?'#fff':c('--ink')):c(k==='Fault'?'--bad':'--ink');
      if(k===n&&n==='Fault'){b.t.style.fill='#fff'}
    });
  }
  build();document.addEventListener('themechange',build);matchMedia('(prefers-color-scheme: dark)').addEventListener('change',build);
  return {highlight};
}
