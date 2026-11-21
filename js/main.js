import { rnd, pick, clamp, lerp, mix, rgb } from './utils.js';
import { getLang, setLangCode, loadLang, tr, applyLang } from './i18n.js';
import {
  pix, rng, BAY, bay, noise1, txt,
  W, WS, O, OD, K, GL, GH, Y, BL, GR, RB,
  SPR, disc, paintCloud, buildSprites
} from './sprites.js';
import { VT, VES, HELIS } from './data/vehicles.js';
import { NM, WX, WXS, overSea, groundY, RA, FIELDS, PRESETS, DEF } from './data/missions.js';
import { SWC, BENC, CPIL, ACTS, CBASE, CAMP, CEV, FEV, EEV, EVC } from './data/campaign.js';
import {
  MU, SN, getAC, initAudio,
  musInit, musSync, musLabel,
  sndInit, sndUpdate, radioTx, beep, boomSnd, xMute, c130Snd
} from './audio.js';
import {
  initGamepad, pollGamepad, getFlightInput, getHoistInput, getPhotoPanInput,
  getInputMode, getGlyph, rumble, stopRumble, openGamepadModal
} from './gamepad.js';

const $=s=>document.querySelector(s);
const wrap=$('#wrap'),cv=$('#cv'),hc=$('#hud'),hx=hc.getContext('2d');let ctx=cv.getContext('2d');
const fxc=document.createElement('canvas'),fx=fxc.getContext('2d');
if(window.rkIntro===undefined)window.rkIntro=1;let VW=640,VH=360,HS=2,cx=0,cy=0,PXS=2;
function resize(){const r=wrap.getBoundingClientRect();if(!r.width)return;
  const px=Math.max(1,Math.round(Math.min(r.width/660,r.height/370)));PXS=px;
  VW=Math.ceil(r.width/px);VH=Math.ceil(r.height/px);cv.width=fxc.width=VW;cv.height=fxc.height=VH;
  const d=Math.min(devicePixelRatio||1,2);hc.width=Math.round(r.width*d);hc.height=Math.round(r.height*d);HS=hc.width/VW;wrap.style.setProperty('--px',px);wrap.style.setProperty('--ux',(r.width/VW).toFixed(4));wrap.style.setProperty('--uy',(r.height/VH).toFixed(4));}
addEventListener('resize',resize);{const free=t=>(state!=='play'&&state!=='brief')||(t&&t.closest&&t.closest('.ov:not([hidden]),#card,input,select,textarea,a'));
  for(const ev of['touchstart','touchmove'])document.addEventListener(ev,e=>{if(free(e.target))return;if(e.touches&&e.touches.length>1||!e.target.closest||!e.target.closest('button'))e.preventDefault();},{passive:false});
  for(const ev of['contextmenu','selectstart','dragstart','gesturestart','gesturechange','dblclick'])document.addEventListener(ev,e=>{if(!free(e.target))e.preventDefault();},{passive:false});}
addEventListener('orientationchange',()=>{setTimeout(resize,120);setTimeout(resize,500);});if(window.visualViewport)visualViewport.addEventListener('resize',resize);if(window.ResizeObserver)new ResizeObserver(()=>{const q=wrap.getBoundingClientRect();if(Math.abs(q.width/PXS-VW)>1.5||Math.abs(q.height/PXS-VH)>1.5)resize();}).observe(wrap);
function buildForm(){
  let h='';
  for(const [sec,items] of FIELDS){h+=`<fieldset class="sec"><legend>${tr(sec)}</legend><div class="grid">`;
    for(const it of items){const id=it[0];DEF[id]=it[2]==='s'?it[4]:it[5];
      if(it[2]==='s')h+=`<div class="f"><label for="f-${id}">${tr(it[1])}</label><select id="f-${id}">${it[3].map(o=>`<option value="${o[0]}"${o[0]===it[4]?' selected':''}>${tr(o[1])}</option>`).join('')}</select></div>`;
      else h+=`<div class="f"><label for="f-${id}">${tr(it[1])} <output id="o-${id}"></output></label><input type="range" id="f-${id}" min="${it[3]}" max="${it[4]}" value="${it[5]}" data-u="${it[6]}"></div>`;}
    h+='</div></fieldset>';}
  $('#fields').innerHTML=h;
  $('#presets').innerHTML=PRESETS.map((p,i)=>`<button type="button" class="chip" data-p="${i}">${tr(p[0])}</button>`).join('')+'<button type="button" class="chip rand" data-p="r">'+tr('Todo al azar')+'</button>';
}
const fid=id=>$('#f-'+id);
function getCfg(){const c={};for(const k in DEF)c[k]=fid(k).value;return c;}
function setCfg(c){for(const k in c)if(fid(k))fid(k).value=c[k];refresh();}
const LBL=(id,v)=>{const f=FIELDS.flatMap(s=>s[1]).find(i=>i[0]===id);return tr((f[3].find(o=>o[0]===String(v))||['',''])[1]);};
function refresh(){
  document.querySelectorAll('#fields input[type=range]').forEach(r=>{$('#o-'+r.id.slice(2)).textContent=r.value+r.dataset.u;});
  const c=getCfg(),n=+c.deck+ +c.water+c.rafts*c.per;
  $('#brief').innerHTML=getLang()==='en'?`<b>${LBL('ves',c.ves)}</b> · ${LBL('cond',c.cond).toLowerCase()} · ${c.dist} NM ${c.side==='w'?'west':c.side==='e'?'east':'east or west'} of Kodiak. Up to <b>${n} people</b>: ${c.deck} on deck, ${c.water} in the water${+c.rafts?`, ${c.rafts*c.per} in ${c.rafts} raft${c.rafts>1?'s':''}`:''}. Departure at ${c.hour}:00, sea ${LBL('sea',c.sea).toLowerCase()}, wind ${c.wind} kt, gusts ${LBL('gust',c.gust).toLowerCase()}, ${LBL('wx',c.wx).toLowerCase()}. ${n>HELIS[c.heli].cap?`The ${HELIS[c.heli].name} will need several trips.`:''}`:`<b>${LBL('ves',c.ves)}</b> · ${LBL('cond',c.cond).toLowerCase()} · a ${c.dist} NM al ${c.side==='w'?'oeste':c.side==='e'?'este':'este u oeste'} de Kodiak. Hasta <b>${n} personas</b>: ${c.deck} en cubierta, ${c.water} en el agua${+c.rafts?`, ${c.rafts*c.per} en ${c.rafts} balsa${c.rafts>1?'s':''}`:''}. Salida a las ${c.hour}:00, ${LBL('sea',c.sea).toLowerCase()}, viento ${c.wind} kt, ráfagas ${LBL('gust',c.gust).toLowerCase()}, ${LBL('wx',c.wx).toLowerCase()}. ${n>HELIS[c.heli].cap?`Con el ${HELIS[c.heli].name} harán falta varios viajes.`:''}`;
  try{localStorage.setItem('rk2',JSON.stringify(c));}catch(e){}
}
$('#fields').addEventListener('input',refresh);
$('#presets').addEventListener('click',e=>{const p=e.target.dataset.p;if(p==null)return;
  if(p==='r'){const c={};for(const [,items] of FIELDS)for(const it of items){if(['heli','mode','aids','bars','crash','fuel','snd'].includes(it[0]))continue;
      c[it[0]]=it[2]==='s'?pick(it[3].filter(o=>o[0]!=='random'))[0]:Math.round(rnd(it[3],it[4]));}
    c.deck=Math.round(rnd(0,5));c.water=Math.round(rnd(0,3));c.rafts=Math.round(rnd(0,1.4));if(+c.deck+ +c.water+c.rafts*c.per===0)c.water=1;setCfg(c);}
  else setCfg({...DEF,heli:fid('heli').value,mode:fid('mode').value,...PRESETS[p][1]});});
function buildMission(c){
  const R=v=>v==='random',types=VES.map(v=>v[0]);
  let ves=R(c.ves)?pick(types):c.ves,cond=R(c.cond)?pick(['drift','list','fire','sink','both']):c.cond;
  if((ves==='kayak'||ves==='zodiac')&&(cond==='fire'||cond==='both'))cond=ves==='kayak'?'drift':'sink';
  const wx=R(c.wx)?pick(['clear','cloud','rain','storm','fog','snow']):c.wx,sea=R(c.sea)?(Math.random()*5|0):+c.sea;
  const west=!c.tut&&(c.camp!=null?CAMP[c.camp].cfg.side==='w':c.side==='w'||(c.side==='random'&&Math.random()<.5));
  const m={dist:west?Math.min(-c.dist*NM-900,c.land==='cutter'?-4600:WXS-1100):c.dist*NM,west,nm:+c.dist,hour:+c.hour,rate:+c.cycle,sea,rogue:+c.rogue,wind:c.wind*1.4*(c.wdir==='e'?-1:1),gust:+c.gust,search:+c.search,fail:+c.fail,triage:c.triage==='1',panic:c.panic==='1',trapN:+c.trapped,boom:c.boom==='1',obst:c.obst,land:c.land,snd:c.snd==='1',wx,temp:+c.temp,
    fuelK:+c.fuel,flares:+c.flares,birds:+c.birds,aids:c.aids==='1',bars:c.bars==='1',crash:c.crash==='1',
    dyn:c.dyn==='1'&&c.camp==null&&!c.tut&&Math.random()<.2,fogA:wx==='fog'?.8:0,rain:wx==='rain'||wx==='storm'?1:0,snow:wx==='snow',fog:wx==='fog',storm:wx==='storm',cloud:{clear:0,cloud:.6,rain:.85,storm:1,fog:.7,snow:.8}[wx],aur:Math.random()<.2,
    name:`${tr(VT[ves].n)[0].toUpperCase()+tr(VT[ves].n).slice(1)} · ${LBL('cond',cond).toLowerCase()}`,vessels:[],water:[]};
  let deck=+c.deck,water=+c.water;const cap=VT[ves].cap;if(deck>cap){water+=deck-cap;deck=cap;}
  m.vessels.push({type:ves,dx:0,crew:deck,cond});let edge=VT[ves].half;
  if(c.ves2!=='none'){const t=R(c.ves2)?pick(types):c.ves2;m.vessels.push({type:t,dx:edge+VT[t].half+rnd(90,170),crew:Math.min(VT[t].cap,1+(Math.random()*2|0)),cond:'drift'});}
  for(let i=0;i<+c.rafts;i++)m.vessels.push({type:'raft',dx:-(edge+70+i*90+rnd(0,40)),crew:+c.per,cond:'drift'});
  for(let i=0;i<Math.min(water,8);i++)m.water.push((i%2?1:-1)*(edge+30+rnd(10,60)+i*26)*(i%2&&c.ves2!=='none'?.6:1));
  if(c.camp!=null)m.camp=c.camp;
  if(c.tut){m.tut=1;m.water=[-270];if(m.vessels[1])m.vessels[1].dx=-160;m.name=tr('Tutorial · lancha de la Guardia Costera a la deriva');}
  return m;
}

// ---------- state ----------
let state='menu',paused=false,T=0,M=null,mode='jump',H=17;
let heli=null,sw={state:'aboard'},hook={L:0},vessels=[],surv=[],parts=[],flares=[],aboard=[],rogues=[],birds=[],base={},note={t:'',life:0},clock=0,endT=0,endInfo=null,camX=300,camY=-260,banner='',rogT=30,flash=0,bolt=null,boltT=8;
const SEA={a:4,s:4};
const KEY={};
const stars=Array.from({length:90},()=>[Math.random(),Math.random()*.62,Math.random()]);
const clouds=Array.from({length:9},(_,i)=>({x:i*420+rnd(0,260),y:rnd(26,120)}));

function wbase(x,t){return SEA.a*(Math.sin(x*.011+t*1.2)*.5+Math.sin(x*.026-t*1.9)*.22)+SEA.s*Math.sin(x*.0042+t*.55);}
function rog(x){let y=0;for(const r of rogues){const d=(x-r.x)/r.w;if(d>-3&&d<3)y-=r.a*r.env*Math.exp(-d*d);}return y;}
function shore(x){return Math.max(clamp((x-340)/420,.1,1),clamp((WXS-x)/420,.1,1));}
function wave(x){return (wbase(x,T)+rog(x))*shore(x);}
function heightAt(v,o){let h=0;for(const p of v.prof)if(o>=p[0]&&o<=p[1]&&p[2]>h)h=p[2];return h;}
function deckY(v,o){return v.brk?v.y-heightAt(v,o)+v.bo*Math.sin(v.ang)+(o-v.bo)*Math.sin(v.ang+(o<v.bo?1:-1)*v.brk*.2)+v.brk*12:v.y-heightAt(v,o)+o*Math.sin(v.ang);}
function vesselAt(x,pad=0){for(const v of vessels)if(!v.gone&&v.sink<.97&&Math.abs(x-v.x)<v.half-1+pad)return v;return null;}
function surfAt(x){let s=Math.min(groundY(x),wave(x));const v=vesselAt(x);if(v&&heightAt(v,x-v.x))s=Math.min(s,deckY(v,x-v.x));return s;}
function fmtInputHints(t,landed=!!(heli&&heli.landed)){
  if(getInputMode()!=='gamepad')return t;
  const g=c=>getGlyph(c,landed);
  return t
    .replace(/↑(?=\s+(?:para despegar|to take off))/g,g('ArrowUp'))
    .replace(/\(BAT\)/g,`(${g('KeyB')})`)
    .replace(/\(ENG 1\)/g,`(${g('Digit1',true)})`)
    .replace(/\(ENG 2\)/g,`(${g('Digit2',true)})`)
    .replace(/\(D\)/g,`(${g('KeyD')})`)
    .replace(/\(W\)/g,`(${g('KeyW')})`)
    .replace(/\(S\)/g,`(${g('KeyS')})`)
    .replace(/\(T\)/g,`(${g('KeyT')})`)
    .replace(/\(G\)/g,`(${g('KeyG',false)})`)
    .replace(/\(F\)/g,`(${g('KeyF')})`)
    .replace(/\(H\)/g,`(${g('KeyH')})`)
    .replace(/\b(con|with)\s+W\b/g,(_,p)=>`${p} ${g('KeyW')}`)
    .replace(/\b(con|with)\s+S\b/g,(_,p)=>`${p} ${g('KeyS')}`)
    .replace(/\b(con|with)\s+C\b/g,(_,p)=>`${p} ${g('KeyC')}`);
}
function say(t,life=4,who){who=who||(/^Nadador/.test(t)?'s':/^(Kodiak|Los sanitarios|Una víctima en camilla|Víctima en la camilla|La ambulancia|RESCUE|El .* se ha hundido)/.test(t)?'r':'p');
  t=fmtInputHints(tr(t));if(state==='play'&&typeof radioTx==='function')radioTx(clamp(t.length*.035,.6,2.4),who==='r'?.05:.035,who==='r'?105:who==='s'?165:135);if(who==='r'){note={t,life};return;}t=t.replace(/^(Nadador|Swimmer): /,'');bub[who]={t:t[0].toUpperCase()+t.slice(1),life:Math.min(life,3)+t.length*.03};}
function jumpMax(){return 10+M.sea*2.5;}
function makeVessels(){
  vessels=M.vessels.map(d=>{const t=VT[d.type],c=d.cond,top=Math.max(...t.prof.map(p=>p[2]));
    return{...t,type:d.type,x:M.dist+d.dx,y:0,ang:0,top,fire:c==='fire'||c==='both'?.3:0,sinking:c==='sink'||c==='both',list:c==='list'?.26:0,sink:0,sinkT:130+t.half*.3,gone:false,nc:d.crew};});
}
function startMission(){
  const c=cfgCur||(cfgCur=getCfg());if(!briefM)M=buildMission(c);briefM=0;mode=c.mode;
  const S=HELIS[c.heli];T=0;H=M.hour;clock=0;endT=0;endInfo=null;parts=[];flares=[];aboard=[];rogues=[];paused=false;banner='';rogT=rnd(18,30);bub={p:null,s:null};shouts=[];gust=null;gustT=rnd(10,22);flash=0;bolt=null;
  recReset();TUT.hoist=false;TUT.asked=false;NVG=null;debris=[];
  heli={spec:S,x:-30,y:-40-S.belly-S.gear,vx:0,vy:0,dir:1,tilt:0,gear:1,gearT:1,door:0,doorT:0,landed:true,fuel:S.fuel*(M.fuelK||1),fmax:S.fuel*(M.fuelK||1),dead:false,spot:false,lights:false,bat:0,e1:0,e2:0,rpm:0,flares:M.flares,pvx:0,rot:0,yaw:1};
  hook={L:0,sw:0,swv:0,x:0,y:0,load:null};
  sw={state:'aboard',x:0,y:0,vy:0,target:null,onV:null,recall:false,think:0};
  makeVessels();surv=[];
  vessels.forEach(v=>{for(let i=0;i<v.nc;i++)surv.push({v,o:v.crew[0]+(v.crew[1]-v.crew[0])*(v.nc>1?i/(v.nc-1):.5),x:0,y:0,hp:rnd(.85,1),state:'wait',ph:rnd(0,6)});});
  M.water.forEach(dx=>surv.push({v:null,o:0,x:M.dist+dx,y:0,hp:rnd(.75,1),state:'wait',ph:rnd(0,6)}));
  base={ambX:-262,ax:-560,av:0,amb:'away',med:{x:-188,state:'in',t:0,load:null},walk:[]};
  makeBirds();makeClouds();xInit();campInit();
  state='play';showOnly('');$('#pad').hidden=false;refreshPadLabels();
  say(M.search?(M.west?`${S.call}: sin posición confirmada. Rumbo oeste y a buscar. ↑ para despegar.`:`${S.call}: sin posición confirmada. Rumbo este y a buscar. ↑ para despegar.`):`${S.call}: ${VT[M.vessels[0].type].n} a ${M.nm} NM al ${M.west?'oeste':'este'}. ↑ para despegar.`,7);
}
function makeBirds(){birds=Array.from({length:M.birds},(_,i)=>({x:rnd(-450,800),y:rnd(-190,-60),vx:pick([-1,1])*rnd(22,40),ph:rnd(0,6),by:rnd(-190,-60)}));}

// ---------- input ----------
function press(c){
  if(state!=='play')return;
  if(FIN.on)return;if(EPI.on){if(c==='Escape'||c==='Enter')epiEnd();return;}if(CUT.on){if(c==='Escape'||c==='Enter')campAdvance();return;}
  if(c==='KeyP'||c==='Escape'){if(PH.on)photoOff();else if(paused)pauseClose();else pauseOpen();return;}
  if(paused||heli.dead)return;
  const h=heli;
  if(c==='KeyB'){if(!h.landed)say('La batería no se desconecta en vuelo.',2.5);else{h.bat=h.bat?0:1;if(h.bat){h.lights=true;h.spot=H<6||H>20;}else{h.e1=h.e2=0;h.lights=false;h.spot=false;}beep(h.bat?880:440,.06,.05,'sine');say(h.bat?'Batería principal conectada.':'Batería desconectada. Motores parados.',2.5);}return;}
  if(c==='Digit1'||c==='Digit2'){const n=c==='Digit1'?1:2,k='e'+n;if(!h.bat)say('Sin energía: conecta antes la batería (BAT).',2.5);else if(!h.landed)say(X.eng&&n===2?'El motor 2 no responde.':'Los motores no se paran en vuelo.',2.5);else{h[k]=h[k]?0:1;beep(h[k]?660:330,.08,.05,'sine');say(h[k]?`Motor ${n} arrancando.`:`Motor ${n} parado.`,2);}return;}
  if((c==='KeyF'||c==='KeyL')&&!h.bat){say('Sin energía: conecta antes la batería (BAT).',2.5);return;}
  if(c==='KeyG'){if(h.spec.fixed)say('El tren del Jayhawk es fijo: siempre va abajo.',3);else if(h.landed)say('En tierra el tren se queda abajo.');else{h.gearT=h.gearT?0:1;say(h.gearT?'Tren abajo.':'Tren arriba.',2);}}
  if(c==='KeyD'){if(h.doorT&&(hook.L>3||hook.load||sw.state==='hook'))say('Recoge la grúa antes de cerrar la puerta.',3);else{h.doorT=h.doorT?0:1;say(h.doorT?'Puerta lateral abierta. Velocidad limitada.':'Puerta cerrada.',2.5);}}
  if(c==='KeyF'){if(X.noSpot){say('El foco no responde.',2);return;}h.spot=!h.spot;say(h.spot?'Foco encendido.':'Foco apagado.',2);}
  if(c==='KeyL'){h.lights=!h.lights;say(h.lights?'Luces de navegación encendidas.':'Luces apagadas.',2);}
  if(c==='KeyH'){if(h.flares>0&&!h.landed){h.flares--;flares.push({x:h.x,y:h.y,vx:h.dir*70+h.vx*.5,vy:-120,life:16});say(`Bengala fuera. Quedan ${h.flares}.`,2);}else say(h.landed?'No se lanzan bengalas en la base.':'Sin bengalas.',2);}
  if(c==='KeyT'){mode=mode==='jump'?'hoist':'jump';say('Despliegue: '+(mode==='jump'?'salto libre.':'bajada con la grúa.'),2.5);}
  if(c==='KeyR'){if(sw.state==='swim'||sw.state==='with'||sw.state==='free'){if(sw.target&&sw.target.state==='ready')sw.target.state='wait';sw.target=null;sw.state='await';sw.recall=true;say('Nadador: espero el gancho.');}}
  if(c==='KeyC')xCut();if(c==='KeyM')xMute();
  if(c==='Space')deploy();
  if((c==='KeyW'||c==='KeyS')&&h.door<.95&&!h.landed)say('Abre la puerta lateral (D) para usar la grúa.',3);
}
function deploy(){
  const h=heli,S=h.spec,dxw=h.x+h.dir*S.doorMid;
  if(sw.state==='hook'&&hook.L<14){sw.state='aboard';say('Nadador de vuelta en cabina.',2);return;}
  if(sw.state!=='aboard'){say('El nadador ya está fuera.',2);return;}
  if(sw.sta<.4){say('Nadador: necesito recuperar fuerzas.',3);return;}
  if(h.landed){say('Primero hay que llegar a la zona.',2);return;}
  if(h.door<.95){say('Abre la puerta lateral (D) primero.',3);return;}
  if(mode==='hoist'){if(X.noHoist){say('Sin cable: solo salto libre hasta volver a base.',3);return;}if(hook.load){say('La grúa está ocupada.',2);return;}if(hook.L>14){say('Recoge la grúa (W) para enganchar al nadador.',3);return;}
    sw.state='hook';say('Nadador en el gancho. Arríalo con S.');return;}
  const alt=(wave(dxw)-(h.y+S.belly))/8;
  if(h.x<360&&h.x>WXS-20){say('Aquí no: estás sobre la costa.',2);return;}
  if(vesselAt(dxw,14)){say('No saltes sobre la embarcación. Usa la grúa (T).',3);return;}
  const jm=jumpMax();if(alt>jm){say(`Demasiado alto para saltar: ${alt.toFixed(0)} m. Baja de ${jm.toFixed(0)} m.`,3);return;}sw.slow=alt>jm*.7;
  if(Math.abs(h.vx)>60){say('Demasiada velocidad para saltar. Estabiliza.',3);return;}
  sw.state='fall';sw.x=dxw;sw.y=h.y+S.belly-2;sw.vy=20;say('¡Nadador al agua!',2);
}
addEventListener('keydown',e=>{if(state==='brief'){if(e.code==='Enter'||e.code==='Space'){e.preventDefault();if(BRdone)startMission();else briefSkip();}else if(e.code==='Escape')guard.on||cfgCur.camp!=null?toMain():toMenu();return;}if(RP.on){if(['Escape','Enter','Space'].includes(e.code)){e.preventDefault();rpEnd();}return;}if(state==='play'&&(!paused||PH.on)&&/^(Arrow|Space)/.test(e.code))e.preventDefault();if(state==='play'&&!e.repeat){KEY[e.code]=true;press(e.code);}});
addEventListener('keyup',e=>{KEY[e.code]=false;});
addEventListener('blur',()=>{for(const k in KEY)KEY[k]=false;});
document.querySelectorAll('#pad button').forEach(b=>{const k=b.dataset.k;
  b.addEventListener('pointerdown',e=>{e.preventDefault();KEY[k]=true;b.classList.add('on');press(k);});
  ['pointerup','pointerleave','pointercancel'].forEach(n=>b.addEventListener(n,()=>{KEY[k]=false;b.classList.remove('on');}));});

// ---------- update ----------
function crash(why){const h=heli;if(h.dead)return;if(!M.crash){h.vy=-90;h.y-=4;rumble('boom');return;}h.dead=true;endT=5;endInfo={fail:why};crashDebris(h);flash=Math.max(flash,.75);rumble('crash');
  for(let i=0;i<320;i++)parts.push(i%8===0?{k:'flame',x:h.x+rnd(-30,30),y:h.y+rnd(-10,10),vx:rnd(-120,120),vy:rnd(-160,20),life:rnd(.5,1.4),max:1.4,r:rnd(3,8)}:{k:'smoke',x:h.x+rnd(-30,30),y:h.y+rnd(-10,10),vx:rnd(-40,40),vy:rnd(-70,-20),life:rnd(3,6),max:6,r:Math.random()<.3?2:1});}
function room(){return aboard.length+(hook.load&&hook.load!==sw?1:0)<heli.spec.cap;}
function envSea(dt){
  const A=[1,3,5,8,12][M.sea],S2=[2,6,12,22,34][M.sea];
  SEA.a=A*(.8+.3*Math.sin(T*.06));SEA.s=S2*(.8+.35*Math.sin(T*.043+2));
  for(const r of rogues){r.x+=r.v*dt;r.env=Math.min(1,r.env+dt/3);}
  const hxx=heli?heli.x:camX;rogues=rogues.filter(r=>Math.abs(r.x-hxx)<1700);
  if(M.rogue&&state==='play'&&heli.x>900){rogT-=dt;if(rogT<=0){rogT=M.rogue>1?rnd(14,24):rnd(34,58);
    const d=M.wind<0?-1:1,big=Math.random()<.3;rogues.push({x:heli.x-d*rnd(750,950),v:d*rnd(70,105),a:(rnd(16,24)+M.sea*7)*(big?1.6:1),w:rnd(90,160),env:0,big,hit:new Set()});
    say(`¡Ola ${big?'gigante':'grande'} acercándose por el ${d>0?'oeste':'este'}! Gana altura.`,5);}}
  if(M.gust&&state==='play'&&heli&&!heli.landed&&!heli.dead){gustT-=dt;if(gustT<=0&&!gust){gustT=rnd(24,46)/(1+M.gust*.45);const F=[0,90,170,260,360][M.gust],d=Math.random()<.75?(M.wind<0?-1:1):(Math.random()<.5?-1:1);
      gust={t:0,d:rnd(1.6,4),fx:d*F*rnd(.7,1.2),fy:rnd(-.5,.6)*F};rumble('gust');say(M.gust>2?'¡Ráfaga fuerte! Corrige.':'¡Ráfaga!',1.6);}}
  if(gust&&(gust.t+=dt)>gust.d)gust=null;
  if(!M.storm)flash=Math.max(0,flash-dt*2.4);
  if(M.storm){boltT-=dt;flash=Math.max(0,flash-dt*2.2);if(boltT<=0){boltT=rnd(4,11);flash=1;const bx=camX+rnd(40,VW-40);let y=camY,x=bx;const p=[x,y];while(y<-10){y+=rnd(14,30);x+=rnd(-16,16);p.push(x,y);}bolt={p,t:.22};}
    if(bolt&&(bolt.t-=dt)<=0)bolt=null;}
}
function update(dt){
  T+=dt;envSea(dt);stepFire(dt);
  for(const b of birds){b.ph+=dt*9;b.x+=b.vx*dt;b.y+=(b.by+Math.sin(T*.8+b.ph*.1)*14-b.y)*dt;
    if(heli&&Math.abs(b.x-heli.x)<90&&Math.abs(b.y-heli.y)<70){b.vx=Math.sign(b.x-heli.x||1)*70;b.by=clamp(b.by-60*dt,-260,-50);}else b.vx+=(Math.sign(b.vx)*30-b.vx)*dt;
    if(b.x<-520)b.vx=Math.abs(b.vx);else if(b.x>860)b.vx=-Math.abs(b.vx);}
  if(state==='brief')briefT+=dt;
  if(state!=='play'){for(const v of vessels){v.y=wave(v.x)*.3;}return;}
  H=(H+dt*M.rate/60)%24;
  const h=heli,S=h.spec;
  if(endT>0){endT-=dt;if(endT<=0){finish();return;}}
  if(!h.dead){
    clock+=dt;
    const gp=getFlightInput();
    let ix=clamp((KEY.ArrowRight?1:0)-(KEY.ArrowLeft?1:0)+gp.x,-1,1),iy=clamp((KEY.ArrowDown?1:0)-(KEY.ArrowUp?1:0)+gp.y,-1,1);
    if(h.fuel<=0){ix=0;iy=0;}
    if(h.landed){h.vx=h.vy=0;h.gearT=1;if(h.on)xRide();h.rpm+=clamp((h.e1+h.e2)/2-h.rpm,-dt*.3,dt*.42);if(iy<-.35&&h.fuel>0&&!endT&&h.rpm>.93){h.landed=false;h.on=null;h.vy=-40;refreshPadLabels();}else{h.fuel=Math.min(h.fmax,h.fuel+45*dt);h.flares=M.flares;
      if(iy<-.35&&!endT&&h.rpm<=.93&&T-(h.hintT==null?-9:h.hintT)>4){h.hintT=T;say(h.e1&&h.e2?'El rotor aún está cogiendo vueltas.':'Antes de despegar: batería (BAT), motor 1 (ENG 1) y motor 2 (ENG 2).',3.5);}}}
    else if(!h.bat||!h.e1||!h.e2||h.rpm<1){h.bat=h.e1=h.e2=1;h.rpm=1;}
    if(!h.landed){
      const max=S.max*(h.gear>.5&&!S.fixed?.72:1)*(h.door>.3?.5:1)*X.mx,drag=S.acc/S.max;
      h.vx+=(ix*S.acc*X.pw-(h.vx-M.wind*.18)*drag+Math.sin(T*1.7)*M.wind*.5)*dt;h.vx=clamp(h.vx,-max,max);
      h.vy+=((iy<0?iy*X.pw:iy)*S.acc*.9+X.sink-h.vy*1.7+Math.sin(T*2.3+1)*(SEA.a+SEA.s)*1.2)*dt;
      if(h.fuel<=0)h.vy+=330*dt;
      if(gust){const e=Math.sin(gust.t/gust.d*3.14),tb=1+.5*Math.sin(T*13);h.vx+=gust.fx*e*tb*dt;h.vy+=gust.fy*e*tb*dt;h.tilt+=Math.sin(T*17)*.45*e*M.gust*dt;hook.swv+=gust.fx*e*.5*dt;}
      h.x+=h.vx*dt;h.y+=h.vy*dt;if(Math.abs(ix)>.12)h.dir=ix>0?1:-1;
      if(M.fuelK)h.fuel=Math.max(0,h.fuel-dt*X.burn);
      if(h.fuel<=0&&!h.out){h.out=1;say('¡Sin combustible! Motores parados.',5);}
      {const xmin=M.west?M.dist-1500:WXS-700,xmax=M.west?1300:M.dist+1500;if(h.x<xmin){h.x=xmin;h.vx=0;}if(h.x>xmax){h.x=xmax;h.vx=0;}}
      if(h.y<-720){h.y=-720;h.vy=0;}
    }
    h.gear+=clamp(h.gearT-h.gear,-dt*1.6,dt*1.6);h.door+=clamp(h.doorT-h.door,-dt*1.8,dt*1.8);
    h.tilt+=((h.vx/S.max*.2+ix*.06)-h.tilt)*5*dt;h.rot+=dt*34*(h.landed?h.rpm:1);h.yaw+=clamp(h.dir-h.yaw,-dt*1.35,dt*1.35);
    const ax=(h.vx-h.pvx)/Math.max(dt,.001);h.pvx=h.vx;
    if(!h.landed){
      const bottom=h.y+S.belly+h.gear*S.gear;
      if(!overSea(h.x)&&bottom>=groundY(h.x)){
        if(h.x<220&&h.x>=WX&&h.gear>.9&&h.vy<120&&Math.abs(h.vx)<80){h.landed=true;h.y=-40-S.belly-S.gear;h.vx=h.vy=0;if(aboard.length)h.doorT=1;rumble('land');refreshPadLabels();say(aboard.length?'En tierra. Abriendo puerta para los sanitarios.':'En tierra, Air Station Kodiak.',3);}
        else if(M.crash)crash(h.x>=220||h.x<WX?'Tocaste la orilla fuera de la plataforma.':h.gear<=.9?'Aterrizaste con el tren arriba.':'Toma demasiado dura.');else{h.vy=-60;h.y-=3;if(h.gear<=.9)say('Baja el tren (G) para tomar.',2);}
      }else if((h.x>=220||h.x<WX)&&h.y+S.belly>=wave(h.x)-2)crash('El helicóptero tocó el agua.');
      else for(const v of vessels){if(v.gone)continue;for(const k of [-.6,0,.6]){const o=h.x+k*S.half-v.x;if(Math.abs(o)<=v.half&&heightAt(v,o)&&h.y+S.belly>deckY(v,o)+2){if(!xDeckLand(v,o))crash('Colisión con la embarcación.');break;}}}
    }
    // hoist: only through the open door
    const hoist=getHoistInput(),hDn=clamp((KEY.KeyS?1:0)+Math.max(0,hoist),0,1),hUp=clamp((KEY.KeyW?1:0)+Math.max(0,-hoist),0,1);
    if(!h.landed&&h.door>.95){if(!X.noHoist){if(hDn>0)hook.L+=95*hDn*X.hk*dt;if(hUp>0&&!X.snag)hook.L-=115*hUp*X.hk*dt;}}else if(h.landed)hook.L-=115*dt;
    hook.L=clamp(hook.L,0,400);
    if(FIN.on){hook.swv=0;hook.bw=0;hook.sw=FIN.st==='gone'?hook.sw*Math.exp(-8*dt):Math.sin(T*1.25)*5*Math.min(1,hook.L/60);}else
    {const Lk=Math.max(hook.L,24),kk=9*clamp(150/Lk,.55,2.6),lw=hook.load?.45:1,wf=(M.wind*1.5*(1+.45*Math.sin(T*1.3)+.3*Math.sin(T*3.1+1))+(gust?gust.fx*.25:0))*lw;
      hook.swv+=(-kk*hook.sw-(hook.load?1.1:.75)*hook.swv-ax*.75+wf)*dt;hook.sw=clamp(hook.sw+hook.swv*dt,-70,70);hook.bw=(hook.bw||0)+((-hook.swv*.22+M.wind*.035*lw)*(hook.L/100)-(hook.bw||0))*Math.min(1,dt*5);}
    hook.x=h.x+h.dir*S.doorMid+hook.sw*(hook.L/400);hook.y=h.y+S.belly+hook.L;
    const s=surfAt(hook.x);if(hook.y>s){hook.L=Math.max(0,s-(h.y+S.belly));hook.y=h.y+S.belly+hook.L;}
    hook.onSurf=hook.y>=s-1.5&&hook.L>14;
    baseUpdate(dt);
  }else hook.L=0;

  xUpdate(dt);debUpdate(dt);campUpdate(dt);if(EPI.on)epiUpdate(dt);
  if(X.c2&&!X.c2d&&heli&&!heli.dead&&!heli.landed&&state==='play'&&vessels[0]){const h=heli,free=h.spec.cap-aboard.length;
    if(free>0&&aboard.length&&sw.state==='aboard'&&hook.L<3&&(M.west?h.x>vessels[0].x+700&&h.x<WXS-1100:h.x<vessels[0].x-700&&h.x>1500)&&!surv.some(p=>['wait','ready','trap','hook'].includes(p.state))){X.c2d=1;
      const type=pick(['kayak','zodiac','sail']),t=VT[type],x=M.west?clamp(h.x+rnd(650,950),h.x+400,WXS-400):clamp(h.x-rnd(650,950),700,h.x-400),n=Math.min(free,1+(Math.random()*2|0));
      vessels.push({...t,type,x,y:0,ang:0,top:Math.max(...t.prof.map(q=>q[2])),fire:0,sinking:type!=='kayak',list:type==='sail'?.3:0,sink:type==='kayak'?0:.25,sinkT:170,gone:false,nc:0});
      for(let i=0;i<n;i++)surv.push({v:null,o:0,x:x+(i?1:-1)*(t.half+24+rnd(0,30)),y:0,hp:rnd(.7,.9),state:'wait',ph:rnd(0,6),kind:'ok'});
      X.found=true;beep(1400,.08,.06,'sine');say(`Kodiak: nuevo aviso en vuestra ruta de vuelta. Una embarcación volcada, ${n} en el agua. Sois los más cercanos.`,8,'r');}}
  for(const v of vessels){if(v.gone)continue;
    v.x+=M.wind*.02*dt;
    if(v.sinking){v.sink=Math.min(1,v.sink+dt/v.sinkT);if(v.sink>=1){v.gone=true;say(`El ${v.n} se ha hundido.`);}}
    if(v.brkAt&&!v.brk0&&v.sink>=v.brkAt){v.brk0=1;v.brk=0;v.sinkT*=.6;flash=Math.max(flash,.5);boomSnd(1.1);say('¡El casco se ha partido en dos!',5);
      for(let i=0;i<30;i++)parts.push({k:'spray',x:v.x+v.bo+rnd(-12,12),y:deckY(v,v.bo)-rnd(0,22),vx:rnd(-70,70),vy:rnd(-130,-30),life:rnd(.5,1.1),max:1.1,r:Math.random()<.4?2:1});
      for(const p of surv)if(p.v===v&&(p.state==='wait'||p.state==='ready')&&Math.abs(p.o-v.bo)<16){p.x=v.x+p.o;p.yo=Math.min(0,deckY(v,p.o)-(wave(p.x)+1));p.vyo=0;p.dvx=(p.o<v.bo?-1:1)*30;p.v=null;if(sw.target===p)sw.onV=null;}}
    if(v.brk0)v.brk=Math.min(1,v.brk+dt/16);
    if(v.fire){v.fire=Math.min(1,v.fire+dt/140);const k=v.fire,wd=5+v.half*.03;
      for(const fo of v.fs){const fy=deckY(v,fo),fx0=v.x+fo;if(fy>wave(fx0))continue;
        if(Math.random()<dt*(10+k*10))parts.push({k:'ember',x:fx0+rnd(-wd,wd)*1.5,y:fy-rnd(10,40),vx:rnd(-26,26)+M.wind*.4,vy:rnd(-140,-60),life:rnd(.8,1.9),max:1.9,r:Math.random()<.4?2:1});
        if(Math.random()<dt*(3+k*3)){const big=v.half>140?1.5:v.half<50?.7:1;puffs.push({x:fx0+rnd(-wd,wd),y:fy-rnd(26,46)*(.5+k*.6)*big,vx:rnd(-4,4),vy:rnd(-38,-26),r:rnd(4,6)*big,a:0,life:rnd(7,10)*(big>1?1.25:1),s:Math.random()*256|0,g:rnd(1.7,2.7)*big});}}}
    const hv=clamp(70/v.half,.12,.85),tk=Math.min(1,60/v.half);
    v.y=wave(v.x)*hv+v.sink*(v.top+8);
    v.ang=(wave(v.x+v.half*.6)-wave(v.x-v.half*.6))/(v.half*1.2)*.7*hv-(v.type==='raft'?0:v.sink*.42*tk)-v.list*tk+(v.cutter?Math.sin(T*.5)*.013+Math.sin(T*.23+1)*.006:0);if(v.cutter)v.y+=Math.sin(T*.41+.6)*1.6;
  }
  for(const p of surv){
    if(p.state==='wait'||p.state==='ready'){
      if(p.v){p.x=p.v.x+p.o;p.y=deckY(p.v,p.o);
        if(p.v.gone||p.y>=wave(p.x)-1){p.v=null;if(sw.target===p)sw.onV=null;}
        else if(M.sea>=3||rogues.some(q=>q.big))for(const q of rogues)if(q.env>.7&&Math.abs(q.x-p.x)<12&&!q.hit.has(p)){q.hit.add(p);
          if(q.a*q.env>heightAt(p.v,p.o)*.55+14&&Math.random()<.5){p.yo=Math.min(0,p.y-(wave(p.x)+1));p.vyo=0;p.dvx=Math.max(-50,Math.min(50,q.v*.6))||30;p.v=null;p.hp-=.05;if(sw.target===p)sw.onV=null;splash(p.x);say('¡Una ola ha barrido la cubierta! Hombre al agua.',5);break;}}}
      if(p.v){}else{const uv=vesselAt(p.x,12);p.dvx=p.dvx||0;p.yo=p.yo||0;
        if(uv&&uv.type!=='raft'&&!uv.sit){const dx=p.x-uv.x,dir=Math.abs(p.dvx)>6?Math.sign(p.dvx):(dx>=0?1:-1),pen=dir>0?uv.half+11-dx:uv.half+11+dx;
          const tg=dir*(p.yo<0?42:Math.min(40,6+pen*.9));p.dvx+=(tg-p.dvx)*Math.min(1,2.5*dt);
          if(p.yo<0&&Math.abs(dx)>=uv.half-1){p.vyo+=260*dt;p.yo+=p.vyo*dt;if(p.yo>=0){p.yo=0;splash(p.x);}}
          else if(p.yo===0&&Math.random()<dt*4)parts.push({k:'spray',x:p.x-dir*3,y:wave(p.x),vx:-dir*rnd(4,14),vy:rnd(-14,-4),life:.4,max:.5,r:1});}
        else{if(p.yo<0){p.vyo+=260*dt;p.yo+=p.vyo*dt;if(p.yo>=0){p.yo=0;splash(p.x);}}p.dvx*=Math.exp(-1.4*dt);}
        p.x+=(p.dvx+M.wind*.03)*dt;p.y=wave(p.x)+1+p.yo;}
      let r=p.v?(p.v.fire?p.v.fire/120:p.v.type==='raft'?1/600:1/900):1/200*M.temp;
      r*=(1+M.rain*.3+(M.snow?.3:0))*(p.state==='ready'?.5:1);if(!M.tut)p.hp-=(r*(p.kind==='uncon'?2:p.kind==='child'?1.4:1)+(p.oil?.035:0))*dt*(M.camp!=null&&M.land==='cutter'?(X.del1?.1:.4):1);
      if(p.hp<=0){p.state='lost';p.lostT=T;p.inW=!p.v;if(sw.target===p){sw.target=null;if(sw.state==='with')sw.state='swim';}say('Hemos perdido a una víctima.',5);}
    }else if(p.state==='hook'){p.x=hook.x;p.y=hook.y;}
  }
  if(sw.state==='fall'){sw.vy+=520*dt;sw.y+=sw.vy*dt;if(sw.y>=wave(sw.x)){sw.state='swim';splash(sw.x);}}
  else if(sw.state==='hook'||sw.state==='riding'){sw.x=hook.x;sw.y=hook.y;
    if(sw.state==='hook'&&hook.onSurf&&overSea(hook.x)){sw.state='swim';sw.onV=vesselAt(sw.x);say('Nadador en posición.',2);}
    if(sw.state==='riding'&&hook.L<=8){sw.state='aboard';sw.recall=false;hook.load=null;say('Nadador a bordo. Cierra la puerta (D) y a casa.',4);}}
  else if(sw.state==='swim'){
    if(!sw.target||sw.target.state!=='wait'){sw.target=null;if(room()&&!sw.recall){let bd=1e9;for(const p of surv)if(p.state==='wait'){const d=Math.abs(p.x-sw.x)-(p.kind==='uncon'?500:p.kind==='hurt'?150:0);if(d<bd){bd=d;sw.target=p;}}}}
    if(!sw.target&&xFreeTarget()){}else if(!sw.target){sw.state='await';say(surv.some(p=>p.state==='wait')?'Nadador: cabina llena, espero el gancho.':'Nadador: listo para el izado.',4);}
    else{const t=sw.target,d=t.x-sw.x;const sp=(sw.slow?40:58)*(sw.sta<.25?.5:1)*(sw.struggle>0?0:1);sw.x+=clamp(d,-sp*dt,sp*dt);
      sw.onV=t.v&&Math.abs(sw.x-t.v.x)<t.v.half?t.v:null;sw.y=sw.onV?deckY(sw.onV,sw.x-sw.onV.x):wave(sw.x)+1;
      if(Math.abs(d)<5&&xReach(t)){t.state='ready';sw.state='with';say(t.kind==='hurt'||t.kind==='uncon'?'Nadador: herido asegurado en camilla. Izad despacio.':'Nadador: víctima asegurada. Bajad la cesta.',4);}}
  }
  else if(sw.state==='with'){const t=sw.target;if(!t||t.state!=='ready'){sw.state='swim';sw.target=null;}else{sw.x=t.x-7;sw.y=t.y;sw.onV=t.v;}}
  else if(sw.state==='await'){if(sw.onV&&(sw.onV.gone||sw.onV.sink>=.8))sw.onV=null;if(!sw.onV){sw.x+=M.wind*.03*dt;
      // in the water he never stays under a hull, where the hook cannot reach him: he kicks clear to the nearer side, even when spent
      for(const v of vessels){if(v.gone||v.sit||v.type==='raft'||v.sink>=.8)continue;const o=sw.x-v.x,lim=v.half+14;if(Math.abs(o)<lim){const sd=o>=0?1:-1;sw.x+=sd*Math.min(lim-Math.abs(o),clamp(v.half*.2,30,70)*(sw.sta>.05?1:.75)*dt);if(!sw.clr&&note.life<=0){sw.clr=1;say('Nadador: me aparto del casco para el gancho.',3);}}}}else sw.clr=0;
    sw.y=sw.onV?deckY(sw.onV,sw.x-sw.onV.x):wave(sw.x)+1;
    sw.think-=dt;if(sw.think<0){sw.think=1;if(!sw.recall&&room()&&sw.sta>.3&&surv.some(p=>p.state==='wait'||p.state==='trap'))sw.state='swim';}}
  if(!h.dead&&!hook.load&&hook.L>14&&sw.state!=='hook'){
    for(const p of surv){if(p.state!=='ready'&&p.state!=='wait')continue;if(p.state==='wait'&&(p.kind==='hurt'||p.kind==='uncon'))continue;const tol=p.state==='ready'?16:7;
      if(p.state==='wait'&&sw.state!=='gone'){if(Math.abs(p.x-hook.x)<tol&&Math.abs(p.y-7-hook.y)<tol+7&&note.life<=0)say('Sin el nadador no puede engancharse. Envía al nadador.',3);continue;}
      if(Math.abs(p.x-hook.x)<tol&&Math.abs(p.y-7-hook.y)<tol+7){
        if(aboard.length>=S.cap){if(note.life<=0)say('Cabina llena. Lleva a las víctimas a Kodiak.',3);break;}
        p.state='hook';hook.load=p;rumble('latch');say('Víctima en la cesta. Iza con W.',3);break;}}
    if(!hook.load&&sw.state==='await'&&Math.abs(sw.x-hook.x)<16&&Math.abs(sw.y-7-hook.y)<24){sw.state='riding';hook.load=sw;rumble('latch');say('Nadador enganchado. Iza con W.',3);}
  }
  if(hook.load&&hook.load!==sw&&hook.L<=8){hook.load.state='aboard';aboard.push(hook.load);hook.load=null;
    const left=surv.filter(p=>p.state==='wait'||p.state==='ready').length;say(`Víctima a bordo (${aboard.length}/${S.cap}). ${left?'Quedan '+left+'.':'No queda nadie en la zona.'}`,4);}
  if(!h.dead&&overSea(h.x)){const a=wave(h.x)-(h.y+S.belly);if(a<210){const st=1-a/210,RR=S.rotR*(1.05+.5*(1-st));let n=dt*3800*st*st;
    while(Math.random()<n){n--;const s=Math.random()<.5?-1:1,x=h.x+s*(RR+rnd(-10,12));parts.push({k:'spray',x,y:wave(x)-1,vx:s*rnd(30,190)*st,vy:rnd(-150,-10)*st,life:rnd(.3,1),max:1,r:1});}
    let n2=dt*1900*st*st;while(Math.random()<n2){n2--;const x=h.x+rnd(-1,1)*RR;parts.push({k:'spray',x,y:wave(x),vx:(x-h.x)*rnd(.6,1.6),vy:rnd(-26,-4),life:rnd(.2,.5),max:.5,r:1});}}}
  for(const r of rogues)if(r.env>.5){let n=dt*700*r.env;while(Math.random()<n){n--;const x=r.x+rnd(-1,1)*r.w*.5;parts.push({k:'spray',x,y:wave(x),vx:r.v*rnd(.5,1.1)+rnd(-20,20),vy:rnd(-70,-5),life:rnd(.4,1.1),max:1.1,r:1});}}
  {let n=dt*(30+M.sea*80);const th=-(SEA.a+SEA.s)*.5;while(Math.random()<n){n--;const x=camX+rnd(0,VW),y=wave(x);if((x>360||x<WXS-20)&&y<th&&y<wave(x-6)&&y<=wave(x+6))for(let i=0;i<7;i++)parts.push({k:'spray',x:x+rnd(-8,8),y,vx:M.wind*.5+rnd(-22,22),vy:rnd(-40,-4),life:rnd(.3,.9),max:.9,r:1});}}
  for(const p of parts){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;if(p.k==='spray')p.vy+=160*dt;else if(p.k==='smoke'){p.vx+=((M.wind*.5-p.vx)*.5+Math.sin(p.y*.05+T*2+(p.s||0))*(8+(1-p.life/p.max)*30))*dt;p.vy+=(-16-p.vy)*.5*dt;}else if(p.k==='ember')p.vy+=40*dt;else if(p.k==='mist'){p.vx*=1-dt*1.5;p.r+=dt*3;}else p.vx+=Math.sin(T*9+p.y)*30*dt;}
  if(parts.length>18000)parts.splice(0,parts.length-18000);
  parts=parts.filter(p=>p.life>0);
  for(const f of flares){f.life-=dt;f.vy+=(14-f.vy)*1.4*dt;f.vx+=(M.wind*.2-f.vx)*.8*dt;f.x+=f.vx*dt;f.y+=f.vy*dt;if(f.y>wave(f.x))f.life=0;}
  flares=flares.filter(f=>f.life>0);
  if(note.life>0)note.life-=dt;
  for(const k of'ps')if(bub[k]&&(bub[k].life-=dt)<=0)bub[k]=null;
  for(const p of surv)if(p.state==='wait'&&p.kind!=='uncon'){p.talk=(p.talk??rnd(2,9))-dt;if(p.talk<=0){p.talk=rnd(6,14);if(Math.abs(p.x-h.x)<430&&shouts.length<2)shouts.push({p,t:pick(p.lines||['¡Socorro!','¡Ayuda!','¡Aquí!','¡Aquí, aquí!','¡Por favor!']),life:p.lines?2.6:1.8});}}
  for(const s of shouts)s.life-=dt;shouts=shouts.filter(s=>s.life>0&&(s.p.state==='wait'||s.p.state==='ready'));
}
function splash(x){for(let i=0;i<130;i++)parts.push({k:'spray',x,y:wave(x),vx:rnd(-60,60),vy:rnd(-120,-40),life:.7,max:.7,r:1});}
function baseUpdate(dt){
  const b=base,m=b.med,h=heli;
  for(const w of b.walk){if(w.d>0){w.d-=dt;continue;}w.x-=34*dt;if(w.x<=b.ambX+52)w.done=1;}
  b.walk=b.walk.filter(w=>!w.done);
  // the ambulance is called only when the helicopter is inbound with victims aboard
  if(b.amb==='away'){if(aboard.length&&h.x<700&&!h.on){b.amb='coming';b.ax=-560;say('Kodiak: ambulancia en camino a la plataforma.',4);}}
  else if(b.amb==='coming'){b.ax=Math.min(0,b.ax+(b.ax<-70?130:55)*dt);if(b.ax>=0){b.amb='parked';m.state='wait';m.x=b.ambX+68;}}
  else if(b.amb==='leaving'){b.av+=70*dt;b.ax-=b.av*dt;if(b.ax<-600){b.amb='away';b.av=0;}}
  const go=(tx,sp)=>{const d=tx-m.x;m.x+=clamp(d,-sp*dt,sp*dt);return Math.abs(d)<1;};
  if(b.amb==='parked'){
    if(m.state==='wait'){if(h.landed&&aboard.length&&h.door>.9){m.state='go';say('Los sanitarios salen con la camilla.',3);}}
    else if(m.state==='go'){if(!h.landed)m.state='ret';else if(go(h.x+h.dir*h.spec.doorMid-10,62)){m.state='load';m.t=1;}}
    else if(m.state==='load'){m.t-=dt;if(m.t<=0){aboard.sort((a,c)=>a.hp-c.hp);m.load=aboard.shift();m.load.state='safe';
        aboard.forEach((p,i)=>{p.state='safe';b.walk.push({x:m.x+14,d:.6+i*.7,ph:i});});const n=aboard.length;aboard.length=0;m.state='back';
        say(n?`Una víctima en camilla; ${n} más van por su pie a la ambulancia.`:'Víctima en la camilla, camino de la ambulancia.',4);}}
    else if(m.state==='back'){if(go(b.ambX+68,44)){m.state='stow';m.t=1.1;}}
    else if(m.state==='stow'){m.t-=dt;if(m.t<=0&&!b.walk.length){m.load=null;m.state='in';b.amb='leaving';b.av=0;
        const left=surv.filter(p=>!['safe','lost'].includes(p.state)).length;if(left)say(`La ambulancia sale hacia el hospital. Quedan ${left} en la zona.`,5);}}
    else if(m.state==='ret'){if(go(b.ambX+68,50))m.state='wait';}
  }
  if(!endT&&h.landed&&!aboard.length&&(b.amb==='away'||b.amb==='leaving'||h.on)&&!b.walk.length&&sw.state==='aboard'&&clock>3&&surv.every(p=>p.state==='safe'||p.state==='lost')){
    const saved=surv.filter(p=>p.state==='safe').length;endInfo={};
    if(saved){banner=saved===surv.length?'MISIÓN CUMPLIDA':'RESCATE PARCIAL';endT=4.6;}else endT=1;}
}
function finish(){
  if(M.camp===0&&endInfo.fail&&vessels[0]&&Math.abs(heli.x-vessels[0].x)<800){cutStart();return;}
  const saved=surv.filter(p=>p.state==='safe').length,lost=surv.filter(p=>p.state==='lost').length,tot=surv.length,fail=endInfo.fail;
  const mm=Math.floor(clock/60),ss=String(Math.floor(clock%60)).padStart(2,'0');
  const score=fail?saved*500:Math.max(0,Math.round(saved*1000-lost*400-clock*2+heli.fuel));
  $('#endTitle').textContent=tr(fail?'Aeronave perdida':saved===tot?(M.tut?'Tutorial completado':'Misión cumplida'):saved?'Rescate parcial':'Misión fallida');
  $('#endSub').textContent=`${M.name} · ${heli.spec.name}`;
  $('#endStats').innerHTML=`<div><b>${saved}/${tot}</b><small>${tr('A salvo')}</small></div><div><b>${lost}</b><small>${tr('Perdidos')}</small></div><div><b>${mm}:${ss}</b><small>${tr('Tiempo')}</small></div><div><b>${score}</b><small>${tr('Puntos')}</small></div>`;
  $('#endTxt').textContent=fmtInputHints(fail?tr(fail)+tr(' Vuela más despacio cerca del agua, vigila las olas grandes y baja el tren (G) antes de tomar en Kodiak.'):tr(saved===tot?'Todos entregados a la ambulancia en Kodiak. Buen trabajo, tripulación.':'El frío del golfo de Alaska no perdona: en el agua cada segundo cuenta.'),false);$('#rpBtn').hidden=REC.f.length<40;
  gFinish(saved,tot,fail,score);xFinish(saved,lost,tot,fail);campFinish(saved,tot,fail);state='end';banner='';$('#pad').hidden=true;$('#end').hidden=false;$('#again').focus();
}

// ---------- main menu flow, Kodiak watch, hangar briefing ----------
let briefT=0,briefM=0,cfgCur=null,guard={on:false,n:0,pts:0,sv:0,ls:0},BR=null,BL_=[],BT_=[];
function showOnly(id){for(const k of['camp','card','title','main','menu','credits','brf','end','pause','photo','rp'])$('#'+k).hidden=k!==id;if(id)$('#pad').hidden=true;}
function gBest(){let b={};try{b=JSON.parse(localStorage.getItem('rkGuard')||'{}');}catch(e){}return{n:b.n||0,pts:b.pts||0,sv:b.sv||0,ls:b.ls||0};}
function gSave(){const b=gBest();if(guard.pts>b.pts){try{localStorage.setItem('rkGuard',JSON.stringify({n:guard.n,pts:guard.pts,sv:guard.sv,ls:guard.ls}));}catch(e){}return true;}return false;}
function toMain(){CUT.on=false;FIN.on=false;EPI.on=false;if(guard.on){gSave();guard.on=false;}xLog();sndUpdate();state='menu';banner='';paused=false;PH.on=false;showOnly('main');const b=gBest(),sv=gsGet(),cb=$('#mCont');
  $('#rec').textContent=b.pts||b.n?tr(`Mejor guardia: ${b.n} avisos atendidos · ${b.sv} vidas salvadas · ${b.ls} no rescatados · ${b.pts} puntos.`):tr('Todavía no has hecho ninguna guardia.');
  {const n=campGet();$('#mCampS').innerHTML='So others may live'+(n>=CAMP.length?' · '+tr('Campaña completada'):n>0?' · '+tr(`Misión ${n+1}`):'')+'<br><span style="font-size:11px;opacity:.8">'+tr('9 misiones · 1 h 15 min aprox.')+'</span>';}
  cb.hidden=!sv;if(sv)cb.innerHTML=`${tr('Continuar guardia')}<small>${tr(`Aviso ${sv.n+1} · ${sv.sv} vidas salvadas · ${sv.pts} puntos`)}</small>`;
  $('#mGuard').className=sv?'big alt':'big';$('#mGuard').innerHTML=sv?`${tr('Nueva guardia')}<small class="tag">${tr('Modo infinito')}</small><small>${tr('Empieza de cero y borra la guardia guardada.')}</small>`:`${tr('Guardia en Kodiak')}<small class="tag">${tr('Modo infinito')}</small><small>${tr('Avisos al azar, uno tras otro y cada vez más duros. ¿Cuántas vidas salvarás?')}</small>`;}
// the watch in progress is kept in the browser so it can be picked up later, at the call it had reached
function gsGet(){try{const q=JSON.parse(localStorage.getItem('rkGuardSave')||'null');return q&&q.n>=0?q:null;}catch(e){return null;}}
function gsPut(){try{localStorage.setItem('rkGuardSave',JSON.stringify({n:guard.n,pts:guard.pts,sv:guard.sv,ls:guard.ls}));}catch(e){}}
function gsClear(){try{localStorage.removeItem('rkGuardSave');}catch(e){}}
function guardCont(){const q=gsGet();if(!q)return;guard={on:true,n:q.n,pts:q.pts||0,sv:q.sv||0,ls:q.ls||0};toBrief(randomCfg(guard.n));}
function toMenu(){guard.on=false;xLog();sndUpdate();state='menu';banner='';paused=false;PH.on=false;showOnly('menu');}
function randomCfg(lv){const f=getCfg(),P=pick,c={...DEF,heli:f.heli,mode:f.mode,snd:f.snd,aids:f.aids,bars:f.bars,crash:f.crash,dyn:f.dyn};
  c.ves=P(lv<2?['kayak','zodiac','sail','fishing','yacht']:['zodiac','sail','fishing','fishing','yacht','crab','crab','container','tanker']);
  c.cond=P(lv<1?['drift','list']:['drift','list','fire','sink','both','fire']);
  c.deck=1+(Math.random()*Math.min(4,1+lv)|0);c.water=Math.random()*Math.min(4,1+lv*.6)|0;c.rafts=Math.random()<.3?1:0;c.per=1+(Math.random()*2|0);
  c.dist=5+(Math.random()*6|0);c.hour=Math.random()*24|0;c.cycle='1';c.sea=String(Math.min(4,(lv*.5|0)+(Math.random()*2|0)));c.rogue=String(Math.min(2,(lv/3|0)+(Math.random()<.4?1:0)));
  c.wind=Math.min(60,8+lv*4+(Math.random()*14|0));c.wdir=P(['w','w','e']);c.gust=String(Math.min(4,(lv/2|0)+(Math.random()<.5?1:0)));
  c.wx=P(lv<2?['clear','clear','cloud']:['clear','cloud','rain','storm','fog','snow']);c.temp=P(['.6','1','1','1.6']);
  c.search=lv>2&&Math.random()<.4?'1':'0';c.fail=lv>3&&Math.random()<.4?'1':'0';c.triage=lv>1&&Math.random()<.5?'1':'0';c.panic=lv>2&&Math.random()<.4?'1':'0';
  c.trapped=lv>4&&Math.random()<.35?1:0;c.boom=lv>2&&Math.random()<.5?'1':'0';c.obst='none';c.land='base';c.ves2='none';return c;}
function tutStart(){guard.on=false;const f=getCfg();toBrief({...DEF,heli:'jayhawk',mode:'jump',ves:'rbmv',cond:'drift',deck:1,water:1,rafts:1,per:1,ves2:'none',dist:4,hour:12,cycle:'0',sea:'0',rogue:'0',wind:4,gust:'0',wdir:'w',wx:'clear',temp:'.6',birds:'8',search:'0',fail:'0',triage:'0',panic:'0',trapped:1,boom:'0',obst:'none',land:'base',snd:f.snd,aids:'1',bars:'1',crash:'0',fuel:'0',flares:6,tut:1});}
function guardStart(){guard={on:true,n:0,pts:0,sv:0,ls:0};toBrief(randomCfg(0));}
function guardNext(){toBrief(randomCfg(guard.n));}
function toBrief(c){$('#endTxt').classList.remove('story');if(guard.on)gsPut();debris=[];cfgCur=c;M=buildMission(c);briefM=1;H=M.hour;mode=c.mode;briefT=0;heli=null;vessels=[];surv=[];parts=[];puffs=[];flares=[];rogues=[];envT=-9;makeClouds();
  const v=M.vessels[0],tot=M.vessels.reduce((a,q)=>a+q.crew,0)+M.water.length+(VT[v.type].half>40?M.trapN:0),rafts=M.vessels.filter(q=>q.type==='raft').length;
  const rk=[];if(M.gust>1)rk.push(getLang()==='en'?LBL('gust',M.gust).toLowerCase()+' gusts':'ráfagas '+LBL('gust',M.gust).toLowerCase());if(M.rogue)rk.push('olas grandes');if(M.search)rk.push('posición incierta');if(M.triage)rk.push('hay heridos');if(M.trapN&&VT[v.type].half>40)rk.push('gente atrapada a bordo');
  if(M.boom&&(v.cond==='fire'||v.cond==='both'))rk.push('riesgo de explosión');if(M.fail)rk.push('aeronave con averías pendientes');if(M.land==='fog')rk.push('niebla en Kodiak al regreso');if(M.land==='cutter')rk.push('guardacostas disponible a medio camino');
  const raw=getLang()==='en'?[`${guard.on?'Call '+(guard.n+1)+': ':''}${tr(VT[v.type].n)} ${LBL('cond',v.cond).toLowerCase()}, ${c.dist} NM ${M.west?'west':'east'} of Kodiak.`,
    `${tot} ${tot===1?'person':'people'}: ${v.crew} on deck, ${M.water.length} in the water${rafts?', '+rafts+(rafts>1?' rafts':' raft'):''}.`,
    `Sea: ${LBL('sea',M.sea).toLowerCase()}. Wind ${c.wind} kt from the ${c.wdir==='e'?'east':'west'}. ${LBL('wx',M.wx)}.`,
    rk.length?'Caution: '+rk.map(tr).join(', ')+'.':'No added risks.',
    `Departure ${String(M.hour).padStart(2,'0')}:00 AKDT. ${HELIS[c.heli].name}. Swimmer: ${c.mode==='jump'?'free jump':'lowered on the hoist'}.`]:[`${guard.on?'Aviso '+(guard.n+1)+': ':''}${VT[v.type].n} ${LBL('cond',v.cond).toLowerCase()}, a ${c.dist} NM al ${M.west?'oeste':'este'} de Kodiak.`,
    `${tot} persona${tot===1?'':'s'}: ${v.crew} en cubierta, ${M.water.length} en el agua${rafts?', '+rafts+(rafts>1?' balsas':' balsa'):''}.`,
    `Mar: ${LBL('sea',M.sea).toLowerCase()}. Viento ${c.wind} kt del ${c.wdir==='e'?'este':'oeste'}. ${LBL('wx',M.wx)}.`,
    rk.length?'Atención: '+rk.join(', ')+'.':'Sin riesgos añadidos.',
    `Salida ${String(M.hour).padStart(2,'0')}:00 AKDT. ${HELIS[c.heli].name}. Nadador: ${c.mode==='jump'?'salto libre':'bajada con la grúa'}.`];
  BL_=[];for(const l of raw){let cur='';for(const w of l.split(' ')){if(cur&&(cur+' '+w).length>Math.floor((VW-44)/7.6)){BL_.push(cur);cur=w;}else cur=cur?cur+' '+w:w;}BL_.push(cur);}
  // what people in the hangar say depends on the job
  const fire=v.cond==='fire'||v.cond==='both',sink=v.cond==='sink'||v.cond==='both',night=M.hour>=21||M.hour<5,big=VT[v.type].half>140,cm=[];
  if(fire)cm.push('El barco estará en llamas.');if(sink)cm.push('Se hunde. No hay tiempo que perder.');if(v.cond==='list')cm.push('Va muy escorado, puede volcar.');
  if(+c.wind>=25)cm.push('Habrá mucho viento ahí fuera.');if(M.gust>1)cm.push('Ojo con las ráfagas en el estacionario.');if(M.sea>=3)cm.push('Con esa mar la cesta va a bailar.');else if(M.sea<=1)cm.push('La mar está tranquila. Eso ayuda.');
  if(M.rogue)cm.push('Vigilad las olas grandes.');if(night)cm.push('De noche: foco y bengalas.');if(M.wx==='fog')cm.push('Con niebla no veremos nada.');if(M.wx==='snow')cm.push('Cuidado con el hielo en las palas.');if(M.wx==='storm')cm.push('Hay tormenta eléctrica en la zona.');if(M.wx==='rain')cm.push('Lloverá todo el camino.');
  if(M.water.length)cm.push(`${M.water.length} en el agua. Saltamos primero a por ellos.`);if(v.crew)cm.push(`${v.crew} esperan en cubierta.`);if(rafts)cm.push('Hay una balsa. Aguantarán más.');
  if(M.temp>1)cm.push('El agua está gélida. Cada minuto cuenta.');if(M.triage)cm.push('Llevad la camilla: hay heridos.');if(M.trapN&&VT[v.type].half>40)cm.push('Alguien sigue dentro del casco.');if(M.search)cm.push('No tenemos posición exacta.');
  if(M.boom&&fire)cm.push('Si va a explotar, nos apartamos.');if(M.fail)cm.push('La aeronave arrastra averías.');if(+c.dist>=10)cm.push('Está lejos. Vigilad el bingo.');if(big)cm.push('Ese barco es enorme. Ojo a las grúas.');if(v.type==='kayak')cm.push('Un kayak: costará verlo.');
  if(M.land==='fog')cm.push('Habrá niebla en Kodiak a la vuelta.');if(M.land==='cutter')cm.push('El guardacostas nos espera a medio camino.');
  const who=[1,4,2,5,3,6,8,1,4,2,5,3];BT_=[[0,'Atención, tripulación. Tenemos un aviso.']];cm.forEach((t,i)=>BT_.push([i%3===2?0:who[i%who.length],t]));
  BT_.push([7,`El ${HELIS[c.heli].call.split(' ')[1]} está repostado y listo.`],[5,'Listo para saltar.'],[0,'A los helicópteros. So others may live.'],[3,'¡Semper Paratus!']);
  if(c.camp!=null){const cm2=CAMP[c.camp];BL_=[];for(const l of cm2.story.map(tr)){let cur='';for(const w of l.split(' ')){if(cur&&(cur+' '+w).length>Math.floor((VW-44)/7.6)){BL_.push(cur);cur=w;}else cur=cur?cur+' '+w:w;}BL_.push(cur);}BT_=cm2.talk.map(q=>[q[0],q[1]]);}
  state='brief';showOnly('brf');$('#brf').hidden=true;BRdone=false;}
function gFinish(saved,tot,fail,score){const G=guard,nx=$('#nextG'),ag=$('#again'),tm=$('#toMenu');
  if(!G.on){nx.hidden=true;ag.hidden=false;tm.hidden=false;return;}
  G.pts+=score;G.sv+=saved;G.ls+=surv.filter(p=>p.state==='lost').length+(fail?surv.filter(p=>p.state!=='lost'&&p.state!=='safe').length:0);if(!fail)G.n++;ag.hidden=true;tm.hidden=true;
  if(fail){nx.hidden=true;const rec=gSave();gsClear();$('#endTitle').textContent=tr('Fin de la guardia');$('#endSub').textContent=tr(`${G.n} avisos atendidos · ${G.sv} vidas salvadas · ${G.ls} no rescatados · ${G.pts} puntos`)+(rec?tr(' · nuevo récord'):'');G.on=false;}
  else{nx.hidden=false;gsPut();$('#endSub').textContent=tr(`Guardia en Kodiak · aviso ${G.n} completado · ${G.sv} vidas salvadas · ${G.pts} puntos`);}}
function briefStatic(){
  const DX=clamp(Math.round(VW*.55),352,400),fl=VH-84,ce=fl-124,fb=fl,c=document.createElement('canvas');c.width=DX+14;c.height=VH;const g=c.getContext('2d'),R=(col,x,y,w,h)=>{g.fillStyle=col;g.fillRect(Math.round(x),Math.round(y),w,h);};
  // tall (portrait) screens: the hangar is cut away a little above the trusses; above it the building is seen from outside
  const TOP=ce-50>=40?ce-50:0,X=TOP?hangarOutside(DX,TOP):null;
  // roof structure with trusses
  R('#141a1f',0,TOP,DX+2,ce-TOP);for(let y=TOP+6;y<ce-52;y+=14)R('#1b2228',0,y,DX+2,1);
  if(TOP){R('#0b0e11',0,TOP,DX+2,2);R('#262f36',0,TOP+2,DX+2,1);for(let x=0;x<DX;x+=24){R('#20282e',x,TOP+3,2,5);R('#20282e',x+2,TOP+3,1,3);}}
  for(let x=-24;x<DX;x+=48)for(let i=0;i<50;i++){R('#2a343d',x+i*.48,ce-i,2,1);R('#2a343d',x+48-i*.48,ce-i,2,1);}
  R('#34414b',0,ce-3,DX+2,4);R('#2a343d',0,ce-52,DX+2,3);
  // far wall
  R('#55616a',0,ce,DX,fb-ce);for(let x=2;x<DX;x+=5)R('#4c5860',x,ce+2,1,fb-ce-2);R('#465158',0,fb-14,DX,14);R('#f2c22e',0,fb-15,DX,1);
  for(let x=16;x<DX-30;x+=44){R('#243038',x-1,ce+9,30,14);R('#9fb6c4',x,ce+10,28,12);R('#c4d6de',x,ce+10,28,3);R('#243038',x+13,ce+10,1,12);}
  for(let i=0;i<26;i++){R(O,100+Math.round((26-i)*.42),ce+30+i,10,1);R(BL,114+Math.round((26-i)*.42),ce+30+i,3,1);}
  txt(R,'#e8ecec','U.S. COAST GUARD',136,ce+31,2);txt(R,'#aab4b8','AIR STATION KODIAK',136,ce+45);txt(R,'#f2c22e','SEMPER PARATUS',136,ce+53);
  // the Coast Guard standard, hung square on the wall
  R('#3d474e',28,ce+28,48,2);R('rgba(0,0,0,.2)',32,ce+32,44,44);R('#f1efe8',30,ce+30,44,44);R('#dcdad2',30,ce+70,44,4);for(let i=0;i<44;i++){R(O,34+Math.round((44-i)*.3),ce+30+i,6,1);R(BL,42+Math.round((44-i)*.3),ce+30+i,2,1);}
  for(let y=-8;y<=8;y++){const w=Math.round(Math.sqrt(64-y*y));R(BL,58-w,ce+50+y,w*2,1);}for(let y=-5;y<=5;y++){const w=Math.round(Math.sqrt(25-y*y));R('#f1efe8',58-w,ce+50+y,w*2,1);}R(RB,56,ce+47,4,6);R(BL,54,ce+49,8,2);
  txt(R,BL,'USCG',51,ce+34);txt(R,BL,'1790',51,ce+64);
  // floor, receding in bands
  R('#7d8589',0,fb,DX+14,VH-fb);R('#747c80',0,fb+9,DX+14,VH);R('#6a7276',0,fb+24,DX+14,VH);R('#60686c',0,fb+46,DX+14,VH);R('#565e62',0,fb+70,DX+14,VH);
  R('#8a9296',0,fb,DX,1);R(Y,0,fl+24,DX-12,1);for(let y=fb;y<VH;y+=6){R(Y,DX-12,y,4,3);R(K,DX-12,y+3,4,3);}
  // ---- back of the hangar: exit door, lockers, notice board, clock, stores
  for(const s of[[32,56],[142,40],[196,48],[268,27],[11,13],[185,7],[297,7]]){R('rgba(0,0,0,.3)',s[0]+1,fb,s[1]+2,2);R('rgba(0,0,0,.3)',s[0]+3,fb+2,s[1]-2,1);}
  R('#3d474e',11,fb-20,13,20);R('#7d8a92',12,fb-19,11,19);R(GL,14,fb-16,4,5);R(K,20,fb-10,1,2);R('#2f9d5a',10,fb-26,15,5);for(let i=0;i<4;i++)R(W,12+i*3,fb-24,2,1);
  for(let i=0;i<8;i++){const x=32+i*7;R(i%2?'#7d8a92':'#8f9aa0',x,fb-18,6,18);R('#5f6c75',x,fb-18,1,18);R('#5f6c75',x+2,fb-16,3,1);R('#5f6c75',x+2,fb-14,3,1);R(K,x+4,fb-9,1,2);}
  R(W,34,fb-21,4,3);R(Y,45,fb-21,4,3);R('#d7ff3f',59,fb-21,4,3);R(W,73,fb-21,4,3);
  R('#8a6a4a',94,fb-24,26,15);R('#c9a070',95,fb-23,24,13);R(W,97,fb-22,6,7);R(W,105,fb-22,5,4);R(Y,112,fb-22,5,6);R(W,105,fb-16,8,5);R(RB,98,fb-21,1,1);R(RB,114,fb-21,1,1);
  R('#3d474e',126,fb-33,9,9);R('#e8ecec',127,fb-32,7,7);R(K,130,fb-31,1,3);R(K,130,fb-29,2,1);
  R('#3d474e',142,fb-32,2,32);R('#3d474e',180,fb-32,2,32);
  for(let k=0;k<3;k++){const y=fb-30+k*10;R('#3d474e',142,y+8,40,2);
    if(k===0){for(const x of[145,154,163,172])R('#f36f21',x,y+1,7,7);for(const x of[145,154,163,172])R('#b8501a',x,y+4,7,1);}
    if(k===1){R(Y,145,y+2,6,6);R('#3d474e',147,y+4,2,2);R(RB,154,y+2,9,6);R(W,156,y+4,5,1);R(K,166,y+1,6,7);R('#3cff7a',167,y+3,1,1);R('#c9ccc8',174,y+3,6,5);}
    if(k===2){R('#f36f21',145,y+1,5,7);R('#f36f21',152,y+1,5,7);R('#f36f21',159,y+1,5,7);R(W,167,y+3,5,5);R(W,174,y+3,5,5);}}
  R(RB,188,fb-13,3,9);R(K,189,fb-15,1,2);
  R('#6b4f38',196,fb-2,48,2);for(let i=0;i<6;i++){const x=198+i*7;R([RB,BL,RB,Y,BL,RB][i],x,fb-12,6,10);R('#c9ccc8',x,fb-9,6,1);R('#c9ccc8',x,fb-5,6,1);}
  R(Y,206,fb-24,9,8);R(K,210,fb-22,1,3);R(K,210,fb-18,1,1);
  R('#f36f21',252,fb-28,9,9);R('#55616a',255,fb-25,3,3);R(W,255,fb-28,3,2);R(W,255,fb-21,3,2);R(W,252,fb-25,2,3);R(W,259,fb-25,2,3);
  R('#8f6a4a',268,fb-13,13,13);R('#6b4f38',268,fb-7,13,1);R('#8f6a4a',282,fb-13,13,13);R('#6b4f38',288,fb-13,1,13);R('#8f6a4a',274,fb-24,13,11);R('#6b4f38',274,fb-19,13,1);
  R('#f36f21',300,fb-30,3,30);R(GR,300,fb-30,1,30);R(GR,299,fb-24,5,1);R(GR,299,fb-8,5,1);
  R('#3d474e',198,fb-44,2,6);R('#3d474e',296,fb-44,2,6);for(let k=0;k<3;k++){R('#2c323a',194,fb-46+k*3,108,2);R(Y,194,fb-46+k*3,3,2);}
  for(let d=0;d<46;d++){g.globalAlpha=.2*(1-d/46);g.drawImage(c,0,fb-1-d,DX-12,1,0,fb+1+d,DX-12,1);}g.globalAlpha=1;
  for(let x=58;x<DX-20;x+=108)for(let d=0;d<56;d++)R(`rgba(255,243,190,${(.06*(1-d/56)).toFixed(3)})`,x-7-(d>>3),fb+5+d,15+(d>>2),1);
  // hangar front above the door, lamps
  const PC=TOP?['#4f585f','#454e55','#363d43','#2e353a']:['#aeb8bd','#9ca7ad','#75838c','#5f6c75'];R(PC[0],DX,TOP,14,ce+6-TOP);for(let y=TOP+4;y<ce;y+=5)R(PC[1],DX,y,14,1);R(PC[2],DX,ce+4,14,3);R(PC[3],DX,TOP,1,ce+6-TOP);
  for(let x=58;x<DX;x+=108){R('#2a343d',x,ce,1,10);R('#3d474e',x-5,ce+10,11,3);R('#fff3b0',x-3,ce+13,7,1);}
  return{c,DX,fl,ce,fb,w:VW,h:VH,top:TOP,x:X};
}
// the hangar seen from outside, above the cut-away: clad side wall with the station sign, eaves, and a detailed metal roof
function hangarOutside(DX,TOP){const W1=DX+14,W2=W1,c=document.createElement('canvas');c.width=W2;c.height=TOP;const g=c.getContext('2d'),R=(col,x,y,w,h)=>{g.fillStyle=col;g.fillRect(Math.round(x),Math.round(y),w,h);};
  const RH=26,wy=TOP,ry=wy-RH;
  // roof plane straight above the trusses: dark standing-seam metal, darker towards the eave, ridge cap
  for(let y=0;y<RH-4;y++){const k=y/(RH-4);R(`rgb(${(58+k*22)|0},${(65+k*21)|0},${(71+k*20)|0})`,0,wy-4-y,W1,1);}
  for(let x=2;x<W1-1;x+=6){R('#363d43',x,ry+4,1,RH-8);R('#626b72',x+1,ry+4,1,RH-8);}
  R('#2e353a',0,ry+2,W1,2);R('#7a838a',0,ry+1,W1,1);R('#30373c',0,ry,W1,1);
  R('#30373c',0,wy-4,W1,4);R('#4a535a',0,wy-4,W1,1);R('#1f2428',0,wy-1,W1,1);
  // skylights
  for(let x=30;x<W1-60;x+=72){R('#2a333a',x,ry+8,30,8);R('#6f889a',x+1,ry+9,28,6);R('#98b2c0',x+1,ry+9,28,2);for(let k=1;k<4;k++)R('#2a333a',x+k*7.5,ry+9,1,6);}
  // on the ridge: extractor vents, an air-con unit, a radio mast with a red obstruction light
  for(const x of[14,W1*.47|0]){R('#3a4248',x,ry-6,8,6);R('#5a636a',x,ry-6,8,1);R('#262c31',x-1,ry-8,10,2);}
  {const x=W1*.62|0;R('#4f585f',x,ry-10,26,10);R('#687178',x,ry-10,26,1);R('#262c31',x+3,ry-8,8,6);for(let k=0;k<3;k++)R('#3a4248',x+4+k*3,ry-7,1,4);R('#3f474d',x+15,ry-7,8,5);}
  {const x=W1-52;R('#9aa1a6',x,ry-34,1,34);for(let k=0;k<3;k++)R('#9aa1a6',x-3,ry-28+k*9,7,1);R('#3f474d',x-2,ry-2,5,2);R('#7a1410',x-1,ry-37,3,3);}
  // the front pillar runs right up to the top of the roof
  R('#4f585f',DX,ry,14,TOP-ry);for(let y=ry+3;y<TOP;y+=5)R('#454e55',DX,y,14,1);R('#2e353a',DX,ry,1,TOP-ry);R('#363d43',DX+13,ry,1,TOP-ry);R('#3a4248',DX-1,ry-2,16,2);
  return{c,wy,ry,lamp:[W1-52,ry-36],fl:[],fy:0};}
// the apron outside the hangar: worn asphalt, slab seams fanning out, stand markings, rubber and oil
function apronStatic(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d'),R=(col,x,y,ww,hh)=>{g.fillStyle=col;g.fillRect(Math.round(x),Math.round(y),Math.max(1,Math.round(ww)),Math.max(1,Math.round(hh)));};
  let sd=11;const rn=()=>(sd=(sd*16807)%2147483647)/2147483647,BD=[[0,'#50565d'],[9,'#484e55'],[24,'#40464d'],[46,'#393f46'],[70,'#32373e']];
  BD.forEach((b,i)=>{R(b[1],0,b[0],w,h);if(i)for(let x=0;x<w;x+=2)R(BD[i-1][1],x+(i&1),b[0],1,1);});
  for(let i=0;i<9;i++){const x=rn()*w,y=3+rn()*(h-10);R(i%2?'rgba(0,0,0,.09)':'rgba(255,255,255,.035)',x,y,16+rn()*44,3+rn()*6);}
  for(let i=0,n=w*h*.06;i<n;i++)R(rn()<.45?'rgba(255,255,255,.055)':'rgba(0,0,0,.13)',rn()*w,rn()*h,rn()<.25?2:1,1);
  const vx=w*.52,hy=-36;for(let k=-9;k<=9;k++)for(let y=0;y<h;y++){const x=vx+(k+.5)*38*(y-hy)/-hy;if(x>=0&&x<w-5)R('rgba(0,0,0,.17)',x,y,1,1);}
  for(const y of[9,24,46,70]){R('rgba(0,0,0,.2)',0,y,w,1);R('rgba(255,255,255,.045)',0,y+1,w,1);}
  R('rgba(255,255,255,.2)',0,0,w,1);
  // rubber, oil and a drain
  for(let i=0;i<22;i++){const y=[2,5,7,18,20,36,37,39,52,60][i%10]+(rn()*2|0),x=rn()*(w-80);R('rgba(0,0,0,.14)',x,y,18+rn()*64,1);}
  for(const[x,y]of[[100,20],[116,21],[w-152,4],[w-118,5],[w-96,3]]){R('rgba(8,10,14,.2)',x-2,y-1,5,1);R('rgba(8,10,14,.2)',x-4,y,9,1);R('rgba(8,10,14,.2)',x-3,y+1,7,1);}
  R('#1b1f24',w*.6,56,12,4);for(let i=0;i<5;i++)R('#3f454c',w*.6+1+i*2.3,57,1,2);
  // paint: edge line, double taxi line with a lead-in to each stand, helicopter spot, stop bar, safety line at the quay
  const YL='rgba(240,196,50,.82)',WH='rgba(228,232,232,.7)',wear=()=>rn()>.07;
  for(let x=16;x<w-14;x+=20)for(let i=0;i<12;i++)if(wear())R(WH,x+i,4,1,1);
  for(let x=14;x<w-12;x++){if(wear())R(YL,x,36,1,1);if(wear())R(YL,x,38,1,1);}
  for(let a=0;a<360;a+=1.5){const q=a*Math.PI/180;if(wear())R(YL,104+Math.cos(q)*47,19+Math.sin(q)*9,1,1);}
  for(let i=0;i<10;i++)if(wear()){R(YL,104-5+i,28+i*.8,1,1);}
  txt(R,YL,'H1',158,13);
  const nx=w-116;for(let i=0;i<=30;i++)if(wear())R(YL,nx+16-i*.55,36-i,1,1);for(let i=-8;i<=8;i++)if(wear())R(WH,nx+i,6,1,1);R(WH,nx,3,1,7);txt(R,WH,'C1',nx+12,9);
  for(let y=0;y<h;y+=4)R((y>>2)&1?'rgba(226,230,230,.8)':'rgba(206,62,40,.85)',w-11,y,2,4);
  R('#5c636a',w-5,0,1,h);R('#22262b',w-4,0,4,h);for(let y=12;y<h;y+=30){R('#15181c',w-8,y,4,3);R('#3a4047',w-8,y,4,1);}
  return c;}
function drawBrief(){
  let g=ctx;const e=ENV,G0=g;if(!BR||BR.w!==VW||BR.h!==VH)BR=briefStatic();
  const DX=BR.DX,fl=BR.fl,ce=BR.ce,fb=BR.fb,fm=fl+18,ff=fl+42,S=HELIS[cfgCur.heli],hz=fl-4,qx=VW-DX<220?VW+60:VW-50;camX=camY=cx=cy=0;
  // low-sun light: how close the sun is to the horizon, its colour, and where it stands outside the door
  const sfB=(H-5.2)/15.6,lowB=Math.min(sfB,1-sfB),wxk=(1-M.cloud*.5)*(M.fog?.5:1),gf=(lowB>=0?clamp(1-(lowB-.035)/.2,0,1):clamp(1+lowB/.07,0,1))*wxk,
    LC=mix(mix([255,112,58],[255,208,136],clamp(lowB/.2,0,1)),e.o,.25+M.cloud*.3),ca=(c,a)=>`rgba(${c[0]|0},${c[1]|0},${c[2]|0},${Math.max(0,a).toFixed(3)})`,
    sbx=r(DX+14+(VW-DX-14)*(.08+.84*clamp(sfB,-.05,1.05))),sby=r(hz-10-Math.sin(clamp(sfB,0,1)*3.14)*hz*.78),visB=1-M.cloud*.9,ax0=DX+14,aw=qx-4-ax0;
  if(!BR.ap||BR.ap.width!==qx-DX)BR.ap=apronStatic(qx-DX,VH-fl);
  const PIL=['#4f6b3c','#3c5230','#f1d2b6'],SWM=['#f36f21','#1a1d22','#f1d2b6'],CHF=['#1f2f4f','#16233d','#f1d2b6'],MEC=['#4a5a6a','#2c363d','#f1d2b6'],MEC2=['#4a5a6a','#2c363d','#c98f6a'],DK=['#2f4a7a','#16233d','#c98f6a'];
  const sh=(x,y,w,a=.3)=>{x=r(x);g.fillStyle=`rgba(0,0,0,${a})`;g.fillRect(x+2,y-1,w-4,1);g.fillRect(x,y,w,2);g.fillRect(x+2,y+2,w-4,1);};
  const pack=(x,y)=>{sh(x-2,y-1,10);g.fillStyle='#f36f21';g.fillRect(x,y-8,6,8);g.fillStyle='#b8501a';g.fillRect(x,y-4,6,1);g.fillStyle=GR;g.fillRect(x+2,y-7,2,1);g.fillStyle=K;g.fillRect(x+1,y-9,4,1);};
  const pace=(a,b,sp,off=0)=>{const n=b-a,p=((T+off)*sp)%(n*2);return p<n?[a+p,1]:[b-(p-n),-1];};
  g.setTransform(1,0,0,1,0,0);g.imageSmoothingEnabled=false;
  // glossy floor: each group is drawn on its own layer, mirrored faintly below its feet, then laid on top
  if(!BR.lc){BR.lc=document.createElement('canvas');BR.lc.width=VW;BR.lc.height=VH;BR.lg=BR.lc.getContext('2d');BR.lg.imageSmoothingEnabled=false;}
  const lay=(base,fn,a=.15)=>{const L=BR.lg,N=6,BH=6;L.setTransform(1,0,0,1,0,0);L.clearRect(0,0,VW,VH);g=ctx=L;try{fn();}finally{g=ctx=G0;}L.setTransform(1,0,0,1,0,0);L.globalAlpha=1;L.globalCompositeOperation='source-over';
    g.save();g.beginPath();g.rect(0,base,DX-12,VH-base);g.clip();g.setTransform(1,0,0,-1,0,2*base);for(let k=0;k<N;k++){g.globalAlpha=a*(1-k/N);g.drawImage(BR.lc,0,base-(k+1)*BH,DX,BH,0,base-(k+1)*BH,DX,BH);}g.restore();g.globalAlpha=1;g.drawImage(BR.lc,0,0);};
  const sunG=g.createLinearGradient(DX,0,VW,0),sa=x=>ca(LC,gf*(.2+.26*(1-Math.min(1,Math.abs(x-sbx)/(VW-DX)))));sunG.addColorStop(0,sa(DX));sunG.addColorStop(1,sa(VW));
  const lit=fn=>{if(gf<=.02){fn();return;}const Lg=BR.lg;Lg.setTransform(1,0,0,1,0,0);Lg.clearRect(0,0,VW,VH);g=ctx=Lg;try{fn();}finally{g=ctx=G0;}Lg.setTransform(1,0,0,1,0,0);Lg.globalAlpha=1;Lg.globalCompositeOperation='source-atop';Lg.fillStyle=sunG;Lg.fillRect(DX,0,VW-DX,VH);Lg.globalCompositeOperation='source-over';g.drawImage(BR.lc,0,0);};
  // outside: sky, clouds, mountains, trees, a strip of sea past the quay
  g.fillStyle=rgb(e.z);g.fillRect(0,0,VW,VH);g.setTransform(1,0,0,1,0,hz-SKH);g.fillStyle=skyPat;g.fillRect(0,0,VW,SKH);g.setTransform(1,0,0,1,0,0);
  if(sfB>0&&sfB<1&&visB>.2){const col=lowB<.1?'#ff8a4a':lowB<.2?'#ffc56a':'#fff3b0',rad=lowB<.1?14:11;g.globalAlpha=visB;g.drawImage(disc(col,rad+6,1),sbx-rad-6,sby-rad-6);g.drawImage(disc(col,rad),sbx-rad,sby-rad);g.drawImage(disc('#fffbe0',rad-4),sbx-rad+4,sby-rad+4);g.globalAlpha=1;}
  {const ck=BR.top?Math.max(.6,(hz-50)/330):.6;for(const cl of skyClouds){if(cl.off>190&&!BR.top)continue;const s=SPR.cl[cl.i],WW=VW+520,x=(((cl.x+T*M.wind*.4*cl.p)%WW)+WW)%WW-260;g.drawImage(s.c,r(x),r(hz-cl.off*ck-s.h*2),s.w*2,s.h*2);}}
  g.drawImage(TINT.mid,DX-560,hz+3-136);g.drawImage(TINT.near,DX-300,hz+4-74);if(BR.x)g.drawImage(BR.x.c,0,0);const XT=BR.top;
  g.fillStyle=rgb(e.s[1]);g.fillRect(qx,fl+12,VW-qx,VH);g.fillStyle=rgb(mix(e.s[1],[255,255,255],.35));for(let x=qx;x<VW;x+=2)g.fillRect(x,fl+12+r(Math.sin(x*.2+T*1.5)*1.3),2,1);
  g.drawImage(BR.ap,DX,fl);
  {const gr=g.createLinearGradient(0,fl,0,fl+40);gr.addColorStop(0,ca(e.o,.16*(1-e.d)));gr.addColorStop(1,ca(e.o,0));g.fillStyle=gr;g.fillRect(ax0,fl,aw,40);}
  if(gf>.02){g.fillStyle=ca(LC,.13*gf);g.fillRect(ax0,fl,aw,VH-fl);g.globalCompositeOperation='lighter';
    const gr=g.createLinearGradient(0,fl,0,fl+78);gr.addColorStop(0,ca(LC,.46*gf));gr.addColorStop(.35,ca(LC,.2*gf));gr.addColorStop(1,ca(LC,0));g.fillStyle=gr;g.fillRect(ax0,fl,aw,78);
    for(let i=0;i<30;i++){const y=fl+1+r(i*i*.085+i*.5),w=22+(i*37%64),x=ax0+r((((i*71.3+(i%2?1:-1)*T*1.4)%(aw-8))+aw-8)%(aw-8));g.fillStyle=ca(LC,(.2-i*.005)*gf*(.7+.3*Math.sin(T*1.3+i)));g.fillRect(x,y,Math.min(w,ax0+aw-x),1);}
    if(sfB>0&&sfB<1&&visB>.2)for(let i=0;i<24;i++)if(Math.sin(T*3+i*2.3)>-.6){const dp=i*3.3,x=sbx+r(((i*37%100)/100-.5)*(12+dp*.55)*2),w=6+(i%3)*4;if(x-3<ax0||x+w>ax0+aw)continue;g.fillStyle=ca([255,238,196],(.6-i*.02)*gf*visB);g.fillRect(x-3,fl+2+r(dp),w,1);}
    g.globalCompositeOperation='source-over';}
  // the flag, behind the Hercules
  sh(DX+34,fl,12);sh(qx-196,fl+1,186,.26);sh(qx-150,fl,90,.2);for(const x of[DX+30,qx-40])sh(x-6,fl,16);
  lit(()=>{g.fillStyle='#c9ccc8';g.fillRect(DX+38,fl-104,2,104);g.fillStyle=Y;g.fillRect(DX+37,fl-106,4,2);
  for(let i=0;i<20;i++){const wy=r(Math.sin(T*5-i*.5)*(.4+i*.08)),x=DX+40+i,y=fl-103+wy;g.fillStyle=RB;g.fillRect(x,y,1,12);g.fillStyle=W;for(let k=1;k<12;k+=4)g.fillRect(x,y+k,1,2);if(i<8){g.fillStyle=BL;g.fillRect(x,y,1,6);if(i%3===1){g.fillStyle=W;g.fillRect(x,y+1,1,1);g.fillRect(x,y+4,1,1);}}}
  g.drawImage(SPR.c130,qx-204,fl-76+1);
  for(const x of[DX+30,qx-40]){g.fillStyle=GR;g.fillRect(x,fl-78,2,78);g.fillStyle=K;g.fillRect(x-5,fl-82,12,4);g.fillStyle=Y;g.fillRect(x-4,fl-79,3,2);g.fillRect(x+3,fl-79,3,2);}});
  sh(DX+104-S.half-4,fm,S.half*2+6,.3);sh(DX+104-S.half+12,fm,S.half+10,.15);sh(DX+46,fm-1,10);sh(DX+156,fm-1,10);
  lit(()=>{drawHeli({spec:S,x:DX+104,y:fm-S.belly-S.gear,tilt:0,yaw:1,gear:1,door:1,rot:.45,lights:false});
  {const[px,pd]=pace(DX+130,qx-60,16,3);man(px,fm+10,['#f2c22e','#16233d','#f1d2b6'],2,1);}
  g.fillStyle='#f36f21';g.fillRect(DX+50,fm-6,2,6);g.fillRect(DX+49,fm-1,4,1);g.fillRect(DX+160,fm-6,2,6);g.fillRect(DX+159,fm-1,4,1);});
  if(M.rain&&XT){g.fillStyle='rgba(205,222,238,.5)';for(let i=0;i<50;i++){const x=(i*83.1)%DX,y=(i*61.7+T*620+i*i)%XT;g.fillRect(r(x),r(y),1,5);}}
  if(M.snow&&XT){g.fillStyle='rgba(255,255,255,.85)';for(let i=0;i<40;i++){const x=(i*67.9+T*8)%DX,y=(i*41.3+T*(30+i%5*8))%XT;g.fillRect(r(x),r(y),1,1);}}
  if(M.fog&&XT){g.fillStyle='rgba(200,210,216,.55)';g.fillRect(0,0,DX,XT);}
  if(XT&&e.d>.05){g.fillStyle=`rgba(4,10,24,${e.d})`;g.fillRect(0,0,DX,XT);g.globalCompositeOperation='lighter';g.globalCompositeOperation='source-over';}
  if(XT&&Math.sin(T*3.2)>.2){const[lx,ly]=BR.x.lamp;g.fillStyle='#ff3b30';g.fillRect(lx-1,ly-1,3,3);g.globalCompositeOperation='lighter';glow(lx,ly,10+e.d*8,`rgba(255,50,40,${(.35+e.d*.4).toFixed(3)})`);g.globalCompositeOperation='source-over';}
  if(M.rain){g.fillStyle='rgba(205,222,238,.5)';for(let i=0;i<70;i++){const x=DX+14+((i*97.3)%(VW-DX)),y=(i*53.7+T*620+i*i)%fl;g.fillRect(r(x),r(y),1,5);}}
  if(M.snow){g.fillStyle='rgba(255,255,255,.85)';for(let i=0;i<60;i++){const x=DX+14+((i*71.3+T*8)%(VW-DX)),y=(i*37.7+T*(30+i%5*8))%fl;g.fillRect(r(x),r(y),1,1);}}
  if(M.fog){g.fillStyle='rgba(200,210,216,.55)';g.fillRect(DX,0,VW-DX,VH);}
  if(e.d>.05){g.fillStyle=`rgba(4,10,24,${e.d})`;g.fillRect(DX,0,VW-DX,VH);g.globalCompositeOperation='lighter';for(const x of[DX+30,qx-40])glow(x,fl-78,90,'rgba(255,196,120,.4)');glow(DX+104,fm-20,80,'rgba(255,214,160,.18)');g.globalCompositeOperation='source-over';}
  if(e.d>.05){g.globalCompositeOperation='lighter';for(const x of[DX+30,qx-40]){g.save();g.translate(x+1,fl+4);g.scale(1,.26);glow(0,0,78,`rgba(255,200,130,${(.1+e.d*.42).toFixed(3)})`);g.restore();}g.globalCompositeOperation='source-over';}
  if(VW>qx){const wy=fl+14,D=Math.min(VH-wy,76),w=VW-qx;g.save();g.beginPath();g.rect(qx,wy,w,VH-wy);g.clip();
    for(let d=0;d<D;d++){if(d>5&&((d*7+((T*2.4)|0)*3)%11)===0)continue;const sx=Math.round(Math.sin(d*.55-T*4.2)*(.7+d*.05)+Math.sin(d*.19+T*1.7)*d*.02);g.globalAlpha=(.55-e.d*.2)*(1-d/D);g.drawImage(cv,qx,fl+10-d,w,1,qx+sx,wy+d,w,1);}
    g.restore();g.globalAlpha=1;}
  if(XT&&e.d>.05){g.globalCompositeOperation='lighter';for(const x of BR.x.fl){glow(x,BR.x.fy+4,30,`rgba(255,214,160,${(.15+e.d*.35).toFixed(3)})`);}g.globalCompositeOperation='source-over';}
  // ---- inside: far plane (stores and people coming and going)
  g.drawImage(BR.c,0,0);
  if(gf>.02){g.fillStyle=ca(LC,.3*gf);g.fillRect(DX,BR.top,14,ce+7-BR.top);g.globalCompositeOperation='lighter';const gr=g.createLinearGradient(DX-12,0,DX-190,0);gr.addColorStop(0,ca(LC,.24*gf));gr.addColorStop(1,ca(LC,0));g.fillStyle=gr;g.beginPath();g.moveTo(DX-12,fb);g.lineTo(DX-12,VH);g.lineTo(DX-190,VH);g.lineTo(DX-70,fb);g.fill();g.globalCompositeOperation='source-over';}
  lay(fb,()=>{
  {const[px]=pace(28,300,17,0);man(px,fb,DK,2,0);}
  {const[px,pd]=pace(150,270,13,9);man(px,fb,MEC2,2,2);g.fillStyle='#8f6a4a';g.fillRect(r(px)+pd*3-2,fb-11,5,5);}
  man(52,fb,PIL,4,1);g.fillStyle=PIL[0];pl(g,55,fb-11,58,fb-13-r(Math.sin(T*3)*1.5));
  man(226,fb,MEC,4,2);g.fillStyle=W;g.fillRect(228,fb-10,3,4);
  });
  // ---- middle plane: the Dolphin in maintenance, mechanics, a tug with a gear trolley
  const fd=fm+9;
  const d=SPR.dolphin,dx=112,dy=fd-13;
  lay(fd,()=>{sh(dx-62,fd,104);sh(dx-30,fd,56,.15);sh(dx+3,fd,20);sh(dx+79,fd,28);sh(dx-72,fd,13);sh(dx-45,fd,16);
  if(cfgCur.camp!=null&&CAMP[cfgCur.camp].act===1&&cfgCur.heli==='dolphin'){sh(dx-84,fd,150);drawHeli({spec:HELIS.jayhawk,x:dx+8,y:dy,tilt:0,yaw:1,gear:1,door:1,rot:.2,lights:false});}
  else{g.fillStyle='#101214';g.fillRect(dx+17,fd-4,4,4);g.fillRect(dx-8,fd-4,4,4);g.drawImage(d,dx-d.ox,dy-d.oy);g.drawImage(SPR.dolphinDoor,dx-9-11,dy-3);g.fillStyle='#22262b';g.fillRect(dx-48,dy-15,96,1);g.fillRect(dx-50,dy-14,6,1);g.fillRect(dx+44,dy-14,6,1);}
  g.fillStyle='#3a424c';g.fillRect(dx-14,dy-10,22,5);g.fillStyle=K;g.fillRect(dx-10,dy-9,6,3);
  g.fillStyle=Y;g.fillRect(dx+6,fd-20,14,2);g.fillRect(dx+6,fd-20,1,20);g.fillRect(dx+19,fd-20,1,20);g.fillRect(dx+6,fd-13,14,1);g.fillRect(dx+6,fd-6,14,1);
  man(dx+13,fd-20,MEC,4,6);g.fillStyle=Y;g.fillRect(dx+12,fd-36,3,2);g.fillStyle=MEC[0];pl(g,dx+10,fd-31,dx+5,fd-33+r(Math.sin(T*9)));
  if(Math.sin(T*1.1)>-.2)for(let i=0;i<7;i++){const a=T*31+i*2.4,rr=(T*40+i*7)%12;g.fillStyle=i%2?'#fff3b0':'#ffd23a';g.fillRect(r(dx+3+Math.cos(a)*rr),r(fd-33+Math.abs(Math.sin(a))*rr),1,1);}
  man(dx-36,fd,MEC2,1,3);g.fillStyle=GR;g.fillRect(dx-42,fd-3,5,3);
  {const[px,pd]=pace(dx+30,dx+78,15,4);man(px,fd,MEC,2,5);g.fillStyle=GR;g.fillRect(r(px)+pd*3,fd-9,1,5);}
  g.fillStyle=RB;g.fillRect(dx+82,fd-18,22,14);g.fillStyle='#7a1e16';g.fillRect(dx+82,fd-13,22,1);g.fillRect(dx+82,fd-8,22,1);g.fillStyle=GR;g.fillRect(dx+82,fd-20,22,2);g.fillStyle=K;g.fillRect(dx+84,fd-4,4,4);g.fillRect(dx+98,fd-4,4,4);g.fillStyle=Y;g.fillRect(dx+88,fd-23,6,3);
  g.fillStyle=Y;g.fillRect(dx-66,fd-26,1,26);g.fillRect(dx-70,fd-1,9,1);g.fillStyle='#fff3b0';g.fillRect(dx-69,fd-30,7,5);
  });
  lay(fm+3,()=>{
  {const[tx,td]=pace(150,VW-120,14,20),x=r(tx);g.save();g.translate(x,fm+3);g.scale(td,1);sh(-39,0,24);sh(-13,0,26);g.fillStyle=Y;g.fillRect(-10,-11,20,8);g.fillRect(-10,-17,8,6);g.fillStyle=GL;g.fillRect(-9,-16,5,4);g.fillStyle=K;g.fillRect(-8,-4,5,4);g.fillRect(4,-4,5,4);g.fillStyle='#b8901c';g.fillRect(-10,-5,20,1);
    g.fillStyle=GR;g.fillRect(-18,-6,8,1);g.fillStyle='#5b6068';g.fillRect(-36,-8,18,3);g.fillStyle=K;g.fillRect(-34,-4,4,4);g.fillRect(-24,-4,4,4);g.fillStyle='#f36f21';g.fillRect(-34,-15,6,7);g.fillRect(-27,-15,6,7);g.fillStyle='#b8501a';g.fillRect(-34,-12,13,1);g.fillStyle='#f1d2b6';g.fillRect(-6,-21,3,3);g.fillStyle=MEC[0];g.fillRect(-7,-18,5,2);g.restore();}
  });
  // ---- front plane: the briefing
  const bx=206,fc=ff-4,cy0=[2,-6,4,-3,6];
  lay(fc,()=>{  man(bx,fc,CHF,4);g.fillStyle='#e8ecec';g.fillRect(bx-2,fc-16,5,1);g.fillStyle=K;g.fillRect(bx-3,fc-15,3,1);const ay=r(Math.sin(T*2)*1.5);g.fillStyle=CHF[0];pl(g,bx+3,fc-11,bx+6,fc-9-ay);g.fillStyle='#e8ecec';g.fillRect(bx+5,fc-12-ay,4,5);g.fillStyle='#8a6a4a';g.fillRect(bx+5,fc-13-ay,4,1);g.fillStyle=Y;g.fillRect(bx-1,fc-11,1,1);g.fillRect(bx+1,fc-11,1,1);});
  const crew=[[bx+26,PIL,'p'],[bx+42,PIL,'p'],[bx+58,['#4f6b3c','#3c5230','#c98f6a'],'m'],[bx+75,BENC,'s'],[bx+91,SWC,'s']];
  crew.map((q,i)=>[q,i]).sort((a,b)=>cy0[a[1]]-cy0[b[1]]).forEach(([q,i])=>lay(ff+cy0[i],()=>{const x=q[0],yy=ff+cy0[i],b=Math.sin(T*1.3+i*2)>.9?1:0;pack(x-9,yy+1);man(x,yy-b,q[1],4,i);
    if(q[2]==='p'){g.fillStyle=W;g.fillRect(x+3,yy-9-b,4,4);g.fillStyle=K;g.fillRect(x+5,yy-8-b,2,2);g.fillStyle=Y;g.fillRect(x-1,yy-11-b,3,1);}
    else if(q[2]==='s'){g.fillStyle=q[1][4];g.fillRect(x+4,yy-2,6,2);}
    else{g.fillStyle=W;g.fillRect(x-1,yy-16-b,3,2);g.fillStyle=GR;g.fillRect(x+3,yy-8-b,2,5);}}));
  lay(ff+18,()=>{const[px,pd]=pace(40,DX-40,24,2);man(px,ff+18,PIL,2,0);g.fillStyle='#f36f21';g.fillRect(r(px)+pd*3-2,ff+18-11,5,6);g.fillStyle='#b8501a';g.fillRect(r(px)+pd*3-2,ff+18-8,5,1);});
  // pools of lamplight
  g.globalCompositeOperation='lighter';for(let x=58;x<DX;x+=108){const gr=g.createLinearGradient(0,ce+14,0,fl+64);gr.addColorStop(0,'rgba(255,240,190,.2)');gr.addColorStop(1,'rgba(255,240,190,0)');g.fillStyle=gr;g.beginPath();g.moveTo(x-3,ce+14);g.lineTo(x-60,fl+64);g.lineTo(x+60,fl+64);g.lineTo(x+4,ce+14);g.fill();}
  glow(dx-66,fd-28,26,'rgba(255,240,190,.5)');g.globalCompositeOperation='source-over';
  // text: briefing sheet typed out over the rafters, and who is talking
  const h=hx;h.setTransform(1,0,0,1,0,0);h.clearRect(0,0,hc.width,hc.height);h.setTransform(HS,0,0,HS,0,0);h.imageSmoothingEnabled=false;
  const A=[[bx,fc],[bx+26,ff+cy0[0]],[bx+42,ff+cy0[1]],[bx+58,ff+cy0[2]],[bx+75,ff+cy0[3]],[bx+91,ff+cy0[4]],[bx+42,ff+cy0[1]],[dx+13,fd-20],[dx+13,fd-20]];
  const bt=briefTimes();
  if(briefT<bt.t0){h.globalAlpha=briefT<bt.tH?1:Math.max(0,1-(briefT-bt.tH)/.7);h.fillStyle='rgba(3,9,16,.93)';h.fillRect(0,0,VW,VH);const y0=Math.max(34,r(VH/2-(BL_.length*15+20)/2));h.fillStyle=O;h.fillRect(16,y0-14,3,BL_.length*15+26);
    h.textAlign='left';h.textBaseline='alphabetic';h.font='700 10px Silkscreen,monospace';h.fillStyle='#f6c62f';h.fillText(cfgCur.camp!=null?tr(`CAMPAÑA · MISIÓN ${cfgCur.camp+1} · `)+tr(CAMP[cfgCur.camp].t).toUpperCase():tr(guard.on?`GUARDIA EN KODIAK · AVISO ${guard.n+1} · ${guard.pts} PTS`:'BRIEFING DE MISIÓN'),28,y0);
    h.font='10px Silkscreen,monospace';let n=Math.floor(briefT*26);BL_.forEach((l,i)=>{const q=l.slice(0,Math.max(0,n));n-=l.length;if(q){h.fillStyle='#eef3f1';h.fillText(q.toUpperCase(),28,y0+20+i*15,VW-48);}});
    h.font='8px Silkscreen,monospace';h.fillStyle='#93adbb';h.textAlign='right';h.fillText(tr('Toca o pulsa una tecla para avanzar').toUpperCase(),VW-16,VH-12);h.globalAlpha=1;}
  else{let tt=briefT-bt.t0,k=0;while(k<BT_.length&&tt>=bt.d[k]){tt-=bt.d[k];k++;}
    if(k<BT_.length){const q=BT_[k];if(tt<bt.d[k]-.3)bubble(h,A[q[0]][0],A[q[0]][1]-18,q[1],'#16191d');}else if(!BRdone){BRdone=true;$('#brf').hidden=false;}}
}
let BRdone=false;
function briefTimes(){const N=BL_.reduce((a,l)=>a+l.length,0),tH=N/26+6;return{tH,t0:tH+.7,d:BT_.map(q=>clamp(2.6+tr(q[1]).length*.085,4.2,11))};}
function briefSkip(){if(state!=='brief'||BRdone)return;const bt=briefTimes();if(briefT<bt.t0-.01){briefT=briefT<bt.tH-6?bt.tH-6:bt.t0;return;}let e=bt.t0;for(const d of bt.d){e+=d;if(briefT<e-.01){briefT=e;return;}}}
wrap.addEventListener('pointerdown',e=>{if(state==='brief'&&!BRdone&&!e.target.closest('button'))briefSkip();});


// ---------- pause menu and photo mode ----------
const PH={on:false,x:0,y:0,x0:0,y0:0,bar:true};let phD=null;
function pauseOpen(){if(state!=='play'||paused)return;paused=true;stopRumble();for(const k in KEY)KEY[k]=false;$('#pause').hidden=false;$('#pad').hidden=true;
  $('#pQuitS').textContent=tr(guard.on?'La guardia queda guardada: podrás continuarla desde este aviso.':'Vuelve al menú principal.');sndUpdate();$('#pResume').focus();}
function pauseClose(){paused=false;$('#pause').hidden=true;$('#pad').hidden=false;$('#pResume').blur();}
function photoOn(){PH.on=true;PH.x=PH.x0=camX;PH.y=PH.y0=camY;PH.bar=true;$('#pause').hidden=true;$('#photo').hidden=false;$('#phHint').textContent=tr('Arrastra para mover la cámara · toca para ocultar los botones');}
function photoOff(){PH.on=false;$('#photo').hidden=true;$('#pause').hidden=false;}
function phClamp(){PH.x=clamp(PH.x,PH.x0-VW,PH.x0+VW);PH.y=clamp(PH.y,PH.y0-VH*.8,PH.y0+VH*.3);}
function phPan(dt){const gp=getPhotoPanInput();PH.x+=clamp((KEY.ArrowRight?1:0)-(KEY.ArrowLeft?1:0)+gp.x,-1,1)*dt*180;PH.y+=clamp((KEY.ArrowDown?1:0)-(KEY.ArrowUp?1:0)+gp.y,-1,1)*dt*180;phClamp();}
wrap.addEventListener('pointerdown',e=>{if(!PH.on||e.target.closest('button'))return;phD={x:e.clientX,y:e.clientY,m:0};});
wrap.addEventListener('pointermove',e=>{if(!phD)return;const k=VW/wrap.clientWidth,dx=e.clientX-phD.x,dy=e.clientY-phD.y;phD.m+=Math.abs(dx)+Math.abs(dy);PH.x-=dx*k;PH.y-=dy*k;phD.x=e.clientX;phD.y=e.clientY;phClamp();});
for(const n of['pointerup','pointercancel'])wrap.addEventListener(n,()=>{if(phD&&PH.on&&phD.m<6){PH.bar=!PH.bar;$('#photo').hidden=!PH.bar;}phD=null;});
function photoSave(){const k=Math.max(2,Math.ceil(1920/VW)),c=document.createElement('canvas');c.width=VW*k;c.height=VH*k;const g=c.getContext('2d');g.imageSmoothingEnabled=false;g.drawImage(cv,0,0,c.width,c.height);
  c.toBlob(async b=>{const name='kodiak-'+Date.now()+'.png';
    try{const dl=window.claude&&window.claude.use?await window.claude.use('downloads'):null;if(dl){try{await dl.save({filename:name,data:b});}catch(e){if(!e||e.code!=='declined')$('#phHint').textContent=tr('No se pudo guardar: haz una captura de pantalla.');}return;}}catch(e){}
    try{const f=new File([b],name,{type:'image/png'});if(padOn&&navigator.canShare&&navigator.canShare({files:[f]})){await navigator.share({files:[f]});return;}}catch(e){if(e&&e.name==='AbortError')return;}
    try{const a=document.createElement('a'),u=URL.createObjectURL(b);a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),5000);}
    catch(e){$('#phHint').textContent=tr('No se pudo guardar: haz una captura de pantalla.');}},'image/png');}

// ---------- the film: ten snapshots a second are kept as compact text while you fly; playback interpolates between them at real speed, speech bubbles included ----------
const REC={f:[],iv:.1,acc:0,max:6000},RP={on:false,i:0,sp:1,cx:0,cy:0,hold:0,live:null,clock:0,banner:'',oilF:null,ia:-1,ib:-1,A:null,B:null,lp:[]};
const RKEEP={spec:1,prof:1,fb:1,f:1,spr:1,hit:1,crew:1,fs:1,wheels:1,lt:1},PKN=['smoke','flame','ember','spray','mist'];
function recReset(){REC.f=[];REC.iv=.1;REC.acc=0;}
function recTick(dt){REC.acc+=dt;if(REC.acc<REC.iv)return;REC.acc=REC.acc>REC.iv*2?0:REC.acc-REC.iv;
  const x0=camX-60,x1=camX+VW+60,c16=v=>clamp(v,-32000,32000);let n=0;for(const p of parts)if(p.x>x0&&p.x<x1)n++;
  const st=n>260?Math.ceil(n/260):1,P=new Int16Array(Math.ceil(n/st)*7);let j=0,q=0;
  for(const p of parts)if(p.x>x0&&p.x<x1&&q++%st===0){P[j++]=p.x;P[j++]=c16(p.y);P[j++]=p.life*100;P[j++]=p.max*100;P[j++]=Math.min(63,p.r|0)+Math.max(0,PKN.indexOf(p.k))*64;P[j++]=c16(p.vx);P[j++]=c16(p.vy);}
  let vp=puffs.filter(p=>p.x>x0-80&&p.x<x1+80);if(vp.length>90){const k=Math.ceil(vp.length/90);vp=vp.filter((_,i)=>i%k===0);}
  const Q=new Float32Array(vp.length*9);vp.forEach((p,i)=>Q.set([p.x,p.y,p.r,p.a,p.life,p.s,p.vx,p.vy,p.g],i*9));
  const Bd=new Int16Array(birds.length*3);birds.forEach((b,i)=>{Bd[i*3]=b.x;Bd[i*3+1]=b.y;Bd[i*3+2]=(b.ph%6.283)*100;});
  const vi=new Map(vessels.map((v,i)=>[v,i])),si=new Map(surv.map((p,i)=>[p,i])),root={heli,sw,hook,surv,vessels,flares,rogues,base,X,gust,bolt,shouts,bub,note,debris},VS=vessels,SU=surv,SW=sw;
  const js=JSON.stringify(root,function(k,v){
    if(k!==''&&vi.has(this)){const t=VT[this.type];if(t&&t[k]===v)return undefined;}
    if(typeof v==='number')return Math.round(v*1000)/1000;
    if(v===null||typeof v!=='object')return v;
    if(RKEEP[k]||ArrayBuffer.isView(v)||v instanceof Set||v instanceof HTMLCanvasElement)return undefined;
    if(this!==VS&&vi.has(v))return{$v:vi.get(v)};if(this!==SU&&si.has(v))return{$s:si.get(v)};if(v===SW&&this!==root)return{$w:1};
    return v;});
  if(REC.f.push({js,P,Q,Bd,T,H,clock,flash,cx:camX,cy:camY,banner,sa:SEA.a,ss:SEA.s})>REC.max){REC.f=REC.f.filter((_,i)=>i%2===0);REC.iv*=2;}}
function rpLoad(i){const s=REC.f[i],o=JSON.parse(s.js),L=RP.live;o.s=s;
  o.vessels=o.vessels.map(v=>Object.assign({},VT[v.type],v));
  const fix=x=>{for(const k in x){const v=x[k];if(!v||typeof v!=='object')continue;if(v.$v!==undefined)x[k]=o.vessels[v.$v];else if(v.$s!==undefined)x[k]=o.surv[v.$s];else if(v.$w)x[k]=o.sw;else if(k!=='prof'&&k!=='crew'&&k!=='fs')fix(v);}};
  fix(o);o.heli.spec=L.heli.spec;(o.X.rocks||[]).forEach((q,j)=>{const lr=L.X.rocks[j];if(lr){q.spr=lr.spr;q.top=lr.top;}});for(const q of o.rogues)q.hit=new Set();
  const lv=L.vessels;o.vessels.forEach((v,j)=>{if(v.fire&&lv[j]){if(!lv[j].fb){const big=v.half>140;lv[j].fb=v.fs.map(()=>mkFire(clamp(r(34+v.half*.3),36,150),big?124:92));}v.fb=lv[j].fb;}});
  for(const q of o.X.oil||[])if(q.lit)q.f=RP.oilF||(RP.oilF=mkFire(Math.max(24,r(q.w0)),46));
  o.birds=[];for(let j=0;j<s.Bd.length;j+=3)o.birds.push({x:s.Bd[j],y:s.Bd[j+1],ph:s.Bd[j+2]/100});
  return o;}
function rpStart(){if(REC.f.length<2||RP.on)return;RP.live={heli,sw,hook,surv,vessels,flares,rogues,base,X,birds,gust,bolt,puffs,parts,shouts,bub,note,debris,T,H,flash,camX,camY,sa:SEA.a,ss:SEA.s};
  RP.on=true;RP.i=0;RP.hold=0;RP.ia=RP.ib=-1;RP.A=RP.B=null;state='replay';showOnly('');$('#pad').hidden=true;$('#rp').hidden=false;$('#rpSpeed').textContent='×'+RP.sp;rpStep(0);musInit();}
function rpStep(dt){const n=REC.f.length;if(RP.i>=n-1){RP.hold+=dt;if(RP.hold>2){rpEnd();return;}}else RP.i=Math.min(n-1,RP.i+dt*RP.sp/REC.iv);
  const ia=Math.min(n-1,RP.i|0),f=RP.i-ia;
  if(ia!==RP.ia){const A=RP.ib===ia&&RP.B?RP.B:rpLoad(ia),ib=Math.min(n-1,ia+1),B=ib===ia?A:rpLoad(ib),lp=RP.lp=[];RP.ia=ia;RP.ib=ib;RP.A=A;RP.B=B;
    const add=(a,b,ks)=>{if(a&&b&&a!==b)for(const k of ks)if(typeof a[k]==='number'&&typeof b[k]==='number')lp.push([a,k,a[k],b[k]]);},same=(a,b,ks)=>{if(a&&b&&a.length===b.length)a.forEach((q,j)=>add(q,b[j],ks));};
    add(A.heli,B.heli,['x','y','tilt','yaw','door','gear']);add(A.hook,B.hook,['x','y','L']);if(A.sw.state===B.sw.state)add(A.sw,B.sw,['x','y']);
    same(A.surv,B.surv,['x','y','hp']);same(A.vessels,B.vessels,['x','y','ang','sink']);same(A.flares,B.flares,['x','y']);same(A.rogues,B.rogues,['x','env']);same(A.birds,B.birds,['x','y']);same(A.debris,B.debris,['x','y','a']);
    add(A.base,B.base,['ax']);add(A.base.med,B.base.med,['x']);same(A.base.walk,B.base.walk,['x']);
    ({heli,sw,hook,surv,vessels,flares,rogues,base,X,birds,gust,bolt,shouts,bub,note,debris}=A);if(!debris)debris=[];if(!shouts)shouts=[];if(!bub)bub={p:null,s:null};if(!note)note={t:'',life:0};}
  for(const e of RP.lp)e[0][e[1]]=e[2]+(e[3]-e[2])*f;
  const a=RP.A.s,b=RP.B.s,d=Math.max(0,b.T-a.T),e=f*d;T=a.T+e;H=Math.abs(b.H-a.H)>12?a.H:lerp(a.H,b.H,f);flash=a.flash;RP.cx=lerp(a.cx,b.cx,f);RP.cy=lerp(a.cy,b.cy,f);SEA.a=lerp(a.sa,b.sa,f);SEA.s=lerp(a.ss,b.ss,f);RP.clock=lerp(a.clock,b.clock,f);RP.banner=a.banner;heli.rot=T*34;
  {const P=a.P,o=[];for(let j=0;j<P.length;j+=7){const k=PKN[P[j+4]>>6];o.push({k,x:P[j]+P[j+5]*e,y:P[j+1]+P[j+6]*e+(k==='spray'?80*e*e:0),life:Math.max(.01,P[j+2]/100-e),max:P[j+3]/100,r:P[j+4]&63});}parts=o;}
  {const Q=a.Q,o=[];for(let j=0;j<Q.length;j+=9)o.push({x:Q[j]+Q[j+6]*e,y:Q[j+1]+Q[j+7]*e,r:Q[j+2]+Q[j+8]*e,a:Q[j+3]+e,life:Q[j+4],s:Q[j+5]});puffs=o;}
  fireT+=dt;if(fireT>=1/22){fireT=0;const seen=new Set();for(const v of vessels)if(!v.gone&&v.fire&&v.fb&&!seen.has(v.fb)){seen.add(v.fb);for(const q of v.fb)burn(q,.4+v.fire*.6,v.half>140?.42:v.half<50?.72:.54);}for(const q of X.oil||[])if(q.lit&&q.f&&!seen.has(q.f)){seen.add(q.f);burn(q.f,.55+.3*Math.min(1,q.life/8),.86);}}}
function rpEnd(){if(!RP.on)return;const L=RP.live;({heli,sw,hook,surv,vessels,flares,rogues,base,X,birds,gust,bolt,puffs,parts,shouts,bub,note,debris}=L);T=L.T;H=L.H;flash=L.flash;camX=L.camX;camY=L.camY;SEA.a=L.sa;SEA.s=L.ss;
  RP.on=false;RP.live=RP.A=RP.B=null;RP.lp=[];state='end';envT=-9;$('#rp').hidden=true;$('#end').hidden=false;}
function rpHud(g,F){const n=REC.f.length,bh=r(VH*.11),k=RP.i/(n-1),hh=Math.floor(H),mn=String(Math.floor((H%1)*60)).padStart(2,'0'),mm=Math.floor(RP.clock/60),ss=String(Math.floor(RP.clock%60)).padStart(2,'0'),h=heli,S=h.spec;
  g.fillStyle='#000';g.fillRect(0,0,VW,bh);g.fillRect(0,VH-bh,VW,bh);g.fillStyle=O;g.fillRect(0,VH-bh,r(VW*k),2);
  g.textBaseline='alphabetic';g.textAlign='left';g.font=F(8,1);if(performance.now()%1000<600){g.fillStyle='#ff3b3b';g.fillRect(12,r(bh/2)-3,6,6);}g.fillStyle='#eef3f1';g.fillText(tr('REPETICIÓN'),24,r(bh/2)+3);
  if(note&&note.life>0&&note.t){g.font='600 9px "IBM Plex Sans",system-ui,sans-serif';g.textAlign='center';g.fillStyle='#93adbb';g.fillText(note.t,VW/2,r(bh/2)+3,VW-300);}
  g.textAlign='left';g.font=F(8);g.fillStyle='#93adbb';g.fillText((M.name+' · '+S.name).toUpperCase(),12,VH-r(bh/2)+3,VW-150);
  g.textAlign='right';g.fillStyle='#eef3f1';g.fillText(`${String(hh).padStart(2,'0')}:${mn} AKDT · T+${mm}:${ss}`,VW-12,VH-r(bh/2)+3);
  for(const q of shouts)if(q.p)bubble(g,q.p.x,q.p.y-(!q.p.v||q.p.v.sit?12:20),q.t,'#16191d',q.p.nm?q.p.nm[0]+q.p.nm.slice(1).toLowerCase():q.who);
  if(bub.p&&!h.dead)bubble(g,h.x,h.y+S.rotY-6,bub.p.t,'#16191d',campCrew('p'));
  if(bub.s&&!h.dead){const out=!['aboard','hook','riding'].includes(sw.state);bubble(g,out?sw.x:h.x-(bub.p?h.dir*70:0),out?sw.y-20:h.y+S.rotY-(bub.p?26:6),bub.s.t,'#16191d',campCrew('s'));}
  g.textAlign='center';
  if(RP.banner){const y=r(VH*.3);g.fillStyle='rgba(6,18,28,.86)';g.fillRect(0,y,VW,46);g.fillStyle=O;g.fillRect(0,y,VW,3);g.fillStyle=BL;g.fillRect(0,y+43,VW,3);g.fillStyle='#fff';g.font='32px "Jersey 25","Pixelify Sans",Silkscreen,monospace';g.fillText(tr(RP.banner),VW/2,y+31);}
  const fa=Math.max(1-RP.i*REC.iv/.5,RP.hold>1.2?(RP.hold-1.2)/.8:0);if(fa>0){g.fillStyle=`rgba(0,0,0,${Math.min(1,fa)})`;g.fillRect(0,bh,VW,VH-bh*2);}}

// ---------- tutorial: the hint is worked out each frame from what is happening, so it follows the player rather than a fixed script ----------
const TUT={hoist:false};let NVG=null;
function tutKey(c){const P={ArrowUp:'▲',ArrowDown:'▼',ArrowLeft:'◀',ArrowRight:'▶'},Kb={ArrowUp:'↑',ArrowDown:'↓',ArrowLeft:'←',ArrowRight:'→',Space:tr('Espacio'),KeyD:'D',KeyT:'T',KeyS:'S',KeyW:'W',KeyR:'R',KeyB:'B',Digit1:'1',Digit2:'2'};
  if(!padOn)return Kb[c];if(P[c])return P[c];const b=document.querySelector(`#pad button[data-k="${c}"]`);return b?'«'+b.firstChild.nodeValue+'»':Kb[c];}
function tutHint(){const h=heli,main=vessels[0],rem=surv.filter(p=>['wait','ready','trap','hook'].includes(p.state)),out=sw.state!=='aboard';for(const p of surv)if(p.wat===undefined)p.wat=p.state!=='trap'&&(!p.v||p.v.type==='raft');
  const lesson=surv.every(p=>!p.wat||!['wait','ready'].includes(p.state));
  if(lesson&&!TUT.hoist&&!TUT.asked&&(sw.state==='swim'||sw.state==='with')){TUT.asked=true;if(sw.target&&sw.target.state==='ready')sw.target.state='wait';sw.target=null;sw.state='await';sw.recall=true;say('Nadador: los del agua ya están arriba. Subidme y bajo a la lancha con el cable.',6);}
  if(lesson&&sw.state==='hook')TUT.hoist=true;
  if(h.landed)return aboard.length||surv.some(p=>p.state==='safe')||(!rem.length&&!out)?['EN TIERRA','Los sanitarios se llevan a las víctimas a la ambulancia. Espera en tierra.']:!h.bat?['ARRANQUE','Conecta la batería principal con {BAT}: da energía a todo el helicóptero.']:!h.e1?['ARRANQUE','Arranca el motor 1 con {E1}.']:!h.e2?['ARRANQUE','Arranca el motor 2 con {E2}. Hacen falta los dos para volar.']:h.rpm<.93?['ARRANQUE','El rotor coge vueltas. En vuelo, un motor averiado parpadea en rojo; la grúa o el foco averiados se ponen en ámbar.']:['DESPEGUE','Mantén {UP} para despegar y gana altura. Al terminar la misión no hace falta apagar nada.'];
  if(hook.load&&hook.load!==sw)return['GRÚA','Víctima en la cesta. Súbela con {W} hasta la cabina.'];
  if(sw.state==='riding')return['GRÚA','Nadador enganchado. Súbelo con {W}.'];
  if(!rem.length){
    if(out)return['RECOGIDA',sw.state==='await'?'Todas las víctimas a bordo. Baja el gancho con {S} hasta el nadador.':'El nadador va hacia la víctima. Mantén el estacionario cerca, sin alejarte.'];
    if(h.doorT||h.door>.05)return['REGRESO','Recoge el cable con {W} y cierra la puerta con {D}.'];
    return h.x>430?['REGRESO','Vuelve a Kodiak hacia el oeste con {LEFT}. La flecha azul marca la base.']:['ATERRIZAJE','Baja despacio sobre la plataforma de la base, junto a las luces amarillas.'];}
  if(out){
    if(sw.state==='hook')return['NADADOR: MODO GRÚA','Bájalo despacio con {S} hasta la cubierta de la lancha.'];
    if(sw.state==='fall')return['NADADOR','El nadador va hacia la víctima. Mantén el estacionario cerca, sin alejarte.'];
    if(lesson&&!TUT.hoist&&sw.state==='await')return['GRÚA','El nadador pide subir. Baja el gancho con {S} hasta él.'];
    if(sw.state==='free')return['ATRAPADO','Queda alguien dentro de la lancha. El nadador entra a sacarlo: espera cerca.'];
    if(surv.some(p=>p.state==='ready'))return['GRÚA','Víctima asegurada. Colócate encima y baja la cesta con {S} hasta ella.'];
    if(sw.state==='await')return['GRÚA','Baja el gancho con {S} hasta el nadador.'];
    return['NADADOR','El nadador va hacia la víctima. Mantén el estacionario cerca, sin alejarte.'];}
  if(h.x<main.x-560)return['VUELO','Vuela hacia el este con {RIGHT}. La flecha amarilla marca el siniestro. {UP} y {DOWN} controlan la altura.'];
  if(Math.abs(h.vx)>75)return['APROXIMACIÓN','Frena con {LEFT} y quédate en estacionario cerca de las víctimas.'];
  if(h.door<.95)return['PUERTA','Abre la puerta lateral con {D}. Con la puerta abierta vuelas más despacio.'];
  if(lesson)return mode!=='hoist'?['NADADOR: MODO GRÚA','Ahora bajará a la lancha colgado del cable. Cambia a modo GRÚA con {T}.']:['NADADOR: MODO GRÚA','Ponte sobre la cubierta de la lancha y pulsa {SPACE}: el nadador se engancha al cable.'];
  return mode!=='jump'?['NADADOR: MODO SALTO','Cambia a modo SALTO con {T}.']:['NADADOR: MODO SALTO',`Ponte junto al náufrago del agua, a menos de ${Math.floor(jumpMax())} m de altura y casi parado, y pulsa {SPACE}: el nadador salta.`];}
function tutHud(g){if(heli.dead||banner)return;const q=tutHint(),KM={UP:'ArrowUp',DOWN:'ArrowDown',LEFT:'ArrowLeft',RIGHT:'ArrowRight',SPACE:'Space',D:'KeyD',T:'KeyT',S:'KeyS',W:'KeyW',R:'KeyR',BAT:'KeyB',E1:'Digit1',E2:'Digit2'};
  const text=tr(q[1]).replace(/\{(\w+)\}/g,(m,k)=>tutKey(KM[k])),w=Math.min(340,VW-250),x=r(VW/2-w/2);g.font='600 10px "IBM Plex Sans",system-ui,sans-serif';
  const ls=[''];for(const wd of text.split(' ')){const l=ls[ls.length-1],c=l?l+' '+wd:wd;if(l&&g.measureText(c).width>w-20)ls.push(wd);else ls[ls.length-1]=c;}
  const hh=20+ls.length*12,y=VH-hh-10;g.fillStyle='rgba(6,18,28,.88)';g.fillRect(x,y,w,hh);g.fillStyle=Y;g.fillRect(x,y,w,2);
  g.textAlign='left';g.textBaseline='alphabetic';g.font='700 8px Silkscreen,monospace';g.fillStyle=Y;g.fillText('TUTORIAL · '+tr(q[0]),x+10,y+13);
  const sv=surv.filter(p=>p.state==='aboard'||p.state==='safe').length;g.textAlign='right';g.fillStyle='#93adbb';g.fillText(sv+'/'+surv.length,x+w-10,y+13);
  g.textAlign='left';g.font='600 10px "IBM Plex Sans",system-ui,sans-serif';g.fillStyle='#eef3f1';ls.forEach((l,i)=>g.fillText(l,x+10,y+27+i*12));}
async function setLang(l){setLangCode(l);await loadLang(l);const c=getCfg();buildForm();setCfg(c);applyLang(wrap);musLabel();toMain();}

const CS={ph:0,t:0,arr:0,f:{}},CUT={on:false,t:0,men:[],pl:null,drop:null,raft:null,b:null,ev:0,note:'',noteT:0,fl:0};
function campGet(){try{return clamp(+localStorage.getItem('rkCamp')||0,0,CAMP.length);}catch(e){return 0;}}
function campSet(n){try{localStorage.setItem('rkCamp',String(n));}catch(e){}}
function campOpen(){const n=campGet();let h='',act=-1;CAMP.forEach((m,i)=>{if(m.act!==act){act=m.act;h+=`<div class="act">${tr(ACTS[act])}</div>`;}
    const lk=i>n,ok=!!m.cfg&&!lk,st=!m.cfg?tr('Próximamente'):lk?'<svg class="ico" viewBox="0 0 7 8" shape-rendering="crispEdges" aria-hidden="true"><path fill="currentColor" d="M2 0h3v1H2zM1 1h1v2H1zM5 1h1v2H5zM0 3h7v5H0z"/><path fill="var(--panel)" d="M3 4h1v2H3z"/></svg>'+tr('Bloqueada'):i<n?'<svg class="ico" viewBox="0 0 8 7" shape-rendering="crispEdges" aria-hidden="true" style="color:var(--hi);width:12px;height:10.5px;vertical-align:0"><path fill="currentColor" d="M6 0h2v2H6zM5 2h2v1H5zM4 3h2v1H4zM0 3h2v1H0zM1 4h4v1H1zM2 5h2v1H2z"/></svg>'+tr('Superada'):tr('Jugar');
    h+=`<button class="big${i===n&&ok?'':' alt'}" type="button" data-c="${i}"${ok?'':' disabled'}>${i+1}. ${tr(m.t)}<small>${st}</small></button>`;});
  $('#campList').innerHTML=h;showOnly('camp');}
$('#campList').addEventListener('click',e=>{const b=e.target.closest('button');if(b&&!b.disabled&&+b.dataset.c<=campGet())campPlay(+b.dataset.c);});
// title cards on black: each fades in, holds and fades out; a tap or key moves on
let cardQ=[],cardDone=null,cardTm=0;
function showCards(list,done){cardQ=list.slice();cardDone=done;guard.on=false;state='menu';showOnly('card');musInit();cardNext();}
function cardNext(){clearTimeout(cardTm);const el=$('#cardIn'),c=cardQ.shift();if(!c){const d=cardDone;cardDone=null;el.classList.remove('on');if(d)d();return;}
  el.classList.remove('on');cardTm=setTimeout(()=>{el.innerHTML=(c.k?`<div class="k">${c.k}</div>`:'')+(c.h?`<h1>${c.h}</h1>`:'')+(c.p||[]).map((l,i)=>`<p style="animation-delay:${.4+i*(c.gap||0)}s">${l}</p>`).join('');el.classList.add('on');
    cardTm=setTimeout(()=>{el.classList.remove('on');cardTm=setTimeout(cardNext,900);},(c.d||3.2)*1000);},el.innerHTML?700:60);}
function cardSkip(){if($('#card').hidden)return;clearTimeout(cardTm);$('#cardIn').classList.remove('on');cardTm=setTimeout(cardNext,250);}
addEventListener('keydown',e=>{if(!$('#card').hidden&&!['Shift','Control','Alt','Meta','Tab'].includes(e.key)){e.preventDefault();cardSkip();}});
function campCfg(i){const f=getCfg(),m=CAMP[i];return{...DEF,...CBASE,snd:f.snd,aids:f.aids,bars:f.bars,...m.cfg,heli:m.heli,camp:i};}
function campPlay(i){const m=CAMP[i],cards=[];if(!m||!m.cfg)return;
  if(i===0){cards.push({h:'ÉPSILON GAMES STUDIO',p:[tr('Presenta')],d:3.6});cards.push({k:tr('Creado y dirigido por'),h:'Jesús Navas Aller',d:3.6});cards.push({k:tr('Música original compuesta para Search & Rescue: Kodiak por'),h:'Jesús Navas Aller',d:4.2});
    cards.push({p:["Los marineros de Kodiak hablan de alguien que habita bajo las olas.","Dicen que acude cuando ya nadie más va a venir.","Quienes volvieron cuentan que unas manos los sostuvieron desde el fondo y una voz les pidió aguantar un poco más.","Claro que solo es un cuento de marineros."].map(tr),gap:3.4,d:21});}
  if(i===0||CAMP[i-1].act!==m.act)cards.push({k:tr('CAMPAÑA'),h:tr(ACTS[m.act]),d:3.2});
  cards.push({k:tr(`Misión ${i+1}`),h:tr(m.t),d:3});
  showCards(cards,()=>toBrief(campCfg(i)));}
function campNext(){const i=M.camp+1;if(CAMP[i]&&CAMP[i].cfg)campPlay(i);else showCards([{k:tr(CAMP[M.camp].act?'Fin del Acto II':'Fin del Acto I'),h:tr('Continuará…'),p:[tr(CAMP[M.camp].act?'Esa noche vuelve el temporal.':'El equipo nuevo está a punto de despegar.')],d:5}],toMain);}
function campInit(){CS.ph=0;CS.t=0;CS.arr=0;CS.f={};CUT.on=false;FIN.on=false;FIN.done=false;if(M.camp==null)return;
  if(M.camp===8&&surv.length){Object.assign(surv[0],{nm:'JACK',C:JKC,state:'jake'});mode='hoist';}if(M.camp===6)CS.t=22;
  if(M.camp===1&&surv.length>=2){Object.assign(surv[0],{nm:'WILL',kind:'hurt',C:CPIL,hp:.72,lines:['¡Aquí! ¡Aquí abajo!','¡Estamos aquí!']});Object.assign(surv[1],{nm:'BRAD',kind:'ok',C:BENC,hp:.8,lines:['¡Aquí abajo!','Ya era hora, 6582.']});}}
function campFinish(saved,tot,fail){const nx=$('#nextG'),ag=$('#again'),tm=$('#toMenu');nx.textContent=tr(M.camp!=null?'Continuar campaña':'Siguiente aviso');if(M.camp==null)return;const m=CAMP[M.camp],win=M.camp===7?!fail&&!!CS.f.stay:!fail&&saved>=Math.ceil(tot*(m.need||1));tm.hidden=true;
  if(win){campSet(Math.max(campGet(),M.camp+1));nx.hidden=false;ag.hidden=true;$('#endTitle').textContent=tr(M.camp===7?'Misión interrumpida':'Misión cumplida');if(m.outro){$('#endTxt').textContent=tr(m.outro);$('#endTxt').classList.add('story');}}
  else{nx.hidden=true;ag.hidden=false;if(!fail){$('#endTitle').textContent=tr('Misión fallida');$('#endTxt').textContent=tr(M.camp===1?'Hay que traer a los dos. Vuelve a intentarlo.':'Han sido demasiadas bajas. Hay que volver a intentarlo.');}}}
function campAdvance(){if(!CUT.on)return;CUT.on=false;$('#rp').hidden=true;$('#rpSpeed').hidden=false;campSet(Math.max(campGet(),M.camp+1));const i=M.camp+1;
  showCards([{h:tr('Horas después…'),d:2.6}],()=>campPlay(i));}
// what the story forces to happen in flight
function campUpdate(dt){if(M.camp==null)return;if(CUT.on){cutUpdate(dt);return;}const h=heli,v=vessels[0];if(h.dead||!v)return;
  if(M.camp===0){
    if(CS.ph===0){if(Math.abs(h.x-v.x)<340&&!h.landed)CS.arr+=dt;
      if(!CS.f.w1&&h.x>v.x*.42&&!h.landed){CS.f.w1=1;CS.wt=0;h.tilt+=.25;say('Cole: Will, los mandos no responden del todo bien.',4.5,'p');}
      if(CS.f.w1&&!CS.f.w2){CS.wt+=dt;h.tilt+=Math.sin(T*13)*.25*dt;if(CS.wt>5){CS.f.w2=1;say('Will: Seguimos. No les dejaremos abandonados.',4.5,'p');}}
      if((aboard.length>=1&&sw.state!=='aboard'&&sw.state!=='hook')||aboard.length>=2||CS.arr>85){CS.ph=1;CS.t=0;const d=M.wind<0?-1:1;
        rogues.push({x:h.x-d*820,v:d*135,a:105,w:180,env:.2,big:true,hit:new Set()});say('Kodiak: ¡ola gigante hacia vuestra posición! ¡Salid de ahí!',5,'r');beep(520,.5,.1);}}
    else{CS.t+=dt;X.pw=0;X.sink=Math.min(150,CS.t*45);{if(!CS.sd)CS.sd=h.x<v.x?-1:1;const tx=v.x+CS.sd*(v.half+58);h.vx+=clamp((tx-h.x)/40,-1,1)*230*dt;if(Math.abs(h.x-v.x)<v.half+24)h.x+=CS.sd*90*dt;}h.tilt+=Math.sin(T*19)*.5*dt;
      if(CS.t>1&&!CS.f.a){CS.f.a=1;say('¡No sube! ¡Los mandos no responden!',3.5,'p');}
      if(CS.t>2.6&&!CS.f.b){CS.f.b=1;say('¡Will, arriba! ¡ARRIBA!',3,'s');}
      const rg=rogues.find(q=>q.a>100);if(CS.t>7.5||(rg&&Math.abs(rg.x-h.x)<70))crash('Una ola gigante arrastró el helicóptero contra el pesquero.');}}
  else if(CAMP[M.camp].fl){const q=CAMP[M.camp].fl,go=(k,c)=>{if(c&&q[k]&&!CS.f[k]){CS.f[k]=1;say(q[k][1],5,q[k][0]);return true;}};
    go('arr',X.found&&Math.abs(h.x-v.x)<v.half+420&&!h.landed);go('jump',sw.state==='swim'||sw.state==='fall');
    if(go('spot',aboard.length>=1&&!h.landed)){X.noSpot=1;h.spot=false;X.alarm=3;}
    if(M.camp===6&&!h.landed&&CS.f.arr){CS.t-=dt;if(CS.t<=0){CS.t=rnd(26,42);X.jam=11;X.alarm=2;say(CS.f.jam?'Mac: ¡Otra vez la grúa! Aguanta, que vuelve.':'Mac: ¡La grúa se atasca! Va muy lenta. Esto ya lo avisé.',4,'p');CS.f.jam=1;}}
    go('all',CS.f.arr&&sw.state==='aboard'&&!surv.some(p=>['wait','ready','trap','hook'].includes(p.state))&&aboard.length>0);}
  if(M.camp===7){
    if(!CS.f.stay){const others=surv.filter(q=>q.state!=='trap'),left=others.some(q=>['wait','ready','hook'].includes(q.state));if(sw.state==='free'||(!left&&CS.f.arr&&Math.abs(h.x-v.x)<600&&!h.landed))CS.t+=dt;
      if(CS.t>2.2&&!hook.load){CS.f.stay=1;CS.t=0;sw.state='inside';sw.target=null;sw.x=v.x;hook.L=Math.min(hook.L,10);X.eng=1;X.alarm=4;h.fuel=Math.min(h.fuel,(h.x+60)/Math.max(60,h.spec.max*.5)*X.burn*1.3+30);X.bingo=1;M.gust=Math.min(M.gust,1);M.rogue=0;M.wind*=.45;gust=null;say('¡Fallo del motor 2! Perdemos potencia.',4,'p');}}
    else{CS.t+=dt;X.eng=1;X.pw=Math.max(X.pw,.86);X.mx=Math.max(X.mx,.9);X.sink=Math.min(X.sink,3);X.bingo=1;h.fuel=Math.max(h.fuel,h.fmax*.05);if(CS.t>4&&!CS.f.s1){CS.f.s1=1;say('Combustible en bingo. Jack, sal de ahí. ¡Nos vamos ya!',4.5,'p');}
      if(CS.t>9&&!CS.f.s2){CS.f.s2=1;shouts.push({p:{x:v.x,y:v.y-v.top*.4,v:v,state:'wait'},t:'Hay un hombre atrapado aquí dentro. No lo dejo. Marchaos y mandad a otro equipo.',life:7,who:'Jack'});}
      if(CS.t>16.5&&!CS.f.s3){CS.f.s3=1;say('¡Jack! ... Aguanta. Volveremos a por ti.',5,'p');}
      if(h.landed&&!h.on&&!overSea(h.x)&&!aboard.length&&(base.amb==='away'||base.amb==='leaving')&&!base.walk.length&&!endT&&CS.t>18){endInfo={};endT=2.5;}}}
  if(M.camp===8){const J=surv[0];if(FIN.on){finUpdate(dt);return;}if(FIN.done||!J)return;
    J.x=v.x+J.o;J.y=deckY(v,J.o);
    if(sw.state==='hook'&&!CS.f.j1){CS.f.j1=1;X.jam=5;X.alarm=2;say('Mac: La grúa va a tirones. Te dije que no estaba para salir.',5,'p');}
    if(sw.state==='tojack'){const sd=sw.x>=v.x?1:-1,ex=v.x+sd*(v.half+3),d=ex-sw.x;sw.x+=clamp(d,-58*dt,58*dt);sw.y=wave(sw.x)+1;sw.onV=null;sw.target=null;
      if(Math.abs(d)<3){sw.x=v.x+sd*(v.half-4);sw.y=deckY(v,sw.x-v.x);finStart(J);}return;}
    if(sw.state==='swim'&&!sw.onV){sw.state='tojack';sw.target=null;say('Mac: Brad al agua. Va nadando hacia el cangrejero.',4,'p');return;}
    if(['swim','await','with'].includes(sw.state)){if(Math.abs(sw.x-v.x)<v.half&&sw.y<wave(sw.x)-6)finStart(J);else if(!CS.f.w&&sw.state==='await'){CS.f.w=1;say('Mac: Ponlo sobre la cubierta, Will.',5,'p');}}}
  if(M.camp===1){const ben=surv[1];
    if(X.found&&!CS.f.a){CS.f.a=1;say('¡Ahí están! Balsa a la vista.',4,'p');}
    if(sw.state==='with'&&!CS.f.b){CS.f.b=1;say('Brad, somos el 6582 de Sitka. Os llevamos a casa.',4,'s');if(ben&&(ben.state==='wait'||ben.state==='ready'))shouts.push({p:ben,t:'Primero Will. Tiene la pierna rota.',life:4});}
    if(aboard.length>=2&&sw.state==='aboard'&&!CS.f.c){CS.f.c=1;say('Kodiak, aquí el 6582. Los tenemos a los dos. Volvemos a casa.',5,'p');}}}
// cut-scene after the crash: two men alone in the dark, the C-130 overhead, flares and a raft
function cutStart(){const h=heli,d=M.wind<0?-1:1,px=h.x+d*300;CUT.on=true;CUT.t=0;CUT.ev=0;CUT.pl=null;CUT.drop=null;CUT.raft=null;CUT.b=null;CUT.note='';CUT.fl=0;endT=0;banner='';sw.state='aboard';hook.L=0;
  CUT.men=[{n:'Brad',x:px-9,y:0,C:BENC,ph:1},{n:'Will',x:px+9,y:0,C:CPIL,ph:3}];h.x=px;h.y=-70;h.vx=0;shouts=[];bub={p:null,s:null};note={t:'',life:0};
  $('#pad').hidden=true;$('#rp').hidden=false;$('#rpSpeed').hidden=true;}
function cutUpdate(dt){const C=CUT;C.t+=dt;
  while(C.ev<CEV.length&&C.t>=CEV[C.ev][0]){const e=CEV[C.ev++];if(e[1]===-2){C.pl={x:camX-150,y:camY+VH*.27,v:150,dr:0};c130Snd(12);}else if(e[1]===-1){C.note=e[2];C.noteT=7;beep(1400,.05,.04,'sine');}else C.b={m:e[1],t:e[2],life:3.4};}
  if(C.b&&(C.b.life-=dt)<=0)C.b=null;if(C.noteT>0)C.noteT-=dt;
  const mx=(C.men[0].x+C.men[1].x)/2;
  if(C.pl){const q=C.pl;q.x+=q.v*dt;q.y=camY+VH*.27;if(q.x+59>mx-110&&q.dr<3&&(C.fl-=dt)<=0){C.fl=.6;q.dr++;flares.push({x:q.x+59,y:q.y+34,vx:60,vy:30,life:22});}
    if(q.x+59>mx+30&&!q.rf){q.rf=1;C.drop={x:q.x+59,y:q.y+34,vx:90,vy:40};}if(q.x>camX+VW+200)C.pl=null;}
  if(C.drop){const q=C.drop;q.vx*=1-dt*1.2;q.vy+=(95-q.vy)*dt*2;q.x+=q.vx*dt;q.y+=q.vy*dt;if(q.y>=wave(q.x)-3){const t=VT.raft;C.raft={...t,type:'raft',x:q.x,y:0,ang:0,top:4,fire:0,sinking:false,list:0,sink:0,sinkT:999,gone:false,nc:0};vessels.push(C.raft);splash(q.x);C.drop=null;}}
  C.men.forEach((m,i)=>{if(C.raft&&C.t>26){const tx=C.raft.x+(i?5:-5);m.x+=clamp(tx-m.x,-24*dt,24*dt);m.in=Math.abs(tx-m.x)<2;}else m.x+=M.wind*.03*dt;m.y=m.in?deckY(C.raft,m.x-C.raft.x):wave(m.x)+1;});
  heli.x+=(mx+(C.raft?(C.raft.x-mx)*.5:0)-heli.x)*Math.min(1,dt*1.2);
  if(C.t>44)campAdvance();}
function cutDrawBack(g){for(const m of CUT.men)man(m.x,m.y,m.C,m.in?1:CUT.raft&&CUT.t>26?5:1,m.ph,1);}
function cutDrawSky(g){const d=CUT.drop;
  if(d){const x=r(d.x),y=r(d.y);g.fillStyle='rgba(255,255,255,.75)';g.fillRect(x-7,y-20,15,2);g.fillRect(x-9,y-18,2,3);g.fillRect(x+8,y-18,2,3);g.fillRect(x-5,y-16,1,12);g.fillRect(x+5,y-16,1,12);g.drawImage(SPR.raft,x-SPR.raft.ox,y-SPR.raft.oy);}}
function cutHud(g,F){const bh=r(VH*.11),C=CUT;g.fillStyle='#000';g.fillRect(0,0,VW,bh);g.fillRect(0,VH-bh,VW,bh);
  if(C.noteT>0){g.font='600 9px "IBM Plex Sans",system-ui,sans-serif';g.textAlign='center';g.textBaseline='alphabetic';g.fillStyle='#eef3f1';g.fillText(tr(C.note),VW/2,VH-r(bh/2)+3,VW-40);}
  if(C.b){const m=C.men[C.b.m];bubble(g,m.x,m.y-20,C.b.t,'#16191d');}
  const fa=Math.max(1-C.t/1.6,(C.t-42)/2);if(fa>0){g.fillStyle=`rgba(0,0,0,${Math.min(1,fa)})`;g.fillRect(0,0,VW,VH);}}

// ---------- the last hoist: once Brad is on the deck the scene plays itself ----------
const JKC=SWC,BNC=BENC,FIN={on:false,done:false,t:0,ev:0,b:null,L:0,J:null,st:'',bn:null,jk:null,hx:0,hy:0,v:null};
function finStart(J){const h=heli,v=vessels[0];Object.assign(FIN,{on:true,done:false,ax:null,t:0,ev:0,b:null,J,st:'deck',v,wv:1,th:2,cy:null,hx:h.x,hy:Math.min(h.y,deckY(v,J.o)-150),L:hook.L});
  FIN.bn={x:sw.x,y:sw.y,vy:0,st:'deck'};FIN.jk={x:J.x,y:J.y};J.state='fin';sw.state='fin';sw.target=null;shouts=[];bub={p:null,s:null};note={t:'',life:0};M.crash=false;M.gust=0;M.rogue=0;gust=null;$('#pad').hidden=true;}
function finUpdate(dt){const F=FIN,h=heli,S=h.spec,v=F.v,B=F.bn,K=F.jk,t=(F.t+=dt);for(const k in KEY)KEY[k]=false;
  while(F.ev<FEV.length&&t>=FEV[F.ev][0]){const e=FEV[F.ev++];F.b={w:e[1],t:e[2],life:e[3]};if(e[1]==='m')beep(700,.12,.08);}
  if(F.b&&(F.b.life-=dt)<=0)F.b=null;
  const jo=F.J.o,jx=v.x+jo,dky=o=>deckY(v,o);
  if(t<18){K.x=jx;K.y=dky(jo);B.x+=clamp(jx+11-B.x,-30*dt,30*dt);B.walk=Math.abs(jx+11-B.x)>1;B.y=dky(clamp(B.x-v.x,-v.half+2,v.half-2));
    {const dd=jx+4-S.doorMid-F.hx;if(t>10||(t>2&&Math.abs(dd)>40)){const sp=Math.max(40,Math.abs(dd)*.6);F.hx+=clamp(dd,-sp*dt,sp*dt);}}if(t>10){F.L=Math.min(dky(jo)-18-(h.y+S.belly),F.L+60*dt);}else F.L=Math.max(30,F.L-50*dt);}
  else{if(F.st==='deck'){F.st='up';v.sinking=true;v.sinkT=16;v.sink=Math.max(v.sink,.12);}
    if(t>21){if(F.ax==null)F.ax=F.hx;if(t<=58)F.hx+=clamp(F.ax+120-F.hx,-30*dt,30*dt);else F.hx-=Math.min(160,(t-58)*60)*dt;}
    if(F.st==='up'){const jerk=Math.sin(t*6)>.2?1:.2;F.L=Math.max(24,F.L-(t<24?26:9)*jerk*dt);if(t>=30){F.st='hang';F.L=Math.max(F.L,24)+6;flash=.6;boomSnd(.5);}}
    if(t>20)F.hy+=(-190-F.hy)*Math.min(1,dt*.5);F.wv=Math.min(2.5,(F.wv||1)+dt*.12);
    if((F.th-=dt)<=0){F.th=rnd(3.2,6.5);flash=1;const bx=camX+rnd(40,VW-40);let y=camY,x=bx;const q=[x,y];while(y<-10){y+=rnd(14,30);x+=rnd(-16,16);q.push(x,y);}bolt={p:q,t:.25};setTimeout(()=>boomSnd(.7),350);}
    else if(F.st==='hang'&&t>=40.2){F.st='gone';B.st='fall';B.x=hook.x+8;B.y=hook.y+30;B.vy=10;}
    if(t>55.5&&F.st==='gone')F.L=Math.max(0,F.L-38*dt);
    if(B.st==='fall'){B.vy+=430*dt;B.y+=B.vy*dt;if(B.y>=wave(B.x)){B.st='sink';B.t=0;splash(B.x);boomSnd(.3);}}
    else if(B.st==='sink'){B.t+=dt;B.y=wave(B.x)+2+B.t*9;if(Math.random()<dt*9&&B.t<5)parts.push({k:'mist',x:B.x+rnd(-5,5),y:wave(B.x)-1,vx:rnd(-5,5),vy:rnd(-8,-2),life:rnd(.4,.8),max:.8,r:1});}}
  if(t>1.6&&t>19&&t<40&&Math.sin(t*7)>.96)beep(1100,.05,.05);
  if(t>58)h.dir=-1;h.x+=(F.hx-h.x)*Math.min(1,dt*3);h.y+=(F.hy+Math.sin(t*1.1)*3-h.y)*Math.min(1,dt*2);h.vx=0;h.vy=0;h.landed=false;h.doorT=t>58?0:1;h.fuel=Math.max(h.fuel,h.fmax*.2);hook.L=F.L;hook.load=null;hook.swv=0;hook.bw=0;gust=null;
  if(t>64){F.on=false;F.done=true;F.b=null;sw.state='gone';campEnding();}}
function finDrawBack(g){const F=FIN;if(!F.on){if(M.camp===8&&!F.done&&surv[0]&&surv[0].state==='jake'&&vessels[0]&&!vessels[0].gone){const J=surv[0];man(J.x,J.y,JKC,0,1);txt((c,x,y,w,h)=>{g.fillStyle=c;g.fillRect(x,y,w,h);},'#fff','JACK',r(J.x)-8,r(J.y)-30);}return;}
  const B=F.bn,K=F.jk;if(F.st==='deck'){man(K.x,K.y,JKC,4,1);man(B.x,B.y,BNC,B.walk?2:4,2,-1);}
  if(B.st==='sink'&&B.t<5)man(B.x,B.y,BNC,4,0,1,1);}
function finDrawFront(g){const F=FIN,B=F.bn,hx=r(hook.x),hy=r(hook.y);if(!F.on)return;
  if(F.st==='up'||F.st==='hang'||F.st==='gone'){if(F.L>8||F.st!=='gone'){man(hx,hy+15,JKC,4,0,1,1);g.fillStyle=JKC[0];pl(g,hx-2,hy+4,hx,hy);pl(g,hx+2,hy+4,hx,hy);}
    if(F.st==='up')man(hx+6,hy+17,BNC,4,0,1,1);
    else if(F.st==='hang'){const q=r(Math.sin(F.t*2.2)*1.5);man(hx+8+q,hy+30,BNC,4,0,1,1);g.fillStyle='#f1d2b6';pl(g,hx+3,hy+10,hx+7+q,hy+16);}
    else if(F.L>8){g.fillStyle=JKC[0];pl(g,hx+3,hy+10,hx+7,hy+16);}}
  if(B.st==='fall')man(B.x,B.y,BNC,0,0,1,1);}
function finHud(g,F){const bh=r(VH*.11),Q=FIN,h=heli,S=h.spec,B=Q.bn,K=Q.jk;g.fillStyle='#000';g.fillRect(0,0,VW,bh);g.fillRect(0,VH-bh,VW,bh);
  if(Q.b){const w=Q.b.w,dk=Q.st==='deck';if(w==='m')bubble(g,h.x,h.y+S.rotY-6,Q.b.t,'#16191d');else if(w==='j')bubble(g,dk?K.x-78:hook.x-84,dk?K.y-16:hook.y+16,Q.b.t,'#16191d');else bubble(g,dk?B.x+82:hook.x+92,dk?B.y+2:hook.y+46,Q.b.t,'#16191d');}
  const fa=Q.t>60.5?(Q.t-60.5)/3:0;if(fa>0){g.fillStyle=`rgba(0,0,0,${Math.min(1,fa)})`;g.fillRect(0,0,VW,VH);}}
function campEnding(){campSet(CAMP.length);banner='';showCards([
  {p:[tr('Buscaron a Brad durante nueve días.'),tr('Nunca lo encontraron.'),tr('Jack volvió a volar un mes después. Nunca ha dejado a nadie en el agua.')],gap:3.2,d:13},
  {k:'Search &amp; Rescue: Kodiak',p:[tr('Creado, dirigido y programado píxel a píxel por Jesús Navas Aller.'),tr('Dedicada a una de mis películas favoritas, «The Guardian», y a las tripulaciones de la Air Station Kodiak de la Guardia Costera de los Estados Unidos y a todos los que salen cuando los demás vuelven.'),tr('Obra de ficción sin relación oficial con la U.S. Coast Guard. Los nombres de barcos y los indicativos son inventados.')],gap:2.5,d:17},
  {h:tr('Tiempo después…'),d:2.6}],epiStart);}
// ---------- epilogue: a dusk rescue that plays by itself, and what the survivor says on the long flight home ----------
const EPI={on:false,t:0,ev:0,j:null,s:null,b:null,X0:500000,vx:0};
function epiStart(){const f=getCfg();guard.on=false;cfgCur={...DEF,...CBASE,side:'e',snd:f.snd,heli:'jayhawk',ves:'sail',cond:'list',deck:0,water:0,dist:16,hour:6,cycle:'1',sea:'2',wind:18,gust:'0',wx:'rain',crash:'0',fuel:'0',aids:'0',bars:'0',mode:'jump'};
  M=buildMission(cfgCur);briefM=1;makeClouds();startMission();const E=EPI,h=heli,X0=E.X0;E.on=true;E.t=0;E.ev=0;E.b=null;E.vx=0;M.dist=X0+4000;M.crash=false;M.rogue=0;H=6.1;envT=-9;
  vessels[0].x=X0+vessels[0].half+34;h.landed=false;h.bat=h.e1=h.e2=1;h.rpm=1;h.lights=true;h.x=X0-70;h.y=-105;h.dir=1;h.yaw=1;h.doorT=1;h.door=1;h.spot=false;camX=h.x-VW/2;note={t:'',life:0};bub={p:null,s:null};shouts=[];
  E.s={x:X0,y:0,st:'water'};E.j={x:0,y:0,vy:0,st:'in'};showOnly('');$('#pad').hidden=true;$('#rp').hidden=false;$('#rpSpeed').hidden=true;}
function epiUpdate(dt){const E=EPI,h=heli,S=h.spec,t=(E.t+=dt),X0=E.X0,J=E.j,V=E.s;for(const k in KEY)KEY[k]=false;
  while(E.ev<EEV.length&&t>=EEV[E.ev][0]){const e=EEV[E.ev++];E.b={who:e[1],t:e[2],life:e[3]};}
  if(E.b&&(E.b.life-=dt)<=0)E.b=null;
  let tx=X0-70,ty=-105+Math.sin(t*1.3)*3;
  if(t>9&&t<16.5)tx=X0-4-S.doorMid;
  if(t<16.5){h.x+=(tx-h.x)*Math.min(1,dt*1.6);h.y+=(ty-h.y)*Math.min(1,dt*2);h.tilt=0;}
  else{h.dir=-1;E.vx=Math.min(195,E.vx+70*dt);h.x-=E.vx*dt;h.y+=(-150+Math.sin(t*.9)*5-h.y)*Math.min(1,dt*.8);h.tilt=-.11*E.vx/195;h.doorT=0;}
  h.vx=h.dir<0?-E.vx:0;h.vy=0;h.landed=false;h.fuel=h.fmax;
  if(V.st==='water'){V.x+=M.wind*.03*dt;V.y=wave(V.x)+1;}
  if(J.st==='in'&&t>3.6){J.st='fall';J.x=h.x+S.doorMid;J.y=h.y+S.belly;J.vy=20;}
  else if(J.st==='fall'){J.vy+=500*dt;J.y+=J.vy*dt;if(J.y>=wave(J.x)){J.st='swim';splash(J.x);}}
  else if(J.st==='swim'){const d=V.x-8-J.x;J.x+=clamp(d,-36*dt,36*dt);J.y=wave(J.x)+1;if(Math.abs(d)<1.5)J.st='with';}
  else if(J.st==='with'){J.x=V.x-8;J.y=wave(J.x)+1;}
  const surf=wave(h.x+S.doorMid)-(h.y+S.belly);
  if(t>10.5&&t<13.2)hook.L=Math.min(surf-4,hook.L+70*dt);
  else if(t>=13.2&&t<16.5){if(J.st==='with'){J.st='hook';V.st='hook';}hook.L=Math.max(0,hook.L-34*dt);if(hook.L<=6&&J.st==='hook'){J.st='in2';V.st='in2';M.rain=0;}}
  else if(t>=16.5)hook.L=0;
  if(t>23)M.cloud=Math.max(.35,M.cloud-dt*.01);
  if(t>56.5)epiEnd();}
function epiDrawBack(g){const J=EPI.j,V=EPI.s;if(V.st==='water')man(V.x,V.y,EVC,1,2);if(J.st==='swim')man(J.x,J.y,JKC,5,1,1);else if(J.st==='with')man(J.x,J.y,JKC,1,4);}
function epiDrawFront(g){const J=EPI.j,hx=r(hook.x),hy=r(hook.y);if(J.st==='fall')man(J.x,J.y,JKC,4,0,1,1);
  if(J.st==='hook'){man(hx-3,hy+15,JKC,4,0,1,1);man(hx+5,hy+16,EVC,4,2,1,1);g.fillStyle=JKC[0];pl(g,hx-3,hy+2,hx,hy);}}
function epiHud(g,F){const E=EPI,bh=r(VH*.11),h=heli,S=h.spec;g.fillStyle='#000';g.fillRect(0,0,VW,bh);g.fillRect(0,VH-bh,VW,bh);
  if(E.b){const J=E.j,out=E.b.who==='Jack'&&(J.st==='with'||J.st==='swim');bubble(g,out?J.x:h.x,out?J.y-18:h.y+S.rotY-6,E.b.t,'#16191d',E.b.who==='Náufrago'?tr('Náufrago'):E.b.who);}
  const fa=Math.max(1-E.t/1.8,(E.t-54)/2.4);if(fa>0){g.fillStyle=`rgba(0,0,0,${Math.min(1,fa)})`;g.fillRect(0,0,VW,VH);}}
function epiEnd(){if(!EPI.on)return;EPI.on=false;$('#rp').hidden=true;$('#rpSpeed').hidden=false;sndUpdate();showCards([
  {h:'So others may live',p:[tr('Para que otros vivan'),tr('Lema de los nadadores de rescate de la U.S. Coast Guard')],gap:1.6,d:9},
  {k:tr('Creado y dirigido por'),h:'Jesús Navas Aller',d:5},{h:tr('Fin'),d:4}],toMain);}

// ---------- crash: the airframe breaks up — tail boom, fuselage, blades and bits fly apart, hit the water, float a moment and go under ----------
let debris=[];const DEBC={};
function debSprites(S){let q=DEBC[S.spr];if(q)return q;const sp=SPR[S.spr],cut=r(sp.ox-S.half*.42),mkp=(x0,x1)=>{const c=document.createElement('canvas');c.width=x1-x0;c.height=sp.height;c.getContext('2d').drawImage(sp,-x0,0);return c;};
  return DEBC[S.spr]={tail:mkp(0,cut),body:mkp(cut,sp.width),cut,ox:sp.ox,oy:sp.oy,h:sp.height,w:sp.width};}
function crashDebris(h){const S=h.spec,q=debSprites(S),d=h.dir<0?-1:1,cy=h.y+q.h/2-q.oy,P=(k,lx,o)=>debris.push(Object.assign({k,x:h.x+d*lx,y:cy,vx:h.vx*.6,vy:0,a:h.tilt*d,va:0,f:d,wet:0,t:0,sk:0},o));
  P('tail',q.cut/2-q.ox,{vx:h.vx*.5-d*rnd(60,120),vy:rnd(-200,-120),va:-d*rnd(2.5,4.5),sz:26,fl:rnd(1.6,2.6)});
  P('body',(q.cut+q.w)/2-q.ox,{vx:h.vx*.7+d*rnd(10,50),vy:rnd(-130,-70),va:d*rnd(.8,1.8),sz:40,fl:rnd(2.2,3.2),burn:1});
  for(let i=0;i<4;i++)P('blade',0,{y:h.y+S.rotY,len:r(S.rotR*rnd(.55,.9)),vx:(i%2?1:-1)*rnd(140,330)+h.vx*.3,vy:rnd(-300,-120),a:rnd(0,3),va:(i%2?1:-1)*rnd(9,16),sz:8,fl:rnd(.4,1.2)});
  P('door',S.door[0]+6,{vx:d*rnd(40,140),vy:rnd(-230,-120),va:rnd(-7,7),sz:6,fl:rnd(.5,1.5)});
  for(let i=0;i<16;i++)P('bit',rnd(-S.half,S.half),{y:h.y+rnd(-8,8),vx:rnd(-240,240)+h.vx*.4,vy:rnd(-330,-60),va:rnd(-12,12),sz:2,fl:rnd(.2,.8),c:i%3,w:1+(Math.random()*3|0)});}
function debUpdate(dt){if(!debris.length)return;
  for(const p of debris){p.t+=dt;const big=p.sz>20,hb=big?8:1;
    if(!p.wet){if(p.rest)continue;p.vy+=430*dt;p.vx*=1-dt*.25;p.x+=p.vx*dt;p.y+=p.vy*dt;p.a+=p.va*dt;
      if(p.burn&&Math.random()<dt*45)parts.push({k:Math.random()<.4?'flame':'smoke',x:p.x+rnd(-14,14),y:p.y+rnd(-6,6),vx:rnd(-20,20),vy:rnd(-50,-10),life:rnd(.5,2.2),max:2.2,r:Math.max(1,rnd(1,5)|0)});
      const gy=groundY(p.x),v=vesselAt(p.x),dk=M.camp!==0&&v&&heightAt(v,p.x-v.x)?deckY(v,p.x-v.x):1e9,w=wave(p.x),solid=Math.min(gy,dk);
      if(p.vy>0&&solid<w&&p.y+hb>=solid){p.y=solid-hb;if(p.vy>70){p.vy=-p.vy*.28;p.vx*=.55;p.va*=.4;}else{p.vy=0;p.vx=0;p.va=0;p.rest=1;p.a=Math.round(p.a/3.1416)*3.1416;}}
      else if(p.vy>0&&p.y>=w-2){p.wet=1;p.t=0;p.vy=0;p.vx*=.35;p.va*=.3;if(p.k==='blade'){p.a=rnd(-.15,.15);p.va=0;}
        for(let i=0,n=p.sz*5;i<n;i++)parts.push({k:'spray',x:p.x+rnd(-p.sz,p.sz)*.5,y:w,vx:rnd(-80,80)*(1+p.sz/40),vy:rnd(-210,-40)*(.55+p.sz/55),life:rnd(.4,1.1),max:1.1,r:1});
        if(big){boomSnd(.45);for(let i=0;i<10;i++)parts.push({k:'mist',x:p.x+rnd(-18,18),y:w-rnd(0,6),vx:rnd(-30,30),vy:rnd(-20,-4),life:rnd(.5,1.1),max:1.1,r:rnd(2,4)});}}
    }else{const w=wave(p.x);p.x+=p.vx*dt;p.vx*=1-dt*2;
      if(p.t<p.fl){p.y+=(w-(big?3:0)-p.y)*Math.min(1,dt*7);p.a+=p.va*dt+Math.sin(T*3+p.x)*.2*dt;p.va*=1-dt*2;
        if(p.burn&&Math.random()<dt*26)parts.push({k:'smoke',x:p.x+rnd(-12,12),y:p.y-6,vx:rnd(-10,10),vy:rnd(-40,-14),life:rnd(1,2.4),max:2.4,r:Math.random()<.4?2:1});}
      else{p.sk+=dt*(big?9:17);p.y=w-(big?3:0)+p.sk;p.a+=p.f*(p.k==='tail'?-.5:.35)*dt;
        if(Math.random()<dt*(big?16:3))parts.push({k:'mist',x:p.x+rnd(-p.sz,p.sz)*.5,y:w-1,vx:rnd(-6,6),vy:rnd(-9,-2),life:rnd(.3,.7),max:.7,r:1});
        if(p.sk>p.sz+30)p.gone=1;}}}
  debris=debris.filter(p=>!p.gone);}
function drawDebris(g){if(!debris.length||!heli)return;const S=heli.spec,q=debSprites(S);
  for(const p of debris){g.save();g.translate(r(p.x),r(p.y));g.rotate(p.a);
    if(p.k==='tail'||p.k==='body'){const c=q[p.k];g.scale(p.f,1);g.drawImage(c,-(c.width>>1),-(c.height>>1));}
    else if(p.k==='blade'){const l=p.len>>1;g.fillStyle='#22262b';g.fillRect(-l,0,p.len,2);g.fillStyle=Y;g.fillRect(l-3,0,3,2);}
    else if(p.k==='door'){const dp=SPR[S.spr+'Door'];g.scale(p.f,1);g.drawImage(dp,-(dp.width>>1),-(dp.height>>1));}
    else{g.fillStyle=[W,O,'#3a424c'][p.c];g.fillRect(0,0,p.w,p.w);}
    g.restore();}}

// ---------- hazards, emergencies, triage, log and sound ----------
let X={pw:1,mx:1,burn:1,sink:0,hk:1,found:true,oil:[],rocks:[]};
function mkRock(x,hh,ice){const w=Math.round(hh*(ice?1.4:.6)),n=noise1(x|0),top=new Float32Array(w),H=Math.round(hh)+24;
  for(let i=0;i<w;i++){const t=1-Math.abs(i/w-.5)*2;top[i]=hh*Math.pow(Math.max(0,t),ice?.45:.6)*(.72+.28*n(i*.09))+(ice?0:n(i*.5)*5);}
  const L=ice?[[238,247,252],[176,212,234],[128,176,214]]:[[118,112,106],[74,74,80],[50,52,60]];
  const spr=pix(w,H,(i,y)=>{const d=y-(Math.round(hh)-top[i]);if(d<0)return null;const lit=i<w*(.42+(n(y*.05)-.5)*.3),st=n((i+d*(lit?.8:-.8))*.07)>.6;
    if(!ice&&d<4+n(i*.3)*5&&lit)return[226,226,214];return lit?(st?L[1]:L[0]):(st?L[2]:L[1]);});
  return{x,w,h:Math.round(hh),top,spr,ice,vx:ice?rnd(-3,3):0};}
function xInit(){
  const main=vessels[0],err=[0,rnd(500,1000),rnd(1300,2400)][M.search]*(Math.random()<.5?-1:1);
  X={pw:1,mx:1,burn:1,sink:0,hk:1,found:!M.search,datum:M.west?Math.min(WXS-400,main.x+err):Math.max(700,main.x+err),clue:0,clueT:rnd(18,30),failT:rnd(35,70),eng:0,noSpot:0,jam:0,ice:0,noHoist:0,snag:0,snagT:0,bingo:0,alarm:0,need:0,
    boomT:rnd(22,45),warn:0,warnV:null,seat:0,oil:[],oilT:rnd(8,16),rocks:[],dead0:false,un:0,c2:M.camp==null&&!M.tut&&Math.random()<.4,c2d:0};
  sw.sta=1;sw.struggle=0;sw.tired=0;puffs=[];
  if(M.triage)for(const p of surv){const q=Math.random();p.kind=q<.2?'hurt':q<.32?'child':q<.45&&!p.v?'uncon':'ok';}
  if(M.panic)for(const p of surv){if(!p.v&&Math.random()<.4)p.pan=1;else if(p.v&&!p.v.sit&&Math.random()<.22)p.jump=1;}
  if(main.half>40)for(let i=0;i<M.trapN;i++)surv.push({v:main,o:lerp(main.crew[0],main.crew[1],rnd(.2,.8)),x:main.x,y:0,hp:1,state:'trap',ph:rnd(0,6),free:0,kind:'ok'});
  const mkV=(type,x,o)=>{const t=VT[type];return Object.assign({...t,type,x,y:0,ang:0,top:Math.max(...t.prof.map(p=>p[2])),fire:0,sinking:false,list:0,sink:0,sinkT:999,gone:false,nc:0},o);};
  if(M.obst==='rock')for(const s of[-1,1])X.rocks.push(mkRock(main.x+s*(main.half+rnd(170,360)),rnd(110,200),0));
  if(M.obst==='ice')for(let i=0;i<3;i++)X.rocks.push(mkRock(main.x+(i-1)*(main.half+rnd(260,400))+(i===1?main.half+rnd(380,520):0),rnd(44,96),1));
  if(M.obst==='ship')vessels.push(mkV('fishing',main.x+main.half+320,{mover:1,md:-1,home:main.x,rng:main.half+440}));
  if(M.land==='cutter')vessels.push(mkV('cutter',M.west?Math.min(-3500,(M.dist-1700)*.5):clamp(M.dist*.5,800,2200),{cutter:1}));
  if(M.camp==null&&!M.tut){if(main.sinking&&main.half>=60&&Math.random()<.45){main.brkAt=rnd(.16,.36);main.bo=Math.round(lerp(main.crew[0],main.crew[1],rnd(.35,.65)));}
    for(const v of vessels)if(v.type==='fishing')v.sk=(Math.random()*FISHP.length|0)+'|'+(Math.random()*FISHN.length|0);}
  sndInit();
  if(M.land==='cutter')say('Kodiak: el guardacostas es vuestro punto de retorno. Descargad y repostad en su cubierta de vuelo.',7,'r');
}
const WXC={clear:0,cloud:.6,rain:.85,storm:1,fog:.7,snow:.8};
function wxDyn(dt){const W=X.wx||(X.wx={t:rnd(45,110),to:null,k:0});if(heli.landed&&!W.to)return;
  if(!W.to){W.t-=dt;if(W.t>0)return;const cur=M.wx,opt={clear:['cloud','rain','fog'],cloud:['clear','rain','storm','fog'],rain:['cloud','storm','clear'],storm:['rain','cloud'],fog:['cloud','clear','rain'],snow:['cloud','clear']}[cur]||['cloud'];
    W.to=pick(opt);W.k=0;W.c0=M.cloud;W.f0=M.fogA;W.w0=M.wind;W.w1=M.wind*(W.to==='storm'?1.5:W.to==='clear'?.7:W.to==='rain'?1.2:1);
    say({clear:'Kodiak: el tiempo abre. Cielos despejándose en la zona.',cloud:'Kodiak: cambio de tiempo. Se cubre el cielo.',rain:'Kodiak: frente de lluvia entrando en vuestra zona.',storm:'Kodiak: ¡aviso! Tormenta eléctrica entrando en la zona.',fog:'Kodiak: banco de niebla entrando. Visibilidad en descenso.'}[W.to],6,'r');return;}
  if(W.k>=1)return;W.k=Math.min(1,W.k+dt/22);const k=W.k,to=W.to;M.cloud=W.c0+(WXC[to]-W.c0)*k;M.fogA=W.f0+((to==='fog'?.8:0)-W.f0)*k;M.wind=W.w0+(W.w1-W.w0)*k;
  if(k>=.5&&M.wx!==to){M.wx=to;M.rain=to==='rain'||to==='storm'?1:0;M.snow=false;M.storm=to==='storm';M.fog=to==='fog';if(to==='storm')M.gust=Math.max(M.gust,2);}
  if(((k*22)|0)!==(((k-dt/22)*22)|0))envT=-9;}
function xFog(){return M.fogA>.02?M.fogA:M.land==='fog'&&heli?.86*clamp((1500-Math.abs(heli.x))/800,0,1):0;}
function xFreeTarget(){if(sw.recall||!room())return false;const t=surv.find(p=>p.state==='trap');if(!t)return false;sw.target=t;sw.state='free';say('Nadador: voy a por el atrapado.',3);return true;}
function xReach(t){if(t.pan&&!t.calm){t.calm=1;sw.struggle=4;say('Nadador: ¡tranquilo, suéltame!',3);shouts.push({p:t,t:'¡No me sueltes!',life:2.6});}return sw.struggle<=0;}
function xCut(auto){const h=heli;if(X.noHoist||hook.L<10&&sw.state!=='hook'){if(!auto)say('No hay cable fuera.',2);return;}
  const v=vesselAt(hook.x),onV=v&&heightAt(v,hook.x-v.x)?v:null;
  if(hook.load===sw||sw.state==='hook'){sw.state='await';sw.x=hook.x;sw.y=hook.y;sw.onV=onV;}
  else if(hook.load){const p=hook.load;p.state='wait';p.v=onV;p.o=onV?hook.x-onV.x:0;p.hp-=.1;splash(p.x);}
  hook.load=null;hook.L=0;X.noHoist=1;X.alarm=2;say(auto?'¡El cable se ha partido! Sin grúa hasta volver a Kodiak.':'Cable cortado. Sin grúa hasta volver a Kodiak.',5);}
function xDeckLand(v,o){const h=heli,S=h.spec;if(!v.cutter||o<-236||o>-112)return false;if(h.gear<.9&&h.vy<=150&&Math.abs(h.vx)<=90){h.vy=-70;h.y-=4;if(note.life<=0)say('Baja el tren (G) para tomar en la cubierta.',3,'r');return true;}if(h.vy>150||Math.abs(h.vx)>90)return false;
  h.landed=true;h.on=v;h.oo=h.x-v.x;h.vx=h.vy=0;if(aboard.length)h.doorT=1;say('En cubierta del guardacostas.',3);return true;}
function xRide(){const h=heli,v=h.on;if(v.gone){h.landed=false;h.on=null;return;}h.x=v.x+h.oo;h.y=deckY(v,h.oo)-h.spec.belly-h.spec.gear;}
function xUpdate(dt){
  const h=heli,S=h.spec;if(h.dead){if(!X.dead0){X.dead0=true;boomSnd(1.2);}sndUpdate();return;}
  const main=vessels[0];
  // search: no fix until something is actually seen
  if(!X.found){const rg=M.fog?200:ENV&&ENV.d>.4?(h.spot||flares.length?340:150):470;let near=Math.abs(main.x-h.x)<rg+main.half;for(const p of surv)if(p.state==='wait'&&Math.abs(p.x-h.x)<rg)near=true;
    if(near&&!h.landed&&h.x>500){X.found=true;say('¡Contacto visual con el siniestro!',3);beep(990,.12,.08,'sine');}
    X.clue-=dt;X.clueT-=dt;if(X.clueT<=0&&!main.gone){X.clueT=rnd(26,44);X.clue=6;flares.push({x:main.x,y:main.y-main.top-10,vx:rnd(-12,12),vy:-230,life:10});say('Kodiak: bengala roja avistada. Marcación actualizada.',4);}}
  if(M.dyn)wxDyn(dt);
  // weight, damage and ice change how the aircraft flies
  const n=aboard.length;X.ice=clamp(X.ice+((M.snow||(M.fail&&M.fog))&&h.y<-200&&!h.landed?dt/50:-dt/14),0,1);
  X.pw=(1-n*.045)*(X.eng?.6:1)*(1-X.ice*.4);X.mx=(X.eng?.7:1)*(1-n*.02);X.burn=1+n*.06+(X.eng?.15:0);X.sink=X.ice*70+(X.eng&&n>2?18:0);
  if(X.ice>.5&&!X.iceW){X.iceW=1;X.alarm=2;say('Hielo en las palas. Baja de altura para soltarlo.',4);}if(X.ice<.2)X.iceW=0;
  X.jam=Math.max(0,X.jam-dt);X.hk=(X.jam>0?.3:1)*(hook.load&&hook.load.kind==='hurt'?.55:1);
  if(M.fail&&!h.landed){X.failT-=dt;if(X.failT<=0){X.failT=rnd(55,110)/M.fail;const k=Math.random();X.alarm=3;
    if(k<.3&&!X.eng){X.eng=1;say('¡Fallo del motor 2! Potencia reducida: vuelve o aligera.',5);}
    else if(k<.55&&!X.noSpot){X.noSpot=1;h.spot=false;say('Foco de búsqueda fuera de servicio.',4);}
    else if(k<.85){X.jam=22;say('La grúa se ha atascado: va muy lenta.',4);}
    else{h.fuel=Math.max(10,h.fuel-h.fmax*.12);say('Fuga de combustible. Vigila el nivel.',4);}}}
  if(h.landed&&!h.on){X.eng=0;X.noSpot=0;X.noHoist=0;X.jam=0;X.ice=0;}
  // bingo fuel for the leg home, with the wind
  if(M.fuelK&&!h.landed){const gs=Math.max(60,S.max*X.mx*.85-M.wind*.18);const ctb=vessels.find(q=>q.cutter);X.need=(ctb?Math.abs(h.x-(ctb.x-174)):Math.abs(h.x+60))/gs*X.burn*1.12+14;
    if(h.fuel<X.need&&!X.bingo&&Math.abs(h.x)>600&&!h.on){X.bingo=1;X.alarm=4;say(ctb?'¡Bingo! Combustible justo para volver al guardacostas.':'¡Bingo! Combustible justo para volver a Kodiak.',5);}if(h.fuel>X.need*1.3)X.bingo=0;}else X.need=0;
  if(X.alarm>0){const a=X.alarm;X.alarm-=dt;if(Math.floor(a*2)!==Math.floor(X.alarm*2))beep(880,.1,.1);}
  // oil fires on the water
  X.inOil=0;for(const p of surv)p.oil=0;
  for(const o of X.oil){o.x+=o.vx*dt;o.life-=dt;o.t+=dt;o.w=Math.min(o.w0*1.6,o.w+dt*o.w0/7);
    if(!o.lit&&o.t>o.ig){o.lit=1;say('Kodiak: el combustible derramado está ardiendo en el agua.',4,'r');}
    if(o.lit){if(Math.random()<dt*1.6)puffs.push({x:o.x+rnd(-.3,.3)*o.w0,y:wave(o.x)-rnd(16,26),vx:0,vy:rnd(-30,-20),r:rnd(3,4),a:0,life:rnd(4,6),s:Math.random()*256|0,g:rnd(1.2,1.8)});
      for(const p of surv)if(!p.v&&(p.state==='wait'||p.state==='ready')&&Math.abs(p.x-o.x)<o.w0/2)p.oil=1;
      if(!sw.onV&&['swim','with','await','free'].includes(sw.state)&&Math.abs(sw.x-o.x)<o.w0/2)X.inOil=1;}}
  X.oil=X.oil.filter(o=>o.life>0);
  // rescue swimmer stamina
  const out=['swim','with','await','free'].includes(sw.state)&&!sw.onV;
  sw.sta=clamp(sw.sta+(sw.state==='aboard'?dt/28:out?-dt/(sw.state==='swim'?80:170)*(1+M.sea*.25)*M.temp*(sw.struggle>0?6:1)*(X.inOil?4:1):0),0,1);
  if(sw.struggle>0)sw.struggle-=dt;
  if(sw.sta<.25&&out&&!sw.tired){sw.tired=1;say('Nadador: me quedo sin fuerzas.',4);}
  if(sw.sta<=0&&['swim','with','free'].includes(sw.state)){if(sw.target&&sw.target.state==='ready')sw.target.state='wait';sw.target=null;sw.state='await';sw.recall=true;say('Nadador: agotado. Sacadme ya.',4);}
  if(sw.state==='aboard')sw.tired=0;
  // people trapped below decks
  for(const p of surv)if(p.state==='trap'){const v=p.v;if(!v||v.gone||deckY(v,p.o)>=wave(v.x+p.o)-1){p.state='lost';say('No llegamos a tiempo al que estaba atrapado.',5);if(sw.target===p){sw.target=null;sw.state='swim';}continue;}
    p.x=v.x+p.o;p.y=deckY(v,p.o);p.talk=(p.talk??rnd(3,8))-dt;if(p.talk<=0){p.talk=rnd(7,13);if(Math.abs(p.x-h.x)<430)shouts.push({p,t:pick(['¡Aquí dentro!','¡Estoy atrapado!','(golpes en el casco)']),life:2});}}
  if(sw.state==='free'){const t=sw.target;if(!t||t.state!=='trap'){sw.state='swim';sw.target=null;}
    else{const d=t.x-sw.x;sw.x+=clamp(d,-50*dt,50*dt);sw.onV=Math.abs(sw.x-t.v.x)<t.v.half?t.v:null;sw.y=sw.onV?deckY(sw.onV,sw.x-sw.onV.x):wave(sw.x)+1;
      if(Math.abs(d)<5){t.free+=dt/11;if(t.free>=1){t.state='ready';sw.state='with';say('Nadador: lo tengo, está fuera. Bajad la cesta.',4);}}}}
  // panic: someone jumps before the swimmer is there
  for(const p of surv)if(p.jump&&p.v&&p.state==='wait'&&Math.abs(p.x-h.x)<170&&h.y>p.y-260){p.jump=0;const v=p.v;p.x=v.x+(p.o>0?1:-1)*(v.half+12);p.v=null;splash(p.x);say('¡No saltes! ¡Espera al nadador!',3);}
  // cable: snags on structure, swinging basket
  let sn=0;if(hook.L>40&&!h.landed&&!X.noHoist){const x0=h.x+h.dir*S.doorMid,y0=h.y+S.belly;for(let k=1;k<4;k++){const px=lerp(x0,hook.x,k/4),py=lerp(y0,hook.y,k/4),v=vesselAt(px);if(v&&heightAt(v,px-v.x)&&py>deckY(v,px-v.x)+3){sn=1;break;}}}
  X.snag=sn;if(sn){h.vx*=1-3*dt;X.snagT+=dt;if(X.snagT>.25&&!X.snagS){X.snagS=1;X.alarm=2;rumble('snag');say('¡Cable enganchado en la estructura! Céntrate o corta con C.',4);}if(X.snagT>5)xCut(1);}else{X.snagT=0;X.snagS=0;}
  if(hook.load&&hook.load!==sw&&Math.abs(hook.swv)>120){hook.load.hp-=dt*.12;if(!X.swS){X.swS=1;say('¡La cesta se balancea demasiado!',3);}}else X.swS=0;
  // explosions on burning ships, burning fuel drifting away
  if(M.boom)for(const v of vessels){if(v.gone||!v.fire)continue;
    X.oilT-=dt;if(X.oilT<=0&&X.oil.length<4){X.oilT=rnd(14,26);const w0=rnd(70,130);X.oil.push({x:v.x+(Math.random()<.5?-1:1)*(v.half+w0*.3),w:10,w0,t:0,ig:rnd(5,9),lit:0,vx:(M.wind>0?1:-1)*rnd(3,8)+rnd(-4,4),life:rnd(45,75)});if(X.oil.length===1)say('Kodiak: el barco pierde combustible. Mancha en el agua.',4,'r');}
    if(v.fire>.5&&!X.warnV&&v.fs.length){X.boomT-=dt;if(X.boomT<=0){X.warnV=v;X.warn=3.2;X.seat=pick(v.fs);X.alarm=3;say('¡Va a explotar! ¡Aléjate del barco!',3);}}}
  if(X.warnV){X.warn-=dt;if(X.warn<=0){const v=X.warnV,ex=v.x+X.seat,ey=deckY(v,X.seat);X.warnV=null;X.boomT=rnd(30,60);flash=1;boomSnd(1.5);rumble('boom');v.fire=Math.min(1,v.fire+.2);
    for(let i=0;i<280;i++){const a=rnd(0,6.28),sp=rnd(40,330);parts.push(i%3?{k:'ember',x:ex,y:ey-10,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-90,life:rnd(.6,2),max:2,r:Math.random()<.4?2:1}:{k:'flame',x:ex+rnd(-20,20),y:ey-rnd(0,30),vx:Math.cos(a)*sp*.4,vy:Math.sin(a)*sp*.4-60,life:rnd(.4,1.1),max:1.1,r:rnd(4,10)});}
    const d=Math.hypot(h.x-ex,h.y-ey);if(d<110)crash('La explosión alcanzó al helicóptero.');else if(d<320){const k=(320-d)/320;h.vx+=Math.sign(h.x-ex)*420*k;h.vy-=260*k;say('¡Onda expansiva!',2);}
    for(const p of surv)if((p.state==='wait'||p.state==='ready')&&Math.abs(p.x-ex)<90)p.hp-=.22;if(!v.sinking&&Math.random()<.5)v.sinking=true;}}
  // moving traffic, rocks and ice
  for(const v of vessels)if(v.mover&&!v.gone){v.x+=v.md*22*dt;if((v.x-v.home)*v.md>v.rng)v.md*=-1;}
  for(const o of X.rocks){o.x+=o.vx*dt;o.y=o.ice?wave(o.x)*.5:0;
    if(o.ice){const mv=vessels[0];let aw=0;for(const p of surv)if(!p.v&&(p.state==='wait'||p.state==='ready')&&Math.abs(p.x-o.x)<o.w/2+70)aw=o.x>=p.x?1:-1;
      if(mv&&!mv.gone){const lim=mv.half+o.w/2+130,d=o.x-mv.x;if(Math.abs(d)<lim)aw=d>=0?1:-1;}
      if(aw){o.vx=aw*Math.max(3,Math.abs(o.vx));o.x+=aw*10*dt;}}const dx=h.x-(o.x-o.w/2);if(!h.landed&&dx>=0&&dx<o.w&&h.y+S.belly>o.y-o.top[dx|0]+4)crash(o.ice?'Chocaste con un iceberg.':'Chocaste con las rocas.');}
  // handing victims over on the cutter
  if(h.on&&h.landed&&aboard.length&&h.door>.9){X.un-=dt;if(X.un<=0){X.un=1.5;aboard.sort((a,c)=>c.hp-a.hp);const p=aboard.pop();p.state='safe';X.cdel=1;X.del1=1;(X.cw||(X.cw=[])).push({v:h.on,o:h.oo+h.dir*S.doorMid,hurt:p.kind==='hurt'||p.kind==='uncon',ph:p.ph||Math.random()*6,wk:svC(p)&&p.wk});say(`Víctima entregada al guardacostas. ${surv.filter(q=>q.state==='safe').length} a salvo.`,3,'r');}}
  if(X.cw){for(const w of X.cw){w.o+=clamp(-102-w.o,-(w.hurt?26:34)*dt,(w.hurt?26:34)*dt);if(Math.abs(w.o+102)<1.5)w.done=1;}X.cw=X.cw.filter(w=>!w.done&&!w.v.gone);}
  {const ct=vessels.find(q=>q.cutter);if(ct){const dd=Math.abs(h.x-(ct.x-174));
    if(!h.landed&&aboard.length&&dd<460&&!X.cmsg){X.cmsg=1;say('Guardacostas: cubierta de vuelo libre, a popa. Baja el tren y toma despacio.',5,'r');}if(dd>800)X.cmsg=0;
    if(h.on&&h.landed&&X.cdel&&!aboard.length&&!(X.cw&&X.cw.length)){X.cdel=0;const left=surv.some(q=>['wait','ready','trap'].includes(q.state));say(left?'Guardacostas: los tenemos en la enfermería. Repostado: puedes volver a por los demás.':'Guardacostas: todos a bordo y atendidos. Buen trabajo.',6,'r');}}}
  sndUpdate();
}
function xMan(p){const sit=!p.v||p.v.sit,g=ctx;
  if(p.kind==='uncon')man(p.x,p.y+1,svC(p),3,0);
  else if(p.kind==='child'){g.save();g.translate(r(p.x),r(p.y));g.scale(.74,.74);man(0,0,svC(p),sit?1:0,p.ph);g.restore();}
  else man(p.x,p.y,p.C||svC(p),sit?1:p.kind==='hurt'?3:0,p.ph);
  hpBar(p,sit?13:21);if(p.nm)txt((c,x,y,w,h)=>{g.fillStyle=c;g.fillRect(x,y,w,h);},'#fff',p.nm,r(p.x)-p.nm.length*2,r(p.y)-(sit?22:30));
  if(p.kind==='hurt'||p.kind==='uncon'){const x=r(p.x),y=r(p.y)-(sit?20:28);g.fillStyle='#fff';g.fillRect(x-3,y-3,7,7);g.fillStyle='#d8341a';g.fillRect(x-1,y-2,3,5);g.fillRect(x-2,y-1,5,3);}}
function xDrawBack(){const g=ctx;if(X.cw)for(const w of X.cw){const x=w.v.x+w.o,y=deckY(w.v,w.o);if(w.hurt){man(x-9,y,MED,2,w.ph);man(x+9,y,MED,2,w.ph+3.14);g.fillStyle='#d8dcdc';g.fillRect(r(x)-7,r(y)-8,15,1);g.fillStyle='#f6c62f';g.fillRect(r(x)-6,r(y)-7,13,1);man(x,y-8,svC(w),3,0);}else{man(x,y,svC(w),2,w.ph);man(x+11,y,MED,2,w.ph+2);}}
  for(const o of X.rocks)g.drawImage(o.spr,r(o.x-o.w/2),r((o.y||0)-o.h));
  for(const p of surv)if(p.state==='trap'){const x=r(p.x),y=r(p.y)-8;if(Math.sin(T*8)>0){g.fillStyle='#c77dff';g.fillRect(x-1,y-8,2,5);g.fillRect(x-1,y-2,2,2);}
    if(p.free>0){g.fillStyle='#0b1118';g.fillRect(x-9,y-14,18,4);g.fillStyle='#c77dff';g.fillRect(x-8,y-13,r(16*p.free),2);}}
  if(X.warnV&&Math.sin(T*30)>0){const v=X.warnV,rad=8+r((3.2-X.warn)*5);g.drawImage(disc('#eaf6ff',rad),r(v.x+X.seat)-rad,r(deckY(v,X.seat))-rad-8);}}
function xDrawFront(){const g=ctx,SH=['#6a3f8c','#2f7f8a','#9a8a2e','#3a5fa0'];
  for(const o of X.oil){const x0=r(o.x-o.w/2),x1=o.x+o.w/2,fade=Math.min(1,o.life/5);
    // the slick itself: a dark, flat film with a rainbow sheen, trailing back to the hull
    for(let x=x0;x<x1;x+=2){const y=r(wave(x)),e=Math.min(x-x0,x1-x)/(o.w/2);g.fillStyle='#120e16';g.fillRect(x,y-1,2,e>.25?7:e>.1?4:2);g.fillStyle='#2a1f36';g.fillRect(x,y-1,2,1);
      if(((x>>1)+(T*3|0))%3===0&&e>.08){g.fillStyle=SH[((x>>2)+(T*1.5|0))&3];g.fillRect(x,y+((x>>1)%4),2,1);}}
    if(o.lit&&o.f){const f=o.f,fx0=r(o.x-f.W/2);for(let sx=0;sx<f.W;sx+=6){const ww=Math.min(6,f.W-sx);g.globalAlpha=fade;g.drawImage(f.c,sx,0,ww,f.H,fx0+sx,r(wave(fx0+sx+3))+2-f.H,ww,f.H);}g.globalAlpha=1;}}}
function xHud(g){const h=heli,F='8px Silkscreen,monospace';g.font=F;g.textAlign='left';
  if(X.need){g.fillStyle='#fff';g.fillRect(r(44+124*clamp(X.need/h.fmax,0,1)),33,1,10);}
  const tg=[];if(X.snag)tg.push('CABLE ENGANCHADO');if(X.eng)tg.push('MOTOR 2');if(X.bingo)tg.push('BINGO');if(X.noHoist)tg.push('SIN CABLE');if(X.jam>0)tg.push('GRÚA LENTA');if(X.noSpot)tg.push('FOCO KO');if(X.ice>.15)tg.push('HIELO '+r(X.ice*100)+'%');
  if(tg.length){const t=tg.map(tr).join('  ');const wy=78+Math.max(16,Math.ceil(30/PXS));g.fillStyle='rgba(60,10,10,.82)';g.fillRect(6,wy,r(g.measureText(t).width)+12,13);g.fillStyle=Math.sin(T*9)>0?'#ff7a5a':'#ffd23a';g.fillText(t,12,wy+10);}
  const rx=VW-138;g.fillStyle='rgba(255,255,255,.16)';g.fillRect(rx+84,48,42,4);g.fillStyle=sw.sta>.5?'#5fe08a':sw.sta>.25?'#f6c62f':'#ff5a4a';g.fillRect(rx+84,48,r(42*sw.sta),4);
  if(!X.found){g.textAlign='center';g.fillStyle='#f6c62f';g.fillText(fmtInputHints(tr('BUSCANDO: FOCO (F) Y BENGALAS (H)')),VW/2,50);}}
function xFinish(saved,lost,tot,fail){const md=[];
  if(!fail&&saved){if(saved===tot)md.push('Todos a casa');if(clock<60+M.nm*17+tot*24)md.push('Rapidez');if(M.hour>=21||M.hour<5)md.push('Rescate nocturno');if(M.sea>=3)md.push('Mar gruesa');
    if(M.gust>=3)md.push('Contra el viento');if(M.search)md.push('Buen ojo');if(M.trapN&&surv.some(p=>p.free>=1&&p.state==='safe'))md.push('Liberación');if(X.eng)md.push('Con un motor');
    if(M.triage&&saved===tot)md.push('Triaje perfecto');if(M.boom)md.push('Entre llamas');if(heli.fuel/heli.fmax<.12&&heli.on==null)md.push('Con los vapores');if(heli.on)md.push('Toma en cubierta');}
  $('#medals').innerHTML=md.map(m=>`<span class="chip">★ ${tr(m)}</span>`).join('')||`<span style="color:var(--mute);font-size:13px">${tr('Sin medallas en esta salida.')}</span>`;
  try{const L=JSON.parse(localStorage.getItem('rkLog')||'[]');L.unshift({d:new Date().toLocaleDateString('es-ES',{day:'2-digit',month:'2-digit'}),n:M.name,s:saved,t:tot,c:Math.floor(clock),m:md.length,f:fail?1:0});localStorage.setItem('rkLog',JSON.stringify(L.slice(0,12)));}catch(e){}
  xLog();}
function xLog(){let L=[];try{L=JSON.parse(localStorage.getItem('rkLog')||'[]');}catch(e){}
  $('#log').innerHTML=L.length?L.map(e=>`<div>${e.d} · ${e.n} — <b style="color:var(--ink)">${e.f?tr('aeronave perdida'):e.s+'/'+e.t+tr(' a salvo')}</b> · ${Math.floor(e.c/60)}:${String(e.c%60).padStart(2,'0')}${e.m?' · ★'+e.m:''}</div>`).join(''):`<div>${tr('Todavía no hay salidas registradas en este navegador.')}</div>`;}
// ---------- environment colours by hour ----------
const SEAN=[[23,56,79],[16,44,66],[10,32,51]],SEAD=[[59,131,168],[40,106,144],[27,82,121]];
const NI={z:[4,7,20],h:[7,13,34],l:[11,24,50],o:[20,40,66],c:[[54,66,90],[22,30,48]],s:SEAN,d:.68},
  DA={z:[36,100,176],h:[66,138,206],l:[128,186,228],o:[200,230,242],c:[[255,255,255],[150,204,232]],s:SEAD,d:0},
  DW={z:[52,64,116],h:[118,110,156],l:[226,160,150],o:[252,208,160],c:[[255,224,196],[150,120,152]],s:[[79,125,154],[58,101,131],[40,78,108]],d:.2},
  DU={z:[28,30,72],h:[84,56,108],l:[206,104,88],o:[250,170,88],c:[[255,188,128],[112,72,104]],s:[[96,86,132],[62,64,112],[40,44,86]],d:.3};
const KF=[[0,NI],[4.6,NI],[6.2,DW],[8,DA],[17.5,DA],[19.6,DU],[21.6,NI],[24,NI]];
function envAt(h){let i=0;while(i<KF.length-2&&h>=KF[i+1][0])i++;const a=KF[i],b=KF[i+1],t=clamp((h-a[0])/(b[0]-a[0]),0,1),A=a[1],B=b[1],e={d:lerp(A.d,B.d,t)};
  for(const k of'zhlo')e[k]=mix(A[k],B[k],t);e.c=[mix(A.c[0],B.c[0],t),mix(A.c[1],B.c[1],t)];e.s=[0,1,2].map(k=>mix(A.s[k],B.s[k],t));
  if(M.cloud){const g=[104,112,124].map(v=>v*(1-e.d*1.1)),c=M.cloud*.66;for(const k of'zhlo')e[k]=mix(e[k],g.map(v=>v*(k==='o'?1.3:k==='z'?.8:1)),c);
    e.c=[mix(e.c[0],g.map(v=>v*1.45),c),mix(e.c[1],g.map(v=>v*.62),c)];e.s=e.s.map(s=>mix(s,[g[0]*.5,g[1]*.62,g[2]*.7],c*.6));e.d=Math.min(.82,e.d+M.cloud*.08);}
  return e;}
const SKH=440,skyC=document.createElement('canvas');skyC.width=64;skyC.height=SKH;const skyG=skyC.getContext('2d');let skyPat=null,envT=-9,ENV=null,skyClouds=[],bub={p:null,s:null},shouts=[],gust=null,gustT=20;const TINT={};
function skyCol(e,t){return t<.16?mix(e.o,e.l,t/.16):t<.5?mix(e.l,e.h,(t-.16)/.34):mix(e.h,e.z,(t-.5)/.5);}
function buildSky(e){const d=skyG.createImageData(64,SKH),a=d.data,NB=12,lv=[];for(let i=0;i<=NB+1;i++)lv.push(skyCol(e,Math.min(1,i/NB)));
  for(let y=0,i=0;y<SKH;y++){const f=Math.pow(1-y/(SKH-1),1.2)*NB,b=Math.floor(f),fr=f-b;for(let x=0;x<64;x++,i+=4){const c=lv[fr>.5&&(fr-.5)*2>bay(x,y)?b+1:b];a[i]=c[0];a[i+1]=c[1];a[i+2]=c[2];a[i+3]=255;}}
  skyG.putImageData(d,0,0);skyPat=ctx.createPattern(skyC,'repeat');
  const cm=mix(e.c[0],e.c[1],.4);for(const cl of SPR.cl)paintCloud(cl,[e.c[0],cm,e.c[1]]);
  for(const [k,al] of[['mid',.2],['near',.1]]){const s=SPR[k],t=TINT[k]||(TINT[k]=Object.assign(document.createElement('canvas'),{width:s.width,height:s.height})),tg=t.getContext('2d');
    tg.globalCompositeOperation='copy';tg.drawImage(s,0,0);tg.globalCompositeOperation='source-atop';tg.fillStyle=`rgba(${e.l[0]|0},${e.l[1]|0},${e.l[2]|0},${al})`;tg.fillRect(0,0,t.width,t.height);}coastTint(e);}
const CSTW=1024,CSTH=46;let CSTM=null;
function coastTint(e){const mkc=()=>Object.assign(document.createElement('canvas'),{width:CSTW,height:CSTH}),k=6.2832/CSTW;
  if(!CSTM){CSTM=[mkc(),mkc(),mkc()];const hs=[x=>26+9*Math.sin(x*k*2+1)+5*Math.sin(x*k*5)+3*Math.sin(x*k*11+2),x=>17+5*Math.sin(x*k*3+2)+3*Math.sin(x*k*7+1)+1.5*Math.sin(x*k*17),x=>11+2.5*Math.sin(x*k*4)+1.5*Math.sin(x*k*9+3)+(((x*7919)%11)<4?2:0)+(((x*104729)%7)<2?1:0)+(((x*31)%13)<2?2:0)];
    CSTM.forEach((c,i)=>{const g=c.getContext('2d');g.fillStyle='#fff';for(let x=0;x<CSTW;x++){const h=Math.max(1,Math.round(hs[i](x)));g.fillRect(x,CSTH-h,1,h);}});}
  const t=TINT.coast||(TINT.coast=mkc()),g=t.getContext('2d'),tmp=TINT.coastT||(TINT.coastT=mkc()),tg=tmp.getContext('2d'),base=mix(e.o,e.l,.55),cols=[mix(base,[104,122,146],.26),mix(base,[76,98,122],.42),mix(base,[52,78,92],.56)];
  g.globalCompositeOperation='source-over';g.clearRect(0,0,CSTW,CSTH);CSTM.forEach((m,i)=>{tg.globalCompositeOperation='copy';tg.drawImage(m,0,0);tg.globalCompositeOperation='source-in';tg.fillStyle=rgb(cols[i]);tg.fillRect(0,0,CSTW,CSTH);g.drawImage(tmp,0,0);});
  g.globalCompositeOperation='source-atop';const gr=g.createLinearGradient(0,CSTH-12,0,CSTH);gr.addColorStop(0,`rgba(${e.o[0]|0},${e.o[1]|0},${e.o[2]|0},0)`);gr.addColorStop(1,`rgba(${e.o[0]|0},${e.o[1]|0},${e.o[2]|0},.5)`);g.fillStyle=gr;g.fillRect(0,0,CSTW,CSTH);g.globalCompositeOperation='source-over';}
function coastFar(g,hz,dc){const ca=clamp((-dc-200)/600,0,1);if(ca<.01||!TINT.coast)return;g.globalAlpha=ca;const off=((r(-dc*.1)%CSTW)+CSTW)%CSTW;for(let x=off-CSTW;x<VW;x+=CSTW)g.drawImage(TINT.coast,x,hz-7-CSTH);g.globalAlpha=1;}
// classic fire automaton: a hot bed at the bottom, heat rises, cools and drifts with the wind
const FW=64,FH=100,fireB=new Uint8Array(FW*FH),fireC=document.createElement('canvas');fireC.width=FW;fireC.height=FH;const fireG=fireC.getContext('2d'),fireI=fireG.createImageData(FW,FH);let fireT=0;
const FPAL=[[122,30,18],[216,52,26],[240,100,30],[249,160,44],[255,210,58],[255,243,176]];
function mkFire(W,H){const c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d');return{W,H,b:new Uint8Array(W*H),c,g,img:g.createImageData(W,H),hs:[0,1,2,3,4].map(()=>({p:Math.random(),ph:Math.random()*6,a:.55+Math.random()*.45}))};}
// one strip of fire: several hot spots wander along the bed, heat rises, cools and leans with the wind
function burn(f,power,cool){const W=f.W,H=f.H,b=f.b,wd=clamp(M.wind/50,-1,1),sg=Math.sign(wd),aw=Math.abs(wd)*.6,a=f.img.data;
  for(let x=0;x<W;x++){const u=x/(W-1);let v=0;for(const s of f.hs){const q=(u-(.14+.72*s.p+Math.sin(T*.6+s.ph)*.07))/.1;v=Math.max(v,Math.exp(-q*q)*s.a*(.75+.25*Math.sin(T*2.3+s.ph*3)));}
    v*=Math.min(1,Math.min(u,1-u)*7)*power;b[(H-1)*W+x]=v>.12?Math.min(36,(14+Math.random()*24)*v+8):0;}
  for(let y=0;y<H-1;y++)for(let x=0;x<W;x++){const sx=clamp(x+(Math.random()*3|0)-1-(Math.random()<aw?sg:0),0,W-1),ed=Math.min(x,W-1-x)<3||y<4?3:0,v=b[(y+1)*W+sx]-(Math.random()<cool?1:0)-(Math.random()<.06?2:0)-ed;b[y*W+x]=v>0?v:0;}
  for(let k=0;k<W*H;k++){const v=b[k];if(v<3){a[k*4+3]=0;continue;}const c=FPAL[v<7?0:v<12?1:v<18?2:v<25?3:v<32?4:5];a[k*4]=c[0];a[k*4+1]=c[1];a[k*4+2]=c[2];a[k*4+3]=255;}
  f.g.putImageData(f.img,0,0);}
let puffs=[];const PT=(()=>{const q=rng(99),o=[];while(o.length<256){const x=q()*2-1,y=q()*2-1;if(x*x+y*y<1)o.push([x,y,y<-.3?0:y<.35?1:2]);}return o;})();
const SM=['#7a4424','#141416','#222327','#35373c','#4d5056','#6a6d73','#868a90'];
function stepFire(dt){
  const wt=M.wind*.5+(M.wind<0?-9:9);
  for(const p of puffs){p.a+=dt;p.vx+=(wt-p.vx)*.4*dt;p.vy+=(-8-p.vy)*.3*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.r+=p.g*dt;}
  if(puffs.length&&puffs[0].a>puffs[0].life)puffs=puffs.filter(p=>p.a<p.life);
  fireT+=dt;if(fireT<1/22)return;fireT=0;
  for(const v of vessels)if(!v.gone&&v.fire){if(!v.fb){const big=v.half>140;v.fb=v.fs.map(()=>mkFire(clamp(r(34+v.half*.3),36,150),big?124:92));}
    for(const f of v.fb)burn(f,.4+v.fire*.6,v.half>140?.42:v.half<50?.72:.54);}
  for(const o of X.oil)if(o.lit){if(!o.f)o.f=mkFire(Math.max(24,r(o.w0)),46);burn(o.f,.55+.3*Math.min(1,o.life/8),.86);}
}
function drawPuffs(g){
  for(const p of puffs){const t=p.a/p.life,n=Math.min(256,(30+p.r*p.r*.5)|0),rot=p.a*.45*(p.s&1?1:-1),c=Math.cos(rot),s=Math.sin(rot),thin=t>.55?(t-.55)/.45:0,bi=t<.1?1:t<.3?2:t<.55?3:t<.8?4:5,rx=p.r,ry=p.r*.82;
    for(let k=0;k<3;k++){g.fillStyle=k===2&&t<.07?SM[0]:SM[Math.max(1,Math.min(6,bi+1-k))];
      for(let i=0;i<n;i++){const q=PT[(p.s+i)&255];if(q[2]!==k||(thin&&((i*7+p.s)%10)/10<thin))continue;const z=t<.6||i%3===0?2:1;g.fillRect(r(p.x+(q[0]*c-q[1]*s)*rx),r(p.y+(q[0]*s+q[1]*c)*ry),z,z);}}}
}
function makeClouds(){skyClouds=[];const n=5+Math.round(M.cloud*15);
  for(let i=0;i<n;i++){const off=rnd(10,250);skyClouds.push({off,i:pick(off<60?[0,1,4]:off<140?[1,2,5,6]:[2,3,5,6,7]),x:rnd(0,3000),p:.04+off/250*.1});}
  if(M.cloud>.8)for(let i=0;i<10;i++)skyClouds.push({off:rnd(150,330),i:pick([3,7,7]),x:rnd(0,3000),p:.14});
  skyClouds.sort((a,b)=>a.off-b.off);envT=-9;}

// ---------- drawing ----------
const r=Math.round;
function pl(g,x0,y0,x1,y1){const n=Math.max(Math.abs(x1-x0),Math.abs(y1-y0))||1;for(let i=0;i<=n;i++)g.fillRect(r(x0+(x1-x0)*i/n),r(y0+(y1-y0)*i/n),1,1);}
// modes: 0 waving, 1 in water or seated, 2 walking, 3 lying, 4 standing, 5 swimming crawl
function man(x,y,C,mode,ph=0,dir=1,ns=0){x=r(x);y=r(y);const g=ctx,t=T*5.5+ph,s=Math.sin(t),c=Math.cos(t);
  if(mode===1){y+=r(Math.sin(T*2.3+ph));g.fillStyle=C[0];g.fillRect(x-2,y-4,5,4);pl(g,x-3,y-4,x-4-r(1.5+1.5*c),y-8+r(1.4*s));pl(g,x+3,y-4,x+4+r(1.5-1.5*c),y-8-r(1.4*s));g.fillStyle=C[2];g.fillRect(x-1,y-7,3,3);if(C.sv){if(C.vest){g.fillStyle=C.vest;g.fillRect(x-1,y-4,3,2);if(C.band){g.fillStyle=C.band;g.fillRect(x-2,y-2,5,1);}}g.fillStyle=C.hair;g.fillRect(x-1,y-7,3,1);}if(C[3]){g.fillStyle=C[3];g.fillRect(x-2,y-3,5,1);g.fillStyle=C[6];g.fillRect(x-1,y-5,3,1);}return;}
  if(mode===5){const w=Math.sin(T*9+ph),k=Math.cos(T*9+ph);g.fillStyle=C[1];g.fillRect(x-dir*8-1,y-2+(w>0?0:1),4,1);g.fillRect(x-dir*7-1,y-3+(w>0?1:0),3,1);g.fillStyle=C[0];g.fillRect(x-4,y-3,8,2);
    if(w>-.3)pl(g,x+dir*2,y-3,x+dir*(2+r(4*k)),y-3-r(4*Math.max(0,w)));g.fillStyle=C[2];g.fillRect(x+dir*4-1,y-5,3,3);if(C[3]){g.fillStyle=C[3];g.fillRect(x-1,y-3,2,2);g.fillStyle=C[4];g.fillRect(x-dir*10-1,y-3+(w>0?0:1),2,3);g.fillStyle=C[6];g.fillRect(x+dir*4-1,y-3,3,1);}g.fillStyle='#fff';if(w<0)g.fillRect(x-dir*10,y-4-(k>0),1,1);g.fillRect(x+dir*7,y-2,2,1);return;}
  if(mode===3){g.fillStyle=C[0];g.fillRect(x-5,y-3,8,3);g.fillStyle=C[1];g.fillRect(x-9,y-2,4,2);g.fillStyle=C[2];g.fillRect(x+3,y-3,3,3);if(C.sv){g.fillStyle='#111';g.fillRect(x-9,y-2,1,2);if(C.vest){g.fillStyle=C.vest;g.fillRect(x-1,y-3,3,3);if(C.band){g.fillStyle=C.band;g.fillRect(x-3,y-3,1,3);}}g.fillStyle=C.hair;g.fillRect(x+5,y-3,1,3);}return;}
  if(!ns){g.fillStyle='rgba(0,0,0,.3)';g.fillRect(x-3,y,7,1);g.fillRect(x-2,y+1,5,1);}
  const wk=mode===2,tw=T*10+ph,q=wk?Math.sin(tw):0,bob=wk?-r(Math.abs(Math.cos(tw))):mode===0&&Math.sin(T*3+ph*3)>.86?-2:0;y+=bob;
  g.fillStyle=C[1];g.fillRect(x-2,y-7,5,2);
  if(wk){const f=r(3*q);pl(g,x-2,y-6,x-2+f,y-1-bob);pl(g,x-1,y-6,x-1+f,y-1-bob);pl(g,x+1,y-6,x+1-f,y-1-bob);pl(g,x+2,y-6,x+2-f,y-1-bob);}
  else{g.fillRect(x-2,y-6,2,6-bob);g.fillRect(x+1,y-6,2,6-bob);}
  if(C.sv){const f=wk?r(3*q):0;g.fillStyle='#111';g.fillRect(x-2+f,y-1-bob,2,1);g.fillRect(x+1-f,y-1-bob,2,1);}
  g.fillStyle=C[0];g.fillRect(x-2,y-12,5,5);
  if(mode===0){pl(g,x-3,y-11,x-4-r(1.5+1.5*c),y-16+r(1.2*s));const t2=t*1.3+1;pl(g,x+3,y-11,x+4+r(1.5+1.5*Math.cos(t2)),y-16+r(1.2*Math.sin(t2)));}
  else if(wk){const f=r(2*q);pl(g,x-3,y-11,x-3-f,y-7);pl(g,x+3,y-11,x+3+f,y-7);}
  else{g.fillRect(x-3,y-12,1,5);g.fillRect(x+3,y-12,1,5);}
  g.fillStyle=C[2];g.fillRect(x-1,y-15,3,3);if(C.sv){if(C.vest){g.fillStyle=C.vest;g.fillRect(x-1,y-12,3,2);if(C.band){g.fillStyle=C.band;g.fillRect(x-2,y-9,5,1);}}g.fillStyle=C.hair;g.fillRect(x-1,y-15,3,1);}if(C[3]){g.fillStyle=C[3];g.fillRect(x-2,y-10,5,1);g.fillStyle=C[5];g.fillRect(x-2,y-8,5,1);g.fillStyle=C[6];g.fillRect(x-1,y-13,3,1);g.fillStyle=C[4];g.fillRect(x-3,y-1-bob,2,1);g.fillRect(x+2,y-1-bob,2,1);}}
const SKIN='#f1c9a5',SVW=[0,1].map(i=>Object.assign(['#d8281e','#b01e16',SKIN],{sv:1,vest:'#ffd21e',band:'#ffffff',hair:i?'#e8c84a':'#15120f'})),
  SVJ=['#2e86de','#8e44ad','#ecf0f1','#16a085','#e84393','#7f5539','#3c9d4e','#4b5d8a'],SVP=['#2c3e50','#5d4037','#1b4f72','#4a4a52'],SVH=['#15120f','#e8c84a','#7b4a22','#bdbdbd'],
  SVT=SVJ.map((j,i)=>Object.assign([j,SVP[i%4],SKIN],{sv:1,vest:'#ffd21e',hair:SVH[(i*3+(i>>1))%4]})),SV=SVW[0],
  svC=o=>{if(o.wk===undefined){const v=o.v&&o.v.type&&o.v.type!=='raft'?o.v:(typeof vessels!=='undefined'&&vessels[0])||{};o.wk=v.type==='tanker'||v.type==='crab'||v.type==='container'?1:0;}const k=((o.ph||0)*7)|0;return o.wk?SVW[k&1]:SVT[k%8];},swCol=()=>typeof M!=='undefined'&&(M.camp===0||M.camp===8)?BENC:SWC,MED=['#1d3b6e','#16233d','#f1d2b6'];
const SPKC={Will:'#1f5fb0',Cole:'#3a86c8',Frank:'#5b62b8',Brad:'#0d3a7a',Carl:'#c2410c',Jack:'#e2502a',Mac:'#9a5b07',Piloto:'#0f766e',Pilot:'#0f766e',Gruista:'#15803d','Hoist op.':'#15803d',Nadador:'#4d7c0f',Swimmer:'#4d7c0f','Cmdte. Hayes':'#4a525a','Cmdr. Hayes':'#4a525a'};
const SPKR={Will:'Piloto',Cole:'Copiloto',Frank:'Gruista',Brad:'Nadador',Jack:'Nadador',Carl:'Piloto',Mac:'Gruista'};
function campCrew(k){if(typeof M==='undefined'||M.camp==null||state==='brief')return null;const v=M.camp===0||M.camp===8;if(M.camp===1)return tr(k==='p'?'Piloto':'Nadador');return k==='p'?(v?'Will':'Carl'):(v?'Brad':'Jack');}
function bubble(g,wx,wy,text,bc,who){text=tr(text);const mt=(typeof M!=='undefined'&&M.camp===1?/^(Cmdte\. Hayes|Cmdr\. Hayes|Piloto|Pilot|Gruista|Hoist op\.|Nadador|Swimmer): /:/^(Cmdte\. Hayes|Cmdr\. Hayes|Will|Cole|Frank|Brad|Jack|Carl|Mac): /).exec(text);if(mt){who=mt[1];text=text.slice(mt[0].length);}
  const lab=who?(SPKR[who]?tr(SPKR[who])+' '+who:who).toUpperCase():'';const sx=wx-camX,sy=wy-camY,ls=[''];for(const w of text.toUpperCase().split(' ')){const l=ls[ls.length-1];if(l&&(l+' '+w).length>22)ls.push(w);else ls[ls.length-1]=l?l+' '+w:w;}
  g.font='8px Silkscreen,monospace';let w=0;for(const l of ls)w=Math.max(w,g.measureText(l).width);if(lab){g.font='700 8px Silkscreen,monospace';w=Math.max(w,g.measureText(lab).width);ls.unshift(lab);}w=r(w)+8;const hh=ls.length*9+4+(lab?2:0),x=r(clamp(sx-w/2,3,VW-w-3)),y=r(clamp(sy-hh-5,3,VH-hh-8));
  g.fillStyle=bc;g.fillRect(x+1,y-1,w-2,hh+2);g.fillRect(x-1,y+1,w+2,hh-2);g.fillRect(x,y,w,hh);g.fillStyle='#fff';g.fillRect(x+1,y,w-2,hh);g.fillRect(x,y+1,w,hh-2);
  const tx=r(clamp(sx,x+4,x+w-5));g.fillStyle=bc;g.fillRect(tx-2,y+hh,5,1);g.fillRect(tx-1,y+hh+1,3,1);g.fillRect(tx,y+hh+2,1,1);g.fillStyle='#fff';g.fillRect(tx-1,y+hh-1,3,2);g.fillRect(tx,y+hh+1,1,1);
  g.textAlign='left';ls.forEach((l,i)=>{const hd=lab&&i===0;g.font=(hd?'700 ':'')+'8px Silkscreen,monospace';g.fillStyle=hd?(SPKC[who]||'#3a424c'):'#16191d';g.fillText(l,x+4,y+9+i*9+(lab&&i?2:0));});if(lab){g.fillStyle='rgba(22,25,29,.25)';g.fillRect(x+4,y+11,w-8,1);}}
function hpBar(p,up){if(!M.bars)return;const x=r(p.x)-5,y=r(p.y)-up;ctx.fillStyle='#0b1118';ctx.fillRect(x-1,y-1,12,4);
  ctx.fillStyle=p.hp>.5?'#5fe08a':p.hp>.25?'#f6c62f':'#ff5a4a';ctx.fillRect(x,y,Math.max(1,r(10*clamp(p.hp,0,1))),2);}
const HSD=document.createElement('canvas'),HSG=HSD.getContext('2d'),HSX=160,HSY=90;HSD.width=300;HSD.height=140;
function drawHeli(h){
  // the turn reads as a real rotation: the whole side view (doors, wheels, tail rotor, lights) is built off-screen and projected in thin vertical slices,
  // so the nose swells toward the camera while the tail shrinks away; it cross-fades into the head-on view, the airframe banks and the rotor disc opens up
  const S=h.spec,G=ctx,sp=SPR[S.spr],dp=SPR[S.spr+'Door'],yw=Math.sin(clamp(h.yaw,-1,1)*1.5708),ay=Math.abs(yw),c3=Math.sqrt(Math.max(0,1-ay*ay)),gy=S.belly+r(h.gear*S.gear),t=S.tail,R0=S.rotR,
    kq=clamp((ay-.2)/.5,0,1),kf=kq*kq*(3-2*kq),fq=clamp((ay-.48)/.34,0,1),fa=1-fq*fq*(3-2*fq),bank=(h.dir||1)*c3*.08,sgn=yw<0?-1:1,wS=ay;
  const side=g=>{
    if(h.gear>.05)for(const w of S.wheels){const by=w[3]||gy;g.fillStyle='#6b7278';g.fillRect(w[0],w[1],1,Math.max(0,by-w[1]-2));g.fillStyle='#101214';g.fillRect(w[0]-(w[2]>>1),by-w[2]+1,w[2],w[2]-1);}
    const tailRotor=()=>{const tl=r(Math.abs(Math.cos(h.rot*1.7))*t[2]);
      if(t[3]){const R=t[2],d=disc('rgba(226,233,240,.22)',R);g.drawImage(d,t[0]-R,t[1]-R);for(let k=0;k<2;k++){const a=h.rot*1.7+k*1.5708,bx=Math.cos(a)*R,by=Math.sin(a)*R;g.fillStyle=k?'rgba(34,38,43,.65)':'#22262b';pl(g,r(t[0]-bx),r(t[1]-by),r(t[0]+bx),r(t[1]+by));for(const q of[-1,1]){g.fillStyle=Y;pl(g,r(t[0]+q*bx*.68),r(t[1]+q*by*.68),r(t[0]+q*bx*.8),r(t[1]+q*by*.8));g.fillStyle='#d8402a';pl(g,r(t[0]+q*bx*.86),r(t[1]+q*by*.86),r(t[0]+q*bx),r(t[1]+q*by));}}g.fillStyle=K;g.fillRect(t[0]-1,t[1]-1,3,3);g.fillStyle='#8a9198';g.fillRect(t[0],t[1],1,1);}
      else{g.fillStyle='#aab2b8';g.fillRect(t[0]-tl,t[1],tl*2+1,1);g.fillRect(t[0],t[1]-(t[2]-tl),1,(t[2]-tl)*2+1);}};
    if(t[3]&&yw<0)tailRotor();
    g.drawImage(sp,-sp.ox,-sp.oy);g.drawImage(dp,S.door[0]-r(h.door*(S.door[2]-1)),S.door[1]);
    if(t[3]){g.fillStyle='#e8502a';g.fillRect(-80,-17,4,4);}
    if(!t[3]||yw>=0)tailRotor();
    if(h.lights){const L=S.lt,q=T%1.3;g.fillStyle=yw>0?'#3cff7a':'#ff3b3b';g.fillRect(L.nav[0],L.nav[1],2,2);if(T*1.1%1<.22){g.fillStyle='#ff3030';for(const b of L.bc)g.fillRect(b[0],b[1],2,2);}if(q<.06||(q>.15&&q<.21)){g.fillStyle='#fff';g.fillRect(L.st[0]-1,L.st[1]-1,3,3);}}};
  const g=G;g.save();g.translate(r(h.x),r(h.y)+r(c3*1.6));g.rotate(h.tilt*ay+bank);
  const front=()=>{if(fa<=0)return;const f=SPR[S.spr+'F'];g.globalAlpha=fa;if(h.gear>.05&&!S.fixed){g.fillStyle='#101214';for(const wx of[-8,-1,6])g.fillRect(wx,gy-3,3,3);}g.drawImage(f,-f.ox,-f.oy);g.globalAlpha=1;};
  {
    if(c3<.02){g.save();g.scale(sgn,1);side(g);g.restore();}
    else{HSG.setTransform(1,0,0,1,0,0);HSG.globalAlpha=1;HSG.clearRect(0,0,HSD.width,HSD.height);HSG.imageSmoothingEnabled=false;HSG.setTransform(1,0,0,1,HSX,HSY);side(HSG);
      const x0=Math.max(0,HSX-sp.ox-16),x1=Math.min(HSD.width,HSX-sp.ox+sp.width+4),SW=2,pp=c3*.3,pv=c3*5,cut=-14,strip=(a,b,tail)=>{for(let sx=a;sx<b;sx+=SW){const lx=sx-HSX,u=clamp(lx/90,-1,1),k=1+pp*u,xa=sgn*wS*lx*(1+pp*u*.35),xb=sgn*wS*(lx+SW)*(1+pp*clamp((lx+SW)/90,-1,1)*.35),dx=Math.min(xa,xb),dw=Math.max(1,Math.ceil(Math.abs(xb-xa)+.4));
        g.globalAlpha=tail?kf+(1-kf)*clamp((cut-lx)/12,0,1):kf;if(g.globalAlpha>.01)g.drawImage(HSD,sx,0,SW,HSD.height,Math.floor(dx),Math.round(-HSY*k-u*pv*.4),dw,Math.round(HSD.height*k));}};
      strip(x0,HSX+cut,1);g.globalAlpha=1;front();strip(HSX+cut,x1,0);g.globalAlpha=1;}}
  const cr=Math.cos(h.rot),sr=Math.sin(h.rot),tk=c3*3.6,hh=Math.round(tk);
  g.fillStyle='rgba(225,233,240,.2)';if(hh<1)g.fillRect(-R0,S.rotY,R0*2,2);else for(let dy=-hh;dy<=hh;dy++){const w=r(R0*Math.sqrt(1-(dy/(hh+.6))**2));g.fillRect(-w,S.rotY+dy,w*2,1);}
  const ax=r(cr*R0),ayy=r(sr*tk),bx=r(sr*R0),byy=r(cr*tk);
  g.fillStyle='rgba(34,38,43,.6)';pl(g,-bx,S.rotY+(hh<1?1:0)-byy,bx,S.rotY+(hh<1?1:0)+byy);
  g.fillStyle='#22262b';pl(g,-ax,S.rotY+ayy,ax,S.rotY-ayy);
  g.fillStyle=Y;g.fillRect(Math.min(-ax,ax),S.rotY+(ax>0?ayy:-ayy),2,1);g.fillRect(Math.max(-ax,ax)-1,S.rotY-(ax>0?ayy:-ayy),2,1);
  g.restore();
}
const YS=new Float32Array(2000);
function seaLayer(i,col,hi){
  const off=[900,400,0][i],amp=[.5,.75,1][i],yo=[-9,-4,0][i],sp=[.7,.85,1][i],g=ctx,n=Math.ceil(VW/2)+1;
  for(let k=0;k<n;k++){const x=cx+k*2;YS[k]=r(i===2?wave(x):(wbase(x+off,T*sp)*amp*(FIN.on&&i<2?FIN.wv:1)+rog(x)*amp)*shore(x)+yo);}
  g.fillStyle=col;for(let k=0;k<n;k++)g.fillRect(cx+k*2,YS[k],2,cy+VH-YS[k]);
  g.fillStyle=hi;for(let k=0;k<n;k++){if(i===2||((k+(T*3|0))&3))g.fillRect(cx+k*2,YS[k],2,1);}
  if(i===2){g.fillStyle='rgba(255,255,255,.55)';for(let k=1;k<n-1;k++)if(YS[k]<YS[k-1]&&YS[k]<=YS[k+1]&&YS[k]<-10)g.fillRect(cx+k*2-4,YS[k]+1,9,1);}
}
function hole(x,y,rad,a){const gr=fx.createRadialGradient(x,y,0,x,y,rad);gr.addColorStop(0,`rgba(0,0,0,${a})`);gr.addColorStop(1,'rgba(0,0,0,0)');fx.fillStyle=gr;fx.fillRect(x-rad,y-rad,rad*2,rad*2);}
function overlay(col,holes){fx.setTransform(1,0,0,1,0,0);fx.globalCompositeOperation='source-over';fx.clearRect(0,0,VW,VH);fx.fillStyle=col;fx.fillRect(0,0,VW,VH);
  fx.setTransform(1,0,0,1,-cx,-cy);fx.globalCompositeOperation='destination-out';holes();ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(fxc,0,0);ctx.setTransform(1,0,0,1,-cx,-cy);}
function glow(x,y,rad,col){const g=ctx,gr=g.createRadialGradient(x,y,0,x,y,rad);gr.addColorStop(0,col);gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(x-rad,y-rad,rad*2,rad*2);}
function beamPts(){const h=heli,S=h.spec,ox=h.x+h.dir*(S.half*.6),oy=h.y+S.belly-1,a=1.57-h.dir*(.42+h.tilt*h.dir),len=400,w=.19;
  return[ox,oy,ox+Math.cos(a-w)*len,oy+Math.sin(a-w)*len,ox+Math.cos(a+w)*len,oy+Math.sin(a+w)*len];}
const FLC=['#fff6c0','#ffd83a','#ff9a1e','#e8481a','#8a2412'],SMC=['#6b3a22','#26272b','#393b40','#4e5157','#666a70'];

// low sun: strength, colour and side; sprites and the helicopter take its colour, and fire, flares and lightning light the airframe
let SUN={gf:0,c:[255,200,130],dir:1,key:''},BOLTX=0;const LITC=new Map(),HLc=document.createElement('canvas'),HLg=HLc.getContext('2d');HLc.width=320;HLc.height=230;
const rgba=(c,a)=>`rgba(${c[0]|0},${c[1]|0},${c[2]|0},${Math.max(0,Math.min(1,a)).toFixed(3)})`;
function sunCalc(){const sf=(H-5.2)/15.6,low=Math.min(sf,1-sf),wk=(1-M.cloud*.5)*(M.fog?.5:1),gf=(low>=0?clamp(1-(low-.035)/.2,0,1):clamp(1+low/.07,0,1))*wk,
  c=mix(mix([255,112,58],[255,208,136],clamp(low/.2,0,1)),ENV.o,.25+M.cloud*.3);SUN={gf,c,dir:sf<.5?1:-1,key:gf<.03?'':(gf*14|0)+'|'+(c[0]>>3)+','+(c[1]>>3)+','+(c[2]>>3)+(sf<.5)};}
function sunSpr(s){if(!SUN.key)return s;let t=LITC.get(s);if(!t){t={c:document.createElement('canvas'),k:''};t.c.width=s.width;t.c.height=s.height;LITC.set(s,t);}
  if(t.k!==SUN.key){t.k=SUN.key;const g=t.c.getContext('2d'),w=s.width,gr=g.createLinearGradient(0,0,w,0),a0=SUN.gf*.4,a1=SUN.gf*.16;gr.addColorStop(0,rgba(SUN.c,SUN.dir>0?a0:a1));gr.addColorStop(1,rgba(SUN.c,SUN.dir>0?a1:a0));
    g.globalCompositeOperation='copy';g.drawImage(s,0,0);g.globalCompositeOperation='source-atop';g.fillStyle=gr;g.fillRect(0,0,w,s.height);g.globalCompositeOperation='source-over';}
  return t.c;}
const flick=q=>.5+.5*Math.sin(T*19+q)*Math.sin(T*6.7+q*.5);
const DROWN=['#0b2030','#0b2030','#0b2030'],FISHP=[null,[150,40,36],[34,96,70],[40,44,52],[196,120,30],[58,110,122],[110,60,120]],FISHN=['KODIAK','ALEUTIAN','SEA WOLF','MARY ANN','POLARIS','ORCA','KATMAI','NORDIC','ICE BAY','SAGA','TEMPEST','BERING','AURORA','LADY K'],FISHC=new Map();
// a fishing boat's own livery: the stock sprite with the hull repainted and another name on the bow
function vspr(v){if(!v.sk)return SPR[v.type];let c=FISHC.get(v.sk);if(c)return c;const q=v.sk.split('|'),s=SPR.fishing,pal=FISHP[+q[0]],hc=pal||[31,79,124];c=document.createElement('canvas');c.width=s.width;c.height=s.height;c.ox=s.ox;c.oy=s.oy;const g=c.getContext('2d');g.drawImage(s,0,0);
  if(pal){const y0=Math.max(0,s.oy-19),im=g.getImageData(0,y0,c.width,c.height-y0),d=im.data;for(let i=0;i<d.length;i+=4){const R=d[i],G=d[i+1],B=d[i+2];if(d[i+3]>200&&B>R*1.7&&B>G*1.2&&B<170){const f=B/124;d[i]=Math.min(255,pal[0]*f);d[i+1]=Math.min(255,pal[1]*f);d[i+2]=Math.min(255,pal[2]*f);}}g.putImageData(im,0,y0);}
  g.fillStyle=rgb(hc);g.fillRect(s.ox-57,s.oy-9,52,7);txt((col,x,y,w,h)=>{g.fillStyle=col;g.fillRect(Math.round(x+s.ox),Math.round(y+s.oy),w,h);},'#f1efe8',FISHN[+q[1]]||'KODIAK',-56,-8);
  FISHC.set(v.sk,c);return c;}
let BW1=null,BW2=null;
function baseWest(){const mkc=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;},pine=(R,x,y,h,col)=>{R('#2a211c',x,y-3,1,3);const n=Math.max(3,Math.round(h/5));for(let k=0;k<n;k++){const w=2+k*((h*.42)/n);R(col,x-w,y-h+k*(h/n),w*2+1,Math.ceil(h/n)+1);}};
  const build=(w,h,ox,oy,fn)=>{const c=mkc(w,h),g=c.getContext('2d');let sd=w;const rn=()=>(sd=(sd*16807)%2147483647)/2147483647;fn((col,x,y,ww,hh)=>{g.fillStyle=col;g.fillRect(Math.round(x+ox),Math.round(y+oy),Math.max(1,Math.round(ww)),Math.max(1,Math.round(hh)));},(col,q)=>{g.fillStyle=col;g.beginPath();for(let i=0;i<q.length;i+=2)g.lineTo(Math.round(q[i]+ox),Math.round(q[i+1]+oy));g.fill();},rn);return c;};
  const rocks=(R,rn,x0,x1,yt,n,cols)=>{for(let i=0;i<n;i++){const t=rn(),x=x0+t*(x1-x0),y=yt(x)+2+rn()*10,rw=2+rn()*5,rh=1.5+rn()*3;for(let k=0;k<rh;k++){const w=rw*Math.sqrt(1-Math.pow(k/rh,2));R(cols[i%cols.length],x-w,y-k,w*2,1);}R('rgba(232,240,244,.2)',x-rw*.5,y-rh+1,rw*.8,1);}};
  // hangar plane: its wooded bank eases down over 170 px, with the perimeter fence, a radar hut and the point light
  BW1=build(190,264,890,252,(R,P,rn)=>{const yt=x=>x>-760?-52:-52+58*Math.pow((-760-x)/118,1.25);P('#46584f',[-700,-52,-760,-52,-800,-40,-846,-12,-878,6,-878,12,-700,12]);P('#3b4b44',[-700,-40,-772,-40,-812,-22,-850,-4,-878,8,-878,12,-700,12]);R('#dfe7e6',-742,-53,42,2);R('rgba(223,231,230,.5)',-752,-53,10,2);
    for(let i=0;i<16;i++){const x=-868+rn()*150,y=Math.min(-4,yt(x));pine(R,x,y,(x<-800?8:12)+rn()*(x<-800?7:14),rn()<.5?'#1f3d33':'#28493c');}
    for(let x=-870;x<-702;x+=2){const y=yt(x);if(rn()<.5)R(rn()<.5?'#5a7058':'#34463c',x,y-1,1,2);else if(rn()<.12)R('#cfdadf',x,y,3,1);}
    for(let x=-758;x<=-700;x+=8)R('#9aa3a6',x,-64,1,11);R('#9aa3a6',-758,-64,58,1);R('#9aa3a6',-758,-59,58,1);R('rgba(154,163,166,.3)',-758,-63,58,9);R('#6b7479',-759,-66,2,14);R(Y,-748,-70,8,6);R(K,-746,-68,4,2);
    R('#aeb8bd',-736,-66,22,13);R('#75838c',-738,-68,26,2);R('#3d474e',-732,-61,5,8);R(GL,-722,-63,5,4);R('#8a9198',-720,-78,1,10);for(let k=-3;k<=3;k++)R('#dfe7e6',-721+k,-82+Math.abs(k),1,2);R(K,-720,-80,1,1);
    for(let k=0;k<44;k+=4){R('#6b7479',-792,-88+k,1,4);R('#6b7479',-786,-88+k,1,4);R('#6b7479',-792,-88+k,7,1);if(k%8===0)for(let m=0;m<4;m++)R('#6b7479',-791+m*1.5,-88+k+m,1,1);}R('#3d474e',-793,-91,9,3);R('#d8341a',-790,-94,3,3);R('#c9ccc8',-796,-46,15,2);
    for(let i=0;i<9;i++){const x0=-770-i*9,y0=yt(x0)-1;R('#7e878a',x0-6,y0,7,1);R('#5d666a',x0-6,y0+1,7,1);}
    rocks(R,rn,-878,-756,yt,80,['#5f686c','#4d5658','#727b80','#404849']);for(let i=0;i<7;i++){const x=-876+rn()*40,rw=5+rn()*6,rh=4+rn()*5;for(let k=0;k<rh;k++){const w=rw*Math.sqrt(1-Math.pow(k/rh,2));R(i%2?'#4d5658':'#5f686c',x-w,9-k,w*2,1);}R('rgba(232,240,244,.25)',x-rw*.5,10-rh,rw*.8,1);}
    for(let i=0;i<4;i++){const x=-860+rn()*70,y=yt(x)+4+rn()*5;R('#7a6650',x,y,10+rn()*8,1);R('#5d4c3b',x+2,y-1,2,1);}for(let x=-878;x<-842;x+=2)if(rn()<.6)R('#2f4a38',x,6+rn()*3,2,2);});
  // apron plane: barriers, a floodlight and a life ring where the concrete gives way to rock armour
  BW2=build(150,180,790,166,(R,P,rn)=>{const yt=x=>x>-684?-46:-46+52*Math.pow((-684-x)/96,1.2);P('#7e878a',[-640,-46,-684,-46,-716,-32,-752,-8,-780,6,-780,12,-640,12]);P('#69726f',[-640,-36,-694,-36,-726,-20,-756,-2,-780,8,-780,12,-640,12]);R('#9aa3a6',-680,-47,40,1);
    for(let x=-676;x<-640;x+=14)R(Y,x,-43,8,1);for(let x=-640;x>-680;x-=12)R('rgba(0,0,0,.14)',x,-45,1,9);R(Y,-683,-46,2,10);R(K,-683,-43,2,2);R(K,-683,-39,2,2);
    for(let i=0;i<3;i++){const x=-682+i*13;P('#c9ccc8',[x,-46,x+2,-52,x+9,-52,x+11,-46]);R('#f36f21',x+2,-51,7,1);R('rgba(0,0,0,.2)',x,-47,11,1);}
    R('#6b7479',-650,-92,2,46);R(K,-656,-96,14,4);R('#fff3b0',-655,-93,4,2);R('#fff3b0',-647,-93,4,2);R('#6b7479',-652,-48,6,2);
    R('#6b7479',-664,-60,1,14);R('#f36f21',-667,-63,7,7);R(W,-665,-61,3,3);R('#f2f2ec',-674,-58,7,5);R('#c8402a',-674,-58,7,1);
    R('#3d474e',-700,-30,7,6);R('#14171a',-699,-29,5,4);for(let k=0;k<16;k++)R(`rgba(60,74,70,${(.5*(1-k/16)).toFixed(2)})`,-698-k*.6,-24+k*1.6,3,2);
    for(let k=0;k<9;k++){R('#8a9296',-712-k*4.4,-33+k*4.2,5,1);R('#5d666a',-712-k*4.4,-32+k*4.2,5,3);}
    rocks(R,rn,-782,-676,yt,110,['#6b7479','#59625f','#7d858a','#4a5253','#8a8f8a']);for(let i=0;i<8;i++){const x=-780+rn()*46,rw=4+rn()*6,rh=3+rn()*5;for(let k=0;k<rh;k++){const w=rw*Math.sqrt(1-Math.pow(k/rh,2));R(i%2?'#59625f':'#6b7479',x-w,9-k,w*2,1);}R('rgba(232,240,244,.25)',x-rw*.5,10-rh,rw*.8,1);}
    for(let x=-780;x<-742;x+=2)if(rn()<.6)R('#2f4a38',x,6+rn()*3,2,2);for(let i=0;i<3;i++){const x=-770+rn()*50,y=yt(x)+5;R('#7a6650',x,y,9+rn()*8,1);}});}
const PADB={};
function padSync(){const h=heli;if(!h||state!=='play')return;const S=(k,cls,v)=>{const b=PADB[k]||(PADB[k]=document.querySelector(`#pad button[data-k="${k}"]`));if(b&&b.classList.contains(cls)!==!!v)b.classList.toggle(cls,!!v);},sp=h.landed&&h.rpm<.93,jm=X.jam>0||X.noHoist||X.snag;
  S('KeyB','lit',h.bat);S('Digit1','lit',h.e1);S('Digit1','spool',h.e1&&sp);S('Digit2','lit',h.e2&&!X.eng);S('Digit2','spool',h.e2&&sp&&!X.eng);S('Digit2','fail',X.eng&&!h.dead);S('KeyF','warn',X.noSpot);S('KeyW','warn',jm);S('KeyS','warn',jm);}
function drawHeliLit(h){const src=[];if(state!=='menu'){for(const v of vessels)if(!v.gone&&v.fire)for(const fo of v.fs)src.push([v.x+fo,deckY(v,fo)-10,150+v.fire*110,[255,128,40],.13+v.fire*.07,fo]);for(const f of flares)src.push([f.x,f.y,230,[255,70,50],.16*Math.min(1,f.life/3),f.x*.01]);}
  const near=src.filter(q=>Math.hypot(q[0]-h.x,q[1]-h.y)<q[2]+70);
  if(!SUN.key&&!near.length&&flash<=.03){drawHeli(h);return;}
  const g=ctx,W=HLc.width,HH=HLc.height,ox=r(h.x)-W/2,oy=r(h.y)-HH/2;HLg.setTransform(1,0,0,1,0,0);HLg.globalCompositeOperation='source-over';HLg.globalAlpha=1;HLg.clearRect(0,0,W,HH);HLg.imageSmoothingEnabled=false;HLg.setTransform(1,0,0,1,-ox,-oy);
  ctx=HLg;try{drawHeli(h);}finally{ctx=g;}
  HLg.setTransform(1,0,0,1,-ox,-oy);HLg.globalAlpha=1;HLg.globalCompositeOperation='source-atop';
  if(SUN.key){const gr=HLg.createLinearGradient(h.x-70,0,h.x+70,0),a0=SUN.gf*.42,a1=SUN.gf*.14;gr.addColorStop(0,rgba(SUN.c,SUN.dir>0?a0:a1));gr.addColorStop(1,rgba(SUN.c,SUN.dir>0?a1:a0));HLg.fillStyle=gr;HLg.fillRect(ox,oy,W,HH);}
  for(const q of near){const rad=q[2]+70,gr=HLg.createRadialGradient(q[0],q[1],0,q[0],q[1],rad);gr.addColorStop(0,rgba(q[3],q[4]*(.6+.4*flick(q[5]))));gr.addColorStop(1,rgba(q[3],0));HLg.fillStyle=gr;HLg.fillRect(ox,oy,W,HH);}
  if(flash>.03){const s=h.x<BOLTX?1:-1,gr=HLg.createLinearGradient(h.x+s*60,h.y-40,h.x-s*50,h.y+30);gr.addColorStop(0,rgba([226,236,255],flash*.75));gr.addColorStop(1,rgba([226,236,255],0));HLg.fillStyle=gr;HLg.fillRect(ox,oy,W,HH);}
  HLg.globalCompositeOperation='source-over';g.drawImage(HLc,ox,oy);}
// ---------- life aboard the cutter: radar, flags and a signal hoist in the wind, sailors at work, a landing signalman with lit wands ----------
const SAIL=['#2f4a7a','#16233d','#f1d2b6'];
function cutterLife(v){const g=ctx,wd=M.wind<0?-1:1,wa=clamp(Math.abs(M.wind)/40,.3,1.4),night=ENV.d>.3;
  // rigging: two radars, whip aerials, stays, mast flag and the ensign aft
  g.fillStyle=GR;g.fillRect(28,-171,1,6);const rw=r(Math.abs(Math.cos(T*2.4))*9);g.fillStyle='#e8ecec';g.fillRect(28-rw,-173,rw*2+1,2);g.fillStyle='#8a9198';g.fillRect(28-rw,-171,rw*2+1,1);
  const r2=r(Math.abs(Math.sin(T*3.1))*6);g.fillStyle='#c9ccc8';g.fillRect(49-r2,-111,r2*2+1,1);g.fillStyle=GR;g.fillRect(49,-110,1,2);
  g.fillStyle='rgba(52,58,64,.5)';pl(g,29,-150,250,-44);pl(g,27,-150,-100,-68);
  g.fillStyle='#3d474e';for(const[x,y,hh]of[[8,-108,20],[56,-108,16],[-44,-102,14]])for(let k=0;k<hh;k++)g.fillRect(r(x+Math.sin(T*2.2+x)*wa*wd*(k/hh)*(k/hh)*2.4),y-k,1,1);
  const flag=(x,y,n,hh,d)=>{for(let i=0;i<n;i++){const fy=y+r(Math.sin(T*7-i*.7)*(.3+i*.11)*wa),fx=x+d*i;g.fillStyle=RB;g.fillRect(fx,fy,1,hh);g.fillStyle=W;for(let k=1;k<hh;k+=2)g.fillRect(fx,fy+k,1,1);if(i<n*.42){g.fillStyle=BL;g.fillRect(fx,fy,1,Math.ceil(hh/2));}}};
  flag(44,-150,13,7,1);g.fillStyle=GR;g.fillRect(-258,-54,1,19);flag(-258+wd,-54,13,7,wd);
  // fittings: life rings, a door on the boat deck, funnel haze, foam along the waterline
  for(const x of[-88,104,176]){g.fillStyle='#f36f21';g.fillRect(x,-40,4,4);g.fillStyle=W;g.fillRect(x+1,-39,2,2);g.fillRect(x+1,-40,2,1);}
  const cyc=(T+3)%20,dOpen=(cyc>4&&cyc<5)||(cyc>10.4&&cyc<11.4);
  g.fillStyle='#8f9aa0';g.fillRect(57,-82,8,14);g.fillStyle=dOpen?'#1a2026':'#c4cbd0';g.fillRect(58,-81,6,13);if(!dOpen){g.fillStyle=GL;g.fillRect(60,-78,2,2);g.fillStyle=K;g.fillRect(62,-74,1,1);}else{g.fillStyle='#c4cbd0';g.fillRect(64,-81,2,13);if(night){g.fillStyle='rgba(255,214,140,.5)';g.fillRect(58,-81,6,13);}}
  for(let i=0;i<7;i++){const a=((T*.5+i/7)%1),x=-45+wd*a*26*wa+Math.sin(T*1.3+i*2)*2,y=-104-a*22;g.fillStyle=`rgba(70,74,80,${(.2*(1-a)).toFixed(3)})`;const sz=2+r(a*4);g.fillRect(r(x)-(sz>>1),r(y)-(sz>>1),sz,sz);}
  g.fillStyle='rgba(255,255,255,.75)';for(let x=-250;x<250;x+=5)if(Math.sin(x*.9+T*3.2)>.35)g.fillRect(x,9+((x*7)&1),3+((x>>2)&1),1);for(let i=0;i<6;i++)if(Math.sin(T*4+i*1.7)>0)g.fillRect(252+i*3,6-i,3,1);
  // crew: a pacer on the foredeck, a lookout with binoculars, two talking, one leaning over the bow rail, one through the door, one at work, the signalman
  const pc=(a,b,sp,off)=>{const n=b-a,q=((T+off)*sp)%(n*2);return q<n?[a+q,1]:[b-(q-n),-1];};
  let q=pc(112,170,10,3);man(q[0],-32,SAIL,2,0,q[1]);
  {const d=Math.sin(T*.42)>0?1:-1,up=Math.sin(T*.42*2+.6)>-.75,x=-12,y=-90;man(x,y,SAIL,4,2,d);if(up){g.fillStyle=SAIL[0];pl(g,x+d,y-12,x+d*3,y-15);pl(g,x-d,y-12,x+d*2,y-15);g.fillStyle='#14171a';g.fillRect(d>0?x+2:x-4,y-16,3,2);g.fillStyle=GL;g.fillRect(d>0?x+4:x-4,y-16,1,1);}}
  {const ta=Math.sin(T*.6)>0,x1=-24,x2=-15,y=-68,ge=r(Math.sin(T*7)*1.5),nod=Math.sin(T*2.3)>.8?1:0;man(x1,y-(ta?0:nod),SAIL,4,1,1);man(x2,y-(ta?nod:0),SAIL,4,2,-1);g.fillStyle=SAIL[0];if(ta)pl(g,x1+2,y-12,x1+5,y-14-ge);else pl(g,x2-2,y-12,x2-5,y-14-ge);}
  {const x=236,y=-40,bob=Math.sin(T*1.1)*.03;g.save();g.translate(x,y);g.rotate(.3+bob);man(0,0,SAIL,4,5,1);g.fillStyle=SAIL[0];pl(g,2,-12,7,-9);pl(g,1,-11,6,-8);g.restore();}
  {let x=null,d=-1,m=2;if(cyc<4){x=88-27*(cyc/4);}else if(cyc<4.5){x=61;m=4;}else if(cyc<10.6){x=null;}else if(cyc<11){x=61;m=4;d=1;}else if(cyc<15){x=61+27*((cyc-11)/4);d=1;}else{x=88;m=4;d=1;}
    if(x!=null){man(x,-68,SAIL,m,6,d);if(cyc<4||cyc>=15){g.fillStyle='#8f6a4a';g.fillRect(r(x)+d*3-2,-78,4,4);}}}
  man(204,-36,SAIL,4,3,1);g.fillStyle=SAIL[0];pl(g,206,-47,209,-44+r(Math.sin(T*6)*1.5));g.fillStyle=GR;g.fillRect(209,-43+r(Math.sin(T*6)*1.5),3,1);g.fillStyle='#5b6068';g.fillRect(210,-40,6,4);
  // the signalman stands at the right-hand edge of the flight deck, by the hangar, leaving the pad clear
  const h=heli,lx=-105,ly=-35,dd=h?h.x-(v.x-174):9e9,near=h&&state!=='menu'&&!h.dead&&Math.abs(dd)<560,down=h&&h.landed&&h.on===v;
  man(lx,ly,SAIL,4,7,-1);g.fillStyle=Y;g.fillRect(lx-2,ly-16,5,2);g.fillStyle='#d7ff3f';g.fillRect(lx-2,ly-11,5,3);v.wand=null;
  if(near){const sw_=Math.sin(T*5.2);let a,b;
    if(down){a=[lx-3,ly-20];b=[lx+3,ly-20];}else if(Math.abs(dd)>46){const k=dd>0?1:-1;a=[lx-5-r(sw_*2)*k,ly-19-r(Math.abs(sw_)*2)];b=[lx+5-r(sw_*2)*k,ly-19-r(Math.abs(sw_)*2)];}else{a=[lx-7,ly-13+r(sw_*3)];b=[lx+7,ly-13+r(sw_*3)];}
    g.fillStyle=SAIL[0];pl(g,lx-2,ly-12,a[0],a[1]);pl(g,lx+2,ly-12,b[0],b[1]);g.fillStyle='#f4ff8a';for(const w of[a,b]){g.fillRect(w[0]-1,w[1]-3,2,4);}
    const c=Math.cos(v.ang),sn=Math.sin(v.ang);v.wand=[a,b].map(w=>[v.x+w[0]*c-(w[1]-2)*sn,v.y+w[0]*sn+(w[1]-2)*c]);}}
function cutterGlow(v,da){const g=ctx;if(da>.08){g.save();g.translate(r(v.x),r(v.y));g.rotate(v.ang);g.fillStyle=`rgba(255,214,140,${Math.min(1,da*1.25).toFixed(3)})`;
    for(let i=0;i<13;i++)if((i*7)%5)g.fillRect(-52+i*11,-58,5,5);for(let i=0;i<8;i++)if(i%4!==2)g.fillRect(-24+i*10,-82,5,5);g.fillStyle=`rgba(255,120,90,${(da*.4).toFixed(3)})`;g.fillRect(3,-102,54,7);
    g.fillStyle=`rgba(255,224,170,${(da*.6).toFixed(3)})`;g.fillRect(-100,-63,8,29);glow(-104,-70,78,`rgba(255,230,180,${(da*.34).toFixed(3)})`);glow(14,-58,110,`rgba(255,200,120,${(da*.12).toFixed(3)})`);glow(30,-84,70,`rgba(255,200,120,${(da*.1).toFixed(3)})`);g.restore();}
  if(v.wand)for(const w of v.wand){glow(r(w[0]),r(w[1]),5+da*6,`rgba(232,255,96,${(.45+da*.5).toFixed(3)})`);glow(r(w[0]),r(w[1]),2,'rgba(255,255,220,.9)');}}
// ---------- aurora: shimmering curtains on its own layer, mirrored on the sea, with everything in front of the sky cut out of it ----------
const AUC=document.createElement('canvas'),AUG=AUC.getContext('2d'),AUS=document.createElement('canvas'),AUR=document.createElement('canvas');
{AUS.width=AUR.width=2;AUS.height=AUR.height=64;const a=AUS.getContext('2d'),gr=a.createLinearGradient(0,0,0,64);gr.addColorStop(0,'rgba(150,80,255,0)');gr.addColorStop(.28,'rgba(140,96,255,.3)');gr.addColorStop(.6,'rgba(60,255,150,.72)');gr.addColorStop(.88,'rgba(170,255,200,1)');gr.addColorStop(1,'rgba(120,255,170,0)');a.fillStyle=gr;a.fillRect(0,0,2,64);
  const b=AUR.getContext('2d');b.setTransform(1,0,0,-1,0,64);b.drawImage(AUS,0,0);}
function auroraDraw(g,hz,dc,cam0,au){const a=AUG,h=heli;if(AUC.width!==VW||AUC.height!==VH){AUC.width=VW;AUC.height=VH;}
  a.setTransform(1,0,0,1,0,0);a.globalCompositeOperation='source-over';a.globalAlpha=1;a.clearRect(0,0,VW,VH);a.imageSmoothingEnabled=false;a.globalCompositeOperation='lighter';
  if(hz<VH){a.globalAlpha=.06*au;a.fillStyle='#3cff96';a.fillRect(0,hz,VW,VH-hz);}
  const px=camX*.03;for(let c=0;c<2;c++){const amp=c?.6:1;for(let sx=0;sx<VW;sx+=3){const x=sx+px+c*210.3,
      I=Math.max(0,.55+.45*Math.sin(x*.012+T*.22+Math.sin(x*.0047-T*.11+c)*2.4))*(.72+.28*Math.sin(x*.21+T*1.7+c*2)),
      yb=hz-122-c*38-Math.sin(x*.0063+T*.07+c*1.7)*46-Math.sin(x*.019-T*.12)*16,hg=74+50*Math.sin(x*.009+T*.16+c)+26*Math.abs(Math.sin(x*.13+T*.5+c*3));
      if(I<.06)continue;a.globalAlpha=Math.min(1,I*au*amp*.9);a.drawImage(AUS,0,0,2,64,sx,r(yb-hg),3,r(hg));
      const wy=r(wave(cx+sx))-cy;if(wy>0&&wy<VH&&Math.sin(sx*.9+T*2.3)<.72){a.globalAlpha=Math.min(1,I*au*amp*.6);a.drawImage(AUR,0,0,2,64,sx+r(Math.sin(sx*.31+T*2.6)*1.6),wy+2+c*4,3,r(hg*.6));}}}
  a.globalAlpha=1;a.globalCompositeOperation='destination-out';const mw=r(Math.max(0,-2500-dc)*1.1);a.drawImage(TINT.mid,r(-460-dc*.38)+mw,hz+3-136);a.drawImage(TINT.near,r(-600-dc*.5)+mw,hz+4-74);coastFar(a,hz,dc);if(dc<-200)townFar(a,hz,dc,1);
  const WW=VW+520;for(const c of skyClouds){const s=SPR.cl[c.i],x=(((c.x-camX*c.p+T*M.wind*.4*c.p)%WW)+WW)%WW-260;a.drawImage(s.c,r(x),r(hz-c.off-s.h*2),s.w*2,s.h*2);}
  if(dc<1700){const o1=r(cam0+dc*.6),o2=r(cam0+dc*.82);a.setTransform(1,0,0,1,-o1,-cy);a.drawImage(SPR.L1,-700,-252);if(BW1)a.drawImage(BW1,-890,-252);a.setTransform(1,0,0,1,-o2,-cy);a.drawImage(SPR.L2,-640,-166);if(BW2)a.drawImage(BW2,-790,-166);}
  a.setTransform(1,0,0,1,-cx,-cy);if(cx<420)a.drawImage(SPR.L3,-720,-60);if(TOWN&&cx<-700&&cx+VW>TWX0)a.drawImage(TOWN,TWX0,-TWOY);
  for(const v of vessels){if(v.gone)continue;const sp=vspr(v);a.save();a.translate(r(v.x),r(v.y));a.rotate(v.ang);a.drawImage(sp,-sp.ox,-sp.oy);a.restore();}
  if(h&&state!=='menu'&&!h.dead){const g0=ctx;ctx=a;try{drawHeli(h);}finally{ctx=g0;}a.globalAlpha=1;}
  g.setTransform(1,0,0,1,0,0);g.drawImage(AUC,0,0);g.setTransform(1,0,0,1,-cx,-cy);}
function render(){
  const g=ctx,h=heli;g.imageSmoothingEnabled=false;
  if(T-envT>.35||T<envT){envT=T;ENV=envAt(H);buildSky(ENV);const nv=ENV.d>.35;$('#pad').classList.toggle('nvg',nv);if(nv!==NVG){if(state==='play'&&!RP.on&&!EPI.on&&heli&&!heli.dead&&(nv||NVG!==null))say(nv?'Cae la noche. Pasando controles a modo de visión nocturna.':'Amanece. Controles de vuelta a modo día.',4.5,'p');if(state==='play'||NVG!==null)NVG=nv;}}
  if(state==='brief'){drawBrief();return;}
  sunCalc();if(bolt)BOLTX=bolt.p[0];
  const e=ENV,cam0=-30-VW*.62;
  if(PH.on){camX=PH.x;camY=PH.y;}else if(RP.on){camX=RP.cx;camY=RP.cy;}
  else if(h&&state!=='menu'){const k=Math.max(clamp((h.x-150)/700,0,1),clamp((-260-h.x)/700,0,1)),tx=h.x-lerp(VW*.62,VW/2-h.dir*50-h.vx*.22,k);camX+=(tx-camX)*.08;camY=Math.min(-VH*.72,h.y-VH*.3);if(FIN.on&&FIN.st!=='deck'){const ty=h.y-VH*.25;FIN.cy=FIN.cy==null?camY:FIN.cy+(ty-FIN.cy)*.03;camY=FIN.cy;}}
  else{camX+=(cam0+90-camX)*.05;camY=-VH*.72;}
  cx=r(camX);cy=r(camY);const hz=-cy,dc=camX-cam0;
  // sky: dithered colour bands, stars, sun, moon, clouds
  g.setTransform(1,0,0,1,0,0);g.fillStyle=rgb(e.z);g.fillRect(0,0,VW,Math.max(0,hz-SKH)+1);
  g.setTransform(1,0,0,1,0,hz-SKH);g.fillStyle=skyPat;g.fillRect(0,0,VW,SKH+VH);g.setTransform(1,0,0,1,0,0);
  const vis=1-M.cloud*.9;let sunX=-1,sunC='';
  if(e.d>.3){g.fillStyle='#fff';for(const s of stars){g.globalAlpha=clamp((e.d-.3)*3,0,1)*vis*(.4+.6*Math.abs(Math.sin(T*.8+s[2]*9)));g.fillRect(r(s[0]*VW),r(s[1]*hz),1+(s[2]>.92),1);}g.globalAlpha=1;}
  const sf=(H-5.2)/15.6;if(sf>0&&sf<1&&vis>.2){const sx=r(VW*(.08+.84*sf)),sy=r(hz-10-Math.sin(sf*3.14)*hz*.78),low=Math.min(sf,1-sf),col=low<.1?'#ff8a4a':low<.2?'#ffc56a':'#fff3b0',rad=low<.1?14:11;
    g.globalAlpha=vis;g.drawImage(disc(col,rad+6,1),sx-rad-6,sy-rad-6);g.drawImage(disc(col,rad),sx-rad,sy-rad);g.drawImage(disc('#fffbe0',rad-4),sx-rad+4,sy-rad+4);g.globalAlpha=1;sunX=sx;sunC=col;}
  const mf=((H+24-20.6)%24)/9.4;if(mf>0&&mf<1&&vis>.2){g.globalAlpha=vis;g.drawImage(SPR.moon,r(VW*(.1+.8*mf))-10,r(hz-10-Math.sin(mf*3.14)*hz*.72)-10);g.globalAlpha=1;}
  const WW=VW+520;for(const c of skyClouds){const s=SPR.cl[c.i],x=(((c.x-camX*c.p+T*M.wind*.4*c.p)%WW)+WW)%WW-260;g.drawImage(s.c,r(x),r(hz-c.off-s.h*2),s.w*2,s.h*2);}
  if(M.cloud<.8){g.fillStyle=rgb(e.c[0]);for(let i=0;i<11;i++){const W2=VW+400,x=(((i*173.3-camX*.015+T*M.wind*.03)%W2)+W2)%W2-200,y=r(hz-250-(i*47%150));g.globalAlpha=(.14+.08*(i%3))*(1-M.cloud);for(let k=0;k<5;k++)g.fillRect(r(x+k*13-k*k*2),y+k,62-k*9,1);}g.globalAlpha=1;}
  {const n=2+Math.round(M.cloud*5);g.globalAlpha=.55;for(let i=0;i<n;i++){const s=SPR.cl[[0,1,4][i%3]],W2=VW+600,x=(((i*311.7-camX*.22+T*M.wind*.14)%W2)+W2)%W2-300;g.drawImage(s.c,r(x),r(hz-24-(i*29%40)-s.h*2.4),r(s.w*2.4),r(s.h*2.4));}g.globalAlpha=1;}
  if(flash>.03){const bxs=BOLTX-r(camX);g.globalCompositeOperation='lighter';glow(bxs,r(hz*.3),VW*.42,rgba([196,212,255],flash*.4));for(const c of skyClouds){const s=SPR.cl[c.i],x=(((c.x-camX*c.p+T*M.wind*.4*c.p)%WW)+WW)%WW-260,k=clamp(1-Math.abs(x+s.w-bxs)/(VW*.55),0,1);if(k<=0)continue;g.globalAlpha=Math.min(1,flash*(.2+.8*k));g.drawImage(s.c,r(x),r(hz-c.off-s.h*2),s.w*2,s.h*2);if(k>.55)g.drawImage(s.c,r(x),r(hz-c.off-s.h*2),s.w*2,s.h*2);}g.globalAlpha=1;g.globalCompositeOperation='source-over';}
  const mw=r(Math.max(0,-2500-dc)*1.1);g.drawImage(TINT.mid,r(-460-dc*.38)+mw,hz+3-136);g.drawImage(TINT.near,r(-600-dc*.5)+mw,hz+4-74);
  coastFar(g,hz,dc);if(dc<-200)townFar(g,hz,dc);
  // world
  g.setTransform(1,0,0,1,-cx,-cy);
  seaLayer(0,rgb(e.s[0]),rgb(mix(e.s[0],[255,255,255],.25)));
  if(dc<1700){const o1=r(cam0+dc*.6),o2=r(cam0+dc*.82);
    if(!BW1)baseWest();g.setTransform(1,0,0,1,-o1,-cy);g.drawImage(sunSpr(SPR.L1),-700,-252);g.drawImage(sunSpr(BW1),-890,-252);g.setTransform(1,0,0,1,-o2,-cy);g.drawImage(sunSpr(SPR.L2),-640,-166);g.drawImage(sunSpr(BW2),-790,-166);g.setTransform(1,0,0,1,-cx,-cy);}
  if(cx<420)drawBase();townDraw();
  seaLayer(1,rgb(e.s[1]),rgb(mix(e.s[1],[255,255,255],.22)));
  for(const v of vessels){if(v.gone)continue;const sp=vspr(v);g.save();g.translate(r(v.x),r(v.y));g.rotate(v.ang);
    if(v.brk){const k=v.brk,S2=sunSpr(sp);for(const sd of[-1,1]){g.save();g.translate(v.bo+sd*k*5,k*12);g.rotate(-sd*k*.2);g.translate(-v.bo,0);g.beginPath();if(sd<0)g.rect(-sp.ox-2,-sp.oy-2,sp.ox+v.bo+2,sp.height+4);else g.rect(v.bo,-sp.oy-2,sp.width,sp.height+4);g.clip();g.drawImage(S2,-sp.ox,-sp.oy);g.fillStyle='#14181c';for(let y=-v.top;y<10;y+=3)g.fillRect(v.bo+(sd<0?-1-((y*7)&1):0),y,1+((y*7)&1),2);g.restore();}}
    else g.drawImage(sunSpr(sp),-sp.ox,-sp.oy);if(v.cutter)cutterLife(v);g.restore();}
  for(const p of parts)if(p.k==='smoke'){const t=1-p.life/p.max;g.fillStyle=SMC[t<.05?0:t<.28?1:t<.52?2:t<.78?3:4];g.fillRect(r(p.x),r(p.y),p.r,p.r);}
  drawPuffs(g);
  for(const v of vessels)if(!v.gone&&v.fire&&v.fb)v.fs.forEach((fo,k)=>{const fy=deckY(v,fo),fxp=v.x+fo,f=v.fb[k];if(fy>wave(fxp))return;g.drawImage(f.c,r(fxp-f.W/2),r(fy)+3-f.H);});
  for(const p of parts)if(p.k==='flame'){const t=1-p.life/p.max,rad=Math.max(1,r(p.r*(1-t*.75)));g.drawImage(disc(FLC[Math.min(4,t*5.2|0)],rad),r(p.x)-rad,r(p.y)-rad);}
    else if(p.k==='ember'){g.fillStyle=p.life>.9?'#ffd23a':p.life>.45?'#f9a02c':'#d8341a';g.fillRect(r(p.x),r(p.y),p.r,p.r);}
  if(state!=='menu'){
    for(const p of surv)if(p.state==='wait'||p.state==='ready')xMan(p);
    if(['swim','with','await','fall','free','tojack'].includes(sw.state)){const dk=sw.onV&&!sw.onV.sit,mv=sw.state==='swim'||sw.state==='tojack'||(sw.state==='free'&&sw.target&&Math.abs(sw.target.x-sw.x)>5);man(sw.x,sw.y,swCol(),sw.state==='fall'?4:dk?(mv?2:4):mv?5:1,1,sw.target&&sw.target.x<sw.x?-1:1,sw.state==='fall');}
  }
  if(state!=='menu'){xDrawBack();drawDebris(g);finDrawBack(g);if(CUT.on)cutDrawBack(g);if(EPI.on)epiDrawBack(g);}
  seaLayer(2,rgb(e.s[2]),rgb(mix(e.s[2],[255,255,255],.5)));
  if(state!=='menu')xDrawFront();
  if(state!=='menu')for(const p of surv)if(p.state==='lost'&&p.inW&&p.lostT!=null){const a=T-p.lostT;if(a<0||a>9)continue;const wy=wave(p.x),x=p.x+Math.sin(a*1.3+p.ph)*2,y=wy+2+a*3+a*a*1.1,al=clamp(1-a/8.5,0,1);g.globalAlpha=al*.85;man(x,y,DROWN,3,0);
    if(a<6.5)for(let k=0;k<4;k++){const bb=(a*.9+k*.27)%1;g.globalAlpha=.6*(1-bb)*al;g.fillStyle='#e6f4ff';g.fillRect(r(x+Math.sin(k*3+a*4)*3),r(y-4-bb*(y-wy-2)),1,1);}g.globalAlpha=1;}
  // depth bands, sparkle dashes, sun glitter
  for(let i=1;i<5;i++){g.fillStyle='rgba(0,6,20,.1)';g.fillRect(cx,i*30+10,VW,VH);}
  {const dl=clamp(1-e.d*1.3,0,1),bot=cy+VH;if(dl>.05){const calm=clamp(1.7-M.sea,0,1)*dl*(M.rain?.4:1);
    const xa=Math.max(cx,150),xb=Math.min(cx+VW,1300);for(let x=xa-(((xa%4)+4)%4);x<xb;x+=4){const k=clamp((x-150)/150,0,1)*(1-clamp((x-300)/1000,0,1)),wy=r(wave(x))+2;g.fillStyle=`rgba(96,206,196,${(.26*k*k*dl).toFixed(3)})`;g.fillRect(x,wy,4,bot-wy);}
    if(calm>.05){
      for(let k=Math.floor((cx-200)/620);k<=Math.floor((cx+VW+200)/620);k++){const hs=Math.abs(Math.sin(k*12.9898)*43758.5)%1,sxx=k*620+hs*300+Math.sin(T*.13+k*2.3)*170,sy=22+hs*34+Math.sin(T*.31+k)*7,vd=Math.cos(T*.13+k*2.3)>0?1:-1;if(sxx<430)continue;const n=10+(hs*9|0);
        for(let j=0;j<n;j++){const fx=sxx+((j*53)%64-32)+Math.sin(T*1.7+j*1.3+k)*5,fy=sy+((j*29)%18-9)+Math.cos(T*1.3+j*2.1)*2;if(fy<wave(fx)+7)continue;const gl=Math.sin(T*2.6+j*1.7+k*3)>.9;
          g.fillStyle=gl?`rgba(226,244,255,${(.8*calm).toFixed(2)})`:`rgba(14,34,52,${(.5*calm).toFixed(2)})`;g.fillRect(r(fx),r(fy),3,1);g.fillRect(r(fx)+(vd>0?-1:3),r(fy)+(Math.sin(T*9+j)>0?-1:1),1,1);}}}}}
  g.fillStyle=`rgba(255,255,255,${.75-e.d*.6})`;const t0=Math.floor(cx/700)*700;
  for(let i=0;i<54;i++){if(Math.sin(T*2.2+i*1.7)<.15)continue;let x=t0+(i*137.5%700);if(x<cx)x+=700;if(x>cx+VW)continue;g.fillRect(r(x),r(wave(x)*.5)+8+(i*53%130),2+(i%3)*2,1);}
  if(sunX<0&&ENV.d>.4){const mq=((H+24-20.6)%24)/9.4;if(mq>0&&mq<1&&M.cloud<.7){const mx=r(VW*(.1+.8*mq));for(let i=0;i<34;i++)if(Math.sin(T*2.4+i*2.3)>-.3){const dp=i*3.6,x=cx+mx+r(((i*37%100)/100-.5)*(14+dp*.3)*2);g.fillStyle=i%4?'#aebfd6':'#eef3fb';g.fillRect(x-2,r(wave(x)*.6)+4+r(dp),4+(i%3)*3,1);}}}
  if(sunX>=0){for(let i=0;i<46;i++)if(Math.sin(T*3+i*2.3)>-.55){const dp=i*3.2,sp=10+dp*.32,x=cx+sunX+r(((i*37%100)/100-.5)*sp*2);g.fillStyle=i%4?sunC:'#fffbe0';g.fillRect(x-2,r(wave(x)*.6)+4+r(dp),4+(i%3)*3+(dp<40?4:0),1+(i%5===0));}}
  // rotor wash on the sea
  if(h&&!h.dead&&overSea(h.x)&&state!=='menu'){const sy=wave(h.x),a=sy-(h.y+h.spec.belly);if(a<200){const st=1-a/200,RR=h.spec.rotR*2.6;
    for(let k=0;k<5;k++){const rr=((T*90+k*RR/5)%RR),al=(1-rr/RR)*st;g.fillStyle=`rgba(255,255,255,${al})`;
      for(const s of[-1,1]){const x=r(h.x+s*(rr+8));g.fillRect(x-3,r(wave(x)),7,1);g.fillRect(x-1,r(wave(x))+2+k%2,4,1);}}
    g.fillStyle=`rgba(255,255,255,${.25*st})`;for(let x=-36;x<36;x+=4)if((x+(T*20|0))&4)g.fillRect(r(h.x+x),r(wave(h.x+x))+1,2,1);}}
  {const sa=Math.max((1-e.d*.9)*(1-M.cloud*.45),Math.min(1,flash*1.7)),shk=flash>.1?(h&&h.x<BOLTX?-1:1)*.5*Math.min(1,flash*1.5):SUN.dir*SUN.gf*.9;if(sa>.08){
    for(const v of vessels){if(v.gone)continue;g.fillStyle=`rgba(0,8,26,${.26*sa})`;for(let x=Math.max(cx,r(v.x-v.half));x<Math.min(cx+VW,v.x+v.half);x+=4)g.fillRect(x,r(wave(x))+1,4,3);}
    if(Math.abs(shk)>.04)for(const v of vessels){if(v.gone)continue;const k=flash>.1?(v.x<BOLTX?-1:1)*Math.abs(shk):shk,Ln=Math.min(280,(v.top||20)*Math.abs(k)*1.7+v.half*.25*Math.abs(k)),sg=k>0?1:-1;for(let j=0;j<Ln;j+=4){const x=r(v.x+sg*(v.half+j));if(x<cx-4||x>cx+VW)continue;g.fillStyle=`rgba(0,8,26,${(.24*sa*(1-j/Ln)).toFixed(3)})`;g.fillRect(x,r(wave(x))+1,4,2);}}
    if(h&&!h.dead&&state!=='menu'){const alt=surfAt(h.x)-(h.y+h.spec.belly),a=clamp(.4-alt/800,.08,.4)*sa,w=r((1+Math.abs(shk)*.8)*h.spec.half*1.5*clamp(1-alt/800,.45,1)),x0=r(h.x+clamp(alt*shk,-240,240));let py=null;
      for(let i=-w;i<w;i++){const xx=x0+i,sy=r(surfAt(xx)),ed=Math.min(i+w,w-1-i),th=ed<2?1:ed<5?2:3,v=vesselAt(xx),on=sy<r(Math.min(groundY(xx),wave(xx)))-1;
        g.fillStyle=`rgba(0,8,24,${on?a*1.25:a})`;g.fillRect(xx,on?sy:sy+(th<3?1:0),1,on?Math.min(th,2):th+1);
        if(py!==null&&Math.abs(sy-py)>2){const top=Math.min(sy,py)+2,n=Math.min(Math.abs(sy-py)-2,60);g.fillStyle=`rgba(0,8,24,${a*.55})`;g.fillRect(sy<py?xx:xx-1,top,1,n);}
        py=sy;}}}}
  for(const p of parts)if(p.k==='spray'){g.fillStyle=`rgba(255,255,255,${p.life/p.max*.9})`;g.fillRect(r(p.x),r(p.y),p.r,p.r);}else if(p.k==='mist'){const rad=r(p.r);g.drawImage(disc(p.life>.5?'#eef5f9':'#cfdfe8',rad,1),r(p.x)-rad,r(p.y)-rad);}
  if(h&&state!=='menu'){
    if(!h.dead){
      const hxp=r(hook.x),hyp=r(hook.y),ld=hook.load&&hook.load!==sw,swh=hook.load===sw||sw.state==='hook';
      if(hook.L>2||sw.state==='hook'){g.fillStyle='#d8dcdc';const x0=r(h.x+h.yaw*h.spec.doorMid),y0=r(h.y-6),y1=hyp-(ld?14:swh?15:5),n=Math.max(1,y1-y0),bw=clamp(hook.bw||0,-n*.22,n*.22);for(let i=0;i<n;i++){const q=i/n;g.fillRect(r(lerp(x0,hxp,q)+bw*4*q*(1-q)),y0+i,1,1);}
        if(ld){man(hxp,hyp-1,hook.load.C||svC(hook.load),1,2);g.fillStyle='#c9ccc9';g.fillRect(hxp-7,hyp-9,1,9);g.fillRect(hxp+6,hyp-9,1,9);g.fillRect(hxp-7,hyp-1,14,1);g.fillRect(hxp-7,hyp-9,14,1);g.fillRect(hxp-7,hyp-5,14,1);
          g.fillRect(hxp-4,hyp-13,1,4);g.fillRect(hxp+3,hyp-13,1,4);g.fillRect(hxp-3,hyp-14,6,1);g.fillStyle=O;g.fillRect(hxp-8,hyp-10,3,2);g.fillRect(hxp+5,hyp-10,3,2);}
        else if(swh){if(hook.L>8)man(hxp,hyp,swCol(),4,1,1,1);}
        else{g.fillStyle=Y;g.fillRect(hxp-1,hyp-5,3,1);g.fillRect(hxp+1,hyp-5,1,4);g.fillRect(hxp-2,hyp-2,4,1);g.fillRect(hxp-2,hyp-3,1,1);}}
      if((ld||swh)&&hook.L>4){const wl=wave(hook.x);if(hook.y>wl-12)hook.wet=T;const wk=clamp(1-(T-(hook.wet==null?-99:hook.wet))/9,0,1);if(wk>0&&T>=(hook.wet||0)){const n=Math.ceil(9*wk);for(let i=0;i<n;i++){const ph=(T*1.5+i*.37)%1,x=hxp+((i*5)%11-5),y=hyp-2+ph*ph*52,sy=r(wave(x));if(y<sy){g.fillStyle=`rgba(214,234,248,${(.85*(1-ph*.6)*Math.min(1,wk*2)).toFixed(2)})`;g.fillRect(x,r(y),1,2+(ph>.5));}else if(y<sy+6){g.fillStyle='rgba(255,255,255,.7)';g.fillRect(x-1,sy,3,1);}}}}
      finDrawFront(g);if(EPI.on)epiDrawFront(g);
      drawHeliLit(h);
    }
    for(const f of flares){if(!f.tr||T<f.tt){f.tr=[];f.tt=-9;}if(T-f.tt>.06){f.tt=T;f.tr.push([f.x,f.y-3,T]);if(f.tr.length>48)f.tr.shift();}
      for(const q of f.tr){const a=T-q[2];if(a>2.9||a<.05)continue;const k=1-a/2.9,sz=1+r(a*1.7);g.fillStyle=`rgba(${200+55*k|0},${150-50*k|0},${150-70*k|0},${(.36*k).toFixed(3)})`;g.fillRect(r(q[0]+M.wind*.22*a+Math.sin(q[2]*9+a*2)*2)-(sz>>1),r(q[1]-a*5)-(sz>>1),sz,sz);}}
    for(const f of flares){const x=r(f.x),y=r(f.y);g.fillStyle='rgba(255,255,255,.7)';g.fillRect(x-4,y-10,9,1);g.fillRect(x-5,y-9,1,2);g.fillRect(x+5,y-9,1,2);g.fillRect(x-3,y-6,1,3);g.fillRect(x+3,y-6,1,3);g.fillStyle='#fff';g.fillRect(x-1,y-1,3,3);}
  }
  for(const b of birds){const x=r(b.x),y=r(b.y),f=Math.sin(b.ph)>0;g.fillStyle=e.d>.5?'#8792a0':'#ffffff';g.fillRect(x-1,y,3,1);g.fillStyle=e.d>.5?'#6b7480':'#dfe5ea';
    if(f){g.fillRect(x-4,y-1,3,1);g.fillRect(x+2,y-1,3,1);g.fillRect(x-6,y-2,2,1);g.fillRect(x+5,y-2,2,1);}else{g.fillRect(x-4,y,3,1);g.fillRect(x+2,y,3,1);g.fillRect(x-6,y+1,2,1);g.fillRect(x+5,y+1,2,1);}}
  if(CUT.on)cutDrawSky(g);
  if(M.rain){g.fillStyle='rgba(205,222,238,.5)';const sl=M.wind*.02;for(let i=0;i<170;i++){const x=cx+r(((((i*97.3+T*sl*200)%(VW+80))+VW+80)%(VW+80))-40),y=cy+r((i*53.7+T*620+i*i)%VH);g.fillRect(x,y,1,3);g.fillRect(x-Math.sign(sl),y+3,1,3);}}
  if(M.snow){g.fillStyle='rgba(255,255,255,.85)';for(let i=0;i<150;i++){const x=cx+r((((i*71.3+T*(M.wind*.5+Math.sin(i)*14))%VW)+VW)%VW),y=cy+r((i*37.7+T*(34+i%5*8))%VH);g.fillRect(x,y,1+(i%7===0),1+(i%7===0));}}
  if(gust){const e=Math.sin(gust.t/gust.d*3.14),sg=gust.fx<0?-1:1;g.fillStyle=`rgba(255,255,255,${.55*e})`;for(let i=0;i<46;i++){const x=cx+((((i*91.7+T*900*sg)%(VW+60))+VW+60)%(VW+60))-30,y=cy+r((i*47.3+Math.sin(i)*20+T*gust.fy*.2)%VH+VH)%VH;g.fillRect(r(x),y,8+(i%4)*5,1);}}
  if(bolt){g.fillStyle='#fff';const p=bolt.p;for(let i=0;i<p.length-2;i+=2){const n=p[i+3]-p[i+1];for(let k=0;k<n;k++)g.fillRect(r(lerp(p[i],p[i+2],k/n)),r(p[i+1]+k),2,1);}}
  // fog, then darkness, each with holes for light
  const lit=state!=='menu'&&h&&!h.dead;
  const fa=state!=='menu'?xFog():M.fog?.8:0;if(fa>.02)overlay(`rgba(${190-e.d*150|0},${200-e.d*150|0},${208-e.d*150|0},${fa})`,()=>{if(lit)hole(h.x,h.y+30,230,.95);else hole(cx+VW/2,cy+VH*.6,280,.9);hole(-150,-80,260,.8);for(const f of flares)hole(f.x,f.y,170,.8);});
  const mfN=((H+24-20.6)%24)/9.4,moon=mfN>0&&mfN<1?Math.sin(mfN*3.14)*(1-M.cloud*.9):0;
  const da=clamp(e.d+(M.storm?.06:0)+(e.d>.5?.13-moon*.2:0)-flash*.5,0,.9);
  const LB=T*1.1%1<.22,lsp=T%1.3,LS=lsp<.06||(lsp>.15&&lsp<.21),lp=q=>[r(h.x+(h.yaw<0?-1:1)*q[0]*Math.abs(h.yaw)),r(h.y+q[1])];
  for(const v of vessels)if(v.lx==null){let b=v.prof[0];for(const q of v.prof)if(q[2]>b[2])b=q;v.lx=(b[0]+b[1])/2;}
  if(da>.05){
    overlay(`rgba(${4+moon*8|0},${9+moon*13|0},${22+moon*22|0},${da})`,()=>{
      // station floodlights and a dim spill around the buildings; working lights on ships; fires, flares
      for(const x of[-140,62])hole(x,-82,150,.85);hole(-40,-60,260,.5);hole(-420,-110,300,.6);townHoles();
      if(lit&&h.spot&&!h.landed){const b=beamPts(),ex=(b[2]+b[4])/2,ey=(b[3]+b[5])/2,tt=(wave(h.x)-b[1])/(ey-b[1]);if(tt>0&&tt<=1){const px=b[0]+(ex-b[0])*tt;hole(px,wave(px)-4,46+96*tt,.8*(1.15-tt*.6));}}
      for(const v of vessels){if(v.gone)continue;
        if(v.fire)for(const fo of v.fs)hole(v.x+fo,deckY(v,fo)-20,130+v.fire*120+Math.sin(T*17+fo)*10,.9);
        else if(v.half>40)hole(v.x+v.lx,v.y-v.top*.6,60+v.half*.2,v.cutter?.8:.5);}
      for(const o of X.oil)if(o.lit)hole(o.x,wave(o.x)-10,o.w0+40,.8);
      for(const f of flares)hole(f.x,f.y,360*Math.min(1,f.life/3),.8);
      if(lit){if(h.lights){hole(h.x,h.y,46,.35);if(LB)hole(h.x,h.y,84,.3);if(LS)hole(h.x,h.y,160,.6);}
        if(h.door>.5){const dx=h.x+h.yaw*h.spec.doorMid,dy=h.y+h.spec.belly,gr=fx.createLinearGradient(dx,dy,dx,dy+230);gr.addColorStop(0,'rgba(0,0,0,.8)');gr.addColorStop(1,'rgba(0,0,0,0)');fx.fillStyle=gr;fx.beginPath();fx.moveTo(dx-4,dy);fx.lineTo(dx-62,dy+230);fx.lineTo(dx+62,dy+230);fx.lineTo(dx+4,dy);if(!h.landed)fx.fill();hole(dx,dy-6,26,.7);if(h.landed)hole(dx,dy-2,78,.9);}
        if(h.spot){const b=beamPts(),gr=fx.createLinearGradient(b[0],b[1],(b[2]+b[4])/2,(b[3]+b[5])/2);gr.addColorStop(0,'rgba(0,0,0,1)');gr.addColorStop(.75,'rgba(0,0,0,.85)');gr.addColorStop(1,'rgba(0,0,0,0)');
          fx.fillStyle=gr;fx.beginPath();fx.moveTo(b[0],b[1]);fx.lineTo(b[2],b[3]);fx.lineTo(b[4],b[5]);fx.fill();}}
      if(state!=='menu'&&['swim','with','await','free'].includes(sw.state))hole(sw.x,sw.y-6,24,.8);
      if(CUT.on){for(const m of CUT.men)hole(m.x,m.y-6,30,.85);}if(FIN.on){const B=FIN.bn;if(FIN.st==='deck'){hole(FIN.jk.x+5,FIN.jk.y-8,52,.95);hole(B.x,B.y-8,30,.9);}else hole(hook.x+4,hook.y+16,64,.95);if(B.st==='fall'||B.st==='sink')hole(B.x,B.y-8,36,.9);}else if(M.camp===8&&state==='play'&&!FIN.done&&surv[0]&&surv[0].state==='jake')hole(surv[0].x,surv[0].y-8,30,.85);if(EPI.on){if(EPI.j)hole(EPI.j.x,EPI.j.y-6,34,.85);if(EPI.s)hole(EPI.s.x,EPI.s.y-6,30,.8);}
    });
  }
  if(CUT.on&&CUT.pl){const q=CUT.pl,x=r(q.x),y=r(q.y),on=T*1.6%1<.12;g.globalAlpha=.2;g.drawImage(SPR.c130,x,y,118,48);g.globalAlpha=1;g.fillStyle='#ff3b3b';g.fillRect(x+7,y+7,2,2);g.fillStyle='#3cff7a';g.fillRect(x+109,y+29,2,2);g.globalCompositeOperation='lighter';
    glow(x+8,y+8,9,'rgba(255,50,50,.95)');glow(x+110,y+30,9,'rgba(60,255,122,.95)');if(on){glow(x+58,y+18,26,'rgba(255,255,255,.95)');glow(x+58,y+18,7,'rgba(255,255,255,1)');}g.globalCompositeOperation='source-over';}
  g.globalCompositeOperation='lighter';
  if(da>.1&&dc<1700&&dc>-1900){const o1=r(cam0+dc*.6),o2=r(cam0+dc*.82);g.setTransform(1,0,0,1,-o1,-cy);if(T*.7%1<.4)glow(-789,-93,9,`rgba(255,50,40,${Math.min(1,da*1.3).toFixed(3)})`);g.setTransform(1,0,0,1,-o2,-cy);glow(-649,-92,30,`rgba(255,206,130,${(.5*da).toFixed(3)})`);g.setTransform(1,0,0,1,-cx,-cy);}
  for(const v of vessels)if(v.cutter&&!v.gone)cutterGlow(v,da);townGlow(da,hz,dc);
  {const au=M.aur?clamp((e.d-.45)*5,0,1)*clamp(1-M.cloud*6,0,1)*clamp(1.6-M.sea,0,1)*(fa>.02?0:1):0;if(au>.02)auroraDraw(g,hz,dc,cam0,au);}
  if(da>.05){for(const x of[-140,62])glow(x,-113,74,'rgba(255,196,120,.5)');
    for(const v of vessels)if(!v.gone&&!v.fire&&v.half>40){const lx=r(v.x+v.lx),ly=r(v.y-v.top);g.fillStyle='#fff';g.fillRect(lx,ly-6,2,2);glow(lx+1,ly-5,9,'rgba(255,255,255,.7)');glow(lx,r(v.y-v.top*.6),30+v.half*.1,'rgba(255,214,150,.2)');
      g.fillStyle='#ff3b3b';g.fillRect(r(v.x-v.half*.5),r(v.y-v.top*.5),2,2);g.fillStyle='#3cff7a';g.fillRect(r(v.x+v.half*.5),r(v.y-v.top*.5),2,2);}}
  // firelight and flares shimmer on the water
  for(const v of vessels)if(!v.gone&&v.fire)for(const fo of v.fs)for(let i=0;i<11;i++)if(Math.sin(T*5+i*2.1+fo)>-.3){const x=r(v.x+fo+((i*37%40)-20)*(1+i*.12));g.fillStyle=`rgba(255,${130+i*7},40,${(.5-i*.04)*(.4+da)})`;g.fillRect(x-3,r(wave(x))+3+i*5,6+(i%3)*3,1);}
  for(const f of flares)for(let i=0;i<8;i++)if(Math.sin(T*6+i*1.9)>-.2){const x=r(f.x+((i*29%30)-15)*(1+i*.15));g.fillStyle=`rgba(255,70,50,${(.45-i*.05)*(.3+da)})`;g.fillRect(x-2,r(wave(x))+3+i*6,5+(i%3)*3,1);}
  if(lit&&h.lights){const L=h.spec.lt,n=lp(L.nav);glow(n[0],n[1],7,h.yaw>0?'rgba(60,255,122,.8)':'rgba(255,59,59,.8)');
    if(LB)for(const b of L.bc){const q=lp(b);glow(q[0],q[1],17,'rgba(255,40,40,.9)');}
    if(LS){const q=lp(L.st);glow(q[0],q[1],54,'rgba(255,255,255,.7)');glow(q[0],q[1],12,'rgba(255,255,255,1)');}}
  if(lit&&h.door>.5&&da>.1){const dx=r(h.x+h.yaw*h.spec.doorMid),dy=r(h.y+h.spec.belly),gr=g.createLinearGradient(dx,dy,dx,dy+220);gr.addColorStop(0,`rgba(255,244,214,${da*.3})`);gr.addColorStop(1,'rgba(255,244,214,0)');g.fillStyle=gr;g.beginPath();g.moveTo(dx-4,dy);g.lineTo(dx-60,dy+220);g.lineTo(dx+60,dy+220);g.lineTo(dx+4,dy);if(!h.landed)g.fill();glow(dx,dy-8,14,'rgba(255,220,160,.5)');if(h.landed){glow(dx,dy-4,58,`rgba(255,232,180,${.25+da*.45})`);g.fillStyle=`rgba(255,236,190,${.1+da*.2})`;g.fillRect(dx-40,dy+h.gear*h.spec.gear,80,2);g.fillRect(dx-26,dy+h.gear*h.spec.gear+2,52,1);}}
  if(lit&&h.spot){const b=beamPts(),mx=(b[2]+b[4])/2,my=(b[3]+b[5])/2,hwx=(b[4]-b[2])/2,hwy=(b[5]-b[3])/2,hazy=Math.min(1,fa*1.2+(M.rain?.45:0)+(M.snow?.4:0)),gr=g.createLinearGradient(b[0],b[1],mx,my);gr.addColorStop(0,`rgba(255,248,210,${(.16+da*.25+hazy*.2).toFixed(3)})`);gr.addColorStop(1,'rgba(255,248,210,0)');
    g.fillStyle=gr;g.beginPath();g.moveTo(b[0],b[1]);g.lineTo(b[2],b[3]);g.lineTo(b[4],b[5]);g.fill();
    if(hazy>.05){const g2=g.createLinearGradient(b[0],b[1],mx,my);g2.addColorStop(0,`rgba(255,250,224,${(hazy*.3).toFixed(3)})`);g2.addColorStop(.8,'rgba(255,250,224,0)');g.fillStyle=g2;g.beginPath();g.moveTo(b[0],b[1]);g.lineTo(mx-hwx*.4,my-hwy*.4);g.lineTo(mx+hwx*.4,my+hwy*.4);g.fill();
      const n=M.rain?84:M.snow?54:26,sl=M.wind*.02;for(let i=0;i<n;i++){const t=.05+((i*.6180339)%1)*.9,u=((i*.3819+i*i*.0713)%1)*2-1,px=b[0]+(mx-b[0])*t+hwx*u*t,py=b[1]+(my-b[1])*t+hwy*u*t,a=(1-t*.85)*(.5+da*.45);let x,y,w=1,hh=1;
        if(M.rain){const f=((T*520+i*47)%34)-17;x=px+f*sl;y=py+f;hh=4;}else if(M.snow){x=px+Math.sin(T*2+i)*4;y=py+((T*38+i*13)%22)-11;w=hh=1+(i%5===0);}else{x=px+Math.sin(T*.7+i*1.3)*6;y=py+Math.cos(T*.5+i)*4;w=2+(i%3);}
        if(y>wave(x)-1)continue;g.fillStyle=`rgba(255,252,232,${(a*(M.rain||M.snow?1:.35)).toFixed(3)})`;g.fillRect(r(x),r(y),w,hh);}}}
  for(const v of vessels)if(!v.gone&&v.fire)for(const fo of v.fs){const fl=flick(fo),x=r(v.x+fo),y=r(deckY(v,fo));glow(x,y-14,(70+v.fire*50)*(.88+.24*fl),`rgba(255,120,30,${((.12+da*.3)*(.65+.7*fl)).toFixed(3)})`);glow(x,y-4,(46+v.fire*30)*(.8+.4*fl),`rgba(255,176,80,${((.1+da*.22)*fl).toFixed(3)})`);}
  for(const f of flares){const fl=flick(f.x*.01),k=Math.min(1,f.life/3);glow(r(f.x),r(f.y),46*(.85+.3*fl),'rgba(255,90,60,.8)');glow(r(f.x),r(f.y),150*k,`rgba(255,60,40,${((.08+da*.16)*(.7+.3*fl)*k).toFixed(3)})`);}
  if(da>.25&&state!=='menu')for(const p of surv)if((p.state==='wait'||p.state==='ready')&&Math.sin(T*7+p.ph)>.55){const up=!p.v||p.v.sit?8:16;g.fillStyle='#fff';g.fillRect(r(p.x)-1,r(p.y)-up,2,2);glow(r(p.x),r(p.y)-up+1,7,'rgba(255,255,255,.7)');}
  if(da>.05){for(let x=-120;x<=44;x+=27)glow(x,-43,8,'rgba(246,198,47,.6)');
    if(base.amb&&base.amb!=='away'){const ax=base.ambX+r(base.ax)+30,on=Math.sin(T*10)>0;glow(ax-10,-68,18,on?'rgba(255,40,40,.8)':'rgba(60,110,255,.8)');}}
  if(lit&&h.spot&&!h.landed){const b=beamPts(),ex=(b[2]+b[4])/2,ey=(b[3]+b[5])/2,wy0=wave(h.x),tt=(wy0-b[1])/(ey-b[1]);
    if(tt>0&&tt<=1){const px=b[0]+(ex-b[0])*tt,py=wave(px),k=(1.2-tt)*(.55+da*.9),rw=26+70*tt;g.save();g.translate(r(px),r(py)+2);g.scale(1,.3);glow(0,0,rw*1.9,`rgba(255,246,206,${(.16*k).toFixed(3)})`);glow(0,0,rw,`rgba(255,248,214,${Math.min(1,.42*k).toFixed(3)})`);glow(0,0,rw*.42,`rgba(255,255,240,${Math.min(1,.6*k).toFixed(3)})`);g.restore();
      for(let i=0;i<18;i++){const ph=T*3.4+i*2.4;if(Math.sin(ph)<.1)continue;const ox=((i*37%100)/50-1)*rw*.9,x=r(px+ox),y=r(wave(x))+1+((i*13)%7)*(1+(rw>50));g.fillStyle=`rgba(255,255,236,${clamp((.35+.5*Math.sin(ph))*k*(1-Math.abs(ox)/(rw*1.1)),0,1).toFixed(3)})`;g.fillRect(x-2,y,4+(i%3)*2,1);}}}
  if(flash>0){g.fillStyle=`rgba(220,230,255,${flash*.35})`;g.fillRect(cx,cy,VW,VH);}
  g.globalCompositeOperation='source-over';
  reflect(da);
  hud();
}
// mirror image of everything above the waterline, column by column, rippled and broken up like real water
const RFA=document.createElement('canvas'),RFB=document.createElement('canvas'),RFD=104;let RFG=null;
function reflect(da){const g=ctx,W=VW,D=RFD,SW=3,n=Math.ceil(W/SW);if(RFA.width!==W||RFA.height!==D){RFA.width=RFB.width=W;RFA.height=RFB.height=D;RFG=null;}
  const A=RFA.getContext('2d'),B=RFB.getContext('2d'),ys=reflect.ys||(reflect.ys=[]);A.imageSmoothingEnabled=B.imageSmoothingEnabled=false;
  A.setTransform(1,0,0,1,0,0);A.clearRect(0,0,W,D);let any=false;
  for(let k=0;k<n;k++){const sx=k*SW,wy=r(wave(cx+sx+1))-cy;ys[k]=wy;if(wy<4||wy>=VH)continue;const hg=Math.min(D,wy);any=true;A.setTransform(1,0,0,-1,0,hg);A.drawImage(cv,sx,wy-hg,SW,hg,sx,0,SW,hg);}
  if(!any)return;
  const sea=typeof M!=='undefined'?M.sea||0:0,amp=.7+sea*.45;B.setTransform(1,0,0,1,0,0);B.globalCompositeOperation='source-over';B.clearRect(0,0,W,D);
  for(let d=0;d<D;d++){const sh=Math.round(Math.sin(d*.55-T*4.2)*(amp+d*.045)+Math.sin(d*.19+T*1.7)*d*.02);B.drawImage(RFA,0,d,W,1,sh,d,W,1);}
  B.globalCompositeOperation='destination-out';B.fillStyle='rgba(0,0,0,.75)';
  for(let i=0;i<90;i++){const y=(i*37+((T*(3+i%4))|0))%D,w=5+(i%5)*5+y*.12,x=(((i*113.7+cx*-1+T*(6+i%7)*(i%2?1:-1))%W)+W)%W;B.fillRect(x|0,y,w|0,1+(y>50&&i%3===0));}
  const mn=state==='menu';if(!RFG||RFG.m!==mn){RFG=B.createLinearGradient(0,0,0,D);RFG.addColorStop(0,'rgba(0,0,0,0)');RFG.addColorStop(mn?.62:.5,mn?'rgba(0,0,0,.22)':'rgba(0,0,0,.55)');RFG.addColorStop(1,'rgba(0,0,0,1)');RFG.m=mn;}
  B.fillStyle=RFG;B.fillRect(0,0,W,D);B.globalCompositeOperation='source-over';
  const cl=1-sea*.11,a1=((mn?.66:.42)-da*.2)*cl,a2=da>.12?Math.min(.75,da*.95)*cl:0;g.setTransform(1,0,0,1,0,0);
  g.globalAlpha=a1;for(let k=0;k<n;k++){const wy=ys[k];if(wy>=4&&wy<VH)g.drawImage(RFB,k*SW,0,SW,D,k*SW,wy+1,SW,D);}
  if(a2){g.globalCompositeOperation='lighter';g.globalAlpha=a2;for(let k=0;k<n;k++){const wy=ys[k];if(wy>=4&&wy<VH)g.drawImage(RFB,k*SW,0,SW,D,k*SW,wy+1,SW,D);}g.globalCompositeOperation='source-over';}
  g.globalAlpha=1;g.setTransform(1,0,0,1,-cx,-cy);}
// ---------- west of the station: the apron ends and rock tumbles into the sea; across the water, on a second plane, lies the fishing town of Kodiak ----------
const TWX0=WXS-14,TWW=-720-TWX0,TWH=130,TWOY=64;let TOWN=null,TPN=null,TPF=null;
function townBuild(){const c=document.createElement('canvas');c.width=TWW;c.height=TWH;c.ox=-TWX0;c.oy=TWOY;const g=c.getContext('2d');let sd=77;const rn=()=>(sd=(sd*16807)%2147483647)/2147483647;
  const R=(col,x,y,w,h)=>{g.fillStyle=col;g.fillRect(Math.round(x-TWX0),Math.round(y+TWOY),Math.max(1,Math.round(w)),Math.max(1,Math.round(h)));},P=(col,q)=>{g.fillStyle=col;g.beginPath();for(let i=0;i<q.length;i+=2)g.lineTo(Math.round(q[i]-TWX0),Math.round(q[i+1]+TWOY));g.fill();};
  P('#454c4d',[WX,-40,-720,-40,-720,66,WXS-10,66,WXS,6]);P('#353c3d',[WX+14,-22,-720,-22,-720,66,WXS-10,66,WXS,10]);R('#dfe7e6',WX+8,-41,-728-WX,1);R('#8a9296',WX+8,-40,-728-WX,2);
  const rock=(x,y,rw,rh,col)=>{for(let k=0;k<rh;k++){const w=rw*Math.sqrt(1-Math.pow(k/rh,2))*(.85+.15*Math.sin(k*2+x));R(col,x-w,y-k,w*2,1);}R('rgba(232,240,244,.22)',x-rw*.5,y-rh+1,rw*.8,1);R('rgba(0,0,0,.3)',x-rw,y+1,rw*2,1);};
  for(let i=0;i<170;i++){const x=WXS-4+rn()*(-722-WXS),top=x<WX?6-46*(x-WXS)/120:-40,y=top+2+rn()*(x<WX?12:46);rock(x,y,2+rn()*7,1.5+rn()*4.5,['#5f686c','#4d5658','#727b80','#404849','#80888c'][i%5]);}
  for(let i=0;i<9;i++){const x=WXS-8+rn()*46;rock(x,8+rn()*3,4+rn()*6,4+rn()*5,i%2?'#4d5658':'#5f686c');}
  for(let i=0;i<5;i++){const x=WX+10+i*9;R('#9aa3a6',x,-52,1,11);}R('#9aa3a6',WX+10,-52,38,1);R('rgba(154,163,166,.35)',WX+10,-51,38,9);R(Y,WX+22,-58,9,6);R(K,WX+24,-56,5,2);
  return c;}
const mini=(x,y,C,mode,ph,d=1,k=.62)=>{const g=ctx;g.save();g.translate(r(x),r(y));g.scale(k,k);man(0,0,C,mode,ph,d);g.restore();};
function planeNear(){const W=780,H=200,wl=H-6,q=wl-12,mk2=()=>{const c=document.createElement('canvas');c.width=W;c.height=H;return c;},cb=mk2(),cf=mk2(),o={cb,cf,W,H,f:.8,wl,q,win:[],lamp:[],smoke:[],sign:[]};let g=cb.getContext('2d'),sd=53;const rn=()=>(sd=(sd*16807)%2147483647)/2147483647;
  const R=(col,x,y,w,h)=>{g.fillStyle=col;g.fillRect(Math.round(x),Math.round(y),Math.max(1,Math.round(w)),Math.max(1,Math.round(h)));},P=(col,a)=>{g.fillStyle=col;g.beginPath();for(let i=0;i<a.length;i+=2)g.lineTo(Math.round(a[i]),Math.round(a[i+1]));g.fill();};
  const spruce=(x,y,h,col)=>{R('#2a211c',x,y-2,1,2);const n=Math.max(3,Math.round(h/4));for(let k=0;k<n;k++){const w=1.5+k*((h*.4)/n),yy=y-h+k*(h/n);P(col,[x+.5,yy-1,x+.5+w,yy+h/n+1,x+.5-w,yy+h/n+1]);}};
  const leafy=(x,y,rr,col)=>{R('#3a2c22',x,y-rr,1,rr);for(let k=-rr;k<=rr;k++){const w=Math.sqrt(rr*rr-k*k);R(col,x-w,y-rr*1.7+k,w*2+1,1);}};
  const rock=(x,y,rw,rh,col)=>{for(let k=0;k<rh;k++){const w=rw*Math.sqrt(1-Math.pow(k/rh,2));R(col,x-w,y-k,w*2,1);}R('rgba(232,240,244,.2)',x-rw*.5,y-rh+1,rw*.8,1);};
  // the rise the town climbs: low, wooded, with a lane across it
  const top=x=>q-2-40*Math.pow(Math.max(0,Math.sin(clamp((x-30)/(W-60),0,1)*3.1416)),.95)-6*Math.sin(x*.021+2)-3*Math.sin(x*.063);
  for(let x=58;x<W-58;x++){const t=top(x);if(t>=q)continue;R('#3f5c46',x,t,1,q-t);R('#375240',x,t+12+3*Math.sin(x*.05),1,q-t);}
  for(let i=0;i<120;i++){const x=6+rn()*(W-12),t=top(x);if(t>q-10)continue;spruce(x,t+3+rn()*6,10+rn()*13,['#1c3a30','#214438','#18342b'][i%3]);}
  const HC=[['#9a3a30','#3d6348','#ded8c6'],['#dcd8cc','#5a6068','#8f989f'],['#42799c','#7d838c','#e6e8e6'],['#c9982f','#54463a','#efe6d0'],['#58806a','#363e44','#ded8c6'],['#80634e','#3a3735','#d8cebc'],['#b9644a','#444c52','#e8e0d0'],['#7186a0','#3b444c','#e6e8e6'],['#aea697','#73382f','#ece8de'],['#4a6888','#2c353c','#ded8c6'],['#8a8f6a','#3a3f38','#e6e2d0']];
  const house=(x,by,w,h,pal,a={})=>{const[wall,roof,trim]=pal,rh=a.rh||Math.round(w*(a.g?.34:.2))+3;R('rgba(0,0,0,.24)',x-1,by,w+3,1);
    if(a.st)for(let k=x+2;k<x+w;k+=7){R('#3f342a',k,by,2,a.st);R('#2c241d',k+1,by,1,a.st);}
    R(wall,x,by-h,w,h);for(let y=by-h+2;y<by;y+=2)R('rgba(0,0,0,.07)',x,y,w,1);R('rgba(0,0,0,.16)',x+w-3,by-h,3,h);R('rgba(255,255,255,.06)',x,by-h,2,h);
    if(a.g){P(wall,[x,by-h,x+w/2,by-h-rh+2,x+w,by-h]);P(roof,[x-3,by-h+1,x+w/2,by-h-rh,x+w+3,by-h+1,x+w+1,by-h+1,x+w/2,by-h-rh+3,x-1,by-h+1]);}
    else{P(roof,[x-3,by-h,x+3,by-h-rh,x+w-3,by-h-rh,x+w+3,by-h]);for(let y=by-h-rh+2;y<by-h;y+=2)R('rgba(0,0,0,.12)',x-1,y,w+2,1);R('rgba(255,255,255,.12)',x+3,by-h-rh,w-6,1);R('rgba(0,0,0,.25)',x-3,by-h-1,w+6,1);}
    R(trim,x,by-h,1,h);R(trim,x+w-1,by-h,1,h);R(trim,x,by-h,w,1);
    const fl=Math.max(1,Math.floor(h/12)),n=Math.max(1,Math.floor((w-5)/9));for(let f=0;f<fl;f++)for(let i=0;i<n;i++){const wx=Math.round(n>1?x+3+i*((w-11)/(n-1)):x+(w-5)/2),wy=by-9-f*12;if(f===0&&i===(a.door==null?0:a.door)){R(trim,wx-1,by-10,6,10);R(a.dc||'#5a3a2a',wx,by-9,4,9);R('#e8d48a',wx+3,by-5,1,1);R('#8a8f93',wx-2,by-1,8,1);continue;}
        if(a.arch&&f===fl-1){R(trim,wx,wy-3,5,1);R('#1e3346',wx+1,wy-2,3,2);}R(trim,wx-1,wy-1,7,7);R('#1e3346',wx,wy,5,5);R('rgba(255,255,255,.3)',wx,wy,5,1);R(trim,wx+2,wy,1,5);o.win.push([wx,wy,5,5]);}
    if(a.g&&h>18){const wx=Math.round(x+w/2-2),wy=by-h-Math.round(rh*.45);R(trim,wx-1,wy-1,6,5);R('#1e3346',wx,wy,4,3);o.win.push([wx,wy,4,3]);}
    if(a.ch){const c2=Math.round(x+w*.72);R('#6f5244',c2,by-h-rh-5,4,rh*.6+5);R('#4e382f',c2-1,by-h-rh-6,6,2);o.smoke.push([c2+2,by-h-rh-7]);}
    if(a.bal){R(trim,x+w*.18,by-h*.52,w*.64,1);for(let k=0;k<w*.64;k+=3)R(trim,x+w*.18+k,by-h*.52,1,4);}
    if(a.bay){const bx=Math.round(x+w*.62);R(wall,bx,by-h-6,13,7);P(roof,[bx-2,by-h-6,bx+6,by-h-12,bx+15,by-h-6]);R('#1e3346',bx+4,by-h-4,5,4);o.win.push([bx+4,by-h-4,5,4]);}
    if(a.porch){R(trim,x-5,by-11,5,1);R(trim,x-5,by-11,1,11);R('#8a8f93',x-6,by-1,7,1);}};
  // upper streets, half hidden by trees
  for(let i=0;i<6;i++){const x=120+i*104+rn()*30,t=top(x),by=Math.min(q-24,t+16+rn()*10);if(x>W-90||by<t+10)continue;house(x,by,22+(rn()*14|0),13+(rn()*6|0),HC[(i*3+1)%HC.length],{g:i%2,ch:i%3===0,door:9});}
  for(let i=0;i<3;i++){const x=190+i*190+rn()*40,t=top(x),by=Math.min(q-36,t+8+rn()*6);if(x>W-110||by<t+5)continue;house(x,by,16+(rn()*8|0),10+(rn()*4|0),HC[(i*5+2)%HC.length],{g:(i+1)%2,door:9});}
  for(let i=0;i<34;i++){const x=40+rn()*(W-80);if(top(x)>q-16)continue;if(i%4===0)leafy(x,q-10-rn()*16,4+rn()*3,['#5a9054','#66a05e','#4c8250'][i%3]);else spruce(x,q-8-rn()*20,11+rn()*12,['#234a38','#2b5642','#1e4032'][i%3]);}
  // shore: rock both ends, the street and its pavement, a seawall under the town
  const tp=x=>{const e=Math.min(x,W-x);return e<56?wl+4-Math.pow(e/56,.8)*(wl+4-q):q;};for(let x=0;x<W;x++){const t=tp(x);R('#474e4b',x,t,1,wl+8-t);}
  R('#5f666a',70,q,W-140,wl-q+8);R('#7a8286',70,q,W-140,1);for(let x=74;x<W-70;x+=9)R('rgba(0,0,0,.16)',x,q+1,1,wl-q+6);for(let x=72;x<W-70;x+=3)if(rn()<.3)R('#39473c',x,wl-3+rn()*3,2,2);
  for(let i=0;i<130;i++){const e=rn()<.5,x=e?6+rn()*70:W-76+rn()*70;rock(x,tp(x)+3+rn()*Math.max(1,wl-tp(x)),2+rn()*5,1.5+rn()*3.5,['#5f686c','#4d5658','#727b80','#404849'][i%4]);}
  for(let i=0;i<14;i++){const e=i%2,x=e?24+rn()*44:W-68+rn()*44;spruce(x,tp(x)+1,8+rn()*11,['#1c3a30','#214438'][i%2]);}
  R('#34393e',64,q-3,W-128,3);for(let x=70;x<W-70;x+=11)R('#cfc060',x,q-2,5,1);R('#a9aeaa',64,q-4,W-128,1);o.road=q;
  // the front street
  let hx=236;const add=(w,h,pal,a,gap=5)=>{house(hx,q-4,w,h,pal,a);hx+=w+gap;};
  add(34,25,HC[1],{g:1,ch:1,porch:1},16);add(60,27,HC[2],{bal:1,door:3,ch:1,arch:1},22);
  {const x=hx+3,by=q-4;house(x,by,30,23,['#efede6','#34424f','#c4c7c3'],{g:1,door:1,dc:'#2f4a7a'});R('#efede6',x+31,by-40,10,40);R('#c4c7c3',x+31,by-40,10,1);R('#1e3346',x+34,by-31,4,6);o.win.push([x+34,by-31,4,6]);
    for(let k=-5;k<=4;k++){const w=k<0?Math.sqrt(25-k*k)*.95:5-k*.9;R('#2c69b0',x+36-w,by-47+k,w*2,1);}R('#5a94d8',x+34,by-50,2,4);R('#e2ce82',x+36,by-59,1,8);R('#e2ce82',x+34,by-56,5,1);R('#e2ce82',x+35,by-53,3,1);
    for(let k=-3;k<=2;k++){const w=k<0?Math.sqrt(9-k*k):3-k;R('#2c69b0',x+15-w,by-23-11+k,w*2,1);}R('#e2ce82',x+15,by-41,1,5);hx=x+62;}
  add(40,22,['#3d8a85','#2c353c','#efede6'],{door:2},18);o.sign.push([hx-42,q-33,'B AND B']);txt(R,'#efede6','B AND B',hx-41,q-34);
  // filling station: canopy, pumps, kiosk, price pole
  {const x=hx+4,by=q-4;R('#d0d3cf',x,by-22,46,3);R('#c8402a',x,by-19,46,1);R('#f2f2ec',x,by-23,46,1);R('#6b7479',x+5,by-18,2,18);R('#6b7479',x+39,by-18,2,18);for(const px of[x+15,x+27]){R('#e6e4da',px,by-8,5,8);R('#c8402a',px,by-8,5,2);R('#1e3346',px+1,by-5,3,2);R(K,px+5,by-6,1,5);}
    house(x+50,by,22,15,HC[7],{door:0});R('#6b7479',x+78,by-34,1,34);R('#c8402a',x+74,by-36,9,9);txt(R,'#fff','GAS',x+74,by-48);R('#f2f2ec',x+75,by-34,7,2);R('#f2f2ec',x+75,by-31,7,2);o.gas=[x,by-19,46];o.lamp.push([x+23,by-18,1]);
    R('#8a3a2e',x+84,by-6,13,4);R('#8a3a2e',x+86,by-9,6,3);R('#1e3346',x+87,by-8,4,2);R(K,x+86,by-2,3,2);R(K,x+93,by-2,3,2);hx=x+118;}
  add(34,24,HC[5],{g:1,ch:1},24);add(30,20,HC[6],{porch:1},30);if(hx<W-120)add(28,19,HC[10],{g:1,ch:1});
  // parked cars, a boat on a trailer, lamps, poles and wires
  for(const[x,col]of[[272,'#3a4a8a'],[668,'#b8862a']]){R(col,x,q-7,12,3);R(col,x+3,q-9,6,2);R('#1e3346',x+4,q-9,4,1);R(K,x+1,q-4,3,2);R(K,x+8,q-4,3,2);}
  {const x=690;R('#e6e4da',x,q-9,22,3);P('#e6e4da',[x+22,q-9,x+28,q-11,x+22,q-6]);R('#3d6348',x,q-7,22,1);R('#6b7479',x-3,q-5,28,1);R(K,x+6,q-4,3,2);R(K,x+14,q-4,3,2);}
  for(let x=84;x<W-70;x+=74){R('#343c42',x,q-25,1,22);R('#343c42',x,q-25,4,1);R(K,x+2,q-24,3,2);o.lamp.push([x+3,q-23]);}
  {let px=null;for(let x=120;x<W-90;x+=140){R('#4a3d30',x,q-36,2,33);R('#4a3d30',x-4,q-34,10,1);R('#4a3d30',x-3,q-31,8,1);if(px!=null)for(let k=0;k<=140;k+=2){const t=k/140;R('rgba(26,30,34,.7)',px+k,q-34+Math.sin(t*3.1416)*4,1,1);R('rgba(26,30,34,.5)',px+k,q-31+Math.sin(t*3.1416)*4,1,1);}px=x;}}
  // ---- front layer: the pier on its piles with the red house, shed and two warehouses; floats; the harbour quay
  g=cf.getContext('2d');
  {const x0=72,x1=232,dk=q-3;for(let x=x0+3;x<x1;x+=11){R('#3f342a',x,dk,2,wl-dk+8);R('#2c241d',x+1,dk,1,wl-dk+8);}for(let x=x0+3;x<x1-11;x+=22)for(let k=0;k<11;k++){R('#57483a',x+k,dk+3+k*1.1,1,1);R('#57483a',x+22-k,dk+3+k*1.1,1,1);}
    R('#86705a',x0,dk-3,x1-x0,3);R('#66543e',x0,dk,x1-x0,1);for(let x=x0;x<x1;x+=7)R('#5b4a37',x,dk-3,1,3);for(let x=x0;x<x1;x+=9)R('#dcd8cc',x,dk-8,1,5);R('#dcd8cc',x0,dk-8,x1-x0,1);
    house(78,dk-3,52,30,HC[0],{ch:1,bal:1,door:2,dc:'#d4ae3a',bay:1});house(134,dk-3,20,13,['#cf8c2c','#62544a','#efe2c6'],{g:1,door:0});
    for(const[x,w,col,rf]of[[158,36,'#7f878c','#5d3a30'],[196,32,'#8a7f6c','#3d444a']]){R(col,x,dk-25,w,22);for(let k=x+1;k<x+w;k+=2)R('rgba(0,0,0,.1)',k,dk-25,1,22);P(rf,[x-2,dk-25,x+w/2,dk-33,x+w+2,dk-25]);R('#2a2f33',x+w/2-7,dk-17,14,14);for(let k=0;k<14;k+=2)R('rgba(255,255,255,.07)',x+w/2-7,dk-17+k,14,1);R('#1e3346',x+3,dk-21,4,3);o.win.push([x+3,dk-21,4,3]);R('rgba(120,60,40,.35)',x+2,dk-8,w-4,5);}
    txt(R,'#efede6','KODIAK SEAFOODS',160,dk-41);R('#3a4248',158,dk-34,70,1);
    for(let k=0;k<4;k++)for(let m=0;m<2+(k%2);m++){R(['#e8731f',Y,'#d8452a'][(k+m)%3],88+k*8-72+72,dk-9-m*5-30+30,6,5);}
    for(let k=0;k<5;k++)for(let m=0;m<2-(k%2)+1;m++){R(['#e8731f',Y,'#d8452a'][(k+m)%3],100+k*7+34,dk-8-m*5,6,5);R('rgba(0,0,0,.25)',100+k*7+34,dk-5-m*5,6,1);}
    R('#343c42',226,dk-27,1,24);R(K,224,dk-28,5,2);o.lamp.push([226,dk-26]);for(const x of[x0+1,x0+40,x1-4])for(let k=-2;k<=2;k++){const w=Math.sqrt(5-k*k);R('#1c1f22',x-w+1,dk+5+k,w*2,1);}
    R('#57483a',112,dk,2,wl-dk+2);for(let k=dk+2;k<wl;k+=3)R('#57483a',112,k,6,1);R('#57483a',117,dk,1,wl-dk+2);}
  {const x0=240,x1=318;R('#8a9094',x0,wl-5,x1-x0,3);R('#676d72',x0,wl-2,x1-x0,2);for(let x=x0;x<x1;x+=6)R('rgba(0,0,0,.15)',x,wl-5,1,3);for(let k=0;k<6;k++){const bx=x0+6+k*13;for(let m=-2;m<=2;m++){const w=Math.sqrt(5.5-m*m);R([RB,'#e8731f',Y,'#d8452a','#efede6','#3fae6a'][k],bx-w,wl-8+m,w*2+1,1);}}
    for(let k=0;k<16;k++)R('#66543e',232+k*.6,q-2+k*.75,2,1);
    for(const[x,col]of[[262,'#dcd8cc'],[292,'#7f9aa8']]){R(col,x,wl-9,16,3);P(col,[x+16,wl-9,x+20,wl-10,x+16,wl-6]);R('rgba(0,0,0,.25)',x,wl-7,16,1);R('#343c42',x-2,wl-11,3,4);}}
  {const x0=326,x1=540;R('#757d81',x0,q-1,x1-x0,2);for(let x=x0+6;x<x1;x+=22)R(K,x,q-4,3,3);for(let x=x0+4;x<x1;x+=12){R('#3f342a',x,q+1,2,wl-q+6);}
    for(const[bx,hc,nm]of[[362,'#2c5a86','ORCA'],[432,'#96342c','SAGA'],[500,'#2f6a52','POLARIS']]){const y=wl-3;P(hc,[bx-26,y-7,bx+18,y-7,bx+28,y-11,bx+24,y+2,bx-23,y+2,bx-26,y-3]);R('#efede6',bx-26,y-8,45,1);R('rgba(0,0,0,.22)',bx-24,y-2,48,3);txt(R,'#efede6',nm,bx-22,y-6);
      R('#efede6',bx+2,y-17,15,10);R('#c4c7c3',bx+1,y-19,17,2);for(let k=0;k<3;k++)R('#1e3346',bx+4+k*4,y-15,3,3);R('#c4c7c3',bx+9,y-33,1,14);R('#c4c7c3',bx+4,y-28,11,1);P('#c4c7c3',[bx+9,y-24,bx+10,y-24,bx-18,y-37,bx-19,y-36]);R('#e8731f',bx-16,y-10,3,3);R('#e8731f',bx-6,y-10,3,3);R('#343a42',bx-22,y-13,6,6);
      for(let k=0;k<14;k++){R('rgba(30,34,38,.7)',bx-27-k*.5,y-8-k*.5,1,1);R('rgba(30,34,38,.7)',bx+27+k*.4,y-10-k*.4,1,1);}}
    house(548,q-1,26,15,HC[9],{g:1});R('#6b7479',579,q-34,1,33);o.flag=[580,q-34];
    R('#3d474e',402,q-25,2,24);R('#3d474e',402,q-25,18,2);R(K,418,q-23,1,7);R(Y,398,q-4,9,3);
    for(let k=0;k<3;k++){R('#74876a',462+k*10,q-11,9,1);R('#57483a',462+k*10,q-11,1,10);R('rgba(116,135,106,.55)',463+k*10,q-10,8,7);}
    for(let k=0;k<4;k++)for(let m=0;m<2+(k%2);m++){R(['#e8731f',Y,'#d8452a'][(k+m)%3],340+k*7-14+14,q-6-m*5,6,5);R('rgba(0,0,0,.25)',340+k*7,q-3-m*5,6,1);}
    R('#c8402a',592,q-13,10,12);R('#f2f2ec',593,q-12,8,4);R(K,602,q-9,1,6);txt(R,'#efede6','FUEL',590,q-20);
    R('#343c42',470,q-25,1,24);R(K,468,q-26,5,2);o.lamp.push([470,q-24]);}
  {const x=W-74;for(let k=0;k<26;k++)rock(x-40+k*3.4+rn()*2,wl+2-rn()*3,3+rn()*3,3+rn()*3,['#5f686c','#4d5658','#727b80'][k%3]);R('#e6e4da',x+44,wl-18,3,14);R('#2f8a5a',x+43,wl-21,5,3);o.bw=[x+45,wl-20];}
  for(const cv2 of[cb,cf]){const gg=cv2.getContext('2d'),im=gg.getImageData(0,0,W,H),d=im.data;for(let i=0;i<d.length;i+=4){if(!d[i+3])continue;const l=.3*d[i]+.59*d[i+1]+.11*d[i+2];d[i]=(l+(d[i]-l)*.3)*.8+17;d[i+1]=(l+(d[i+1]-l)*.3)*.8+20;d[i+2]=(l+(d[i+2]-l)*.3)*.8+25;}gg.putImageData(im,0,0);}
  return o;}
function planeFar(){const W=980,H=150,c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d');let sd=31;const rn=()=>(sd=(sd*16807)%2147483647)/2147483647,o={c,W,H,f:.6,win:[]};
  const R=(col,x,y,w,h)=>{g.fillStyle=col;g.fillRect(Math.round(x),Math.round(y),Math.max(1,Math.round(w)),Math.max(1,Math.round(h)));},P=(col,a)=>{g.fillStyle=col;g.beginPath();for(let i=0;i<a.length;i+=2)g.lineTo(Math.round(a[i]),Math.round(a[i+1]));g.fill();};
  const top=x=>H-6-Math.max(0,62*Math.pow(Math.max(0,Math.sin(clamp((x-20)/520,0,1)*3.1416)),.8)+84*Math.pow(Math.max(0,Math.sin(clamp((x-330)/630,0,1)*3.1416)),.9)*.9)-5*Math.sin(x*.019)-3*Math.sin(x*.057);
  for(let x=0;x<W;x++){const t=top(x);if(t>=H-2)continue;R('#2c4640',x,t,1,H-t);R('#263e3a',x,t+18+4*Math.sin(x*.04),1,H);}
  for(let i=0;i<420;i++){const x=10+rn()*(W-20),t=top(x);if(t>H-8)continue;const y=t+2+rn()*Math.min(70,H-t-4),h=6+rn()*8,n=3;for(let k=0;k<n;k++){const w=1+k*(h*.36/n),yy=y-h+k*(h/n);P(['#17302c','#1b3632','#132a27'][i%3],[x+.5,yy-1,x+.5+w,yy+h/n+1,x+.5-w,yy+h/n+1]);}}
  for(let i=0;i<22;i++){const x=40+rn()*(W-80),t=top(x);if(t<H-20)R('rgba(210,224,232,.5)',x,t+2+rn()*10,5+rn()*10,1);}
  for(let i=0;i<14;i++){const x=120+i*56+rn()*24,t=top(x),by=t+22+rn()*40;if(by>H-8||by<t+12)continue;const w=9+(rn()*6|0),h=6+(rn()*3|0),pal=[['#7a3a34','#252b30'],['#4a6078','#22282d'],['#a8aeac','#2c3238'],['#8a7648','#2a2622']][i%4];R(pal[0],x,by-h,w,h);P(pal[1],[x-1,by-h,x+w/2,by-h-4,x+w+1,by-h]);R('#16242f',x+2,by-4,2,2);o.win.push([x+2,by-4,2,2]);if(w>11){R('#16242f',x+w-4,by-4,2,2);o.win.push([x+w-4,by-4,2,2]);}}
  {const x=640,t=top(x);R('#3a4248',x,t-26,1,28);for(let k=0;k<26;k+=5)R('#3a4248',x-2,t-26+k,5,1);o.mast=[x,t-27];}
  g.globalCompositeOperation='source-atop';g.fillStyle='rgba(76,104,132,.34)';g.fillRect(0,0,W,H);const gr=g.createLinearGradient(0,H-60,0,H);gr.addColorStop(0,'rgba(176,196,210,0)');gr.addColorStop(1,'rgba(176,196,210,.55)');g.fillStyle=gr;g.fillRect(0,0,W,H);g.globalCompositeOperation='source-over';return o;}
const TWD0=-1820,townX=(p,dc)=>r(VW/2-p.W/2-(dc-TWD0)*p.f),TVEH=[['car','#7a504a',26,0],['truck','#b0b2ae',19,260],['car','#4f5d72',31,520],['pick','#5c635a',23,140],['tank','#9a9ea2',17,700],['car','#a6a49e',28,900],['pick','#6a4e48',21,400]],
  TPED=[[250,560,7,['#c8482c','#2c3e50','#f1d2b6']],[330,530,5,['#e8b23a','#16233d','#c98f6a']],[420,700,8,['#2e86de','#3d3a38','#f1d2b6']],[90,225,5,['#f36f21','#3d474e','#f1d2b6']],[600,705,6,['#8e44ad','#2c3e50','#c98f6a']]];
function townFar(g,hz,dc,mask){if(!TPN){TPN=planeNear();TPF=planeFar();}
  {const p=TPF,x=townX(p,dc),y=hz-12-p.H;if(x<VW&&x+p.W>0)g.drawImage(mask?p.c:sunSpr(p.c),x,y);}
  const p=TPN,x=townX(p,dc),y=hz-3-p.H;if(x>VW+260||x+p.W<-260)return;if(mask){g.drawImage(p.cb,x,y);g.drawImage(p.cf,x,y);return;}
  const g0=ctx,wd=M.wind<0?-1:1,wa=clamp(Math.abs(M.wind)/40,.3,1.4),q=y+p.q,wl=y+p.wl;ctx=g;
  g.drawImage(sunSpr(p.cb),x,y);
  for(const s of p.smoke)for(let i=0;i<6;i++){const a=(T*.35+i/6+s[0]*.013)%1,sz=1+r(a*3);g.fillStyle=`rgba(206,212,218,${(.32*(1-a)).toFixed(3)})`;g.fillRect(x+r(s[0]+wd*a*18*wa+Math.sin(T*1.2+i*2)*1.5)-(sz>>1),y+r(s[1]-a*20)-(sz>>1),sz,sz);}
  // traffic on the front street: cars, pick-ups, a box truck, a tanker
  p.cars=[];const ra=70,rn_=p.W-140;TVEH.forEach((v,i)=>{const u=((T*v[2]+v[3])%(rn_*2)),d=u<rn_?1:-1,vx=x+r(u<rn_?ra+u:ra+rn_*2-u),vy=q-(d>0?0:1);p.cars.push([vx,vy,d,v[0]]);const F=(c,a,b,w,h)=>{g.fillStyle=c;g.fillRect(d>0?vx+a:vx-a-w,vy+b,w,h);};
    if(v[0]==='car'){F(v[1],-6,-4,12,3);F(v[1],-3,-6,6,2);F('#1e3346',-2,-6,4,1);F('#14171a',-5,-1,3,2);F('#14171a',2,-1,3,2);}
    else if(v[0]==='pick'){F(v[1],-7,-4,14,3);F(v[1],0,-7,5,3);F('#1e3346',1,-6,3,2);F('rgba(0,0,0,.25)',-7,-4,7,1);F('#14171a',-6,-1,3,2);F('#14171a',3,-1,3,2);}
    else if(v[0]==='truck'){F(v[1],-10,-10,14,9);F('rgba(0,0,0,.1)',-10,-6,14,1);F('#5c7068',-8,-8,9,3);F('#84504a',4,-7,6,6);F('#1e3346',6,-6,3,2);F('#14171a',-8,-1,3,2);F('#14171a',-4,-1,3,2);F('#14171a',6,-1,3,2);}
    else{F('#8a9198',-11,-3,22,2);F(v[1],-11,-9,15,6);F('rgba(255,255,255,.3)',-11,-9,15,1);F('rgba(0,0,0,.2)',-11,-5,15,1);F('#4c607a',5,-8,6,6);F('#1e3346',7,-7,3,2);F('#14171a',-9,-1,3,2);F('#14171a',-5,-1,3,2);F('#14171a',7,-1,3,2);}});
  TPED.forEach((w,i)=>{const n=w[1]-w[0],u=((T+i*7)*w[2])%(n*2);mini(x+(u<n?w[0]+u:w[1]-(u-n)),q-(i===3?5:3),w[3],2,i,u<n?1:-1);});
  g.drawImage(sunSpr(p.cf),x,y);
  if(p.flag){const fx0=x+p.flag[0],fy0=y+p.flag[1];for(let i=0;i<9;i++){const fy=fy0+r(Math.sin(T*7-i*.7)*(.3+i*.1)*wa),fx=fx0+wd*i-(wd<0?1:0);g.fillStyle=RB;g.fillRect(fx,fy,1,5);g.fillStyle=W;g.fillRect(fx,fy+1,1,1);g.fillRect(fx,fy+3,1,1);if(i<4){g.fillStyle=BL;g.fillRect(fx,fy,1,3);}}}
  // fishermen on the pier, a forklift between the warehouses, hands on the quay
  const dk=q-6;for(const[fxp,ph]of[[x+76,0],[x+104,2.1]]){mini(fxp,dk,['#3f6b4a','#3d3a38','#f1d2b6'],4,ph,-1);g.fillStyle='#5a4a3a';pl(g,fxp-1,dk-7,fxp-11,dk-13);g.fillStyle='rgba(230,236,240,.6)';pl(g,fxp-11,dk-13,fxp-12+r(Math.sin(T*.9+ph)*1.5),wl-1);}
  {const n=46,u=(T*9)%(n*2),d=u<n?1:-1,fx=x+r(160+(u<n?u:n*2-u));g.fillStyle='#a8904a';g.fillRect(fx-3,dk-5,7,4);g.fillRect(fx-2,dk-8,4,3);g.fillStyle='#14171a';g.fillRect(fx-3,dk-1,2,1);g.fillRect(fx+2,dk-1,2,1);g.fillStyle='#3a4248';g.fillRect(d>0?fx+4:fx-5,dk-8,1,8);g.fillStyle='#9a6a44';g.fillRect(d>0?fx+5:fx-9,dk-5,4,4);}
  mini(x+352,q-1,['#e8b23a','#16233d','#f1d2b6'],4,1,1);mini(x+358,q-1,['#2f4a7a','#16233d','#c98f6a'],4,2,-1);{const n=60,u=(T*6+20)%(n*2);mini(x+440+(u<n?u:n*2-u),q-1,['#f36f21','#2c363d','#f1d2b6'],2,3,u<n?1:-1);}mini(x+276,wl-5,['#c8482c','#2c3e50','#f1d2b6'],4,4,1);
  // boats working in and out of the harbour
  p.boats=[];for(let i=0;i<2;i++){const per=70+i*26,u=((T+i*37)%per)/per,out=i===0,t=out?u:1-u,bx=x+r(out?500-t*t*1300:600+t*t*640-(1-t)*20),d=-1,by=wl-2+r(Math.sin(T*1.6+i)*.8),hc=['#465a6c','#6c4844'][i];if(bx<-60||bx>VW+60)continue;p.boats.push([bx,by,d]);
    const F=(c,a,b,w,h)=>{g.fillStyle=c;g.fillRect(d>0?bx+a:bx-a-w,by+b,w,h);};F(hc,-17,-6,32,6);F(hc,15,-8,4,5);F('#efede6',-17,-7,34,1);F('rgba(0,0,0,.25)',-15,-2,32,2);F('#efede6',1,-14,11,8);F('#1e3346',3,-12,7,2);F('#c4c7c3',6,-24,1,10);F('#c4c7c3',2,-20,9,1);F('#9a6a44',-11,-9,3,2);
    g.fillStyle='rgba(255,255,255,.7)';for(let k=0;k<7;k++)if(Math.sin(T*5+k*1.7+i)>-.2)g.fillRect(bx-d*(19+k*6),by-1+(k%2),4-(k>4),1);g.fillRect(bx+d*19,by-1,2,1);}
  for(let i=0;i<30;i++){const ox=[430,150,300,600,520][i%5],a=T*(.26+(i%7)*.035)*(i%2?1:-1)+i*1.9,gx=x+r(ox+Math.cos(a)*(40+(i%9)*13)+Math.sin(a*.37)*26),gy=y+r(p.H-62-(i%6)*14+Math.sin(a*1.7)*10),dkk=ENV.d>.5;g.fillStyle=dkk?'#7a8490':'#f4f6f6';g.fillRect(gx-1,gy,3,1);g.fillStyle=dkk?'#636c78':'#d6dde2';if(Math.sin(T*7+i*2)>0){g.fillRect(gx-3,gy-1,2,1);g.fillRect(gx+2,gy-1,2,1);}else{g.fillRect(gx-3,gy,2,1);g.fillRect(gx+2,gy,2,1);}}
  for(const[px,py]of[[74,-2],[112,-2],[232,-2],[246,3],[300,3],[330,0],[412,-22],[540,0],[604,-12],[150,-36],[190,-36]]){const bx=x+px,by=(py>0?wl-8:q-6)+py;g.fillStyle=ENV.d>.5?'#7a8490':'#f0f2f2';g.fillRect(bx,by-2,3,2);g.fillRect(bx+2,by-3,2,1);g.fillStyle='#b8862a';g.fillRect(bx+4,by-3,1,1);}
  ctx=g0;}
function townGlow(da,hz,dc){const g=ctx;if(da<.1||!TPN)return;const a=Math.min(1,da*1.3);g.setTransform(1,0,0,1,0,0);
  {const p=TPF,x=townX(p,dc),y=hz-12-p.H;if(x<VW&&x+p.W>0){p.win.forEach((w,i)=>{if((i*7919)%17<9)return;g.fillStyle=`rgba(255,206,128,${(a*.8).toFixed(3)})`;g.fillRect(x+w[0],y+w[1],w[2],w[3]);});if(T*.8%1<.5)glow(x+p.mast[0],y+p.mast[1],6,`rgba(255,50,40,${(.9*a).toFixed(3)})`);}}
  const p=TPN,x=townX(p,dc),y=hz-3-p.H;if(x<VW+260&&x+p.W>-260){
    p.win.forEach((w,i)=>{const sx=x+w[0];if(sx<-6||sx>VW)return;const h=(i*7919)%17;if(h<8)return;g.fillStyle=h===16?`rgba(${130+r(50*Math.sin(T*9+i))},180,255,${(a*.8).toFixed(3)})`:h>13?`rgba(255,236,190,${a.toFixed(3)})`:`rgba(255,204,124,${a.toFixed(3)})`;g.fillRect(sx,y+w[1],w[2],w[3]);if(h>14)glow(sx+2,y+w[1]+2,7,`rgba(255,200,120,${(.16*a).toFixed(3)})`);});
    for(const l of p.lamp){const lx=x+l[0],ly=y+l[1];glow(lx,ly,l[2]?26:15,`rgba(255,${l[2]?236:204},${l[2]?200:128},${(.6*a).toFixed(3)})`);g.fillStyle=`rgba(255,240,200,${a.toFixed(3)})`;g.fillRect(lx-1,ly,2,1);g.save();g.translate(lx,y+p.q-1);g.scale(1,.22);glow(0,0,l[2]?34:22,`rgba(255,206,130,${(.3*a).toFixed(3)})`);g.restore();}
    if(p.gas){g.fillStyle=`rgba(255,244,214,${(.85*a).toFixed(3)})`;g.fillRect(x+p.gas[0]+1,y+p.gas[1]+1,p.gas[2]-2,1);}
    if(p.cars)for(const c of p.cars){glow(c[0]+c[2]*8,c[1]-3,7,`rgba(255,244,200,${(.75*a).toFixed(3)})`);g.fillStyle=`rgba(255,60,44,${a.toFixed(3)})`;g.fillRect(c[0]-c[2]*(c[3]==='car'?6:10),c[1]-3,1,1);}
    if(p.boats)for(const b of p.boats){glow(b[0]+b[2]*6,b[1]-24,5,`rgba(255,255,236,${(.9*a).toFixed(3)})`);glow(b[0]+b[2]*17,b[1]-7,4,b[2]>0?`rgba(60,255,122,${a.toFixed(3)})`:`rgba(255,59,59,${a.toFixed(3)})`);glow(b[0]+b[2]*6,b[1]-11,7,`rgba(255,214,150,${(.5*a).toFixed(3)})`);}
    if(p.bw&&T*.6%1<.35)glow(x+p.bw[0],y+p.bw[1],8,`rgba(60,255,140,${(.95*a).toFixed(3)})`);
    for(const[bx,by]of[[371,p.wl-36],[441,p.wl-36],[509,p.wl-36]])glow(x+bx,y+by,4,`rgba(255,255,236,${(.7*a).toFixed(3)})`);}
  g.setTransform(1,0,0,1,-cx,-cy);}
function townDraw(){const g=ctx;if(cx>-700||cx+VW<TWX0)return;if(!TOWN)TOWN=townBuild();g.drawImage(sunSpr(TOWN),TWX0,-TWOY);}
function townHoles(){}
function drawBase(){
  const g=ctx;g.drawImage(sunSpr(SPR.L3),-720,-60);
  {const k=flash>.1?0:SUN.gf;if(k>.05){const sg=SUN.dir;g.fillStyle=`rgba(0,6,18,${(.32*k).toFixed(3)})`;for(const[x,hh]of[[-140,72],[62,72],[120,50],[-157,34],[76,12],[-245,9]]){const Ln=r(hh*k*1.5);g.fillRect(sg>0?x+2:x-Ln,-40,Ln,1);g.fillRect(sg>0?x+2:x-r(Ln*.6),-39,r(Ln*.6),1);}}}
  g.drawImage(SPR.rbm,352,r(wave(400)*.8)-36);
  for(let x=-120;x<=44;x+=27){g.fillStyle=Y;g.fillRect(x,-44,2,2);}
  g.fillStyle='#ccd';g.fillRect(120,-90,1,50);const wa=clamp(Math.abs(M.wind)/80,.15,1),wd=M.wind<0?-1:1;
  for(let i=0;i<5;i++){g.fillStyle=i%2?'#fff':'#f36f21';g.fillRect(120+wd*(i*5)+(wd<0?-5:1),-90+r(i*(1-wa)*4+Math.sin(T*6+i)*wa),5,6-(i>2));}
  if(state==='menu'||!base.amb)return;
  const b=base,m=b.med;
  if(b.amb!=='away'){const ax=b.ambX+r(b.ax);g.fillStyle='rgba(0,0,0,.24)';g.fillRect(ax+2,-41,52,2);g.drawImage(SPR.amb,ax-2,-40-28);
    const on=Math.sin(T*10)>0;g.fillStyle=on?'#ff3030':'#3070ff';g.fillRect(ax+15,-68,5,1);g.fillStyle=on?'#3070ff':'#ff3030';g.fillRect(ax+20,-68,5,1);}
  if(b.amb==='parked'&&m.state!=='stow'&&m.state!=='in'){const mv=['go','back','ret'].includes(m.state)?2:4,mx=r(m.x);
    man(mx-9,-40,MED,mv,0);man(mx+9,-40,MED,mv,3.14);
    g.fillStyle='#d8dcdc';g.fillRect(mx-7,-48,15,1);g.fillStyle='#f6c62f';g.fillRect(mx-6,-47,13,1);g.fillStyle='#8a9198';g.fillRect(mx-5,-46,1,6);g.fillRect(mx+5,-46,1,6);g.fillStyle=K;g.fillRect(mx-6,-41,2,2);g.fillRect(mx+5,-41,2,2);
    if(m.load)man(mx,-48,SV,3,0);}
  for(const w of b.walk)if(w.d<=0)man(w.x,-40,svC(w),2,w.ph*2);
}
function hud(){
  const g=hx;g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,hc.width,hc.height);if(state==='menu'||!heli||PH.on)return;
  g.setTransform(HS,0,0,HS,0,0);g.imageSmoothingEnabled=false;
  const h=heli,S=h.spec,F=(s,b)=>`${b?'700 ':''}${s}px Silkscreen,monospace`;
  if(RP.on){rpHud(g,F);return;}if(CUT.on){cutHud(g,F);return;}if(FIN.on){finHud(g,F);return;}if(EPI.on){epiHud(g,F);return;}
  const surf=!overSea(h.x)?Math.min(groundY(h.x),wave(h.x)):wave(h.x),alt=Math.max(0,(surf-(h.y+S.belly+h.gear*S.gear))/8*3.28);
  g.fillStyle='rgba(6,18,28,.72)';g.fillRect(6,6,168,66);g.fillStyle=O;g.fillRect(6,6,2,66);
  g.textAlign='left';g.textBaseline='alphabetic';g.fillStyle='#93adbb';g.font=F(8);g.fillText(S.call+' · '+S.name.split(' ')[0],12,17);
  g.fillStyle='#eef3f1';g.fillText(tr(`ALT ${String(r(alt)).padStart(3,'0')} FT  VEL ${String(r(Math.abs(h.vx)/2.2)).padStart(3,'0')} KT`),12,29);
  const fr=h.fuel/h.fmax;g.fillStyle='#93adbb';g.fillText(tr('COMB'),12,41);g.fillStyle='rgba(255,255,255,.16)';g.fillRect(44,35,124,6);
  g.fillStyle=fr>.3?'#5fe08a':fr>.15?'#f6c62f':'#ff5a4a';g.fillRect(44,35,r(124*fr),6);
  g.fillStyle='#93adbb';g.fillText(tr('CABINA'),12,53);for(let i=0;i<S.cap;i++){g.fillStyle=i<aboard.length?'#f36f21':'rgba(255,255,255,.18)';g.fillRect(58+i*9,46,7,7);}
  let tx=12;const tag=(t,on)=>{t=tr(t);g.fillStyle=on?'#f6c62f':'rgba(255,255,255,.3)';g.fillText(t,tx,66);tx+=g.measureText(t).width+6;};
  tag(S.fixed?'FIJO':'TREN',h.gearT);tag('PUERTA',h.doorT);tag('FOCO',h.spot);tag('LUZ',h.lights);tag('B'+h.flares,h.flares>0);
  const rw=132,rx=VW-6-rw;g.fillStyle='rgba(6,18,28,.72)';g.fillRect(rx,6,rw,52);
  const hh=Math.floor(H),mn=String(Math.floor((H%1)*60)).padStart(2,'0');g.fillStyle='#eef3f1';g.font=F(8,1);g.fillText(`${String(hh).padStart(2,'0')}:${mn} AKDT`,rx+6,17);
  const mm=Math.floor(clock/60),ss=String(Math.floor(clock%60)).padStart(2,'0');g.textAlign='right';g.fillStyle='#93adbb';g.font=F(8);g.fillText(`T+${mm}:${ss}`,VW-12,17);g.textAlign='left';
  surv.forEach((p,i)=>{g.fillStyle={wait:p.hp>.3?'#f36f21':'#ff5a4a',ready:'#f6c62f',hook:'#f6c62f',aboard:'#7cc4ff',safe:'#5fe08a',lost:'#4a525a',trap:'#c77dff'}[p.state];g.fillRect(rx+6+(i%17)*7,22+(i>16?7:0),5,5);});
  g.fillStyle='#93adbb';g.fillText(tr({aboard:'NADADOR A BORDO',hook:'NADADOR EN GANCHO',fall:'NADADOR SALTANDO',swim:'NADADOR NADANDO',with:'CON LA VÍCTIMA',await:'ESPERA IZADO',riding:'IZANDO NADADOR',free:'LIBERANDO',inside:'NADADOR EN EL BARCO',fin:'EN EL CABLE',gone:'SIN NADADOR'}[sw.state]),rx+6,42);
  g.fillStyle='#f6c62f';g.fillText(tr(mode==='jump'?'MODO: SALTO':'MODO: GRÚA'),rx+6,53);
  if(NVG){for(const q of[[6,6,168,66],[rx,6,rw,52]]){const X0=Math.round(q[0]*HS),Y0=Math.round(q[1]*HS),W0=Math.round(q[2]*HS),H0=Math.round(q[3]*HS),im=g.getImageData(X0,Y0,W0,H0),a=im.data;
      for(let i=0;i<a.length;i+=4){const R=a[i],G=a[i+1],B=a[i+2];if(R>150&&R>G*1.7)continue;const l=(R+G+B)/3;if(l<70){a[i]=8+l*.25;a[i+1]=46+l*1.1;a[i+2]=22+l*.5;}else{a[i]=Math.min(255,l*.62);a[i+1]=Math.min(255,l*1.3+40);a[i+2]=Math.min(255,l*.72);}}g.putImageData(im,X0,Y0);
      g.save();g.shadowColor='rgba(70,255,130,.85)';g.shadowBlur=9*HS;g.strokeStyle='rgba(90,255,140,.8)';g.lineWidth=1;g.strokeRect(q[0]+.5,q[1]+.5,q[2]-1,q[3]-1);g.strokeRect(q[0]+.5,q[1]+.5,q[2]-1,q[3]-1);g.restore();}}
  if(M.aids){const pc={l:0,r:0};const ptr=(wx,label,col,dy=0)=>{const sx=wx-camX;if(sx>30&&sx<VW-30)return;const L=sx<=30,x=L?8:VW-8,y=r(VH*.36)+dy+14*(pc[L?"l":"r"]++);g.fillStyle=col;
      for(let i=0;i<6;i++)g.fillRect(L?x+i:x-i-1,y-i,1,i*2+1);g.font=F(8);g.textAlign=L?'left':'right';g.fillText(`${tr(label)} ${(Math.abs(wx-h.x)/NM).toFixed(1)} NM`,x+(L?10:-10),y+3);};
    const live=surv.filter(p=>p.state==='wait'||p.state==='ready');
    if(live.length){if(X.found)ptr(live.reduce((a,p)=>a+p.x,0)/live.length,'SINIESTRO','#f6c62f');}else if(sw.state!=='aboard'&&sw.state!=='hook')ptr(sw.x,'NADADOR','#d7ff3f');
    const ct=vessels.find(v=>v.cutter);if(ct)ptr(ct.x-174,'GUARDACOSTAS','#7cc4ff');else ptr(-60,'KODIAK','#7cc4ff');}
  g.textAlign='center';
  if(hook.L>14&&!h.dead){g.fillStyle='#93adbb';g.font=F(8);g.fillText(`CABLE ${(hook.L/8).toFixed(0)} M`,VW/2,38);}
  for(const s of shouts)bubble(g,s.p.x,s.p.y-(!s.p.v||s.p.v.sit?12:20),s.t,'#16191d',s.p.nm?s.p.nm[0]+s.p.nm.slice(1).toLowerCase():s.who);
  if(bub.p&&!h.dead)bubble(g,h.x,h.y+S.rotY-6,bub.p.t,'#16191d',campCrew('p'));
  if(bub.s&&!h.dead){const out=!['aboard','hook','riding'].includes(sw.state);bubble(g,out?sw.x:h.x-(bub.p?h.dir*70:0),out?sw.y-20:h.y+S.rotY-(bub.p?26:6),bub.s.t,'#16191d',campCrew('s'));}
  if(note.life>0&&!banner){g.font='600 9px "IBM Plex Sans",system-ui,sans-serif';g.textAlign='center';const w=Math.min(VW-12,g.measureText(note.t).width+18),y=w<VW-404?8:95+Math.max(16,Math.ceil(30/PXS));
    g.globalAlpha=Math.min(1,note.life*2);g.fillStyle='rgba(6,18,28,.82)';g.fillRect(r(VW/2-w/2),y,r(w),17);g.fillStyle='#eef3f1';g.fillText(note.t,VW/2,y+12,VW-24);g.globalAlpha=1;}
  xHud(g);if(M.tut)tutHud(g);g.textAlign='center';
  if(banner){const y=r(VH*.3);g.fillStyle='rgba(6,18,28,.86)';g.fillRect(0,y,VW,46);g.fillStyle=O;g.fillRect(0,y,VW,3);g.fillStyle=BL;g.fillRect(0,y+43,VW,3);
    g.fillStyle='#fff';g.font='32px "Jersey 25","Pixelify Sans",Silkscreen,monospace';g.fillText(tr(banner),VW/2,y+31);}
}

$('#pResume').onclick=pauseClose;$('#pPhoto').onclick=photoOn;$('#pPad').onclick=openGamepadModal;$('#pQuit').onclick=()=>{$('#pause').hidden=true;toMain();};$('#phBack').onclick=photoOff;$('#phSave').onclick=photoSave;
$('#mTut').onclick=tutStart;$('#rpSpeed').onclick=()=>{RP.sp=RP.sp>=4?1:RP.sp*2;$('#rpSpeed').textContent='×'+RP.sp;};$('#rpBtn').onclick=rpStart;$('#rpSkip').onclick=()=>CUT.on?campAdvance():EPI.on?epiEnd():rpEnd();$('#mCont').onclick=guardCont;$('#mLang').onclick=()=>setLang(getLang()==='es'?'en':'es');$('#mPad').onclick=openGamepadModal;
$('#form').addEventListener('submit',e=>{e.preventDefault();guard.on=false;toBrief(getCfg());});
$('#again').onclick=()=>toBrief(cfgCur);$('#toMenu').onclick=toMenu;$('#toMain').onclick=toMain;$('#nextG').onclick=()=>M.camp!=null?campNext():guardNext();$('#mCamp').onclick=campOpen;$('#campBack').onclick=toMain;$('#campReset').onclick=()=>{campSet(0);campOpen();};$('#card').onclick=()=>cardSkip();$('#mGuard').onclick=guardStart;$('#mCustom').onclick=toMenu;$('#mCred').onclick=()=>showOnly('credits');$('#credBack').onclick=toMain;$('#backMain').onclick=toMain;$('#bGo').onclick=startMission;
$('#mMus').onclick=()=>{MU.on=!MU.on;try{localStorage.setItem('rkMus',MU.on?'1':'0');}catch(e){}if(MU.on)musInit();musLabel();};
const padOn=matchMedia('(pointer:coarse)').matches;$('#pad').hidden=true;
const KN={KeyF:'F',KeyL:'L',KeyG:'G',KeyH:'H',KeyD:'D',KeyT:'T',Space:'Esp',KeyR:'R',KeyW:'W',KeyS:'S',KeyB:'B',Digit1:'1',Digit2:'2'};
function refreshPadLabels(){
  const gpMode=getInputMode()==='gamepad',landed=!!(heli&&heli.landed),padEl=$('#pad');
  padEl.classList.toggle('pc',!padOn);
  padEl.classList.toggle('gp',gpMode);
  document.querySelectorAll('#pad .ac button,#pad .pw button').forEach(b=>{
    let i=b.querySelector('i');
    if(!i){i=document.createElement('i');b.appendChild(i);}
    if(gpMode)i.textContent=getGlyph(b.dataset.k,landed);
    else if(!padOn)i.textContent=KN[b.dataset.k]||'';
    else i.textContent='';
  });
}
refreshPadLabels();
const padLit=(c,on)=>{const b=document.querySelector(`#pad button[data-k="${c}"]`);if(b)b.classList.toggle('on',on);};addEventListener('keydown',e=>padLit(e.code,true));addEventListener('keyup',e=>padLit(e.code,false));addEventListener('blur',()=>document.querySelectorAll('#pad button.on').forEach(b=>b.classList.remove('on')));

$('#title').onclick=()=>showOnly('main');addEventListener('keydown',e=>{if(!$('#title').hidden&&!['Shift','Control','Alt','Meta','Tab'].includes(e.key)){e.preventDefault();showOnly('main');}});
if(document.fonts&&document.fonts.load){document.fonts.load('8px Silkscreen');document.fonts.load('32px "Jersey 25"');}
let last=performance.now();
function loop(now){const dt=Math.min(.033,(now-last)/1000);last=now;pollGamepad(dt);if(RP.on)rpStep(dt);else if(!paused){update(dt);if(state==='play'&&heli&&!CUT.on&&!FIN.on&&!EPI.on)recTick(dt);}else if(PH.on)phPan(dt);render();padSync();musSync();requestAnimationFrame(loop);}

window.__rk={epi:()=>epiStart(),get e(){return EPI;},get rocks(){return X.rocks;},get X(){return X;},get mu(){return{MU,AC:getAC()};},get x(){return{REC,RP,PH,paused,LANG:getLang(),guard,CS,CUT,FIN};},get s(){return{heli,sw,hook,surv,aboard,base,state,M,vessels,banner,rogues,SPR};},set hour(v){H=v;envT=-9;},set flash(v){flash=v;},get deb(){return debris;},fin:()=>finStart(surv.find(p=>p.v)),get hook(){return hook;},get F(){return FIN;},set bolt(v){bolt=v;}};

initAudio({
  getState: () => state,
  isPaused: () => paused,
  getMission: () => M,
  getHeli: () => heli,
  getGust: () => gust,
  isCinematic: () => FIN.on || CUT.on || EPI.on,
  isEpiOn: () => EPI.on,
  say,
});

initGamepad({
  getState: () => state,
  isPaused: () => paused,
  getHeli: () => heli,
  getX: () => X,
  isPhotoOn: () => PH.on,
  isReplayOn: () => RP.on,
  isCinematic: () => FIN.on || CUT.on || EPI.on,
  isTitleVisible: () => !$('#title').hidden,
  isCardVisible: () => !$('#card').hidden,
  isBriefDone: () => BRdone,
  getReplaySpeed: () => RP.sp,
  press,
  padLit,
  pauseOpen,
  pauseClose,
  photoOff,
  photoSave,
  photoToggleBar: () => { PH.bar = !PH.bar; $('#photo').hidden = !PH.bar; },
  replayEnd: rpEnd,
  replayCycleSpeed: () => { RP.sp = RP.sp >= 4 ? 1 : RP.sp * 2; $('#rpSpeed').textContent = '×' + RP.sp; },
  cinematicSkip: () => { if (CUT.on) campAdvance(); else if (EPI.on) epiEnd(); },
  titleDismiss: () => showOnly('main'),
  cardSkip,
  briefSkip,
  briefStart: startMission,
  briefBack: () => guard.on || cfgCur.camp != null ? toMain() : toMenu(),
  toMain,
  toMenu,
  onModeChange: () => refreshPadLabels(),
  say,
});

async function boot() {
  await loadLang(getLang());
  buildForm();
  try {
    const s = JSON.parse(localStorage.getItem('rk2') || 'null');
    if (s) setCfg(s);
  } catch (e) {}
  refresh();
  M = buildMission({ ...DEF, side: 'e', ves: 'kayak', deck: 0, hour: 16, dist: 16, birds: '8', wx: 'clear', sea: '1' });
  buildSprites();
  makeBirds();
  makeClouds();
  applyLang(wrap);
  musLabel();
  toMain();
  showOnly('title');
  resize();
  last = performance.now();
  requestAnimationFrame(loop);
}

boot();
