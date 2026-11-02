const fs=require('fs'),vm=require('vm');const ctx={console};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(__dirname+'/../src/rules.js','utf8')+fs.readFileSync(__dirname+'/../src/tactics.js','utf8')+';globalThis.UNM=UNM;',ctx);
const U=ctx.UNM; const s=U.newGame('tech1'); U.skipTutorial(s); s.res.buttons=5000; s.res.salvage=5000;
const fails=[];
// gated upgrade
const gr=s.rooms.find(r=>r.type==='guest_room'); if(!U.upgradeRoom(s,gr.id)) fails.push('upgrade not gated');
if(!U.buildRoom(s,'messenger_post',0,6)) fails.push('build not gated');
// research everything in order
let guard=0;
while(guard++<200){ const t=U.TECH.find(t=>U.techStatus(s,t)==='available'); if(!t&&!s.tech.current) break;
  if(t&&!s.tech.current){const e=U.startResearch(s,t.id); if(e) fails.push(e);} 
  s.res.buttons=5000; s.res.salvage=5000; s.day=1; U.endMorning(s,{auto:true}); U.endEvening(s,{auto:true}); s.gameOver=null; s.res.buttons=5000;}
if(s.tech.done.length!==U.TECH.length) fails.push('not all researched '+s.tech.done.length);
if(U.upgradeRoom(s,gr.id)) fails.push('upgrade after tech failed');
// build every new room somewhere
s.dug=4; let row=1,col=0;
for(const k of ['messenger_post','checkpoint','turret_nest','bathhouse']){ let ok=false; for(let c=0;c<10&&!ok;c++){ if(!U.buildRoom(s,k,0,c)) ok=true;} if(!ok){ // clear surface lots
  const d=s.rooms.find(r=>r.row===0&&['guest_room'].includes(r.type)); }
  if(!ok) fails.push('could not place '+k+' :: '+U.buildRoom(s,k,0,0));}
for(const k of ['purifier','cold_storage','armory','meeting_hall','informants']){ let ok=false; for(let rr=1;rr<=4&&!ok;rr++) for(let c=0;c<10&&!ok;c++){ if(!U.buildRoom(s,k,rr,c)) ok=true;} if(!ok) fails.push('could not place '+k+' :: '+U.buildRoom(s,k,0,0));}
for(const r of s.rooms) if(r.state==='building'){r.state='working';r.buildLeft=0;}
// staff them
for(const r of s.rooms.filter(r=>r.state==='working'&&U.ROOM_TYPES[r.type].staff)){ s.crew.push({...s.crew[0],id:'z'+r.id,name:'Z '+r.id,alive:true,job:r.id,away:null,injured:0}); }
s.rooms.filter(r=>r.type==='generator').forEach(r=>{r.level=3}); for(let i=0;i<6;i++) s.crew.push({...s.crew[0],id:'g'+i,alive:true,away:null,job:s.rooms.find(r=>r.type==='generator').id});
const pw=U.powerReport(s); console.log('power',pw.supply,pw.demand);
console.log('craft', U.craftGear(s,'scope'), s.gear);
const day=s.day; const n=U.endMorning(s,{auto:true}); U.endEvening(s,{auto:true}); console.log('raidPlan',JSON.stringify(s.raidPlan), 'lastNight', JSON.stringify(s.lastNight.lines).slice(0,300));
const base=U.raidBase(s); console.log('base',JSON.stringify({cp:base.checkpoint,t:base.turrets}));
s.pendingRaid={warlord:s.warlords.find(w=>w.alive).id,count:5,style:'siege'}; s.phase='night';
U.startRaid(s,U.defaultDefenders(s)); console.log('nests',s.battle.units.filter(u=>u.kind==='turret').length,'stims',s.battle.stims,'gate',s.battle.cover[ (14-7)*12+5 ]);
console.log('fails',fails);
