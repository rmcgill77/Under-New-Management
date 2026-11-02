const fs=require('fs'),vm=require('vm');const ctx={console};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(__dirname+'/../src/rules.js','utf8')+';globalThis.UNM=UNM;',ctx);const U=ctx.UNM;
const s=U.newGame('seed1');
for(const r of s.rooms.filter(r=>r.free)) U.repairRoom(s,r.id);
for(let d=0;d<16;d++){
  for(const t of ['wall','watchtower','food']) for(const r of s.rooms.filter(r=>r.type===t&&(r.state==='ruined'||r.state==='damaged'))) U.repairRoom(s,r.id);
  for(const t of ['generator','water_pump','food','bar','guest_room','generator','water_pump']){const r=s.rooms.find(r=>r.type===t&&r.state==='working'); if(!r) continue;
    const idle=U.atHome(s).find(c=>!c.job&&c.injured===0); if(idle) U.assignJob(s,idle.id,r.id);}
  while(s.pendingEvents.length){const v=U.eventView(s,s.pendingEvents[0]);U.answerEvent(s,v.options.find(o=>!o.disabled).id);}
  for(const id of [...s.pendingRoleChoice]) U.chooseRole(s,id,'tinker');
  const m=s.missions.find(m=>m.status==='open'); const free=U.atHome(s).filter(c=>c.injured===0&&!c.job);
  if(m&&free.length>=4) U.setSquad(s,m.id,free.slice(0,4).map(c=>c.id));
  if(m&&m.scripted) U.setSquad(s,m.id,U.atHome(s).slice(0,4).map(c=>c.id));
  const r=U.endMorning(s); const t=r.today;
  if(s.travelers.length && U.living(s).length<U.bedCount(s)) U.hire(s,s.travelers[0].id);
  const n=U.endEvening(s);
  const jobs=U.living(s).map(c=>c.job? s.rooms.find(r=>r.id===c.job).type.slice(0,4):(c.away?'away':'-')).join(',');
  console.log(s.day, JSON.stringify(s.res), 'pow',t.power.supply+'/'+t.power.demand,'traf',t.traffic,'g',t.guests,'srv',t.served,'$',t.buttons,'crew',jobs, n.raid?('RAID '+n.raid.outcome):'', s.gameOver||'');
}
