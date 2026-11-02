const fs=require('fs'),vm=require('vm');const ctx={console};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(__dirname+'/../src/rules.js','utf8')+fs.readFileSync(__dirname+'/../src/tactics.js','utf8')+';globalThis.UNM=UNM;',ctx);
const U=ctx.UNM; let broken=0, elim=0, succ=0, pacts=0, strongholds=0, gear=0, errs=0, originSeen=0, hostileOrigin=0;
for(let i=0;i<40;i++){ try{
  const s=U.newGame('p'+i); U.skipTutorial(s);
  const roles=['bulwark','longshot','drifter','sawbones','tinker'];
  for(let k=0;k<4;k++) s.crew.push({...s.crew[0],id:'x'+k,name:'Extra '+k,alive:true});
  s.crew.forEach((c,j)=>{c.role=roles[j%5];c.level=6;c.morale=90;});
  s.rooms.filter(r=>r.type==='crew_quarters').forEach(r=>r.level=3);
  for(let d=0;d<45&&!s.gameOver;d++){
    s.res.buttons=Math.max(s.res.buttons,150); s.res.food=50; s.res.water=50;
    for(const c of s.crew) if(c.alive){c.injured=0;c.morale=90;}
    while(s.pendingEvents.length){const v=U.eventView(s,s.pendingEvents[0]);U.answerEvent(s,v.options.find(o=>!o.disabled).id);}
    const live=s.warlords.filter(w=>w.alive);
    // politics
    const opp=live.find(w=>w.stance==='oppose');
    if(!opp){ const t=live.filter(w=>w.stance==='neutral').sort((a,b)=>a.disposition-b.disposition)[0]; if(t) U.oppose(s,t.id); }
    if(!s.conspiracy){ const a=live.find(w=>w.disposition>=10&&w.stance!=='oppose'); const t=live.find(w=>a&&w!==a&&w.stance!=='pact'); if(a&&t) U.conspire(s,a.id,t.id); }
    const pf=live.find(w=>w.stance==='neutral'&&w.disposition>=30&&w.temperament!=='aggressive'); if(pf&&!U.proposePact(s,pf.id)) pacts++;
    // gear
    while((s.gear||[]).length){ const c=s.crew.find(c=>c.alive&&!c.gear&&!c.away); if(!c) break; U.equipGear(s,c.id,s.gear[0]); gear++; }
    // send squad to stronghold or strike first
    const free=U.atHome(s).filter(c=>!c.injured);
    const m=s.missions.find(m=>m.status==='open'&&m.scripted==='stronghold')||s.missions.find(m=>m.status==='open'&&m.rival)||s.missions.find(m=>m.status==='open');
    if(m&&free.length>=6){ if(m.scripted==='stronghold') strongholds++; m.travel=0; U.setSquad(s,m.id,free.slice(0,6).map(c=>c.id)); }
    const before=s.warlords.filter(w=>!w.alive).length;
    U.endMorning(s,{auto:true});
    elim+=s.warlords.filter(w=>!w.alive).length-before;
    for(const t of s.travelers){ if(t.origin){originSeen++; const w=s.warlords.find(x=>x.id===t.origin); if(w.disposition<=-40) hostileOrigin++;} }
    const wn=s.warlords.length; U.endEvening(s,{auto:true}); succ+=s.warlords.length-wn;
    const g=U.checkGuarantees(s.warlords,(s.vacant||[]).length); if(g.length){broken++; if(broken<5) console.log('broken',i,d,g,JSON.stringify(s.warlords.map(w=>[w.alive,w.temperament,w.disposition])),(s.vacant||[]).length);}
  }
 }catch(e){errs++; if(errs<3) console.log(e.stack);} }
console.log({broken,elim,succ,pacts,strongholds,gear,originSeen,hostileOrigin,errs});
