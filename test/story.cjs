const fs=require('fs'),vm=require('vm');const ctx={console};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(__dirname+'/../src/rules.js','utf8')+fs.readFileSync(__dirname+'/../src/tactics.js','utf8')+';globalThis.UNM=UNM;',ctx);
const U=ctx.UNM; let done=0, days=[], errs=0, guests=0, trust4=[];
for(let i=0;i<20;i++){ try{
  const s=U.newGame('st'+i); U.skipTutorial(s);
  const roles=['bulwark','longshot','drifter','sawbones','tinker'];
  for(let k=0;k<3;k++) s.crew.push({...s.crew[0],id:'x'+k,name:'Extra '+k,alive:true});
  s.crew.forEach((c,j)=>{c.role=roles[j%5];c.level=5;});
  s.rooms.filter(r=>r.type==='crew_quarters').forEach(r=>r.level=3);
  for(let d=0;d<120&&!s.story?.open;d++){
    s.res.buttons=Math.max(s.res.buttons,100); s.res.food=40; s.res.water=40; s.rep=Math.max(s.rep,25); s.gameOver=null;
    for(const c of s.crew) if(c.alive){c.injured=0;c.morale=80;}
    while(s.pendingEvents.length){const ev=s.pendingEvents[0]; if(/^(marguerite|ansel|wes)/.test(ev.id)) guests++; const v=U.eventView(s,ev);U.answerEvent(s,v.options.find(o=>!o.disabled).id);}
    if(s.trust.level>=4 && !trust4[i]) trust4[i]=s.day;
    const ic=U.intercom(s); if(ic) { const r=U.answerIntercom(s, ic.options[ic.options.length-1].id); if(!r) console.log('no reply'); }
    if(!U.canOpenVault(s)){ U.openVault(s); const e=U.vaultEnding(s); if(!e.pages.length) console.log('no ending'); break; }
    const free=U.atHome(s).filter(c=>!c.injured);
    const m=s.missions.find(m=>m.status==='open'&&m.scripted==='keycard');
    if(m&&free.length>=5) U.setSquad(s,m.id,free.slice(0,6).map(c=>c.id));
    U.endMorning(s,{auto:true}); U.endEvening(s,{auto:true});
    if(s.gameOver){ s.gameOver=null; if(s.phase==='night'){ s.phase='evening'; } }
  }
  if(s.story&&s.story.open){done++; days.push(s.day);} else console.log('seed',i,'stuck',JSON.stringify(s.story),'trust',s.trust, s.phase);
 }catch(e){errs++; console.log(e.stack);} }
console.log({done,days,trust4:trust4.filter(Boolean),guests,errs});
