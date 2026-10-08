/* ============================================================
   NEON ECHO — main game script (vanilla ES6+)
   Modules: Config, AudioManager, Particles, UIManager,
            SequenceManager, GlitchManager, GameState
   ============================================================ */
'use strict';

/* ---------------- CONFIG ---------------- */
const CONFIG = {
  difficulties: {
    easy:   { startLen:3, bpm: 90, addPerRound:1, glitchEvery:5, inputWindow:2200, mult:1   },
    medium: { startLen:4, bpm:120, addPerRound:1, glitchEvery:3, inputWindow:1500, mult:1.5 },
    hard:   { startLen:4, bpm:160, addPerRound:2, glitchEvery:2, inputWindow:1000, mult:2.2 },
  },
  // Pentatonic-ish frequencies for pleasant chord
  freqs: [261.63, 329.63, 392.00, 523.25, 659.25, 783.99], // C4, E4, G4, C5, E5, G5
  symbols: ['◆','▲','●','■','★','✦'],
};

/* ---------------- AUDIO ---------------- */
class AudioManager {
  constructor(){ this.ctx=null; this.enabled=true; this.master=null; this.reverb=null; }
  init(){
    if(this.ctx) return;
    const C = window.AudioContext || window.webkitAudioContext;
    this.ctx = new C();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    // Simple convolver "reverb" via short noise buffer
    const ir = this.ctx.createBuffer(2, this.ctx.sampleRate*1.2, this.ctx.sampleRate);
    for(let c=0;c<2;c++){
      const d = ir.getChannelData(c);
      for(let i=0;i<d.length;i++){
        d[i] = (Math.random()*2-1) * Math.pow(1 - i/d.length, 2.5);
      }
    }
    this.reverb = this.ctx.createConvolver();
    this.reverb.buffer = ir;
    const wet = this.ctx.createGain(); wet.gain.value = 0.18;
    this.reverb.connect(wet).connect(this.ctx.destination);
    this.master.connect(this.ctx.destination);
    this.master.connect(this.reverb);
  }
  resume(){ this.ctx && this.ctx.state==='suspended' && this.ctx.resume(); }
  setEnabled(v){ this.enabled=v; if(this.master) this.master.gain.value = v?0.5:0; }

  /** Play synth note */
  tone(freq, dur=0.35, type='sawtooth', vol=0.22){
    if(!this.enabled||!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const o2 = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const filt = this.ctx.createBiquadFilter();
    filt.type='lowpass'; filt.frequency.value=2200; filt.Q.value=6;
    o.type=type; o2.type='triangle';
    o.frequency.value=freq; o2.frequency.value=freq*2.01;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t+0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
    o.connect(g); o2.connect(g); g.connect(filt); filt.connect(this.master);
    o.start(t); o2.start(t); o.stop(t+dur); o2.stop(t+dur);
  }
  pad(i){ this.tone(CONFIG.freqs[i], 0.4, 'sawtooth', 0.18); }
  success(){ [0,2,4].forEach((n,k)=>setTimeout(()=>this.tone(CONFIG.freqs[n]*1.5, .18, 'square', .15), k*60)); }
  fail(){ this.tone(70,.6,'square',.25); setTimeout(()=>this.tone(55,.6,'sawtooth',.2),60); }
  blip(){ this.tone(880,.08,'square',.1); }
  click(){ this.tone(1200,.04,'square',.06); }
}

/* ---------------- PARTICLES ---------------- */
class Particles {
  constructor(canvas){
    this.cv=canvas; this.ctx=canvas.getContext('2d'); this.p=[]; this.dpr=Math.min(devicePixelRatio||1,2);
    this.resize(); addEventListener('resize',()=>this.resize());
    this.tick = this.tick.bind(this); requestAnimationFrame(this.tick);
    this.reduced=false;
    // ambient drift
    for(let i=0;i<50;i++) this.p.push(this.spawnAmbient());
  }
  resize(){
    const w=innerWidth, h=innerHeight;
    this.cv.width=w*this.dpr; this.cv.height=h*this.dpr;
    this.cv.style.width=w+'px'; this.cv.style.height=h+'px';
    this.ctx.scale(this.dpr,this.dpr);
  }
  spawnAmbient(){
    return { x:Math.random()*innerWidth, y:Math.random()*innerHeight,
      vx:(Math.random()-.5)*.15, vy:-(.1+Math.random()*.3),
      r:Math.random()*1.6+.4, life:Infinity, c:this.randColor(), a:Math.random()*.6+.2, amb:true };
  }
  randColor(){ return ['#00f0ff','#ff2bd6','#9b5cff','#9bff3b'][Math.floor(Math.random()*4)]; }
  burst(x,y,color,n=18){
    if(this.reduced) return;
    for(let i=0;i<n;i++){
      const a=Math.random()*Math.PI*2, s=Math.random()*4+1;
      this.p.push({ x,y, vx:Math.cos(a)*s, vy:Math.sin(a)*s, r:Math.random()*2.5+1, life:40+Math.random()*20, c:color, a:1 });
    }
  }
  tick(){
    const ctx=this.ctx; ctx.clearRect(0,0,innerWidth,innerHeight);
    for(let i=this.p.length-1;i>=0;i--){
      const p=this.p[i];
      p.x+=p.vx; p.y+=p.vy;
      if(!p.amb){ p.vy+=.05; p.life--; p.a=Math.max(0,p.life/60); }
      if(p.amb && (p.y<-10||p.x<-10||p.x>innerWidth+10)){ Object.assign(p,this.spawnAmbient(),{y:innerHeight+10}); }
      ctx.globalAlpha=p.a;
      ctx.fillStyle=p.c;
      ctx.shadowBlur=10; ctx.shadowColor=p.c;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
      if(!p.amb && p.life<=0) this.p.splice(i,1);
    }
    ctx.globalAlpha=1; ctx.shadowBlur=0;
    requestAnimationFrame(this.tick);
  }
}

/* ---------------- UTIL ---------------- */
const sleep = ms => new Promise(r=>setTimeout(r,ms));
const $ = id => document.getElementById(id);

/* ---------------- GLITCH ---------------- */
class GlitchManager {
  constructor(board){ this.board=board; this.active=null; }
  clear(){
    this.board.classList.remove('rot90','rot180','rot270','mirror','invert','flash');
    this.active=null;
  }
  random(round, diff){
    this.clear();
    const pool = ['rot90','rot180','rot270','mirror','invert','flash','fake'];
    // hard adds intensity
    const pick = pool[Math.floor(Math.random()*pool.length)];
    if(pick!=='fake') this.board.classList.add(pick);
    this.active = pick;
    return pick;
  }
  fakePulse(pads){
    const idx = Math.floor(Math.random()*pads.length);
    pads[idx].classList.add('lit');
    setTimeout(()=>pads[idx].classList.remove('lit'), 180);
  }
}

/* ---------------- MAIN GAME ---------------- */
class NeonEcho {
  constructor(){
    this.audio = new AudioManager();
    this.particles = new Particles($('particles'));
    this.board = $('board');
    this.glitch = new GlitchManager(this.board);

    this.state = {
      diff:'easy', layout:'2x2', soundOn:true, reduced:false, cb:false,
      seq:[], inputIdx:0, round:1, score:0, combo:0, bestCombo:0,
      padCount:4, accepting:false, paused:false, running:false, hi:0,
    };
    this.timers=new Set();
    this.loadPrefs();
    this.bindMenu();
    this.bindGame();
    this.bindKeys();
    $('hiScore').textContent = this.state.hi;
  }

  /* ---- prefs / storage ---- */
  loadPrefs(){
    try{
      const s = JSON.parse(localStorage.getItem('neonEcho')||'{}');
      Object.assign(this.state, {
        diff:s.diff||'easy', layout:s.layout||'2x2',
        soundOn:s.soundOn!==false, reduced:!!s.reduced, cb:!!s.cb, hi:s.hi||0
      });
    }catch{}
    this.applyPrefs();
  }
  savePrefs(){
    const {diff,layout,soundOn,reduced,cb,hi} = this.state;
    localStorage.setItem('neonEcho', JSON.stringify({diff,layout,soundOn,reduced,cb,hi}));
  }
  applyPrefs(){
    document.body.classList.toggle('reduced', this.state.reduced);
    document.body.classList.toggle('cb', this.state.cb);
    this.particles.reduced = this.state.reduced;
    this.audio.setEnabled(this.state.soundOn);
    // sync seg buttons
    const sync=(id,val)=>{
      document.querySelectorAll(`#${id} button`).forEach(b=>{
        b.classList.toggle('active', b.dataset.val===val);
      });
    };
    sync('difficulty', this.state.diff);
    sync('layout', this.state.layout);
    sync('sound', this.state.soundOn?'on':'off');
    sync('motion', this.state.reduced?'on':'off');
    sync('cb', this.state.cb?'on':'off');
  }

  /* ---- menu ---- */
  bindMenu(){
    const wire=(id,key,fn)=>{
      document.querySelectorAll(`#${id} button`).forEach(b=>{
        b.addEventListener('click',()=>{
          this.audio.init(); this.audio.resume(); this.audio.click();
          this.state[key] = fn ? fn(b.dataset.val) : b.dataset.val;
          this.applyPrefs(); this.savePrefs();
        });
      });
    };
    wire('difficulty','diff');
    wire('layout','layout');
    wire('sound','soundOn', v=>v==='on');
    wire('motion','reduced', v=>v==='on');
    wire('cb','cb', v=>v==='on');
    $('startBtn').addEventListener('click',()=>{ this.audio.init(); this.audio.resume(); this.start(); });
  }

  bindGame(){
    $('pauseBtn').addEventListener('click',()=>this.togglePause());
    $('resumeBtn').addEventListener('click',()=>this.togglePause());
    $('quitBtn').addEventListener('click',()=>this.quitToMenu());
    $('replayBtn').addEventListener('click',()=>{ this.show('game'); this.start(); });
    $('menuBtn').addEventListener('click',()=>this.quitToMenu());
  }

  bindKeys(){
    addEventListener('keydown', e=>{
      if(e.key==='Escape'){
        if($('game').classList.contains('active')) this.quitToMenu();
      } else if(e.key===' '||e.code==='Space'){
        if($('game').classList.contains('active')||$('pause').classList.contains('active')){
          e.preventDefault(); this.togglePause();
        }
      } else if(/^[1-6]$/.test(e.key)){
        const i = parseInt(e.key,10)-1;
        if(i < this.state.padCount && this.state.accepting){
          const pad = this.board.children[i];
          if(pad) this.handlePress(pad);
        }
      }
    });
  }

  /* ---- screen routing ---- */
  show(id){
    ['menu','game','pause','over'].forEach(s=>$(s).classList.toggle('active', s===id));
  }

  /* ---- start game ---- */
  start(){
    this.clearTimers();
    this.glitch.clear();
    this.state.padCount = this.state.layout==='2x3'?6:4;
    this.state.seq = [];
    this.state.round = 1;
    this.state.score = 0;
    this.state.combo = 0;
    this.state.bestCombo = 0;
    this.state.accepting = false;
    this.state.running = true;
    this.state.paused = false;
    this.buildBoard();
    this.updateHUD();
    this.show('game');
    this.countdown().then(()=>this.nextRound());
  }

  buildBoard(){
    this.board.className = 'board ' + (this.state.padCount===6 ? 'cols-3':'cols-2');
    this.board.innerHTML='';
    for(let i=0;i<this.state.padCount;i++){
      const p = document.createElement('button');
      p.className='pad';
      p.dataset.i=i;
      p.dataset.sym = CONFIG.symbols[i];
      p.setAttribute('aria-label',`Pad ${i+1}`);
      p.addEventListener('pointerdown', ev=>{
        ev.preventDefault();
        if(this.state.accepting) this.handlePress(p, ev);
      });
      this.board.appendChild(p);
    }
  }

  /* ---- countdown ---- */
  async countdown(){
    const el = $('countdown'), span = el.firstElementChild;
    el.classList.remove('hidden');
    for(const n of ['3','2','1','GO']){
      span.textContent = n;
      span.style.animation='none'; void span.offsetWidth; span.style.animation='';
      this.audio.blip();
      await sleep(700);
      if(!this.state.running) { el.classList.add('hidden'); return; }
    }
    el.classList.add('hidden');
  }

  /* ---- round flow ---- */
  async nextRound(){
    if(!this.state.running) return;
    const cfg = CONFIG.difficulties[this.state.diff];
    // extend sequence
    const add = cfg.addPerRound;
    for(let i=0;i<add;i++) this.state.seq.push(Math.floor(Math.random()*this.state.padCount));
    // first round needs initial length
    if(this.state.round===1){
      while(this.state.seq.length < cfg.startLen)
        this.state.seq.push(Math.floor(Math.random()*this.state.padCount));
    }
    this.updateHUD();
    this.setStatus('Watch…','show');
    // glitch?
    if(this.state.round>1 && this.state.round % cfg.glitchEvery === 0){
      const g = this.glitch.random(this.state.round, this.state.diff);
      this.setStatus(`GLITCH: ${g.toUpperCase()}`,'show');
      await sleep(900);
    }
    await sleep(400);
    await this.playSequence();
    if(!this.state.running) return;
    this.setStatus('Your turn','show');
    this.state.inputIdx = 0;
    this.state.accepting = true;
    this.armInputWatchdog();
  }

  async playSequence(){
    const cfg = CONFIG.difficulties[this.state.diff];
    // BPM: time per step shrinks each round subtly
    const baseStep = 60000/cfg.bpm;
    const step = Math.max(160, baseStep - this.state.round*8);
    const lit = Math.min(step*0.55, 380);
    for(let i=0;i<this.state.seq.length;i++){
      if(this.state.paused) await this.waitResume();
      if(!this.state.running) return;
      const idx = this.state.seq[i];
      const pad = this.board.children[idx];
      this.flashPad(pad, lit);
      this.audio.pad(idx);
      // glitch fake pulse
      if(this.glitch.active==='fake' && Math.random()<0.35){
        setTimeout(()=>this.glitch.fakePulse(this.board.children), lit*0.4);
      }
      await sleep(step);
    }
  }

  flashPad(pad, dur=300){
    pad.classList.add('lit');
    const r = document.createElement('span'); r.className='ripple';
    const rect = pad.getBoundingClientRect();
    r.style.left=(rect.width/2-5)+'px'; r.style.top=(rect.height/2-5)+'px';
    pad.appendChild(r); setTimeout(()=>r.remove(), 700);
    setTimeout(()=>pad.classList.remove('lit'), dur);
  }

  /* ---- input watchdog ---- */
  armInputWatchdog(){
    this.clearWatchdog();
    const cfg = CONFIG.difficulties[this.state.diff];
    const remaining = this.state.seq.length - this.state.inputIdx;
    const total = cfg.inputWindow * remaining + 600;
    this.watchdog = setTimeout(()=>{
      if(this.state.accepting) this.gameOver('Time out');
    }, total);
    this.timers.add(this.watchdog);
  }
  clearWatchdog(){ if(this.watchdog){ clearTimeout(this.watchdog); this.timers.delete(this.watchdog); this.watchdog=null; } }

  /* ---- handle pad press ---- */
  handlePress(pad, ev){
    if(!this.state.accepting || this.state.paused) return;
    const i = parseInt(pad.dataset.i,10);
    pad.classList.add('press');
    setTimeout(()=>pad.classList.remove('press'),120);
    this.flashPad(pad, 220);
    this.audio.pad(i);
    if(navigator.vibrate) navigator.vibrate(15);
    // particles burst
    const rect = pad.getBoundingClientRect();
    const cs = getComputedStyle(pad);
    const col = cs.getPropertyValue('--c').trim() || '#00f0ff';
    this.particles.burst(rect.left+rect.width/2, rect.top+rect.height/2, col, 14);

    const expected = this.state.seq[this.state.inputIdx];
    if(i !== expected){
      pad.classList.add('bad');
      setTimeout(()=>pad.classList.remove('bad'),350);
      this.state.combo = 0;
      this.updateHUD();
      this.gameOver('Wrong pad');
      return;
    }
    // correct
    this.state.inputIdx++;
    this.state.combo++;
    if(this.state.combo > this.state.bestCombo) this.state.bestCombo = this.state.combo;

    const cfg = CONFIG.difficulties[this.state.diff];
    const gained = Math.round((10 + this.state.combo*2 + this.state.round) * cfg.mult);
    this.state.score += gained;
    this.floatScore(rect.left+rect.width/2, rect.top, `+${gained}`);
    this.updateHUD();

    if(this.state.inputIdx >= this.state.seq.length){
      this.state.accepting = false;
      this.clearWatchdog();
      this.audio.success();
      this.setStatus('Perfect!','show');
      this.state.round++;
      setTimeout(()=>{
        this.glitch.clear();
        this.nextRound();
      }, 750);
    } else {
      // reset watchdog after each correct press
      this.armInputWatchdog();
    }
  }

  /* ---- HUD ---- */
  updateHUD(){
    $('round').textContent = this.state.round;
    $('score').textContent = this.state.score;
    $('combo').textContent = 'x'+Math.max(1,this.state.combo);
    const cfg = CONFIG.difficulties[this.state.diff];
    const pct = Math.min(100, (this.state.combo / 10) * 100);
    $('streakBar').style.width = pct+'%';
  }
  setStatus(t,cls){
    const s = $('status'); s.textContent=t;
    s.className='status '+(cls||'');
  }
  floatScore(x,y,txt){
    const f = document.createElement('div'); f.className='float'; f.textContent=txt;
    f.style.left=(x-20)+'px'; f.style.top=(y-30)+'px';
    $('floats').appendChild(f);
    setTimeout(()=>f.remove(), 1000);
  }

  /* ---- pause ---- */
  togglePause(){
    if(!this.state.running) return;
    this.state.paused = !this.state.paused;
    if(this.state.paused){
      this.show('pause');
      this.state.accepting = false;
      this.clearWatchdog();
    } else {
      this.show('game');
      // resume input only if mid-input
      if(this.state.inputIdx < this.state.seq.length){
        this.state.accepting = true;
        this.armInputWatchdog();
      }
      if(this._resumeResolver){ this._resumeResolver(); this._resumeResolver=null; }
    }
  }
  waitResume(){ return new Promise(r=>this._resumeResolver=r); }

  quitToMenu(){
    this.state.running=false; this.state.accepting=false; this.state.paused=false;
    this.clearTimers(); this.glitch.clear();
    this.show('menu');
  }

  /* ---- game over ---- */
  gameOver(reason){
    this.state.accepting=false; this.state.running=false;
    this.clearWatchdog();
    this.audio.fail();
    document.body.classList.add('body-shake');
    setTimeout(()=>document.body.classList.remove('body-shake'),400);
    this.setStatus(reason,'bad');
    if(this.state.score > this.state.hi){ this.state.hi = this.state.score; this.savePrefs(); $('hiScore').textContent=this.state.hi; }
    $('fScore').textContent = this.state.score;
    $('fRounds').textContent = Math.max(0,this.state.round-1);
    $('fCombo').textContent = this.state.bestCombo;
    $('fRank').textContent = this.rank(this.state.score);
    setTimeout(()=>this.show('over'), 700);
  }
  rank(s){
    if(s>=3000) return 'CYBER PHANTOM';
    if(s>=1500) return 'NEON CHAMPION';
    if(s>=800)  return 'NEON RUNNER';
    if(s>=300)  return 'SIGNAL SCOUT';
    return 'SIGNAL ROOKIE';
  }

  /* ---- timers cleanup ---- */
  clearTimers(){ this.timers.forEach(t=>clearTimeout(t)); this.timers.clear(); this.clearWatchdog(); }
}

/* ---------------- BOOT ---------------- */
window.addEventListener('DOMContentLoaded', ()=>{ new NeonEcho(); });