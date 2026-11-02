const fs=require('fs'),vm=require('vm');const ctx={console};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(__dirname+'/../src/tactics.js','utf8')+';globalThis.TAC=TAC;',ctx);const T=ctx.TAC;
const crew=['longshot','drifter','sawbones','tinker'].map((r,i)=>({id:'c'+i,name:'C '+i,role:r,level:2,morale:70}));
let ok=0,bad=[];
for(let seed=1;seed<40;seed++){
 const b=T.create({seed,kind:'combat',site:'x',danger:2,crew,owner:null});
 const [ls,dr,sb,tk]=b.units.filter(u=>u.side==='crew');
 // put an enemy in view of the longshot
 const e=b.units.find(u=>u.side==='enemy'); e.x=ls.x; e.y=Math.max(0,ls.y-6);
 for(let y=e.y+1;y<ls.y;y++) b.cover[T.idx(ls.x,y)]=0;
 b.cover[T.idx(e.x,e.y)]=0;
 const r1=T.shoot(b,ls.id,e.id,'steady'); if(r1) bad.push('steady:'+r1);
 if(T.active(e)){ dr.x=ls.x+1; const r2=T.shoot(b,dr.id,e.id,'quick'); if(r2&&!/No clear shot/.test(r2)) bad.push('quick:'+r2); else if(!r2&&dr.ap!==1) bad.push('quick ap');}
 // down the drifter and revive-shot it
 dr.hp=0;dr.downed=true;dr.bleed=3; sb.x=dr.x; sb.y=Math.min(T.H-1,dr.y+1);
 const r3=T.ability(b,sb.id,'reviveShot',dr.id); if(r3) bad.push('revive:'+r3); else if(dr.downed) bad.push('still down');
 const r4=T.ability(b,tk.id,'turret'); if(r4&&!/No room/.test(r4)) bad.push('turret:'+r4);
 T.endTurn(b); ok++;
}
console.log('ran',ok,'problems',bad.slice(0,8),bad.length);
