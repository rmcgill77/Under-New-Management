const fs=require('fs'),vm=require('vm');
const ctx={console};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(__dirname+'/../src/rules.js','utf8')+fs.readFileSync(__dirname+'/../src/tactics.js','utf8')+';globalThis.UNM=UNM;',ctx);
const U=ctx.UNM;let fails=0;
function play(seed,days){
  const s=U.newGame(seed);
  // tutorial path
  for(const r of s.rooms.filter(r=>r.free)) U.repairRoom(s,r.id);
  const jobs=[['generator'],['water_pump'],['bar'],['guest_room']];
  const crew=s.crew;
  jobs.forEach(([t],i)=>U.assignJob(s,crew[i].id,s.rooms.find(r=>r.type===t).id));
  const smart=(s)=>{
    for(const t of ['wall','watchtower','food']) for(const r of s.rooms.filter(r=>r.type===t&&(r.state==='ruined'||r.state==='damaged'))) U.repairRoom(s,r.id);
    for(const t of ['food','watchtower','water_pump','bar']){const r=s.rooms.find(r=>r.type===t&&r.state==='working'); if(!r) continue;
      const idle=U.atHome(s).find(c=>!c.job&&c.injured===0); if(idle) U.assignJob(s,idle.id,r.id);}
  };
  for(let d=0;d<days&&!s.gameOver;d++){ smart(s);
    while(s.pendingEvents.length){const v=U.eventView(s,s.pendingEvents[0]);U.answerEvent(s,v.options.find(o=>!o.disabled).id);}
    for(const id of [...s.pendingRoleChoice]) U.chooseRole(s,id,U.ROLES[d%5].id);
    const m=s.missions.find(m=>m.status==='open');
    const free=U.atHome(s).filter(c=>c.injured===0);
    if(m && free.length>=7){ U.setSquad(s,m.id,free.slice(-4).map(c=>c.id)); }
    const r1=U.endMorning(s,{auto:true});
    if(s.travelers.length && U.living(s).length<U.bedCount(s)) U.hire(s,s.travelers[0].id);
    U.endEvening(s,{auto:true});
    const g=U.checkGuarantees(s.warlords,(s.vacant||[]).length); if(g.length){console.log('guarantee broken',seed,g);fails++;}
  }
  return s;
}
for(let i=0;i<30;i++){const s=play('seed'+i,40);
 if(i<6) console.log(i,'day',s.day,'over',s.gameOver,'res',JSON.stringify(s.res),'crew',U.living(s).length,'tut',s.tutorial.step,'trust',s.trust.level,'rep',s.rep);}
console.log('fails',fails);
