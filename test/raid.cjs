const fs=require('fs'),vm=require('vm');const ctx={console};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(__dirname+'/../src/tactics.js','utf8')+';globalThis.TAC=TAC;',ctx);const T=ctx.TAC;
const roles=['bulwark','longshot','drifter','sawbones','tinker','recruit'];
const rooms=[{id:'r3',name:'Guest Rooms',col:2,w:2},{id:'r4',name:'Bar & Kitchen',col:4,w:2},{id:'r9',name:'Card Room',col:6,w:2}];
let errs=0; const st={};
for(const wp of [0.5,2,4]) for(const style of ['frontal assault','siege','sabotage']) for(const n of [3,5]){
  const k=`wall${wp}/${style}/${n}def`; st[k]={};
  for(let i=0;i<40;i++){ try{
    const crew=Array.from({length:n},(_,j)=>({id:'c'+j,name:'C '+j,role:roles[j%6],level:2,morale:70}));
    const b=T.create({seed:i*31+n,kind:'raid',site:'The waystation',crew,owner:{id:'w1',name:'Mags',territory:i%3,strength:1,color:'#a33'},style,count:5,
      base:{rooms,wallPower:wp,towers:[1,8],towerCrew:['c0','c1']}});
    JSON.parse(JSON.stringify(b));
    const o=T.autoplay(b,30);
    const key=o.outcome+' wrecked'+o.wrecked.length+(o.died.length?' d'+o.died.length:'');
    st[k][key]=(st[k][key]||0)+1;
  }catch(e){errs++; if(errs<3)console.log(e.stack);} }
}
for(const [k,v] of Object.entries(st)) console.log(k.padEnd(32), JSON.stringify(Object.entries(v).sort((a,b)=>b[1]-a[1]).slice(0,5)));
console.log('errors',errs);
