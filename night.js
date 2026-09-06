/* ─────────────────────────────────────────────────────────────
   NIGHT — the campaign spine.
   One definition of the running order, loaded by every game, so
   adding or reordering a leg is a single edit.

   Progress travels two ways:
     • URL params  — the transport between legs. Always works,
                     survives a refresh, bookmarkable.
     • localStorage— the save point. Convenience only. If the
                     browser refuses it (private mode, file://
                     restrictions) nothing breaks; you just lose
                     "continue" and the URL still carries you.
   ───────────────────────────────────────────────────────────── */
(function(global){
'use strict';

const CHAIN=[
  {url:'night-hawk.html',   drive:{dist:2400},                 name:'RUN OUT TO THE COLO'},
  {url:'dark-fiber.html',                                      name:'THE COLO'},
  {url:'night-hawk.html',   drive:{dist:2800},                 name:'ACROSS TOWN'},
  {url:'cold-boot.html',    desk:{job:'switch'},               name:'THE DESK — PHONE SWITCH'},
  {url:'red-eye.html',                                         name:'THE AIRPORT'},
  {url:'night-hawk.html',   drive:{dist:3200,hostile:1},       name:'THEY KNOW NOW'},
  {url:'clearance.html',                                       name:'THE ANNEXE'},
  {url:'night-hawk.html',   drive:{dist:3600,hostile:1},       name:'THE LAST RUN'},
  {url:'cold-boot.html',    desk:{job:'clear'},                name:'THE DESK — THE BANK'},
  {url:'night-deposit.html',                                   name:'THE BANK'}
];

const KEY='nighthawk.progress';
const q=new URLSearchParams(location.search);

function legURL(n,t,down){          // n is 1-based
  const L=CHAIN[n-1];
  if(!L) return null;
  const p=new URLSearchParams({campaign:'1',leg:String(n),t:String(Math.round(t||0)),down:String(down||0)});
  if(L.drive){ p.set('dist',String(L.drive.dist)); if(L.drive.hostile) p.set('hostile','1'); }
  if(L.desk){ p.set('job',L.desk.job); }
  return L.url+'?'+p.toString();
}

const Night={
  CHAIN,
  q,
  campaign: q.get('campaign')==='1',
  leg:  +(q.get('leg')||0),
  time: +(q.get('t')||0),
  down: +(q.get('down')||0),
  count: CHAIN.length,

  // legacy shape some files still read
  get NAMES(){ return [''].concat(CHAIN.map(c=>c.name)); },
  legLabel(n){ const L=CHAIN[n-1]; return L?L.name:''; },
  isDrive(n){ const L=CHAIN[n-1]; return !!(L&&L.drive); },

  total(add){ return Math.round(Night.time+(add||0)); },

  // where to go after finishing the current leg
  nextURL(addTime,addDown){
    if(!Night.campaign) return null;
    const t=Night.total(addTime), d=Night.down+(addDown||0);
    const n=Night.leg+1;
    if(n>CHAIN.length){ Night.clear(); return 'index.html?done=1&t='+t+'&down='+d; }
    Night.save(n,t,d);
    return legURL(n,t,d);
  },
  startURL(){ return legURL(1,0,0); },

  // ── save point ──
  save(leg,t,down){
    try{ localStorage.setItem(KEY,JSON.stringify({leg,t,down,at:Date.now()})); }
    catch(e){ /* storage unavailable — URL still carries progress */ }
  },
  load(){
    try{
      const raw=localStorage.getItem(KEY);
      if(!raw) return null;
      const p=JSON.parse(raw);
      if(!p||!p.leg||p.leg<1||p.leg>CHAIN.length) return null;
      return p;
    }catch(e){ return null; }
  },
  clear(){ try{ localStorage.removeItem(KEY); }catch(e){} },
  resumeURL(){ const p=Night.load(); return p?legURL(p.leg,p.t,p.down):null; }
};

// arriving at a leg is itself a save point
if(Night.campaign && Night.leg>=1) Night.save(Night.leg,Night.time,Night.down);

global.Night=Night;
})(window);
