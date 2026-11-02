const fs=require('fs'),vm=require('vm');
const ctx={console};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(__dirname+'/../src/tactics.js','utf8')+';globalThis.TAC=TAC;',ctx);
const T=ctx.TAC;
const roles=['recruit','bulwark','longshot','drifter','sawbones','tinker'];
function crew(n,lv){return Array.from({length:n},(_,i)=>({id:'c'+i,name:'Crew '+i,role:lv>1?roles[1+i%5]:'recruit',level:lv,morale:70,look:{}}));}
const stats={};
let errs=0;
for(const kind of ['intro','salvage','rescue','combat','elite','warlord']){
  for(const danger of [1,3,5]){
    const k=kind+danger; stats[k]={};
    for(let i=0;i<60;i++){
      try{
        const owner=kind==='warlord'?{id:'w1',territory:i%3,strength:Math.ceil(danger/2),color:'#a33'}:null;
        const b=T.create({seed:i*7919+danger,kind:kind==='intro'?'combat':kind,site:kind==='intro'?'Old pump station':'x',danger:kind==='intro'?1:danger,crew:crew(kind==='intro'?5:4+(danger>3),kind==='intro'?1:1+Math.floor(danger/2)),owner,scripted:kind==='intro'?'intro':null});
        JSON.parse(JSON.stringify(b));
        const o=T.autoplay(b,40);
        const key=o.outcome+(o.died.length?'/d'+o.died.length:'');
        stats[k][key]=(stats[k][key]||0)+1;
        if(kind==='intro'&&o.died.length<1){stats[k].NODEATH=(stats[k].NODEATH||0)+1;}
      }catch(e){errs++; if(errs<4)console.log(kind,danger,i,e.stack);}
    }
    if(kind==='intro')break;
  }
}
console.log(JSON.stringify(stats,null,0).replace(/\},/g,'},\n'));
console.log('errors',errs);
