(function(){
var g=document.getElementById('devGate'),sp=document.getElementById('epsSplash');
var EVS=['keydown','keyup','pointerdown','pointerup','touchstart','touchend','mousedown','mouseup','click'];
function block(e){if(g.isConnected&&!g.contains(e.target)){e.stopImmediatePropagation();e.preventDefault();}}
EVS.forEach(function(t){addEventListener(t,block,true);g.addEventListener(t,function(e){e.stopPropagation();});});

// ---- logo sting: a rising whoosh, a deep hit as the symbol lands, a soft chime on the name, a rumble as the doors part
var AC=null,OUT=null,PADG=null,muted=false;try{muted=localStorage.getItem('rkMus')==='0';}catch(e){}
function noise(sec){var b=AC.createBuffer(1,Math.ceil(AC.sampleRate*sec),AC.sampleRate),d=b.getChannelData(0);for(var k=0;k<d.length;k++)d[k]=Math.random()*2-1;var s=AC.createBufferSource();s.buffer=b;return s;}
function env(gn,t,a,peak,rel){gn.gain.setValueAtTime(0.0001,t);gn.gain.exponentialRampToValueAtTime(peak,t+a);gn.gain.exponentialRampToValueAtTime(0.0001,t+a+rel);}
function audioStart(){if(muted)return;try{AC=new(window.AudioContext||window.webkitAudioContext)();if(AC.state!=='running'){try{AC.close();}catch(e){}AC=null;return;}var cp=AC.createDynamicsCompressor();OUT=AC.createGain();OUT.gain.value=.8;OUT.connect(cp);cp.connect(AC.destination);
  var t=AC.currentTime;
  var w=noise(1.3),bp=AC.createBiquadFilter(),wg=AC.createGain();bp.type='bandpass';bp.Q.value=1.4;bp.frequency.setValueAtTime(260,t+.2);bp.frequency.exponentialRampToValueAtTime(2600,t+1.3);
  wg.gain.setValueAtTime(0.0001,t+.2);wg.gain.exponentialRampToValueAtTime(.16,t+1.22);wg.gain.exponentialRampToValueAtTime(0.0001,t+1.42);w.connect(bp);bp.connect(wg);wg.connect(OUT);w.start(t+.2);w.stop(t+1.5);
  var o=AC.createOscillator(),og=AC.createGain();o.type='sine';o.frequency.setValueAtTime(78,t+1.25);o.frequency.exponentialRampToValueAtTime(34,t+2.6);env(og,t+1.25,.015,.55,1.9);o.connect(og);og.connect(OUT);o.start(t+1.25);o.stop(t+3.3);
  var h=noise(.6),lp=AC.createBiquadFilter(),hg=AC.createGain();lp.type='lowpass';lp.frequency.value=900;env(hg,t+1.25,.01,.22,.45);h.connect(lp);lp.connect(hg);hg.connect(OUT);h.start(t+1.25);h.stop(t+1.9);
  // a hall reverb built from decaying noise, shared by the hit and the swell
  var rl=Math.floor(AC.sampleRate*3.2),ir=AC.createBuffer(2,rl,AC.sampleRate);for(var ch=0;ch<2;ch++){var dd=ir.getChannelData(ch);for(var q=0;q<rl;q++)dd[q]=(Math.random()*2-1)*Math.pow(1-q/rl,3.2);}
  var RV=AC.createConvolver(),rg=AC.createGain();RV.buffer=ir;rg.gain.value=.55;RV.connect(rg);rg.connect(OUT);og.connect(RV);
  // the name lands on a low, slow brass-and-strings swell in D minor: detuned saws through a filter that opens and closes
  PADG=AC.createGain();PADG.gain.value=1;PADG.connect(OUT);PADG.connect(RV);
  var lpf=AC.createBiquadFilter();lpf.type='lowpass';lpf.Q.value=.7;lpf.frequency.setValueAtTime(220,t+1.5);lpf.frequency.exponentialRampToValueAtTime(1500,t+3.3);lpf.frequency.exponentialRampToValueAtTime(420,t+6.2);lpf.connect(PADG);
  var pg=AC.createGain();pg.gain.setValueAtTime(0.0001,t+1.5);pg.gain.exponentialRampToValueAtTime(.16,t+3.1);pg.gain.setValueAtTime(.16,t+4.4);pg.gain.exponentialRampToValueAtTime(0.0001,t+6.4);pg.connect(lpf);
  [73.42,110,146.83,174.61,220].forEach(function(f,k){[-6,6].forEach(function(dt){var o2=AC.createOscillator(),g2=AC.createGain();o2.type='sawtooth';o2.frequency.value=f;o2.detune.value=dt+(k%2?3:-3);g2.gain.value=k===0?.5:k===4?.22:.32;o2.connect(g2);g2.connect(pg);o2.start(t+1.5);o2.stop(t+6.6);});});
  var sub=AC.createOscillator(),sg=AC.createGain();sub.type='sine';sub.frequency.value=36.71;sg.gain.setValueAtTime(0.0001,t+1.5);sg.gain.exponentialRampToValueAtTime(.22,t+2.8);sg.gain.exponentialRampToValueAtTime(0.0001,t+6.2);sub.connect(sg);sg.connect(PADG);sub.start(t+1.5);sub.stop(t+6.4);
 }catch(e){AC=null;}}
function rumble(){if(!AC)return;try{var t=AC.currentTime,n=noise(1.8),lp=AC.createBiquadFilter(),ng=AC.createGain();lp.type='lowpass';lp.frequency.setValueAtTime(140,t);lp.frequency.linearRampToValueAtTime(320,t+1.1);
  ng.gain.setValueAtTime(0.0001,t);ng.gain.exponentialRampToValueAtTime(.3,t+.35);ng.gain.exponentialRampToValueAtTime(0.0001,t+1.7);n.connect(lp);lp.connect(ng);ng.connect(OUT);n.start(t);n.stop(t+1.8);
  setTimeout(function(){try{AC.close();}catch(e){}},3200);}catch(e){}}

// ---- floating blue dust behind the logo
var raf=0;function dust(){var c=document.getElementById('esDust'),x=c.getContext('2d'),d=Math.min(devicePixelRatio||1,2),P=[],W,H;
  function rs(){W=c.width=Math.round(innerWidth*d);H=c.height=Math.round(innerHeight*d);}rs();addEventListener('resize',rs);
  for(var k=0;k<80;k++)P.push({x:Math.random(),y:Math.random(),r:(Math.random()*1.6+.4),v:Math.random()*.018+.006,p:Math.random()*6.3,h:Math.random()<.3});
  var t0=performance.now();(function f(now){var t=(now-t0)/1000;x.clearRect(0,0,W,H);
    for(var k=0;k<P.length;k++){var q=P[k],y=((q.y-t*q.v)%1+1)%1,a=Math.min(1,t/1.5)*(.25+.35*Math.sin(t*1.7+q.p)+.3);
      x.fillStyle=q.h?'rgba(170,140,255,'+a.toFixed(3)+')':'rgba(110,165,255,'+a.toFixed(3)+')';x.beginPath();x.arc((q.x+Math.sin(t*.4+q.p)*.01)*W,y*H,q.r*d,0,6.283);x.fill();}
    raf=requestAnimationFrame(f);})(t0);}

// ---- timeline
var T=[],phase=0;function at(ms,fn){T.push(setTimeout(fn,ms));}
function sblock(e){if(!sp.isConnected)return;e.stopImmediatePropagation();if(e.cancelable)e.preventDefault();if((e.type==='pointerdown'||e.type==='keydown')&&phase===1)skip();}
function exitLogo(fast){phase=2;sp.classList.add('out');at(fast?380:720,openDoors);}
function openDoors(){phase=3;window.rkIntro=0;sp.classList.add('open');rumble();var tt=document.getElementById('title');if(tt)tt.classList.add('ttl-in');at(1450,finish);}
function finish(){phase=4;cancelAnimationFrame(raf);sp.remove();EVS.forEach(function(t){removeEventListener(t,sblock,true);});}
function skip(){T.forEach(clearTimeout);T=[];if(AC&&PADG){try{PADG.gain.setTargetAtTime(0,AC.currentTime,.15);}catch(e){}}exitLogo(true);}
function splash(){sp.hidden=false;EVS.forEach(function(t){addEventListener(t,sblock,{capture:true,passive:false});});audioStart();
  void sp.offsetWidth;sp.classList.add('es-go');phase=1;at(4900,function(){exitLogo(false);});}

// ---- full screen on phones: Android and iPad go full screen on a tap; iPhone cannot, so the first time it explains how to add the game to the home screen
function go(){EVS.forEach(function(t){removeEventListener(t,block,true);});splash();g.classList.add('bye');setTimeout(function(){g.remove();},460);}
var UA=navigator.userAgent,iOS=/iPhone|iPad|iPod/.test(UA)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1),
  mobile=iOS||/Android|Mobi/i.test(UA),standalone=navigator.standalone===true||(window.matchMedia&&matchMedia('(display-mode: standalone)').matches)||(window.matchMedia&&matchMedia('(display-mode: fullscreen)').matches),
  DE=document.documentElement,canFS=!!(DE.requestFullscreen||DE.webkitRequestFullscreen)&&document.fullscreenEnabled!==false&&document.webkitFullscreenEnabled!==false,fsT=0;
function isFS(){return !!(document.fullscreenElement||document.webkitFullscreenElement);}
function fsTry(){if(!mobile||standalone||!canFS||isFS()||Date.now()-fsT<2500)return;fsT=Date.now();try{var p=(DE.requestFullscreen||DE.webkitRequestFullscreen).call(DE,{navigationUI:'hide'});if(p&&p.catch)p.catch(function(){});}catch(e){}}
addEventListener('pointerup',fsTry,true);
function needA2HS(){if(!iOS||standalone||canFS)return false;try{if(localStorage.getItem('rkA2HS'))return false;localStorage.setItem('rkA2HS','1');}catch(e){}return true;}
function showA2HS(done){var d=document.createElement('div');d.id='a2hs';
  d.innerHTML='<div class="ah"><svg class="ah-i" viewBox="0 0 96 96" aria-hidden="true"><defs><linearGradient id="ahG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4aa3ff"/><stop offset="1" stop-color="#2a5bff"/></linearGradient></defs>'+
  '<rect x="27" y="10" width="42" height="76" rx="9" fill="none" stroke="#fff" stroke-width="3.5"/><rect x="41" y="15" width="14" height="3" rx="1.5" fill="#fff"/>'+
  '<rect x="32" y="23" width="32" height="56" rx="3" fill="url(#ahG)" opacity=".18"/>'+
  '<g fill="none" stroke="url(#ahG)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M37 40v-9h9M59 40v-9h-9M37 62v9h9M59 62v9h-9"/></g></svg><h2>Juega a pantalla completa</h2>'+
  '<p class="ah-p">Añade <b style="color:#fff">Search &amp; Rescue: Kodiak</b> a tu pantalla de inicio. Se abrirá siempre a pantalla completa, sin las barras del navegador.</p>'+
  '<ol><li><span class="n">1</span><span>Toca el botón <b>Compartir</b> del navegador.</span><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5"/><path d="M8 10H6a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1h-2"/></svg></li>'+
  '<li><span class="n">2</span><span>Elige <b>Añadir a pantalla de inicio</b>.</span><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M12 8v8M8 12h8"/></svg></li>'+
  '<li><span class="n">3</span><span>Abre el juego desde su <b>icono</b>.</span><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/></svg></li></ol>'+
  '<button type="button" id="ahOk">Entendido</button><p class="ah-s">Este aviso solo aparece la primera vez.</p></div>';
  g.appendChild(d);void d.offsetWidth;d.classList.add('on');document.getElementById('ahOk').onclick=function(){d.classList.remove('on');setTimeout(function(){d.remove();},350);done();};}

// ---- start: on the first visit from an iPhone the home-screen tip comes first (its button also unlocks the logo's sound); otherwise the logo plays at once
if(needA2HS())showA2HS(go);else go();
(function gpSplash(){var prev=[];function poll(){if(phase>=4)return;if(navigator.getGamepads){var list=navigator.getGamepads();if(list){for(var i=0;i<list.length;i++){var gp=list[i];if(!gp||!gp.connected)continue;var p=prev[i]||(prev[i]=[]),hit=false;for(var b=0;b<gp.buttons.length;b++){var on=!!(gp.buttons[b]&&(gp.buttons[b].pressed||gp.buttons[b].value>.5));if(on&&!p[b])hit=true;p[b]=on;}if(hit){var ok=document.getElementById('ahOk');if(ok){ok.click();}else if(phase===1){skip();}}}}}requestAnimationFrame(poll);}if(navigator.getGamepads)requestAnimationFrame(poll);})();})();
