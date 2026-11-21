// ---------- synthesised music & SFX (Web Audio API) ----------
import { rnd, pick } from './utils.js';
import { getLang, tr } from './i18n.js';

let AC = null;
export const SN = {};
export const MU = { on: true, play: false, g: null, ses: null, next: 0, bar: 0 };
const MB = 60 / 104;
try { MU.on = localStorage.getItem('rkMus') !== '0'; } catch (e) {}

let deps = {
  getState: () => 'menu',
  isPaused: () => false,
  getMission: () => ({ snd: false, wind: 0, sea: 0 }),
  getHeli: () => null,
  getGust: () => null,
  isCinematic: () => false,
  isEpiOn: () => false,
  say: () => {},
};

export function initAudio(d) {
  deps = { ...deps, ...d };
}

export function getAC() {
  return AC;
}

export function acGet(){if(!AC){try{AC=new(window.AudioContext||window.webkitAudioContext)();}catch(e){AC=null;}}if(AC&&AC.state!=='running'&&AC.resume)AC.resume();return AC;}
export function musInit(){if(!acGet()||MU.g)return;const sr=AC.sampleRate,cp=AC.createDynamicsCompressor();MU.g=AC.createGain();MU.g.gain.value=.5;MU.g.connect(cp);cp.connect(AC.destination);
  const len=sr*3|0,ir=AC.createBuffer(2,len,sr);for(let c=0;c<2;c++){const d=ir.getChannelData(c);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,2.8);}
  MU.rv=AC.createConvolver();MU.rv.buffer=ir;const wet=AC.createGain();wet.gain.value=.5;MU.rv.connect(wet);wet.connect(MU.g);
  MU.nb=AC.createBuffer(1,sr,sr);const d=MU.nb.getChannelData(0);for(let i=0;i<sr;i++)d[i]=Math.random()*2-1;}
const mHz=n=>440*Math.pow(2,(n-69)/12);
function mTone(t,n,d,v,type,cut,att,rel,det=0){const o=AC.createOscillator(),f=AC.createBiquadFilter(),g=AC.createGain();o.type=type;o.frequency.value=mHz(n);o.detune.value=det;f.type='lowpass';f.frequency.value=cut;
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v,t+att);g.gain.setValueAtTime(v,t+Math.max(att,d));g.gain.linearRampToValueAtTime(0,t+Math.max(att,d)+rel);o.connect(f);f.connect(g);g.connect(MU.ses);o.start(t);o.stop(t+Math.max(att,d)+rel+.05);}
function mStr(t,n,d,v,cut=850){mTone(t,n,d,v,'sawtooth',cut,.6,.9,-9);mTone(t,n,d,v,'sawtooth',cut,.6,.9,9);}
function mHorn(t,n,d,v){mTone(t,n,d,v,'sawtooth',1150,.08,.3,-6);mTone(t,n,d,v*.7,'square',720,.1,.3,6);mTone(t,n-12,d,v*.6,'sawtooth',620,.1,.3);}
function mDrum(t,v){const o=AC.createOscillator(),g=AC.createGain();o.frequency.setValueAtTime(96,t);o.frequency.exponentialRampToValueAtTime(40,t+.3);g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.0005,t+1);o.connect(g);g.connect(MU.ses);o.start(t);o.stop(t+1.05);
  const s=AC.createBufferSource(),f=AC.createBiquadFilter(),ng=AC.createGain();s.buffer=MU.nb;f.type='lowpass';f.frequency.value=320;ng.gain.setValueAtTime(v*.8,t);ng.gain.exponentialRampToValueAtTime(.0005,t+.16);s.connect(f);f.connect(ng);ng.connect(MU.ses);s.start(t);s.stop(t+.2);}
function mSnare(t,v){const s=AC.createBufferSource(),f=AC.createBiquadFilter(),g=AC.createGain();s.buffer=MU.nb;f.type='bandpass';f.frequency.value=2100;f.Q.value=.6;g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.0005,t+.1);s.connect(f);f.connect(g);g.connect(MU.ses);s.start(t,Math.random()*.5);s.stop(t+.12);}
function mBell(t,n,v){for(const p of[[.5,.55,7],[1,1,6],[1.19,.6,4.6],[1.5,.4,3.6],[2,.5,3],[2.51,.3,2.2],[2.66,.22,1.8],[3.01,.18,1.4],[4.1,.1,1]]){const o=AC.createOscillator(),g=AC.createGain();o.frequency.value=mHz(n)*p[0];
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v*p[1],t+.004);g.gain.exponentialRampToValueAtTime(.0002,t+p[2]);o.connect(g);g.connect(MU.ses);o.start(t);o.stop(t+p[2]+.05);}}
// the theme: an original cue in the modern blockbuster idiom — a driving string ostinato, low brass swells, big drums, a slow horn melody and a bell, building over four sections
function mPluck(t,n,v,cut=2600){const f=AC.createBiquadFilter(),g=AC.createGain();f.type='lowpass';f.frequency.setValueAtTime(cut,t);f.frequency.exponentialRampToValueAtTime(500,t+.16);
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v,t+.008);g.gain.exponentialRampToValueAtTime(.0006,t+.24);f.connect(g);g.connect(MU.ses);
  for(const d of[-11,10]){const o=AC.createOscillator();o.type='sawtooth';o.frequency.value=mHz(n);o.detune.value=d;o.connect(f);o.start(t);o.stop(t+.27);}}
function mBraam(t,n,d,v){const f=AC.createBiquadFilter(),g=AC.createGain();f.type='lowpass';f.Q.value=1.2;f.frequency.setValueAtTime(140,t);f.frequency.exponentialRampToValueAtTime(1100,t+d*.45);f.frequency.exponentialRampToValueAtTime(260,t+d);
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v,t+.12);g.gain.setValueAtTime(v,t+d*.55);g.gain.linearRampToValueAtTime(0,t+d+.5);f.connect(g);g.connect(MU.ses);
  for(const q of[[0,-14],[0,13],[12,-6],[12,7],[7,0],[-12,0]]){const o=AC.createOscillator();o.type=q[0]===-12?'square':'sawtooth';o.frequency.value=mHz(n+q[0]);o.detune.value=q[1];o.connect(f);o.start(t);o.stop(t+d+.6);}}
function mTaiko(t,v,hi){const o=AC.createOscillator(),g=AC.createGain();o.frequency.setValueAtTime(hi?150:105,t);o.frequency.exponentialRampToValueAtTime(hi?70:38,t+.22);g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.0005,t+(hi?.5:1.1));o.connect(g);g.connect(MU.ses);o.start(t);o.stop(t+1.2);
  const s=AC.createBufferSource(),f=AC.createBiquadFilter(),ng=AC.createGain();s.buffer=MU.nb;f.type='lowpass';f.frequency.value=hi?900:380;ng.gain.setValueAtTime(v*.9,t);ng.gain.exponentialRampToValueAtTime(.0005,t+.14);s.connect(f);f.connect(ng);ng.connect(MU.ses);s.start(t);s.stop(t+.18);}
const MC={Dm:[38,62,65,69],Bb:[34,62,65,70],F:[29,60,65,69],C:[36,60,64,67],Gm:[31,62,67,70],A:[33,61,64,69]};
const MPA=['Dm','Dm','Bb','Bb','F','F','C','C'],MPB=['Dm','Dm','Bb','Bb','Gm','Gm','A','A'],MOS=[0,2,1,2,0,2,1,2];
const MMEL=[[[0,69,3],[3,72,1]],[[0,74,4]],[[0,74,2],[2,72,1],[3,70,1]],[[0,72,3],[3,70,1]],[[0,69,3],[3,72,1]],[[0,77,4]],[[0,76,2],[2,74,1],[3,72,1]],[[0,76,3.8]],
  [[0,74,3],[3,77,1]],[[0,81,4]],[[0,82,2],[2,81,1],[3,77,1]],[[0,74,4]],[[0,79,2],[2,77,1],[3,74,1]],[[0,70,2],[2,74,2]],[[0,73,2],[2,76,2]],[[0,81,3.6]]];
function musBar(b,t){const B=MB,sec=b>>3,k=b&7,c=MC[(sec&1?MPB:MPA)[k]],lv=[.5,.75,.9,1][sec];
  // bass and pad
  mTone(t,c[0],4*B,.17,'sawtooth',210,.2,.4);mTone(t,c[0]-12,4*B,.2,'sine',300,.2,.4);
  for(let i=1;i<4;i++)mStr(t,c[i]-12,4*B-.2,sec?.045:.06,sec>2?1200:800);
  if(sec===3)for(let i=1;i<4;i++)mStr(t,c[i]+12,4*B-.2,.026,2300);
  // string ostinato in eighths, with a pulsing bass under it once the cue is moving
  if(sec>=1||k>=4)for(let i=0;i<8;i++){const acc=i%4===0?1:i%2===0?.8:.6,v=(sec?.085:.045)*acc*lv;mPluck(t+i*B/2,c[1+MOS[i]],v,sec>1?3200:2200);if(sec>=2)mPluck(t+i*B/2,c[1+MOS[i]]+12,v*.5,3600);
    if(sec>=1)mTone(t+i*B/2,c[0]+12,.12,.1*acc,'sawtooth',340,.01,.1);}
  if(sec===3)for(let i=0;i<8;i++)mPluck(t+i*B/2+B/4,c[1+MOS[(i+1)%8]],.035,3000);
  // horns carry the tune in the last two sections
  if(sec>=2)for(const m of MMEL[(sec-2)*8+k]){mHorn(t+m[0]*B,m[1],m[2]*B-.1,sec===3?.13:.11);if(sec===3)mTone(t+m[0]*B,m[1]+12,m[2]*B-.1,.03,'sawtooth',2600,.25,.4,7);}
  // low brass swell at the top of each phrase
  if(sec>=1&&k%4===0)mBraam(t,c[0],3.2*B,sec===1?.07:.1);
  // drums
  if(sec===0){if(k%4===0)mTaiko(t,.45);}
  else{const pat=sec===1?[[0,.6],[1.5,.3],[2.5,.3],[3,.4]]:[[0,.7],[.75,.3],[1.5,.42],[2,.55],[2.75,.3],[3.5,.42]];for(const q of pat)mTaiko(t+q[0]*B,q[1]*lv);
    if(sec>=2)for(const q of[1,3])mTaiko(t+q*B,.22,1);
    if(sec===3)for(let i=0;i<16;i++)if(i%4)mSnare(t+i*B/4,i%2?.03:.05);}
  if(k===7&&sec>=1)for(let i=0;i<16;i++)mSnare(t+i*B/4,.015+i*.007);
  if(k===7&&sec===3)for(let i=0;i<4;i++)mTaiko(t+(3+i/4)*B,.3+i*.1,1);
  // the bell
  if(k===0)mBell(t,62,sec===2?.3:.24);else if(sec===0&&k%2===0)mBell(t,k===4?69:62,.14);else if(k===4)mBell(t,69,.12);}
export function musSync(){const want=MU.on&&!window.rkIntro&&(deps.getState()==='menu'||deps.getState()==='replay'||deps.isEpiOn());
  if(!want){if(MU.play){MU.play=false;const s=MU.ses,t=AC.currentTime;s.gain.cancelScheduledValues(t);s.gain.setTargetAtTime(0,t,.18);setTimeout(()=>s.disconnect(),1500);}return;}
  if(!MU.g||AC.state!=='running')return;const t=AC.currentTime;
  if(!MU.play){MU.play=true;MU.ses=AC.createGain();MU.ses.gain.setValueAtTime(0,t);MU.ses.gain.linearRampToValueAtTime(1,t+1.2);MU.ses.connect(MU.g);MU.ses.connect(MU.rv);MU.bar=0;MU.next=t+.15;}
  if(MU.next<t-.05)MU.next=t+.1;
  while(MU.next<t+.5){musBar(MU.bar,MU.next);MU.next+=4*MB;MU.bar=MU.bar>=31?8:MU.bar+1;}}
export function musLabel(){const b=document.querySelector('#mMus');if(b)b.textContent=tr('Música: '+(MU.on?'activada':'desactivada'));const l=document.querySelector('#mLang');if(l)l.textContent=getLang()==='es'?'Idioma: Español':'Language: English';}
for(const ev of['pointerdown','touchend','click','keydown'])addEventListener(ev,()=>{if(MU.on&&deps.getState()==='menu')musInit();else if(AC&&AC.state!=='running'&&AC.resume)AC.resume();},true);
// --- synthesised sound: rotor, turbine, wind, sea, alarms
export function sndInit(){if(!deps.getMission().snd){if(SN.master)SN.master.gain.value=0;return;}
  if(SN.master){SN.master.gain.value=SN.vol;AC.resume&&AC.resume();return;}
  if(!acGet())return;
  const nb=AC.createBuffer(1,AC.sampleRate*2,AC.sampleRate),d=nb.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
  SN.nb=nb;SN.vol=.55;SN.master=AC.createGain();SN.master.gain.value=SN.vol;SN.master.connect(AC.destination);
  const mkN=(type,f,q)=>{const s=AC.createBufferSource();s.buffer=nb;s.loop=true;const fl=AC.createBiquadFilter();fl.type=type;fl.frequency.value=f;fl.Q.value=q;const g=AC.createGain();g.gain.value=0;s.connect(fl);fl.connect(g);g.connect(SN.master);s.start();return g;};
  SN.rot=mkN('lowpass',420,1);SN.wind=mkN('bandpass',700,.6);SN.sea=mkN('lowpass',300,.5);
  const lfo=AC.createOscillator();lfo.type='sawtooth';lfo.frequency.value=17;const lg=AC.createGain();lg.gain.value=.1;lfo.connect(lg);lg.connect(SN.rot.gain);lfo.start();SN.lfo=lfo;
  const o=AC.createOscillator();o.type='sawtooth';o.frequency.value=900;const of=AC.createBiquadFilter();of.type='bandpass';of.frequency.value=1800;SN.whine=AC.createGain();SN.whine.gain.value=0;o.connect(of);of.connect(SN.whine);SN.whine.connect(SN.master);o.start();}
export function radioTx(dur=1.4,vol=.05,pitch=130){return;if(!SN.master||!deps.getMission().snd||!SN.vol)return;const t0=AC.currentTime+.02,out=AC.createGain();out.gain.value=vol;out.connect(SN.master);
  const hp=AC.createBiquadFilter();hp.type='highpass';hp.frequency.value=420;const lp=AC.createBiquadFilter();lp.type='lowpass';lp.frequency.value=2700;hp.connect(lp);lp.connect(out);
  const ws=AC.createWaveShaper(),cv=new Float32Array(256);for(let i=0;i<256;i++){const x=i/128-1;cv[i]=Math.tanh(x*4);}ws.curve=cv;ws.connect(hp);
  const o=AC.createOscillator();o.type='sawtooth';const f1=AC.createBiquadFilter(),f2=AC.createBiquadFilter();f1.type=f2.type='bandpass';f1.Q.value=5;f2.Q.value=7;const vg=AC.createGain();vg.gain.value=0;
  o.connect(f1);o.connect(f2);f1.connect(vg);f2.connect(vg);vg.connect(ws);const VW_=[[700,1200],[400,2000],[300,2500],[500,900],[350,750],[600,1700]];
  let t=t0+.07;const end=t0+.07+dur;while(t<end){const syl=rnd(.07,.17),v=pick(VW_);o.frequency.setValueAtTime(pitch*rnd(.85,1.3),t);f1.frequency.setValueAtTime(v[0],t);f2.frequency.setValueAtTime(v[1],t);
    vg.gain.setValueAtTime(0,t);vg.gain.linearRampToValueAtTime(rnd(.5,1),t+.02);vg.gain.linearRampToValueAtTime(0,t+syl);t+=syl+(Math.random()<.22?rnd(.08,.2):.015);}
  o.start(t0);o.stop(end+.05);
  const n=AC.createBufferSource();n.buffer=SN.nb;n.loop=true;const nf=AC.createBiquadFilter();nf.type='bandpass';nf.frequency.value=1900;nf.Q.value=.7;const ng=AC.createGain();
  ng.gain.setValueAtTime(0,t0);ng.gain.linearRampToValueAtTime(.9,t0+.012);ng.gain.setTargetAtTime(.1,t0+.05,.02);ng.gain.setValueAtTime(.1,end);ng.gain.linearRampToValueAtTime(.8,end+.015);ng.gain.setTargetAtTime(0,end+.11,.025);
  n.connect(nf);nf.connect(ng);ng.connect(hp);n.start(t0);n.stop(end+.4);}
export function beep(f,d,v=.12,type='square'){if(!SN.master||!deps.getMission().snd)return;const o=AC.createOscillator(),g=AC.createGain();o.type=type;o.frequency.value=f;g.gain.value=v;g.gain.setTargetAtTime(0,AC.currentTime+d,.02);o.connect(g);g.connect(SN.master);o.start();o.stop(AC.currentTime+d+.2);}
export function boomSnd(v){if(!SN.master||!deps.getMission().snd)return;const s=AC.createBufferSource();s.buffer=SN.nb;const f=AC.createBiquadFilter();f.type='lowpass';f.frequency.value=260;const g=AC.createGain();g.gain.value=v*.9;g.gain.setTargetAtTime(0,AC.currentTime+.05,.35);s.connect(f);f.connect(g);g.connect(SN.master);s.start();s.stop(AC.currentTime+2);}
export function sndUpdate(){if(!AC||!SN.rot)return;const h=deps.getHeli(),on=deps.getState()==='play'&&!deps.isPaused()&&h&&!h.dead,t=AC.currentTime;
  if(on&&!h.landed&&!deps.isCinematic()){if(SN.rdT==null||SN.rdT-t>60)SN.rdT=t+rnd(8,18);if(t>SN.rdT){SN.rdT=t+rnd(14,34);radioTx(rnd(.8,2.2),.022,pick([95,120,150,180]));if(Math.random()<.4)setTimeout(()=>deps.getState()==='play'&&!deps.isPaused()&&radioTx(rnd(.5,1.2),.02,pick([100,140,170])),2600);}}
  {const pk=on?(h.landed?h.rpm:1):0;SN.rot.gain.setTargetAtTime(.16*pk,t,.1);SN.whine.gain.setTargetAtTime(.012*Math.max(pk,on&&(h.e1||h.e2)?.5:0),t,.1);}SN.lfo.frequency.setTargetAtTime(17+(on?Math.abs(h.vy)/60:0),t,.1);
  SN.wind.gain.setTargetAtTime(on?Math.min(.085,Math.abs(deps.getMission().wind)/1300+(deps.getGust()?.05:0)+Math.abs(h.vx)/8000):0,t,.2);
  SN.sea.gain.setTargetAtTime(deps.getState()==='play'&&!deps.isPaused()?(.012+deps.getMission().sea*.008)*(on&&h.y>-250?1:.5):0,t,.3);}
export function xMute(){if(!SN.master)return;SN.vol=SN.vol?0:.55;SN.master.gain.value=SN.vol;deps.say(SN.vol?'Sonido activado.':'Sonido silenciado.',2);}
export function c130Snd(dur){if(!deps.getMission().snd||!acGet())return;const t=AC.currentTime,g=AC.createGain(),f=AC.createBiquadFilter();f.type='lowpass';f.frequency.value=560;
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.34,t+dur*.42);g.gain.linearRampToValueAtTime(.2,t+dur*.6);g.gain.linearRampToValueAtTime(0,t+dur);f.connect(g);g.connect(SN.master||AC.destination);
  for(const q of[[82,-9],[82,8],[123,3],[164,-4]]){const o=AC.createOscillator();o.type='sawtooth';o.frequency.setValueAtTime(q[0]*1.12,t);o.frequency.linearRampToValueAtTime(q[0]*1.1,t+dur*.4);o.frequency.linearRampToValueAtTime(q[0]*.9,t+dur*.6);o.detune.value=q[1];o.connect(f);o.start(t);o.stop(t+dur+.1);}
  const l=AC.createOscillator(),lg=AC.createGain();l.frequency.value=68;lg.gain.value=.1;l.connect(lg);lg.connect(g.gain);l.start(t);l.stop(t+dur+.1);
  if(SN.nb){const n=AC.createBufferSource(),nf=AC.createBiquadFilter(),ng=AC.createGain();n.buffer=SN.nb;n.loop=true;nf.type='lowpass';nf.frequency.value=900;ng.gain.value=.5;n.connect(nf);nf.connect(ng);ng.connect(g);n.start(t);n.stop(t+dur+.1);}}
