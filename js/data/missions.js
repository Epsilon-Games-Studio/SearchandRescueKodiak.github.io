// ---------- mission planner constants & presets ----------
import { VES } from './vehicles.js';

export const NM=480,WX=-770,WXS=WX-120,overSea=x=>x>340||x<WXS;
export function groundY(x){return x<WXS?1e9:x<WX?6-46*(x-WXS)/120:x<220?-40:x<340?-40+46*(x-220)/120:1e9;}
export const RA=['random','Aleatorio'];
export const FIELDS=[
  ['Aeronave',[
    ['heli','Helicóptero','s',[['dolphin','MH-65 Dolphin · 4 plazas, ágil'],['jayhawk','MH-60T Jayhawk · 6 plazas, más alcance']],'jayhawk'],
    ['mode','Despliegue del nadador','s',[['jump','Salto libre desde la puerta'],['hoist','Bajada con la grúa']],'jump'],
    ['fuel','Combustible','s',[['1','Depósitos llenos'],['.6','Reducido'],['0','Ilimitado']],'1'],
    ['flares','Bengalas','r',0,12,6,'']]],
  ['Siniestro',[
    ['ves','Embarcación principal','s',[RA,...VES],'fishing'],
    ['cond','Avería','s',[RA,['drift','A la deriva'],['list','Escorada'],['fire','Incendio a bordo'],['sink','Hundiéndose'],['both','Incendio y hundimiento']],'drift'],
    ['deck','Tripulantes en cubierta','r',0,8,3,''],
    ['water','Náufragos en el agua','r',0,6,0,''],
    ['rafts','Balsas salvavidas','r',0,3,0,''],
    ['per','Ocupantes por balsa','r',1,4,2,''],
    ['ves2','Segunda embarcación','s',[['none','Ninguna'],RA,...VES],'none'],
    ['dist','Distancia desde Kodiak','r',4,32,7,' NM']]],
  ['Mar y cielo',[
    ['hour','Hora de salida','r',0,23,11,':00'],
    ['cycle','Ciclo día / noche','s',[['0','Detenido'],['1','1 hora por minuto'],['4','4 horas por minuto']],'1'],
    ['sea','Estado del mar','s',[RA,['0','Calma'],['1','Marejada'],['2','Fuerte marejada'],['3','Mar gruesa'],['4','Temporal']],'1'],
    ['rogue','Olas gigantes','s',[['0','Nunca'],['1','Ocasionales'],['2','Frecuentes']],'1'],
    ['wind','Viento','r',0,60,15,' kt'],
    ['gust','Ráfagas de viento','s',[['0','Ninguna'],['1','Flojas'],['2','Moderadas'],['3','Fuertes'],['4','Violentas']],'1'],
    ['wdir','Dirección del viento','s',[['w','Del oeste (te empuja mar adentro)'],['e','Del este (te empuja a tierra)']],'w'],
    ['wx','Meteorología','s',[RA,['clear','Despejado'],['cloud','Nublado'],['rain','Lluvia'],['storm','Tormenta eléctrica'],['fog','Niebla'],['snow','Nevada']],'clear'],
    ['dyn','Meteorología dinámica','s',[['1','Sí: a veces cambia en vuelo'],['0','No']],'1'],
    ['temp','Temperatura del agua','s',[['.6','Fresca (aguantan más)'],['1','Fría'],['1.6','Gélida (aguantan poco)']],'1'],
    ['birds','Aves marinas','s',[['0','Ninguna'],['8','Algunas'],['20','Muchas']],'8']]],
  ['Dificultad y emergencias',[
    ['search','Localización del siniestro','s',[['0','Posición exacta'],['1','Zona aproximada'],['2','Sin posición: búsqueda']],'0'],
    ['fail','Averías del helicóptero','s',[['0','Ninguna'],['1','Posibles'],['2','Frecuentes']],'0'],
    ['triage','Víctimas','s',[['0','Todas ilesas'],['1','Heridos, niños e inconscientes']],'0'],
    ['panic','Pánico entre los náufragos','s',[['0','No'],['1','Sí']],'0'],
    ['trapped','Atrapados dentro del barco','r',0,2,0,''],
    ['boom','Explosiones y fuego en el agua','s',[['0','No'],['1','Sí (si hay incendio)']],'0'],
    ['obst','Obstáculos','s',[['none','Ninguno'],['ship','Barco que acude a ayudar']],'none'],
    ['side','Rumbo de la misión','s',[['random','Aleatorio'],['e','Este, mar abierto'],['w','Oeste, pasando el pueblo de Kodiak']],'random'],
    ['land','Regreso','s',[['base','Kodiak despejado'],['fog','Kodiak con niebla'],['cutter','Guardacostas en la mar']],'base'],
    ['snd','Sonido','s',[['1','Sí'],['0','No']],'1']]],
  ['Ayudas',[
    ['aids','Flechas de rumbo y distancia','s',[['1','Sí'],['0','No']],'1'],
    ['bars','Barras de vida de las víctimas','s',[['1','Sí'],['0','No']],'1'],
    ['crash','Daños','s',[['1','Realistas'],['0','Sin colisiones']],'1']]]
];
export const PRESETS=[
  ['Pesquero a la deriva',{ves:'fishing',cond:'drift',deck:3,water:0,rafts:0,ves2:'none',dist:7,hour:11,sea:'1',wind:15,wx:'clear',rogue:'0'}],
  ['Fuego a bordo',{ves:'fishing',cond:'fire',deck:2,water:2,rafts:0,ves2:'none',dist:8,hour:19,sea:'2',wind:20,wx:'cloud',rogue:'1'}],
  ['Velero desarbolado',{ves:'sail',cond:'drift',deck:0,water:1,rafts:1,per:2,ves2:'none',dist:8,hour:23,sea:'2',wind:28,wx:'clear',rogue:'1'}],
  ['Hombre al agua',{ves:'crab',cond:'drift',deck:0,water:2,rafts:0,ves2:'none',dist:9,hour:6,sea:'3',wind:35,wx:'rain',rogue:'1',gust:'2'}],
  ['Portacontenedores hundiéndose',{ves:'container',cond:'sink',deck:4,water:0,rafts:1,per:2,ves2:'none',dist:10,hour:22,sea:'4',wind:50,wx:'storm',rogue:'2',gust:'3'}],
  ['Petrolero en llamas',{ves:'tanker',cond:'fire',deck:4,water:2,rafts:0,ves2:'zodiac',dist:11,hour:15,sea:'2',wind:25,wx:'cloud',rogue:'1'}],
  ['Kayakista en la niebla',{ves:'kayak',cond:'drift',deck:1,water:0,rafts:0,ves2:'none',dist:6,hour:8,sea:'1',wind:8,wx:'fog',rogue:'0'}],
  ['Yate escorado al anochecer',{ves:'yacht',cond:'list',deck:5,water:1,rafts:0,ves2:'none',dist:9,hour:20,sea:'3',wind:30,wx:'snow',rogue:'1'}]
];
export const DEF=Object.fromEntries(FIELDS.flatMap(([,items])=>items.map(it=>[it[0],it[2]==='s'?it[4]:it[5]])));

