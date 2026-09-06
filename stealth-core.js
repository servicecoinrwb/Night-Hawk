/* ─────────────────────────────────────────────────────────────
   STEALTH CORE
   Shared engine for the on-foot jobs. A mission file supplies
   geometry, guard routes, cameras and objectives; everything
   below is common and should only ever be fixed in one place.

   Mission config:
     name, sub, blurb, code
     levels   [{y,name}]           floors, low to high
     plate    {x0,x1,z0,z1}        main floor footprint
     tower    {x0,x1,z0,z1}        stair shaft (optional)
     ramps    [{zTop,yTop,zBot,yBot,x0,x1}]
     landings [{z0,z1,y}]
     spawn    {x,z,y,yaw}
     build(A)                      geometry; A is the builder api
     tags(S)  -> [{text,cls}]      HUD chips
     objective(S) -> {t,w}
     verdict(won,why,S) -> {title,text}
   ───────────────────────────────────────────────────────────── */
(function(global){
'use strict';

const Stealth = {};
global.Stealth = Stealth;

// ═══════════════ HUD markup + styling, injected so missions stay thin ═══════════════
const CSS = `
:root{--ink:#04060a;--cyan:#5fe6ff;--green:#4dff9e;--amber:#ffb020;--red:#ff2418;--steel:#8f9ab8}
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;overflow:hidden;background:var(--ink)}
body{font-family:'Chakra Petch',system-ui,sans-serif;color:#e8ecf7;-webkit-user-select:none;user-select:none}
canvas{display:block}
#hud{position:fixed;inset:0;pointer-events:none;z-index:10}
.pane{position:absolute}
#objPane{top:18px;left:20px;max-width:330px}
#objLabel{font-size:10.5px;font-weight:700;letter-spacing:2.4px;color:var(--steel)}
#objText{font-size:18px;font-weight:700;color:#fff;line-height:1.25;margin-top:3px}
#objWhy{font-size:12.5px;font-weight:500;color:var(--cyan);margin-top:6px;line-height:1.4}
#statePane{top:18px;right:20px;text-align:right;width:250px}
.gTop{display:flex;justify-content:space-between;font-size:11.5px;font-weight:700;letter-spacing:.6px;margin-bottom:4px}
.gTop span{color:var(--steel);font-weight:600}
.bar{height:7px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);position:relative;overflow:hidden}
.fill{position:absolute;inset:0;transform-origin:left center;transform:scaleX(0);transition:transform .08s linear;
  background:linear-gradient(90deg,#4dff9e,#ffb020 50%,#ff2418)}
.why{font-size:11.5px;font-weight:500;color:var(--steel);margin-top:5px;line-height:1.35;text-align:right}
.why.warn{color:var(--amber)} .why.bad{color:var(--red)} .why.ok{color:var(--green)}
#tags{margin-top:14px;display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap}
.tag{font-size:10.5px;font-weight:700;letter-spacing:1px;padding:3px 9px;
  border:1px solid rgba(255,255,255,.16);color:var(--steel)}
.tag.on{color:var(--green);border-color:rgba(77,255,158,.5)}
.tag.hot{color:var(--cyan);border-color:rgba(95,230,255,.5)}
.tag.bad{color:var(--red);border-color:rgba(255,36,24,.5)}
#clockPane{top:16px;left:50%;transform:translateX(-50%);text-align:center;display:none}
#clockPane.on{display:block}
#clockLabel{font-size:10px;font-weight:700;letter-spacing:3px;color:var(--red)}
#clockVal{font-size:42px;font-weight:700;font-style:italic;color:#fff;line-height:1;
  text-shadow:0 0 26px rgba(255,36,24,.8);font-variant-numeric:tabular-nums}
#clockPane.low #clockVal{color:var(--red)}
#reticle{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:6px;height:6px;
  border:1px solid rgba(255,255,255,.5);border-radius:50%;transition:all .1s}
#reticle.hot{border-color:var(--cyan);box-shadow:0 0 10px rgba(95,230,255,.8);transform:translate(-50%,-50%) scale(1.6)}
#reticle.kill{border-color:var(--red);box-shadow:0 0 12px rgba(255,36,24,.9);transform:translate(-50%,-50%) scale(2.1)}
#prompt{position:absolute;top:calc(50% + 40px);left:50%;transform:translateX(-50%);text-align:center;
  font-size:14px;font-weight:600;display:none;max-width:440px}
#prompt.on{display:block}
#prompt b{display:block;color:#fff;font-size:15.5px;font-weight:700}
#prompt i{display:block;font-style:normal;color:var(--steel);font-size:12.5px;font-weight:500;margin-top:3px}
#prompt em{display:inline-block;font-style:normal;margin-top:7px;font-size:12px;font-weight:700;
  letter-spacing:1px;color:var(--cyan);border:1px solid rgba(95,230,255,.35);padding:3px 10px}
#prompt.locked em{color:var(--amber);border-color:rgba(255,176,32,.35)}
#prompt.kill em{color:var(--red);border-color:rgba(255,36,24,.4)}
#log{position:absolute;left:20px;bottom:20px;width:min(420px,56vw)}
.line{font-size:13px;font-weight:600;color:var(--cyan);background:rgba(4,14,22,.72);
  border-left:2px solid rgba(95,230,255,.5);padding:6px 12px;margin-top:5px}
.line.warn{color:var(--amber);border-left-color:rgba(255,176,32,.55)}
.line.bad{color:var(--red);border-left-color:rgba(255,36,24,.55)}
.line.good{color:var(--green);border-left-color:rgba(77,255,158,.55)}
#stance{position:absolute;left:50%;bottom:22px;transform:translateX(-50%);
  font-size:11px;font-weight:700;letter-spacing:2.4px;color:var(--steel)}
#stance b{color:var(--green)}
#progWrap{position:absolute;left:50%;bottom:27%;transform:translateX(-50%);width:min(400px,72vw);display:none}
#progWrap.on{display:block}
#progLabel{font-size:12px;font-weight:700;letter-spacing:1.4px;color:var(--cyan);text-align:center;margin-bottom:6px}
#progBar{height:9px;background:rgba(255,255,255,.08);border:1px solid rgba(95,230,255,.3);position:relative;overflow:hidden}
#progFill{position:absolute;inset:0;background:var(--cyan);transform-origin:left center;transform:scaleX(0)}
#mapWrap{position:absolute;right:22px;bottom:22px;width:150px;height:150px}
#minimap{width:150px;height:150px;border-radius:50%;border:1px solid rgba(95,230,255,.24);
  background:rgba(3,8,14,.72);box-shadow:0 0 26px rgba(0,0,0,.6), inset 0 0 26px rgba(95,230,255,.05)}
#mapWrap.dead #minimap{filter:grayscale(1) brightness(.4)}
#mapLevel{position:absolute;left:50%;bottom:-16px;transform:translateX(-50%);
  font-size:9.5px;font-weight:700;letter-spacing:2px;color:var(--steel);white-space:nowrap}
#mapWrap.dead #mapLevel{color:var(--red)}
@media (max-width:760px){ #mapWrap{width:104px;height:104px} #minimap{width:104px;height:104px} }
#vig{position:fixed;inset:0;pointer-events:none;z-index:11;opacity:0;transition:opacity .2s;
  box-shadow:inset 0 0 180px 40px rgba(255,36,24,.55)}
.screen{position:fixed;inset:0;z-index:20;display:flex;flex-direction:column;align-items:center;
  justify-content:center;padding:26px;text-align:center;
  background:radial-gradient(ellipse at 50% 55%,rgba(8,20,30,.7),rgba(2,4,8,.96) 70%)}
.screen.hidden{display:none}
.title{font-size:clamp(38px,8.5vw,86px);font-weight:700;font-style:italic;letter-spacing:-2.5px;line-height:.88;color:#fff}
.sub{font-size:11px;font-weight:700;letter-spacing:4px;color:var(--cyan);margin-bottom:10px}
.tagline{font-size:15px;font-weight:600;color:var(--steel);max-width:62ch;margin-top:12px;line-height:1.55}
.tagline em{color:#e8ecf7;font-style:normal}
.keys{display:grid;grid-template-columns:repeat(auto-fit,minmax(158px,1fr));gap:9px 22px;
  margin:22px 0 4px;width:min(700px,92vw);text-align:left}
.key{font-size:13.5px;font-weight:500;color:var(--steel);display:flex;gap:9px;align-items:baseline}
.key b{font-weight:700;color:#fff;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);
  padding:1px 7px;font-size:12px;white-space:nowrap}
.btnRow{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;align-items:center}
button.go{pointer-events:auto;margin-top:22px;font-family:inherit;font-size:18px;font-weight:700;font-style:italic;
  color:#02141a;background:var(--cyan);border:0;padding:14px 40px;cursor:pointer;
  clip-path:polygon(0 0,100% 0,calc(100% - 14px) 100%,0 100%);box-shadow:0 0 32px rgba(95,230,255,.4)}
button.go:hover{box-shadow:0 0 46px rgba(95,230,255,.7)}
button.ghost{pointer-events:auto;margin-top:22px;font-family:inherit;font-size:15px;font-weight:600;color:#cfd6e8;
  background:transparent;border:1px solid rgba(255,255,255,.22);padding:13px 24px;cursor:pointer}
button.ghost:hover{border-color:rgba(255,255,255,.5);color:#fff}
.sensRow{display:flex;align-items:center;gap:12px;margin-top:22px;pointer-events:auto}
.sensRow label{font-size:10.5px;font-weight:700;letter-spacing:2px;color:var(--steel)}
.sensRow input{width:200px;accent-color:var(--cyan)}
.sensRow span{font-size:13px;font-weight:700;color:#fff;width:26px;text-align:right}
.statRow{display:flex;gap:32px;margin:18px 0 2px;flex-wrap:wrap;justify-content:center}
.stat b{display:block;font-size:32px;font-weight:700;font-style:italic;color:#fff;line-height:1}
.stat span{font-size:12px;font-weight:600;color:var(--steel)}
#endWhy{font-size:15px;font-weight:600;color:var(--amber);margin-top:14px;max-width:56ch;line-height:1.5}
#journal,#pad,#doc{position:fixed;inset:0;z-index:22;display:none;align-items:center;justify-content:center;
  background:rgba(2,6,10,.88)}
#journal.on,#pad.on,#doc.on{display:flex}
.jBox{width:min(560px,90vw);border:1px solid rgba(95,230,255,.28);background:rgba(4,12,20,.98);padding:26px 28px}
.jBox h3{font-size:11px;font-weight:700;letter-spacing:3px;color:var(--cyan)}
.jItem{margin-top:16px;padding-left:14px;border-left:2px solid rgba(95,230,255,.35)}
.jItem b{display:block;font-size:14px;font-weight:700;color:#fff}
.jItem span{display:block;font-size:13px;font-weight:500;color:var(--steel);margin-top:4px;line-height:1.5}
.jItem.pending{border-left-color:rgba(255,255,255,.12)}
.jItem.pending b{color:#4b546b} .jItem.pending span{color:#3c4457}
.jHint{margin-top:18px;font-size:11.5px;color:#4b546b;font-weight:600;letter-spacing:.6px;text-align:center}
.padBox{width:min(320px,86vw);border:1px solid rgba(95,230,255,.3);background:rgba(4,14,22,.98);padding:22px}
.padTitle{font-size:12px;font-weight:700;letter-spacing:2px;color:var(--cyan);text-align:center}
.padHint{font-size:12px;font-weight:500;color:var(--steel);text-align:center;margin-top:6px;line-height:1.4}
#padVal{font-size:34px;font-weight:700;font-style:italic;text-align:center;letter-spacing:10px;color:#fff;
  margin:14px 0;min-height:40px}
#padVal.bad{color:var(--red)}
.padGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.padGrid button{font-family:inherit;font-size:20px;font-weight:700;color:#e8ecf7;background:rgba(255,255,255,.05);
  border:1px solid rgba(255,255,255,.14);padding:12px 0;cursor:pointer}
.padGrid button:hover{background:rgba(95,230,255,.14);border-color:rgba(95,230,255,.5)}
.docBox{width:min(430px,90vw);background:#f4f1e4;color:#20242e;padding:26px 28px;
  box-shadow:0 20px 60px rgba(0,0,0,.6);transform:rotate(-1deg)}
.docBox h4{font-size:11px;letter-spacing:2px;color:#7a7566;font-weight:700}
.docBox p{font-size:15px;font-weight:600;margin-top:10px;line-height:1.55}
.docBox small{display:block;margin-top:16px;font-size:11.5px;color:#7a7566;font-weight:600}

/* ── intrusion terminal ── */
#term{position:fixed;inset:0;z-index:23;display:none;align-items:center;justify-content:center;
  background:rgba(1,4,7,.82)}
#term.on{display:flex}
.termBox{width:min(560px,94vw);border:1px solid rgba(95,230,255,.35);background:#050d14;
  box-shadow:0 0 60px rgba(0,0,0,.8), inset 0 0 60px rgba(95,230,255,.04);padding:0 0 16px}
.termTop{display:flex;justify-content:space-between;align-items:baseline;padding:14px 18px 10px;
  border-bottom:1px solid rgba(95,230,255,.2)}
.termTop b{font-size:12px;font-weight:700;letter-spacing:2.4px;color:var(--cyan)}
.termTop span{font-size:11px;font-weight:600;color:var(--steel);letter-spacing:1px}
#termBody{padding:18px;min-height:210px;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:14px}
.termHint{font-size:12.5px;font-weight:600;color:var(--steel);text-align:center;line-height:1.5;max-width:44ch}
.grid{display:grid;grid-template-columns:repeat(5,1fr);gap:7px}
.cell{width:52px;height:52px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.03);
  cursor:pointer;transition:background .1s,border-color .1s}
.cell:hover{border-color:rgba(95,230,255,.5)}
.cell.lit{background:rgba(95,230,255,.75);border-color:var(--cyan);box-shadow:0 0 18px rgba(95,230,255,.6)}
.cell.ok{background:rgba(77,255,158,.5);border-color:var(--green)}
.cell.no{background:rgba(255,36,24,.5);border-color:var(--red)}
.dials{display:flex;gap:10px}
.dial{width:64px;height:74px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.03);
  font-family:inherit;font-size:30px;font-weight:700;color:#e8ecf7;cursor:pointer}
.dial:hover{border-color:rgba(95,230,255,.5)}
.dial.set{color:var(--green);border-color:rgba(77,255,158,.5)}
.target{display:flex;gap:10px}
.tgl{width:64px;text-align:center;font-size:24px;font-weight:700;color:var(--amber)}
.lockTrack{position:relative;width:min(420px,80%);height:34px;border:1px solid rgba(255,255,255,.16);
  background:rgba(255,255,255,.03);overflow:hidden}
#lockWin{position:absolute;top:0;bottom:0;background:rgba(77,255,158,.28);border-left:1px solid var(--green);
  border-right:1px solid var(--green)}
#lockMark{position:absolute;top:0;bottom:0;width:4px;background:#fff;box-shadow:0 0 12px #fff}
.termBtn{font-family:inherit;font-size:15px;font-weight:700;letter-spacing:1px;color:#02141a;
  background:var(--cyan);border:0;padding:11px 30px;cursor:pointer}
.pips{display:flex;gap:6px}
.pip{width:22px;height:6px;background:rgba(255,255,255,.14)}
.pip.on{background:var(--green);box-shadow:0 0 10px rgba(77,255,158,.6)}
.termBar{height:5px;background:rgba(255,255,255,.07);margin:0 18px;position:relative;overflow:hidden}
#termTime{position:absolute;inset:0;background:var(--cyan);transform-origin:left center;transform:scaleX(1)}
#termTime.low{background:var(--red)}
.termFoot{display:flex;justify-content:space-between;align-items:center;padding:12px 18px 0}
#termMsg{font-size:12px;font-weight:600;color:var(--steel)}
#termMsg.bad{color:var(--red)} #termMsg.good{color:var(--green)}
#termAbort{font-family:inherit;font-size:11.5px;font-weight:700;letter-spacing:1.4px;color:#cfd6e8;
  background:transparent;border:1px solid rgba(255,255,255,.22);padding:8px 16px;cursor:pointer}
#termAbort:hover{border-color:rgba(255,36,24,.6);color:var(--red)}
`;

const HTML = `
<div id="hud">
  <div class="pane" id="objPane"><div id="objLabel">OBJECTIVE</div><div id="objText">—</div><div id="objWhy"></div></div>
  <div class="pane" id="clockPane"><div id="clockLabel">ALARM IN</div><div id="clockVal">0:00</div></div>
  <div class="pane" id="statePane">
    <div class="gTop"><span>DETECTION</span><b id="susVal">UNSEEN</b></div>
    <div class="bar"><div class="fill" id="susFill"></div></div>
    <div class="why" id="susWhy">Nobody is looking at you.</div>
    <div id="tags"></div>
  </div>
  <div id="reticle"></div><div id="prompt"></div>
  <div id="progWrap"><div id="progLabel">WORKING</div><div id="progBar"><div id="progFill"></div></div></div>
  <div id="log"></div><div id="stance">STANDING</div>
  <div id="mapWrap"><canvas id="minimap" width="240" height="240"></canvas><div id="mapLevel">—</div></div>
</div>
<div id="vig"></div>
<div id="journal"><div class="jBox"><h3>CASE NOTES</h3><div id="jList"></div><div class="jHint">TAB to close</div></div></div>
<div id="pad"><div class="padBox">
  <div class="padTitle" id="padTitle">KEYPAD</div><div class="padHint" id="padHint">Four digits.</div>
  <div id="padVal"></div>
  <div class="padGrid">
    <button data-k="1">1</button><button data-k="2">2</button><button data-k="3">3</button>
    <button data-k="4">4</button><button data-k="5">5</button><button data-k="6">6</button>
    <button data-k="7">7</button><button data-k="8">8</button><button data-k="9">9</button>
    <button data-k="c">C</button><button data-k="0">0</button><button data-k="x">✕</button>
  </div></div></div>
<div id="term"><div class="termBox">
  <div class="termTop"><b id="termTitle">TERMINAL</b><span id="termStage"></span></div>
  <div id="termBody"></div>
  <div class="termBar"><div id="termTime"></div></div>
  <div class="termFoot"><span id="termMsg"></span><button id="termAbort">ABORT</button></div>
</div></div>
<div id="doc"><div class="docBox"><h4 id="docHead">NOTE</h4><p id="docBody"></p>
  <small>Click anywhere to put it back.</small></div></div>
<div class="screen" id="menu">
  <div class="sub" id="mSub"></div><h1 class="title" id="mTitle"></h1>
  <p class="tagline" id="mBlurb"></p>
  <div class="keys">
    <div class="key"><b>W A S D</b><span>Move. Mouse looks.</span></div>
    <div class="key"><b>C</b><span>Crouch. Toggles.</span></div>
    <div class="key"><b>Shift / R</b><span>Run. They hear it.</span></div>
    <div class="key"><b>E</b><span>Use, take, or choke out from behind.</span></div>
    <div class="key"><b>Tab / Q</b><span>Case notes.</span></div>
    <div class="key"><b>F</b><span>Flashlight.</span></div>
    <div class="key"><b>H</b><span>Quick check.</span></div>
    <div class="key"><b>M / N</b><span>Mute · music off.</span></div>
  </div>
  <div class="sensRow"><label for="sens">LOOK SENSITIVITY</label>
    <input type="range" id="sens" min="4" max="34" step="1" value="14"><span id="sensVal">14</span></div>
  <div class="btnRow"><button class="go" id="startBtn">Go in</button>
    <button class="ghost" id="menuBackBtn">Back to menu</button></div>
</div>
<div class="screen hidden" id="help">
  <h1 class="title" style="font-size:clamp(30px,6.5vw,54px)">QUICK CHECK</h1>
  <p class="tagline" style="text-align:left;max-width:680px" id="helpBody"></p>
  <div class="btnRow"><button class="go" id="helpCloseBtn">Back to it</button>
    <button class="ghost" id="helpMenuBtn">Main screen</button></div>
</div>
<div class="screen hidden" id="end">
  <h1 class="title" id="endTitle">CLEAN</h1>
  <div class="statRow">
    <div class="stat"><b id="eTime">0:00</b><span>On site</span></div>
    <div class="stat"><b id="eDown">0</b><span>Guards down</span></div>
    <div class="stat"><b id="ePeak">0%</b><span>Peak detection</span></div>
  </div>
  <p id="endWhy"></p>
  <div class="btnRow"><button class="go" id="continueBtn" style="display:none">Next leg</button>
    <button class="go" id="againBtn">Run it again</button>
    <button class="ghost" id="endBackBtn">Back to menu</button></div>
</div>`;

// ═══════════════ campaign chaining (definitions live in night.js) ═══════════════
const CQ=Night.q, CAMPAIGN=Night.campaign, LEG=Night.leg, CTIME=Night.time, CDOWN=Night.down;
const CHAIN=Night.CHAIN;
Stealth.CHAIN=CHAIN; Stealth.CAMPAIGN=CAMPAIGN; Stealth.LEG=LEG;

// ═══════════════ engine ═══════════════
Stealth.init=function(CFG){

document.head.insertAdjacentHTML('beforeend','<style>'+CSS+'</style>');
document.body.insertAdjacentHTML('beforeend',HTML);
document.title=CFG.name;
document.getElementById('mTitle').innerHTML=CFG.name.replace(' ','<br>');
document.getElementById('mSub').textContent=CFG.sub||'';
document.getElementById('mBlurb').innerHTML=CFG.blurb||'';
document.getElementById('helpBody').innerHTML=CFG.help||'';

// ── renderer ──
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth,innerHeight);
document.body.appendChild(renderer.domElement);

const scene=new THREE.Scene();
scene.background=new THREE.Color(CFG.bg!==undefined?CFG.bg:0x04060a);
scene.fog=new THREE.Fog(CFG.bg!==undefined?CFG.bg:0x04060a,8,50);
const camera=new THREE.PerspectiveCamera(74,innerWidth/innerHeight,0.05,300);
camera.rotation.order='YXZ'; scene.add(camera);
const ambient=new THREE.AmbientLight(0x2b3350,CFG.ambient||0.74); scene.add(ambient);
const key=new THREE.DirectionalLight(0x93a6dd,0.4); key.position.set(-30,50,20); scene.add(key);
const torch=new THREE.SpotLight(0xdfeaff,1.4,24,0.5,0.45,1.4);
torch.position.set(0,0,0.2); camera.add(torch); camera.add(torch.target);
torch.target.position.set(0,0,-1); torch.visible=false;

const MAT={
  floor:new THREE.MeshStandardMaterial({color:0x171c28,roughness:.92}),
  wall:new THREE.MeshStandardMaterial({color:0x1c2231,roughness:.95}),
  steel:new THREE.MeshStandardMaterial({color:0x39415a,roughness:.5,metalness:.7}),
  panel:new THREE.MeshStandardMaterial({color:0x2a3040,roughness:.6,metalness:.5}),
  rack:new THREE.MeshStandardMaterial({color:0x0e1119,roughness:.55,metalness:.5}),
  glass:new THREE.MeshStandardMaterial({color:0x0a1a26,roughness:.15,metalness:.9,transparent:true,opacity:.5}),
  guard:new THREE.MeshStandardMaterial({color:0x1e2433,roughness:.8}),
  vest:new THREE.MeshStandardMaterial({color:0x2c3446,roughness:.7}),
  skin:new THREE.MeshStandardMaterial({color:0x6b5a4c,roughness:.9}),
  dark:new THREE.MeshBasicMaterial({color:0x161b26}),
  paper:new THREE.MeshBasicMaterial({color:0xd8d2bd}),
  green:new THREE.MeshBasicMaterial({color:0x4dff9e}),
  amber:new THREE.MeshBasicMaterial({color:0xffb020}),
  red:new THREE.MeshBasicMaterial({color:0xff2418}),
  cyan:new THREE.MeshBasicMaterial({color:0x5fe6ff})
};
Object.assign(MAT, CFG.materials? CFG.materials(THREE):{});

// ── world ──
const colliders=[];
function box(w,h,d,mat,x,y,z,solid,pad){
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
  m.position.set(x,y,z); scene.add(m);
  if(solid) colliders.push({x,z,hw:w/2+(pad||0),hd:d/2+(pad||0),bot:y-h/2,top:y+h/2});
  return m;
}
function slab(x0,x1,z0,z1,y,mat){
  const m=new THREE.Mesh(new THREE.BoxGeometry(x1-x0,0.3,z1-z0),mat||MAT.floor);
  m.position.set((x0+x1)/2,y-0.15,(z0+z1)/2); scene.add(m); return m;
}

const LV=CFG.levels||[{y:0,name:'GROUND'}];
const PLATE=CFG.plate, TOWER=CFG.tower||null;
const RAMPS=CFG.ramps||[], LANDINGS=CFG.landings||[];

function inTower(x,z){ return TOWER && x>TOWER.x0 && x<TOWER.x1 && z>TOWER.z0 && z<TOWER.z1; }
function groundAt(x,z,curY){
  let best=-99; const take=v=>{ if(v<=curY+0.8 && v>best) best=v; };
  if(x>PLATE.x0&&x<PLATE.x1&&z>PLATE.z0&&z<PLATE.z1) LV.forEach(L=>take(L.y));
  if(inTower(x,z)){
    LANDINGS.forEach(l=>{ if(z>l.z0&&z<l.z1) take(l.y); });
    RAMPS.forEach(r=>{
      if(x<r.x0-0.2||x>r.x1+0.2) return;
      const lo=Math.min(r.zTop,r.zBot), hi=Math.max(r.zTop,r.zBot);
      if(z>lo&&z<hi) take(r.yTop+(r.yBot-r.yTop)*((z-r.zTop)/(r.zBot-r.zTop)));
    });
  }
  return best<-90?curY:best;
}
function blocked(nx,nz,y){
  y=y||0;
  for(const c of colliders){
    if(Math.abs(nx-c.x)>=c.hw+0.38||Math.abs(nz-c.z)>=c.hd+0.38) continue;
    if(c.top!==undefined && c.top<y+0.3) continue;
    if(c.bot!==undefined && c.bot>y+1.8) continue;
    return true;
  }
  return false;
}
function safeSpot(x,z,y){
  if(!blocked(x,z,y)) return {x,z};
  for(let r=0.5;r<=4;r+=0.5) for(let a=0;a<Math.PI*2;a+=Math.PI/8){
    const nx=x+Math.cos(a)*r, nz=z+Math.sin(a)*r;
    if(!blocked(nx,nz,y)) return {x:nx,z:nz};
  }
  return {x,z};
}
function losClear(ax,az,bx,bz,y){
  const dx=bx-ax,dz=bz-az,d=Math.hypot(dx,dz),n=Math.ceil(d/0.7);
  for(let i=1;i<n;i++){ const t=i/n; if(blocked(ax+dx*t,az+dz*t,y||0)) return false; }
  return true;
}

// ── interaction registry ──
const interactables=[];
function addInteract(mesh,def){ mesh.userData.def=def; def.mesh=mesh; interactables.push(mesh); return def; }
const val=v=>typeof v==='function'?v():v;

// ── guards ──
const guards=[];
function addGuard(o){
  const g=new THREE.Group(); scene.add(g);
  const legs=new THREE.Mesh(new THREE.BoxGeometry(0.42,0.9,0.3),MAT.guard); legs.position.y=0.45; g.add(legs);
  const torso=new THREE.Mesh(new THREE.BoxGeometry(0.58,0.8,0.36),MAT.vest); torso.position.y=1.28; g.add(torso);
  const head=new THREE.Mesh(new THREE.BoxGeometry(0.26,0.28,0.26),MAT.skin); head.position.y=1.82; g.add(head);
  const cap=new THREE.Mesh(new THREE.BoxGeometry(0.3,0.1,0.3),MAT.guard); cap.position.y=1.99; g.add(cap);
  const lamp=new THREE.Mesh(new THREE.BoxGeometry(0.1,0.1,0.1),MAT.amber);
  lamp.position.set(0.22,1.55,0.16); g.add(lamp);
  if(o.badge){
    const b=new THREE.Mesh(new THREE.BoxGeometry(0.16,0.22,0.03),
      new THREE.MeshBasicMaterial({color:o.badgeColor||0xd8b25a}));
    b.position.set(-0.22,1.15,0.2); g.add(b);
  }
  const cone=new THREE.Mesh(new THREE.ConeGeometry(2.6,9,14,1,true),
    new THREE.MeshBasicMaterial({color:0xffb020,transparent:true,opacity:0.045,
      side:THREE.DoubleSide,blending:THREE.AdditiveBlending,depthWrite:false}));
  cone.rotation.x=-Math.PI/2; cone.position.set(0,1.5,4.5); g.add(cone);

  const gd={g,path:o.path,speed:o.speed||1.5,name:o.name,level:o.level||0,badge:o.badge||null,
    onSearch:o.onSearch, wp:1,sus:0,down:false,pause:0,lamp,cone,face:0,searched:false,
    mode:'patrol',invest:null,investT:0,alerted:false,seesNow:false,found:false,probe:false,lastSeen:null};
  g.position.set(o.path[0][0],gd.level,o.path[0][1]);
  guards.push(gd);

  const doTake=()=>{
    gd.down=true; S.downed++;
    gd.g.rotation.x=Math.PI/2.1; gd.g.position.y=gd.level+0.25;
    gd.cone.visible=false; gd.lamp.material=MAT.dark;
    gd.loot.position.set(gd.g.position.x,gd.level+0.55,gd.g.position.z+1.0);
    log('Guard down. Press E on the body to search him.','good');
  };
  const doSearch=()=>{
    gd.searched=true;
    if(gd.onSearch) gd.onSearch(gd); else log('Nothing on him worth taking.');
  };
  const body=new THREE.Mesh(new THREE.BoxGeometry(0.7,1.9,0.5),new THREE.MeshBasicMaterial({visible:false}));
  body.position.y=1.0; g.add(body);
  addInteract(body,{
    name:()=>gd.down?'GUARD — OUT COLD':'GUARD', guard:gd,
    hint:()=>gd.down?'Still breathing. Pockets are fair game.':'He has not seen you.',
    verb:()=>gd.down?'SEARCH':'CHOKE OUT',
    locked:()=>{
      if(gd.down) return gd.searched?'Nothing left on him.':null;
      if(gd.sus>55) return 'He is already looking your way. Break off.';
      const dx=P.x-gd.g.position.x, dz=P.z-gd.g.position.z;
      const f=new THREE.Vector3(0,0,1).applyAxisAngle(new THREE.Vector3(0,1,0),gd.g.rotation.y);
      if(f.dot(new THREE.Vector3(dx,0,dz).normalize())>-0.25) return 'Only from behind. Get around him.';
      if(Math.hypot(dx,dz)>1.8) return 'Too far. Closer, and quiet.';
      return null;
    },
    act(){ gd.down?doSearch():doTake(); }
  });
  const loot=new THREE.Mesh(new THREE.BoxGeometry(1.5,1.1,2.6),new THREE.MeshBasicMaterial({visible:false}));
  loot.position.set(0,-100,0); scene.add(loot); gd.loot=loot;
  addInteract(loot,{
    name:'GUARD — OUT COLD',
    hint:()=>gd.searched?'Pockets already turned out.':'Still breathing.',
    verb:'SEARCH', locked:()=>gd.searched?'Nothing left on him.':null,
    act(){ doSearch(); }
  });
  return gd;
}

// ── cameras ──
const seccams=[];
function addCamera(o){
  const g=new THREE.Group(); g.position.set(o.x,o.y,o.z); scene.add(g);
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.32,0.24,0.62),MAT.panel));
  const dot=new THREE.Mesh(new THREE.BoxGeometry(0.07,0.07,0.07),MAT.red);
  dot.position.set(0.13,0.16,0.1); g.add(dot);
  const range=o.range||10;
  const cone=new THREE.Mesh(new THREE.ConeGeometry(2.4,range,14,1,true),
    new THREE.MeshBasicMaterial({color:0xff5a3c,transparent:true,opacity:0.05,
      side:THREE.DoubleSide,blending:THREE.AdditiveBlending,depthWrite:false}));
  cone.rotation.x=-Math.PI/2; cone.position.set(0,-0.8,range/2); g.add(cone);
  const c={g,base:o.base,sweep:o.sweep||0.4,range,dot,cone,sus:0,t:Math.random()*6,
    level:o.level!==undefined?o.level:o.y-3.2};
  seccams.push(c); return c;
}

// ── state ──
const S={playing:false,paused:false,time:0,sus:0,peakSus:0,downed:0,crouch:false,
  camSees:false,camsDown:0,tripped:false,clock:0,hold:0,holdTarget:null,mapDead:false,termOpen:false};
Stealth.S=S;
const P={x:0,z:0,y:0,vx:0,vz:0};
Stealth.P=P;

// ── HUD ──
const H={};
['objText','objWhy','susVal','susFill','susWhy','tags','prompt','reticle','log','stance',
 'progWrap','progFill','progLabel','vig','clockPane','clockVal','mapWrap','mapLevel']
 .forEach(id=>H[id]=document.getElementById(id));
function log(t,cls){
  const d=document.createElement('div'); d.className='line'+(cls?' '+cls:''); d.textContent=t;
  H.log.appendChild(d);
  while(H.log.children.length>4) H.log.removeChild(H.log.firstChild);
  setTimeout(()=>{ if(d.parentNode) d.parentNode.removeChild(d); },7000);
}
const saidBy={};
function sayGuard(gd,t,cls){ if(saidBy[gd.name]===t) return; saidBy[gd.name]=t; log(t,cls);
  setTimeout(()=>{ delete saidBy[gd.name]; },9000); }
function clockText(t){ const m=Math.floor(t/60),s=Math.floor(t%60); return m+':'+String(s).padStart(2,'0'); }

function setObjective(){
  const o=CFG.objective?CFG.objective(S):{t:'—',w:''};
  H.objText.textContent=o.t; H.objWhy.textContent=o.w;
}
function paintHUD(){
  const s=S.sus;
  H.susFill.style.transform='scaleX('+Math.min(1,s/100)+')';
  H.susVal.textContent = s>=100?'MADE':s>62?'SPOTTED':s>18?'SUSPICIOUS':'UNSEEN';
  const hunted=guards.some(g=>!g.down&&g.mode==='hunt');
  if(s>=100){ H.susWhy.textContent='They have you.'; H.susWhy.className='why bad'; }
  else if(s>18){
    H.susWhy.textContent = hunted?'One of them is hunting you. He will not go back to his rounds.'
      : S.camSees?'A camera has you. Break the arc.' : 'Break line of sight and it bleeds down.';
    H.susWhy.className=hunted?'why bad':'why warn';
  } else if(S.crouch){ H.susWhy.textContent='Crouched. They need to be close.'; H.susWhy.className='why ok'; }
  else { H.susWhy.textContent='Nobody is looking at you.'; H.susWhy.className='why'; }

  const tags=CFG.tags?CFG.tags(S):[];
  H.tags.innerHTML=tags.map(t=>'<div class="tag'+(t.cls?' '+t.cls:'')+'">'+t.text+'</div>').join('');
  H.stance.innerHTML=S.crouch?'<b>CROUCHED</b>':'STANDING';

  if(S.tripped){
    H.clockPane.classList.add('on');
    H.clockPane.classList.toggle('low',S.clock<15);
    H.clockVal.textContent=clockText(Math.max(0,S.clock));
  } else H.clockPane.classList.remove('on');
}

// ── overlays ──
const jEl=document.getElementById('journal'), jList=document.getElementById('jList');
function toggleJournal(){
  if(jEl.classList.contains('on')){ jEl.classList.remove('on'); S.paused=false;
    if(S.playing) document.body.requestPointerLock(); }
  else {
    const items=CFG.notes?CFG.notes(S):[];
    jList.innerHTML=items.map(i=>'<div class="jItem'+(i.got?'':' pending')+'"><b>'+
      (i.got?i.t:'— not yet —')+'</b><span>'+(i.got?i.s:'Still out there.')+'</span></div>').join('');
    jEl.classList.add('on'); S.paused=true; document.exitPointerLock();
  }
}
const helpEl=document.getElementById('help');
function toggleHelp(){
  if(helpEl.classList.contains('hidden')){ helpEl.classList.remove('hidden'); S.paused=true; document.exitPointerLock(); }
  else { helpEl.classList.add('hidden'); S.paused=false; if(S.playing) document.body.requestPointerLock(); }
}
const docEl=document.getElementById('doc');
function showDoc(h,b){
  document.getElementById('docHead').textContent=h;
  document.getElementById('docBody').textContent=b;
  docEl.classList.add('on'); S.paused=true; document.exitPointerLock();
}
docEl.onclick=()=>{ docEl.classList.remove('on'); S.paused=false; if(S.playing) document.body.requestPointerLock(); };

const padEl=document.getElementById('pad'); let padBuf='', padCB=null, padCode='';
function openPad(title,code,onOK,hint){
  padCode=code; padCB=onOK; padBuf='';
  document.getElementById('padTitle').textContent=title;
  document.getElementById('padHint').textContent=hint||'Four digits.';
  const v=document.getElementById('padVal'); v.textContent=''; v.className='';
  padEl.classList.add('on'); S.paused=true; document.exitPointerLock();
}
function closePad(){ padEl.classList.remove('on'); S.paused=false; if(S.playing) document.body.requestPointerLock(); }
padEl.querySelectorAll('button').forEach(b=>{
  b.onclick=()=>{
    const k=b.dataset.k, v=document.getElementById('padVal');
    if(k==='x'){ closePad(); return; }
    if(k==='c'){ padBuf=''; v.textContent=''; v.className=''; return; }
    if(padBuf.length>=padCode.length) return;
    padBuf+=k; v.textContent='•'.repeat(padBuf.length);
    if(padBuf.length===padCode.length){
      if(padBuf===padCode){ v.textContent='OK';
        setTimeout(()=>{ closePad(); if(padCB) padCB(); setObjective(); },520); }
      else { v.textContent='NO'; v.className='bad';
        document.getElementById('padHint').textContent='Rejected. That chirp carries.';
        S.sus=Math.min(99,S.sus+14);
        setTimeout(()=>{ padBuf=''; v.textContent=''; v.className=''; },700); }
    }
  };
});

// ═══════════ intrusion terminal ═══════════
// A tap-driven mini-game. The world KEEPS RUNNING while it is open — you are
// stationary and blind to the room, which is the whole risk. Fumbling costs
// detection; the clock running out ends the session.
const termEl=document.getElementById('term');
const termBody=document.getElementById('termBody');
const termTime=document.getElementById('termTime');
const termMsg=document.getElementById('termMsg');
const termStageEl=document.getElementById('termStage');
const GLYPHS=['\u25B2','\u25A0','\u25CF','\u2726','\u25C6','\u2B22'];
let TERM=null;

function termSay(t,cls){ termMsg.textContent=t; termMsg.className=cls||''; }
function termFumble(cost,text){
  S.sus=Math.min(97,S.sus+(cost||8));
  termSay(text||'Rejected. That went somewhere.','bad');
  blip(150,0.14,'square',0.12);
}
function closeTerm(){
  termEl.classList.remove('on'); S.termOpen=false; TERM=null;
  if(S.playing) document.body.requestPointerLock();
}
function openTerminal(o){
  // o: {title, stages:['trace','cycle','lock'], time, onWin}
  TERM={o, i:0, t:o.time||26, total:o.time||26};
  S.termOpen=true;
  termEl.classList.add('on');
  document.getElementById('termTitle').textContent=o.title||'TERMINAL';
  document.exitPointerLock();
  runStage();
}
function runStage(){
  if(!TERM) return;
  const st=TERM.o.stages[TERM.i];
  termStageEl.textContent='STAGE '+(TERM.i+1)+' / '+TERM.o.stages.length+'  ·  '+st.toUpperCase();
  termBody.innerHTML='';
  if(st==='trace') stageTrace();
  else if(st==='cycle') stageCycle();
  else stageLock();
}
function stageDone(){
  if(!TERM) return;
  TERM.i++;
  if(TERM.i>=TERM.o.stages.length){
    termSay('Session open.','good');
    blip(660,0.12,'triangle',0.16); setTimeout(()=>blip(990,0.18,'triangle',0.14),110);
    const cb=TERM.o.onWin;
    setTimeout(()=>{ closeTerm(); if(cb) cb(); setObjective(); },600);
  } else {
    termSay('Layer down. Next.','good');
    TERM.t=Math.min(TERM.total,TERM.t+6);
    setTimeout(runStage,450);
  }
}

// stage 1 — retrace the route the packets took
function stageTrace(){
  const hint=document.createElement('div'); hint.className='termHint';
  hint.textContent='A route flashes across the switch. Tap the same nodes back, in order.';
  const grid=document.createElement('div'); grid.className='grid';
  const cells=[];
  for(let i=0;i<25;i++){
    const c=document.createElement('div'); c.className='cell'; grid.appendChild(c); cells.push(c);
  }
  termBody.appendChild(hint); termBody.appendChild(grid);
  const path=[]; while(path.length<5){ const n=(Math.random()*25)|0; if(!path.includes(n)) path.push(n); }
  let step=0, armed=false;
  path.forEach((n,k)=>{
    setTimeout(()=>{ cells[n].classList.add('lit'); blip(520+k*80,0.09,'square',0.08); },420+k*430);
    setTimeout(()=>{ cells[n].classList.remove('lit'); },420+k*430+330);
  });
  setTimeout(()=>{ armed=true; termSay('Your turn.'); },420+path.length*430+150);
  cells.forEach((c,idx)=>{
    c.onclick=()=>{
      if(!armed||!TERM) return;
      if(idx===path[step]){
        c.classList.add('ok'); blip(760+step*60,0.07,'square',0.09); step++;
        if(step>=path.length) stageDone();
      } else {
        c.classList.add('no'); setTimeout(()=>c.classList.remove('no'),260);
        step=0; cells.forEach(x=>x.classList.remove('ok'));
        termFumble(9,'Wrong node. The switch logged that.');
      }
    };
  });
}
// stage 2 — line the glyphs up with the header
function stageCycle(){
  const hint=document.createElement('div'); hint.className='termHint';
  hint.textContent='Four fields, one header. Tap each field until it matches above it.';
  const tgtRow=document.createElement('div'); tgtRow.className='target';
  const row=document.createElement('div'); row.className='dials';
  const want=[], cur=[];
  for(let i=0;i<4;i++){
    want.push((Math.random()*GLYPHS.length)|0);
    cur.push((want[i]+1+((Math.random()*(GLYPHS.length-1))|0))%GLYPHS.length);
    const t=document.createElement('div'); t.className='tgl'; t.textContent=GLYPHS[want[i]]; tgtRow.appendChild(t);
  }
  const btns=[];
  for(let i=0;i<4;i++){
    const b=document.createElement('button'); b.className='dial'; b.textContent=GLYPHS[cur[i]];
    b.onclick=()=>{
      if(!TERM) return;
      cur[i]=(cur[i]+1)%GLYPHS.length; b.textContent=GLYPHS[cur[i]];
      b.classList.toggle('set',cur[i]===want[i]);
      blip(420+i*70,0.05,'square',0.06);
      if(cur.every((v,k)=>v===want[k])) stageDone();
    };
    row.appendChild(b); btns.push(b);
    if(cur[i]===want[i]) b.classList.add('set');
  }
  termBody.appendChild(hint); termBody.appendChild(tgtRow); termBody.appendChild(row);
  termSay('No penalty for over-shooting. Only the clock.');
}
// stage 3 — catch the carrier three times, window shrinks
function stageLock(){
  const hint=document.createElement('div'); hint.className='termHint';
  hint.textContent='Catch the carrier inside the window. Three times, and it gets narrower.';
  const track=document.createElement('div'); track.className='lockTrack';
  const win=document.createElement('div'); win.id='lockWin';
  const mark=document.createElement('div'); mark.id='lockMark';
  track.appendChild(win); track.appendChild(mark);
  const pips=document.createElement('div'); pips.className='pips';
  const pipEls=[]; for(let i=0;i<3;i++){ const p=document.createElement('div'); p.className='pip'; pips.appendChild(p); pipEls.push(p); }
  const btn=document.createElement('button'); btn.className='termBtn'; btn.textContent='LOCK';
  termBody.appendChild(hint); termBody.appendChild(track); termBody.appendChild(pips); termBody.appendChild(btn);
  let hits=0, wWidth=26, wPos=Math.random()*60+8, pos=0, dir=1, speed=58;
  const place=()=>{ win.style.left=wPos+'%'; win.style.width=wWidth+'%'; };
  place();
  TERM.lock=setInterval(()=>{
    if(!TERM) return;
    pos+=dir*speed*0.03;
    if(pos>100){pos=100;dir=-1;} if(pos<0){pos=0;dir=1;}
    mark.style.left=pos+'%';
  },30);
  btn.onclick=()=>{
    if(!TERM) return;
    if(pos>=wPos && pos<=wPos+wWidth){
      hits++; pipEls[hits-1].classList.add('on');
      blip(700+hits*140,0.1,'triangle',0.13);
      if(hits>=3){ clearInterval(TERM.lock); TERM.lock=null; stageDone(); return; }
      wWidth=Math.max(11,wWidth-6); wPos=Math.random()*(96-wWidth); speed+=16; place();
      termSay('Locked. Tighter now.','good');
    } else termFumble(7,'Missed the window. Carrier spiked.');
  };
}
document.getElementById('termAbort').onclick=()=>{
  if(TERM&&TERM.lock) clearInterval(TERM.lock);
  termSay('Session dropped.');
  closeTerm();
};
function tickTerm(dt){
  if(!TERM) return;
  TERM.t-=dt;
  termTime.style.transform='scaleX('+Math.max(0,TERM.t/TERM.total)+')';
  termTime.classList.toggle('low',TERM.t<6);
  if(TERM.t<=0){
    if(TERM.lock) clearInterval(TERM.lock);
    S.sus=Math.min(99,S.sus+22);
    termSay('Session timed out.','bad');
    blip(120,0.5,'sawtooth',0.18);
    setTimeout(closeTerm,400);
    TERM=null;
  }
}

// ── input ──
const keys={}; let eTap=false, yaw=Math.PI, pitch=0, locked=false, SENS=14;
const sensEl=document.getElementById('sens'), sensVal=document.getElementById('sensVal');
sensEl.oninput=()=>{ SENS=+sensEl.value; sensVal.textContent=SENS; };
addEventListener('keydown',e=>{
  const k=e.key.toLowerCase();
  if(k==='tab'||k==='q'){ e.preventDefault(); if(S.playing) toggleJournal(); return; }
  if(k===' ') e.preventDefault();
  const fresh=!keys[k]; keys[k]=true; if(!fresh) return;
  if(k==='e') eTap=true;
  if(k==='f') torch.visible=!torch.visible;
  if(k==='c'&&S.playing) S.crouch=!S.crouch;
  if(k==='h'||k==='?'||k==='/'){ e.preventDefault(); toggleHelp(); }
  if(k==='m'){ muted=!muted; if(master) master.gain.value=muted?0:0.5; log(muted?'Audio muted.':'Audio live.'); }
  if(k==='n'){ musicOn=!musicOn; log(musicOn?'Score on.':'Score off.'); }
});
addEventListener('keyup',e=>{ keys[e.key.toLowerCase()]=false; });
addEventListener('mousemove',e=>{
  if(!locked) return;
  const s=SENS*0.00016;
  yaw-=e.movementX*s; pitch=Math.max(-1.25,Math.min(1.25,pitch-e.movementY*s));
});
document.addEventListener('pointerlockchange',()=>{ locked=document.pointerLockElement===document.body; });
renderer.domElement.addEventListener('click',()=>{
  if(S.playing && !S.termOpen && !padEl.classList.contains('on') && !docEl.classList.contains('on')
     && !jEl.classList.contains('on') && helpEl.classList.contains('hidden'))
    document.body.requestPointerLock();
});

function move(dt){
  const running=(keys['shift']||keys['r'])&&!S.crouch;
  const spd=S.crouch?1.35:(running?4.4:2.7);
  let fx=0,fz=0;
  if(keys['w']) fz-=1; if(keys['s']) fz+=1;
  if(keys['a']) fx-=1; if(keys['d']) fx+=1;
  const len=Math.hypot(fx,fz)||1; fx/=len; fz/=len;
  const sin=Math.sin(yaw), cos=Math.cos(yaw);
  const wx=fx*cos+fz*sin, wz=-fx*sin+fz*cos;
  P.vx+=(wx*spd-P.vx)*Math.min(1,dt*12);
  P.vz+=(wz*spd-P.vz)*Math.min(1,dt*12);
  const nx=P.x+P.vx*dt, nz=P.z+P.vz*dt;
  if(!blocked(nx,P.z,P.y)) P.x=nx; else P.vx=0;
  if(!blocked(P.x,nz,P.y)) P.z=nz; else P.vz=0;
  const gy=groundAt(P.x,P.z,P.y);
  P.y+=(gy-P.y)*Math.min(1,dt*(gy>P.y?9:14));
  if(Math.abs(gy-P.y)<0.02) P.y=gy;
  const bob=Math.sin(performance.now()*0.012)*Math.min(0.05,Math.hypot(P.vx,P.vz)*0.014);
  camera.position.set(P.x,P.y+(S.crouch?1.05:1.65)+bob,P.z);
  camera.rotation.set(pitch,yaw,0);
  return running;
}

// ── sensing ──
function tickCams(dt){
  let worst=0, seen=false;
  if(S.camsDown>0){
    S.camsDown-=dt;
    seccams.forEach(c=>{ c.sus=Math.max(0,c.sus-60*dt); c.cone.visible=false;
      c.dot.material=new THREE.MeshBasicMaterial({color:0x1a1f2c}); worst=Math.max(worst,c.sus); });
    if(S.camsDown<=0){ S.camsDown=0; seccams.forEach(c=>c.cone.visible=true);
      log('Cameras back up.','warn'); }
    S.camSees=false; return worst;
  }
  seccams.forEach(c=>{
    c.t+=dt; c.g.rotation.y=c.base+Math.sin(c.t*c.sweep)*0.9;
    const dx=P.x-c.g.position.x, dz=P.z-c.g.position.z, dist=Math.hypot(dx,dz);
    const same=Math.abs(c.level-P.y)<2.2;
    let sees=false;
    if(same && dist<c.range*(S.crouch?0.9:1)){
      const f=new THREE.Vector3(0,0,1).applyAxisAngle(new THREE.Vector3(0,1,0),c.g.rotation.y);
      if(f.dot(new THREE.Vector3(dx,0,dz).normalize())>0.88 &&
         losClear(c.g.position.x,c.g.position.z,P.x,P.z,P.y)) sees=true;
    }
    if(sees){ c.sus=Math.min(100,c.sus+26*dt); seen=true; } else c.sus=Math.max(0,c.sus-13*dt);
    c.dot.material=new THREE.MeshBasicMaterial({color:c.sus>62?0xff2418:c.sus>22?0xffb020:0x5a1410});
    c.cone.material.opacity=sees?0.12:0.05;
    worst=Math.max(worst,c.sus);
  });
  S.camSees=seen; return worst;
}
function tickGuards(dt,running){
  let loudest=0;
  guards.forEach(gd=>{
    if(gd.down) return;
    if(gd.pause>0 && gd.mode!=='hunt'){ gd.pause-=dt; }
    else {
      const hunting=gd.mode==='hunt';
      const tgt = hunting ? (gd.seesNow?[P.x,P.z]:(gd.lastSeen?[gd.lastSeen.x,gd.lastSeen.z]:[P.x,P.z]))
        : (gd.mode==='investigate'&&gd.invest?[gd.invest.x,gd.invest.z]:gd.path[gd.wp]);
      const dx=tgt[0]-gd.g.position.x, dz=tgt[1]-gd.g.position.z, d=Math.hypot(dx,dz);
      if(d<0.35){ if(gd.mode==='patrol'){ gd.wp=(gd.wp+1)%gd.path.length; gd.pause=0.6+Math.random()*1.4; } }
      else {
        const sp=gd.speed*(gd.mode==='hunt'?2.1:(gd.mode==='investigate'?1.75:1));
        gd.g.position.x+=dx/d*sp*dt; gd.g.position.z+=dz/d*sp*dt;
        gd.face=Math.atan2(dx,dz);
      }
    }
    let want=gd.face;
    if(gd.sus>30) want=Math.atan2(P.x-gd.g.position.x,P.z-gd.g.position.z);
    const diff=((want-gd.g.rotation.y+Math.PI*3)%(Math.PI*2))-Math.PI;
    gd.g.rotation.y+=diff*Math.min(1,dt*(gd.mode==='hunt'?11:5));

    const dx=P.x-gd.g.position.x, dz=P.z-gd.g.position.z, dist=Math.hypot(dx,dz);
    const same=Math.abs(gd.level-P.y)<1.8;
    const range=9.5*(S.crouch?0.62:1)*(torch.visible?1.35:1)*(S.tripped?1.25:1);
    let sees=false;
    if(same && dist<range){
      const f=new THREE.Vector3(0,0,1).applyAxisAngle(new THREE.Vector3(0,1,0),gd.g.rotation.y);
      if(f.dot(new THREE.Vector3(dx,0,dz).normalize())>0.78 &&
         losClear(gd.g.position.x,gd.g.position.z,P.x,P.z,gd.level)) sees=true;
    }
    gd.seesNow=sees;
    const heard=running && dist<8.5 && same;
    if(sees||heard){
      gd.sus=Math.min(100,gd.sus+(sees?(S.crouch?16:30)*(1-dist/range*0.5):10)*dt);
      if(sees) gd.lastSeen={x:P.x,z:P.z};
      if(sees && gd.sus>58 && !gd.alerted){
        gd.alerted=true; gd.mode='hunt'; gd.invest=null;
        sayGuard(gd,'He has you. That one is coming and he is not stopping.','bad');
        blip(140,0.5,'sawtooth',0.2);
      }
    } else {
      gd.sus=Math.max(gd.alerted?46:0, gd.sus-(gd.alerted?4:11)*dt);
      if(gd.mode==='patrol' && gd.sus>42 && gd.lastSeen){
        gd.mode='investigate'; gd.invest=gd.lastSeen; gd.investT=0; gd.probe=true;
      }
    }
    if(gd.mode==='hunt' && dist<1.5 && same) gd.sus=100;

    guards.forEach(o=>{
      if(!o.down||o===gd||o.found) return;
      if(Math.abs(o.level-gd.level)>1.6) return;
      const bx=o.g.position.x-gd.g.position.x, bz=o.g.position.z-gd.g.position.z;
      if(Math.hypot(bx,bz)<9 && losClear(gd.g.position.x,gd.g.position.z,o.g.position.x,o.g.position.z,gd.level)){
        o.found=true; gd.mode='investigate'; gd.probe=false;
        gd.invest={x:o.g.position.x,z:o.g.position.z}; gd.investT=0;
        gd.sus=Math.max(gd.sus,55);
        sayGuard(gd,'He has found a body. Six seconds before he calls it.','bad');
      }
    });
    if(gd.mode==='investigate'&&gd.invest){
      const ix=gd.invest.x-gd.g.position.x, iz=gd.invest.z-gd.g.position.z;
      if(Math.hypot(ix,iz)<1.6){
        gd.investT+=dt;
        gd.sus=Math.min(gd.probe?70:99, gd.sus+(gd.probe?4:14)*dt);
        if(!gd.probe && gd.investT>6) finish(false,'body');
        if(gd.probe && gd.investT>3.5){ gd.mode='patrol'; gd.invest=null; gd.investT=0; gd.lastSeen=null; }
      }
    }
    const col=gd.sus>62?'#ff2418':gd.sus>22?'#ffb020':'#4dff9e';
    gd.lamp.material=new THREE.MeshBasicMaterial({color:col});
    gd.cone.material.color.set(col);
    gd.cone.material.opacity=gd.sus>25?0.10:0.045;
    loudest=Math.max(loudest,gd.sus);
  });
  return loudest;
}

// ── interaction ──
const ray=new THREE.Raycaster(), centre=new THREE.Vector2(0,0);
let focus=null;
function scan(){
  ray.setFromCamera(centre,camera);
  const hits=ray.intersectObjects(interactables,false);
  const hit=(hits.length&&hits[0].distance<3.2)?hits[0].object:null;
  focus=hit?hit.userData.def:null;
  H.reticle.className='';
  if(!focus){ H.prompt.classList.remove('on');
    if(S.holdTarget){ S.holdTarget=null; S.hold=0; H.progWrap.classList.remove('on'); } return; }
  const why=focus.locked?focus.locked():null;
  const kill=focus.guard&&!focus.guard.down&&!why;
  H.reticle.className=kill?'kill':'hot';
  H.prompt.className='on'+(why?' locked':'')+(kill?' kill':'');
  H.prompt.innerHTML='<b>'+val(focus.name)+'</b><i>'+(why||val(focus.hint))+'</i>'+(why?'':'<em>'+val(focus.verb)+'</em>');
}
function tryUse(dt,tap){
  if(!focus) return;
  if(focus.locked && focus.locked()) return;
  if(focus.hold){
    if(S.holdTarget!==focus){ S.holdTarget=focus; S.hold=0; }
    S.hold+=dt;
    H.progWrap.classList.add('on');
    H.progLabel.textContent=String(val(focus.verb)).replace('HOLD E — ','')+' — '+Math.round(S.hold/focus.hold*100)+'%';
    H.progFill.style.transform='scaleX('+Math.min(1,S.hold/focus.hold)+')';
    if(S.hold>=focus.hold){ H.progWrap.classList.remove('on'); S.holdTarget=null; S.hold=0; focus.act(); }
  } else if(tap) focus.act();
}

// ── minimap ──
const mapCv=document.getElementById('minimap'), mx=mapCv.getContext('2d');
const MAPR=120, MAPSCALE=CFG.mapScale||3.4;
function nearestLevel(){ let b=0,bd=99; LV.forEach((L,i)=>{ const d=Math.abs(L.y-P.y); if(d<bd){bd=d;b=i;} }); return b; }
function drawMap(){
  const dead=S.mapDead;
  H.mapWrap.classList.toggle('dead',dead);
  mx.setTransform(1,0,0,1,0,0); mx.clearRect(0,0,240,240);
  const li=nearestLevel();
  H.mapLevel.textContent = dead?'NO SIGNAL':LV[li].name;
  if(dead) return;
  mx.save();
  mx.beginPath(); mx.arc(MAPR,MAPR,MAPR-2,0,Math.PI*2); mx.clip();
  mx.translate(MAPR,MAPR); mx.rotate(yaw); mx.scale(MAPSCALE,MAPSCALE); mx.translate(-P.x,-P.z);
  mx.fillStyle='rgba(24,34,52,.85)';
  mx.fillRect(PLATE.x0,PLATE.z0,PLATE.x1-PLATE.x0,PLATE.z1-PLATE.z0);
  mx.strokeStyle='rgba(120,140,180,.55)'; mx.lineWidth=1.6/MAPSCALE;
  mx.strokeRect(PLATE.x0,PLATE.z0,PLATE.x1-PLATE.x0,PLATE.z1-PLATE.z0);
  if(TOWER){
    mx.fillStyle='rgba(95,230,255,.12)';
    mx.fillRect(TOWER.x0,TOWER.z0,TOWER.x1-TOWER.x0,TOWER.z1-TOWER.z0);
    mx.strokeStyle='rgba(95,230,255,.5)';
    mx.strokeRect(TOWER.x0,TOWER.z0,TOWER.x1-TOWER.x0,TOWER.z1-TOWER.z0);
  }
  const dot=(x,z,r,f)=>{ mx.fillStyle=f; mx.beginPath(); mx.arc(x,z,r,0,Math.PI*2); mx.fill(); };
  if(CFG.mapMarks) CFG.mapMarks(S,li).forEach(m=>dot(m.x,m.z,m.r||0.7,m.c));
  const ly=LV[li].y;
  seccams.forEach(c=>{
    if(Math.abs(c.level-ly)>2.2) return;
    const a=c.g.rotation.y;
    mx.fillStyle=c.sus>22?'rgba(255,36,24,.28)':'rgba(255,90,60,.16)';
    mx.beginPath(); mx.moveTo(c.g.position.x,c.g.position.z);
    for(let t=-0.5;t<=0.5;t+=0.1) mx.lineTo(c.g.position.x+Math.sin(a+t)*c.range,c.g.position.z+Math.cos(a+t)*c.range);
    mx.closePath(); mx.fill();
    dot(c.g.position.x,c.g.position.z,0.55,'#ff5a3c');
  });
  guards.forEach(g=>{
    const other=Math.abs(g.level-ly)>1.8, gx=g.g.position.x, gz=g.g.position.z, a=g.g.rotation.y;
    if(g.down){ dot(gx,gz,0.8,other?'rgba(120,130,160,.35)':'rgba(160,170,200,.85)'); return; }
    mx.globalAlpha=other?0.28:1;
    mx.fillStyle=g.sus>62?'rgba(255,36,24,.22)':g.sus>22?'rgba(255,176,32,.18)':'rgba(77,255,158,.12)';
    mx.beginPath(); mx.moveTo(gx,gz);
    for(let t=-0.62;t<=0.62;t+=0.12) mx.lineTo(gx+Math.sin(a+t)*9,gz+Math.cos(a+t)*9);
    mx.closePath(); mx.fill();
    dot(gx,gz,0.85,g.sus>62?'#ff2418':g.sus>22?'#ffb020':'#4dff9e');
    mx.globalAlpha=1;
  });
  mx.restore();
  mx.save(); mx.translate(MAPR,MAPR); mx.fillStyle='#fff';
  mx.beginPath(); mx.moveTo(0,-9); mx.lineTo(6.5,7); mx.lineTo(0,3.5); mx.lineTo(-6.5,7); mx.closePath(); mx.fill();
  mx.restore();
}

// ── score ──
let AC=null,master=null,muted=false,musicOn=true,MUSIC=null,NOISE=null;
function noiseBuf(){ if(NOISE) return NOISE;
  const n=AC.sampleRate*0.4; NOISE=AC.createBuffer(1,n,AC.sampleRate);
  const d=NOISE.getChannelData(0); for(let i=0;i<n;i++) d[i]=Math.random()*2-1; return NOISE; }
const mn=m=>440*Math.pow(2,(m-69)/12);
function initAudio(){
  if(AC) return;
  AC=new (window.AudioContext||window.webkitAudioContext)();
  master=AC.createGain(); master.gain.value=0.5; master.connect(AC.destination);
  const bus=AC.createGain(); bus.gain.value=0; bus.connect(master);
  const delay=AC.createDelay(1.4),fb=AC.createGain(),send=AC.createGain();
  fb.gain.value=0.34; send.gain.value=0.26;
  delay.connect(fb); fb.connect(delay); delay.connect(send); send.connect(bus);
  MUSIC={bus,delay,step:0,next:0,bpm:CFG.bpm||108,intensity:1};
  MUSIC.delay.delayTime.value=60/MUSIC.bpm/2;
  setInterval(schedule,25);
}
function blip(f,d,t,v){ if(!AC||muted) return;
  const o=AC.createOscillator(),g=AC.createGain(); o.type=t||'square'; o.frequency.value=f;
  g.gain.setValueAtTime(v||0.15,AC.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0008,AC.currentTime+(d||0.12));
  o.connect(g); g.connect(master); o.start(); o.stop(AC.currentTime+(d||0.12)+0.02); }
function sBass(f,t,dur){ const o=AC.createOscillator(); o.type='triangle';
  o.frequency.setValueAtTime(f*0.87,t); o.frequency.exponentialRampToValueAtTime(f,t+0.04);
  const lp=AC.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=760;
  const g=AC.createGain(); g.gain.setValueAtTime(0.0001,t);
  g.gain.exponentialRampToValueAtTime(0.4,t+0.012); g.gain.exponentialRampToValueAtTime(0.02,t+dur);
  o.connect(lp); lp.connect(g); g.connect(MUSIC.bus); o.start(t); o.stop(t+dur+0.03); }
function sHat(t,v){ const s=AC.createBufferSource(); s.buffer=noiseBuf();
  const f=AC.createBiquadFilter(); f.type='highpass'; f.frequency.value=6800;
  const g=AC.createGain(); g.gain.setValueAtTime(v,t); g.gain.exponentialRampToValueAtTime(0.0006,t+0.06);
  s.connect(f); f.connect(g); g.connect(MUSIC.bus); s.start(t); s.stop(t+0.08); }
function sKick(t,v){ const o=AC.createOscillator(); o.type='sine';
  o.frequency.setValueAtTime(126,t); o.frequency.exponentialRampToValueAtTime(44,t+0.08);
  const g=AC.createGain(); g.gain.setValueAtTime(v||0.5,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.2);
  o.connect(g); g.connect(MUSIC.bus); o.start(t); o.stop(t+0.22); }
function sTick(f,t){ const o=AC.createOscillator(); o.type='square'; o.frequency.value=f;
  const g=AC.createGain(); g.gain.setValueAtTime(0.0001,t);
  g.gain.exponentialRampToValueAtTime(0.07,t+0.004); g.gain.exponentialRampToValueAtTime(0.0007,t+0.07);
  o.connect(g); g.connect(MUSIC.bus); g.connect(MUSIC.delay); o.start(t); o.stop(t+0.09); }
function sPad(f,t,dur){ const g=AC.createGain();
  g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.055,t+0.3);
  g.gain.exponentialRampToValueAtTime(0.0008,t+dur);
  const lp=AC.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=1500; lp.Q.value=2;
  lp.connect(g); g.connect(MUSIC.bus);
  [-9,0,9].forEach(d=>{ const o=AC.createOscillator(); o.type='sawtooth'; o.frequency.value=f; o.detune.value=d;
    o.connect(lp); o.start(t); o.stop(t+dur+0.05); }); }
const BARS=CFG.bars||[{r:33,t:[0,3,7]},{r:33,t:[0,3,10]},{r:29,t:[0,4,7]},{r:31,t:[0,3,7]}];
const OST=[0,7,12,7,0,7,15,7,0,7,12,7,15,12,7,3];
function playStep(st,t,spb){
  const B=BARS[(st>>4)&3], i=MUSIC.intensity, b=st%16;
  if(i<=0) return;
  if(b%2===0) sBass(mn(B.r-12+(b===8?7:0)),t,spb*1.8);
  if(i>=2) sTick(mn(B.r+12+OST[b]),t);
  if(i>=1) sHat(t,(b%2)?0.028:0.016);
  if(i>=2&&(b===0||b===6||b===10)) sKick(t,i>=3?0.58:0.4);
  if(i>=2&&b===0) B.t.forEach((iv,k)=>sPad(mn(B.r+12+iv),t+k*0.02,spb*14));
  if(i>=3&&b===8) sKick(t,0.5);
  if(i>=4&&b%4===0) sKick(t,0.62);
}
function schedule(){
  if(!MUSIC||!AC||AC.state!=='running') return;
  const spb=60/MUSIC.bpm/4;
  while(MUSIC.next<AC.currentTime+0.12){
    if(MUSIC.next<AC.currentTime) MUSIC.next=AC.currentTime+0.02;
    playStep(MUSIC.step,MUSIC.next,spb);
    MUSIC.next+=spb; MUSIC.step=(MUSIC.step+1)&63;
  }
}
function updateMusic(dt){
  if(!MUSIC) return;
  const s=S.sus;
  MUSIC.intensity = !musicOn?0 : !S.playing?1 : S.tripped?4 : s>62?4 : s>22?3 : 2;
  const vol=!musicOn?0:(S.playing?0.32:0.18);
  MUSIC.bus.gain.value+=(vol-MUSIC.bus.gain.value)*Math.min(1,dt*2);
  const bpm=(CFG.bpm||108)+(S.playing?Math.min(40,s*0.5)+(S.tripped?18:0):0);
  MUSIC.bpm+=(bpm-MUSIC.bpm)*Math.min(1,dt*1.1);
  MUSIC.delay.delayTime.value=60/MUSIC.bpm/2;
}

// ── run control ──
const menu=document.getElementById('menu'), endS=document.getElementById('end');
function start(){
  initAudio(); if(AC.state==='suspended') AC.resume();
  Object.assign(S,{playing:true,paused:false,time:0,sus:0,peakSus:0,downed:0,crouch:false,
    camSees:false,camsDown:0,tripped:false,clock:0,hold:0,holdTarget:null,mapDead:false,termOpen:false});
  termEl.classList.remove('on'); TERM=null;
  if(CFG.reset) CFG.reset(S);
  guards.forEach(g=>{
    g.down=false; g.searched=false; g.sus=0; g.wp=1; g.pause=0; g.mode='patrol';
    g.invest=null; g.investT=0; g.alerted=false; g.seesNow=false; g.found=false; g.probe=false; g.lastSeen=null;
    g.g.rotation.set(0,0,0); g.g.position.set(g.path[0][0],g.level,g.path[0][1]);
    g.cone.visible=true; g.lamp.material=new THREE.MeshBasicMaterial({color:0x4dff9e});
    g.loot.position.set(0,-100,0);
  });
  seccams.forEach(c=>{ c.sus=0; c.cone.visible=true; });
  const sp=CFG.spawn;
  P.x=sp.x; P.z=sp.z; P.y=sp.y; P.vx=0; P.vz=0; yaw=sp.yaw!==undefined?sp.yaw:Math.PI; pitch=0;
  torch.visible=false;
  menu.classList.add('hidden'); endS.classList.add('hidden'); helpEl.classList.add('hidden');
  jEl.classList.remove('on'); docEl.classList.remove('on'); padEl.classList.remove('on');
  setObjective(); paintHUD(); drawMap();
  (CFG.intro||[]).forEach((l,i)=>setTimeout(()=>log(l.t||l,l.cls||'warn'),i*40));
  document.body.requestPointerLock();
}
function finish(won,why){
  if(!S.playing) return;
  S.playing=false; document.exitPointerLock();
  H.prompt.classList.remove('on'); H.progWrap.classList.remove('on'); H.vig.style.opacity=0;
  document.getElementById('eTime').textContent=clockText(S.time);
  document.getElementById('eDown').textContent=S.downed;
  document.getElementById('ePeak').textContent=Math.round(S.peakSus)+'%';
  const v=CFG.verdict?CFG.verdict(won,why,S):{title:won?'CLEAN':'MADE',text:''};
  document.getElementById('endTitle').textContent=v.title;
  let txt=v.text;
  const cont=document.getElementById('continueBtn');
  if(won&&CAMPAIGN){
    const nxt=Night.nextURL(S.time,S.downed);
    const last=LEG>=Night.count;
    cont.style.display='';
    cont.textContent=last?'Finish the night':'Back to the car';
    cont.onclick=()=>location.href=nxt;
    txt+='  Night so far: '+clockText(Night.total(S.time))+' — leg '+LEG+' of '+Night.count+'.';
  } else cont.style.display='none';
  document.getElementById('endWhy').textContent=txt;
  endS.classList.remove('hidden');
}
Stealth.finish=finish;

// ── loop ──
let last=performance.now(), mapT=0;
function frame(now){
  requestAnimationFrame(frame);
  const dt=Math.min((now-last)/1000,0.05); last=now;
  if(S.playing && !S.paused){
    S.time+=dt;
    const running = S.termOpen ? false : move(dt);
    if(S.termOpen) tickTerm(dt); else scan();
    if(!S.termOpen && keys['e']) tryUse(dt,eTap);
    else if(S.holdTarget){ S.holdTarget=null; S.hold=0; H.progWrap.classList.remove('on'); }
    eTap=false;
    if(S.tripped){ S.clock-=dt; if(S.clock<=0) finish(false,'alarm'); }
    if(CFG.tick) CFG.tick(dt,S,api);
    S.sus=Math.max(tickGuards(dt,running),tickCams(dt));
    S.peakSus=Math.max(S.peakSus,S.sus);
    H.vig.style.opacity=S.sus>50?Math.min(0.8,(S.sus-50)/50):0;
    if(S.sus>=100) finish(false,'made');
    paintHUD();
    mapT-=dt; if(mapT<=0){ mapT=1/24; drawMap(); }
  }
  updateMusic(dt);
  renderer.render(scene,camera);
}

document.getElementById('startBtn').onclick=start;
document.getElementById('againBtn').onclick=start;
document.getElementById('menuBackBtn').onclick=()=>location.href='index.html';
document.getElementById('endBackBtn').onclick=()=>location.href='index.html';
document.getElementById('helpCloseBtn').onclick=toggleHelp;
document.getElementById('helpMenuBtn').onclick=()=>location.href='index.html';
addEventListener('resize',()=>{
  camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
});

// ── builder api handed to the mission ──
const api={THREE,scene,MAT,box,slab,colliders,addInteract,addGuard,addCamera,
  log,showDoc,openPad,openTerminal,safeSpot,blocked,groundAt,losClear,setObjective,finish,blip,
  P,S,guards,seccams,LV,PLATE,TOWER,
  trip(seconds){ S.tripped=true; S.clock=seconds;
    guards.forEach(g=>{ if(!g.down){ g.alerted=true; g.sus=Math.max(g.sus,50); } }); },
  killCams(sec){ S.camsDown=sec; }
};
CFG.build(api);
setObjective(); paintHUD(); drawMap();
requestAnimationFrame(frame);
};
})(window);
