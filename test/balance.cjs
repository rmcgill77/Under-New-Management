// A sensible autoplayer: keeps essentials staffed, repairs and researches with a reserve,
// hires when it can feed people, sends reasonable squads, defends raids.
const fs=require('fs'),vm=require('vm');const ctx={console,Math};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(__dirname+'/../src/rules.js','utf8')+fs.readFileSync(__dirname+'/../src/tactics.js','utf8')+';globalThis.UNM=UNM;',ctx);
const U=ctx.UNM;
const DAYS=+process.argv[2]||60, GAMES=+process.argv[3]||30, DIFF=process.argv[4]||'standard';
const PLAN_ORDER=['p2','p1','f1','c1','d1','h1','d2','x1','c4','f3','h3','c2','p4','d3','x2','f2','h2','c3','p3','d4','x3','h4','c5','h5'];
function staff(s){
  const want=['generator','water_pump','food','bar','guest_room','watchtower','food','water_pump','clinic','workshop','purifier','armory','messenger_post','checkpoint','meeting_hall','informants','bathhouse','entertainment'];
  for(const c of U.atHome(s)) if(c.job){const r=s.rooms.find(r=>r.id===c.job); if(!r||r.state!=='working') c.job=null;}
  // one worker per room first (in priority order), then second workers
  for(const pass of [1,2]) for(const t of want){
    for(const r of s.rooms.filter(r=>r.type===t&&r.state==='working')){
      const T=U.ROOM_TYPES[t]; if(U.workersIn(s,r.id).length>=Math.min(T.staff,pass)) continue;
      const idle=U.atHome(s).find(c=>!c.job&&!c.injured); if(!idle) return; U.assignJob(s,idle.id,r.id);
    }
  }
}
function play(seed){
  const s=U.newGame(seed); U.skipTutorial(s); if(U.setDifficulty) U.setDifficulty(s,DIFF);
  const stat={rdeath:0,mdeath:0,leftc:0,raids:0,repelled:0,missions:0,success:0,deaths:0,minButtons:999,story:0};
  for(let d=0;d<DAYS&&!s.gameOver;d++){
    while(s.pendingEvents.length){const ev=s.pendingEvents[0];const v=U.eventView(s,ev);
      let pick=v.options.find(o=>!o.disabled);
      if(ev.id==='demand'){ const w=s.warlords.find(x=>x.id===ev.warlord); pick=(s.res.buttons>ev.amount+40)?v.options[0]:v.options[1]; }
      U.answerEvent(s,pick.id);}
    for(const id of [...s.pendingRoleChoice]) U.chooseRole(s,id,U.ROLES[(s.crew.findIndex(c=>c.id===id))%5].id);
    // repairs with a reserve
    for(const r of s.rooms.filter(r=>r.state==='ruined'||r.state==='damaged')){ const c=U.costOf(s,r.type,'repair',r); if(c&&s.res.buttons-c.buttons>35&&s.res.salvage>=c.salvage) U.repairRoom(s,r.id); }
    // build a third crew quarters / grow room when needed
    const pop=U.living(s).length, beds=U.bedCount(s);
    if(beds-pop<1 && s.res.buttons>60){ for(let row=1;row<=s.dug;row++) for(let c=0;c<10;c++) if(!U.buildRoom(s,'crew_quarters',row,c)) {row=99;break;} }
    // food security: buy when short, build another grow room when production lags
    for(let k=0;k<3&&s.res.food<U.living(s).length*3;k++) if(U.buySupplies(s,'food')) break;
    for(let k=0;k<2&&s.res.water<U.living(s).length*3;k++) if(U.buySupplies(s,'water')) break;
    if(s.res.food<U.living(s).length*2&&s.res.buttons>90&&s.rooms.filter(r=>r.type==='food').length<3){ outer: for(let row=1;row<=s.dug;row++) for(let c=0;c<9;c++) if(!U.buildRoom(s,'food',row,c)) break outer; }
    // research
    if(!(s.tech&&s.tech.current)&&s.res.buttons>70){ const t=PLAN_ORDER.map(U.techById).find(t=>U.techStatus(s,t)==='available'); if(t) U.startResearch(s,t.id); }
    // upgrades for food/water when short
    for(const t of ['water_pump','food','generator']){ const r=s.rooms.find(r=>r.type===t&&r.state==='working'&&r.level<2); if(r&&s.res.buttons>80) U.upgradeRoom(s,r.id); }
    // intercom
    const ic=U.intercom(s); if(ic) U.answerIntercom(s,ic.options[ic.options.length-1].id);
    if(!U.canOpenVault(s)){U.openVault(s); stat.story=s.day;}
    staff(s);
    // missions: keep at least 3 home
    const keep=new Set(s.rooms.filter(r=>['generator','water_pump','food','bar','guest_room'].includes(r.type)).map(r=>r.id));
    const essential=new Set(); for(const id of keep){ const w=U.workersIn(s,id)[0]; if(w) essential.add(w.id); }
    const free=U.atHome(s).filter(c=>!c.injured&&!essential.has(c.id)).sort((a,b)=>b.level-a.level);
    const avg=free.length?free.reduce((n,c)=>n+c.level,0)/free.length:1;
    const m=s.missions.filter(m=>m.status==='open'&&m.danger<=Math.ceil(avg)+1).sort((a,b)=>(b.scripted==='keycard')-(a.scripted==='keycard')||(b.urgent-a.urgent)||a.danger-b.danger)[0];
    if(m&&free.length>=4){ U.setSquad(s,m.id,free.slice(0,4).map(c=>c.id)); }
    const dead0=s.crew.filter(c=>!c.alive&&!c.left).length;
    const d0=s.crew.filter(c=>!c.alive&&!c.left).length;
    const r1=U.endMorning(s,{auto:true});
    stat.mdeath+=s.crew.filter(c=>!c.alive&&!c.left).length-d0;
    if(r1&&r1.reports) for(const rep of r1.reports){stat.missions++; if(rep.outcome==='success')stat.success++;}
    // hire if food production allows
    if(s.travelers.length&&U.living(s).length<U.bedCount(s)&&s.res.food>U.living(s).length*3) U.hire(s,s.travelers[0].id);
    const d1=s.crew.filter(c=>!c.alive&&!c.left).length, l1=s.crew.filter(c=>c.left).length;
    const n=U.endEvening(s,{auto:true});
    stat.rdeath+=s.crew.filter(c=>!c.alive&&!c.left).length-d1; stat.leftc+=s.crew.filter(c=>c.left).length-l1;
    if(n&&n.raid){stat.raids++; if(n.raid.outcome==='repelled')stat.repelled++;}
    stat.deaths+=s.crew.filter(c=>!c.alive&&!c.left).length-dead0;
    stat.minButtons=Math.min(stat.minButtons,s.res.buttons);
  }
  return {s,stat};
}
const out=[];
for(let i=0;i<GAMES;i++){ const {s,stat}=play('bal'+i); out.push({day:s.day,over:s.gameOver,crew:U.living(s).length,buttons:s.res.buttons,...stat}); }
const alive=out.filter(o=>!o.over).length;
const reasons={}; for(const o of out) if(o.over) reasons[o.over]=(reasons[o.over]||0)+1;
const avg=(k)=> (out.reduce((n,o)=>n+(o[k]||0),0)/out.length).toFixed(1);
console.log(`${DIFF}: survived ${alive}/${GAMES} to day ${DAYS}`, reasons);
console.log(`avg end day ${avg('day')} crew ${avg('crew')} buttons ${avg('buttons')} minButtons ${avg('minButtons')} raids ${avg('raids')} repelled ${avg('repelled')} missions ${avg('missions')} success ${avg('success')} deaths ${avg('deaths')} (missions ${avg('mdeath')}, raids ${avg('rdeath')}) left ${avg('leftc')} tribute?  storyDay ${(out.filter(o=>o.story).map(o=>o.story).reduce((a,b)=>a+b,0)/Math.max(1,out.filter(o=>o.story).length)).toFixed(0)} (${out.filter(o=>o.story).length} finished)`);
