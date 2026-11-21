// ---------- vehicles & vessels ----------
export const BAYT=[3,4,3,2,4,4,3,2,3,4,3,2];
export const VES=[['kayak','Kayak'],['zodiac','Lancha neumática'],['sail','Velero'],['fishing','Pesquero'],['yacht','Yate a motor'],['crab','Cangrejero'],['container','Portacontenedores'],['tanker','Petrolero']];
// name, crew capacity, crew range on deck, height profile [x0,x1,h], fire seats, seated crew
export const VT={
  kayak:{n:'kayak',half:18,cap:1,crew:[0,0],prof:[[-18,18,3]],fs:[0],sit:1},
  zodiac:{n:'lancha neumática',half:27,cap:4,crew:[-16,12],prof:[[-26,27,5]],fs:[-6],sit:1},
  raft:{n:'balsa',half:11,cap:4,crew:[-6,6],prof:[[-11,11,4]],fs:[],sit:1},
  sail:{n:'velero',half:46,cap:4,crew:[-40,-22],prof:[[-44,47,8],[-16,20,15]],fs:[2]},
  fishing:{n:'pesquero',half:62,cap:5,crew:[-48,-6],prof:[[-60,63,11],[2,38,34]],fs:[20,-30]},
  yacht:{n:'yate',half:84,cap:6,crew:[-76,-58],prof:[[-80,86,12],[-54,44,26],[-36,18,37]],fs:[-10,30]},
  crab:{n:'cangrejero',half:131,cap:6,crew:[-16,50],prof:[[-128,133,18],[56,118,79],[-118,-46,72],[-46,-22,54]],fs:[86,-70]},
  container:{n:'portacontenedores',half:402,cap:8,crew:[-270,390],prof:[[-400,404,46],[-392,-290,157],[334,404,60],...BAYT.map((t,b)=>[-284+b*51,-234+b*51,46+21*t])],fs:[-340,-110,150]},
  rbmv:{n:'lancha de la Guardia Costera',half:57,cap:4,crew:[-50,-30],prof:[[-57,56,13],[-25,17,29]],fs:[-8]},
  cutter:{n:'guardacostas',half:258,cap:0,crew:[0,0],prof:[[-256,263,32],[-256,-100,35],[-102,92,68],[-32,72,90],[-3,63,108],[180,263,42]],fs:[]},
  tanker:{n:'petrolero',half:362,cap:8,crew:[-262,292],prof:[[-360,364,32],[-356,-262,123],[-280,300,48],[304,364,48]],fs:[-306,0,180]}
};
export const HELIS={
  dolphin:{name:'MH-65 Dolphin',call:'RESCUE 6582',cap:4,fuel:240,acc:270,max:310,half:42,belly:10,gear:3,rotY:-15,rotR:48,spr:'dolphin',door:[-9,-3,12],doorMid:-3,wheels:[[19,8,4],[-6,8,4]],tail:[-52,-3,5,0],lt:{nav:[18,6],tail:[-64,-8],bc:[[-58,-22],[2,10]],st:[-62,-19]}},
  jayhawk:{name:'MH-60T Jayhawk',call:'RESCUE 6025',cap:6,fuel:340,acc:205,max:280,half:50,belly:10,gear:3,rotY:-18,rotR:65,spr:'jayhawk',fixed:1,door:[1,-3,14],doorMid:8,wheels:[[10,5,5],[-58,1,3,7]],tail:[-77,-27,13,1],lt:{nav:[24,6],tail:[-84,-4],bc:[[-66,-22],[-6,10]],st:[-80,-29]}}
};
