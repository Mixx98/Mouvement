'use strict';
(() => {
  const $ = s => document.querySelector(s);
  const {presets,scales,names,tracks,moods,nextGridTime,gridShape,gridMidi,chordForBar,harmonize,keyMidi} = Music;
  const state = {started:false,paused:false,muted:false,preset:'piano',root:0,scale:'major',volume:.55,reverb:.4,labels:true,density:'dense',keyMode:'fixed',track:'lofi',tempo:76,bgmVolume:.35,harmonize:true,bgm:false};
  state.timing='free';state.division=2;
  const savedKeys=['preset','root','scale','volume','reverb','labels','density','keyMode','track','tempo','bgmVolume','harmonize','timing','division'];
  try {
    const saved=JSON.parse(localStorage.getItem('mouvement-settings')||'{}');
    for(const [key,options] of Object.entries({preset:Object.keys(presets),scale:Object.keys(scales),root:[0,2,4,5,7,9],density:['wide','dense','fine'],keyMode:['fixed','random'],track:Object.keys(tracks)}))if(options.includes(saved[key]))state[key]=saved[key];
    for(const key of ['volume','reverb','bgmVolume'])if(Number.isFinite(saved[key]))state[key]=Math.max(0,Math.min(1,saved[key]));
    for(const key of ['labels','harmonize'])if(typeof saved[key]==='boolean')state[key]=saved[key];
    if(Number.isFinite(saved.tempo))state.tempo=Math.max(30,Math.min(240,Math.round(saved.tempo)));
    if(['free','grid'].includes(saved.timing))state.timing=saved.timing;
    if([1,2,4].includes(saved.division))state.division=saved.division;
  } catch {}
  function persist(){try{localStorage.setItem('mouvement-settings',JSON.stringify(Object.fromEntries(savedKeys.map(k=>[k,state[k]]))));}catch{}}
  let cols=20,rows=12,cells=[],lastCell=-1,lastTime=0,ctx,master,dry,wet,bgmBus,noiseBuffer,voices=[];
  let scheduler=null,nextBeatTime=0,beatIndex=0,currentChord=null,visualTimers=new Set(),audioStarting=null;
  let transportOrigin=0;
  const beatQueue=Music.createBeatQueue();
  const grid=$('#note-grid'),canvas=$('#trails'),paint=canvas.getContext('2d');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let width=innerWidth,height=innerHeight,dpr=1,rings=[],particles=[],path=[],pointer={x:width/2,y:height/2,visible:false},rgb='111,160,110';
  const midiFor=(col,row)=>gridMidi(col,row,cols,rows,state.root,state.scale);
  const noteName=midi=>names[midi%12]+(Math.floor(midi/12)-1);
  function buildGrid(){
    cells.forEach(cell=>clearTimeout(cell.fade));[cols,rows]=gridShape(state.density,innerWidth<600);
    if(innerHeight<550)rows=Math.max(6,Math.round(rows*.7));
    grid.style.gridTemplateColumns=`repeat(${cols},1fr)`;grid.style.gridTemplateRows=`repeat(${rows},1fr)`;grid.replaceChildren();cells=[];
    for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
      const midi=midiFor(col,row),cell=document.createElement('div');cell.className='note-cell';cell.innerHTML=`<span class="note-label">${names[midi%12]}<sub>${Math.floor(midi/12)-1}</sub></span>`;grid.append(cell);cells.push(cell);
    }
    lastCell=-1;$('#range-label').textContent=noteName(midiFor(0,rows-1))+' — '+noteName(midiFor(cols-1,0));$('#scale-label').textContent=names[state.root]+' '+({major:'MAJOR PENTATONIC',minor:'MINOR PENTATONIC',diatonic:'MAJOR SCALE'})[state.scale];
  }
  function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('show'),2300);}
  async function initAudio(){
    if(!ctx){
      const AudioContext=window.AudioContext||window.webkitAudioContext;if(!AudioContext)throw new Error('이 브라우저는 오디오를 지원하지 않습니다.');
      ctx=new AudioContext();master=ctx.createGain();const compressor=ctx.createDynamicsCompressor();compressor.threshold.value=-15;compressor.knee.value=12;compressor.ratio.value=5;compressor.attack.value=.003;compressor.release.value=.25;
      master.connect(compressor);compressor.connect(ctx.destination);dry=ctx.createGain();wet=ctx.createGain();dry.connect(master);wet.connect(master);
      const convolver=ctx.createConvolver(),length=Math.floor(ctx.sampleRate*2.5),buffer=ctx.createBuffer(2,length,ctx.sampleRate);
      for(let ch=0;ch<2;ch++){const data=buffer.getChannelData(ch);for(let i=0;i<length;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/length,3);}
      convolver.buffer=buffer;convolver.connect(wet);ctx.reverbInput=convolver;bgmBus=ctx.createGain();bgmBus.connect(dry);bgmBus.connect(convolver);
      noiseBuffer=ctx.createBuffer(1,Math.floor(ctx.sampleRate*.3),ctx.sampleRate);const noise=noiseBuffer.getChannelData(0);for(let i=0;i<noise.length;i++)noise[i]=Math.random()*2-1;applyLevels();
    }
    if(ctx.state!=='running')await ctx.resume();if(ctx.state!=='running')throw new Error('소리를 켜려면 다시 눌러 주세요.');
  }
  function applyLevels(){if(!ctx)return;const t=ctx.currentTime;master.gain.setTargetAtTime(state.muted||state.paused?0:state.volume*.65,t,.04);dry.gain.setTargetAtTime(1-state.reverb*.25,t,.08);wet.gain.setTargetAtTime(state.reverb*.75,t,.08);bgmBus.gain.setTargetAtTime(state.bgm?state.bgmVolume:0,t,.04);}
  function killVoice(voice){const t=ctx.currentTime;voice.gain.gain.cancelAndHoldAtTime(t);voice.gain.gain.setTargetAtTime(.0001,t,.02);voice.oscs.forEach(osc=>{try{osc.stop(t+.07);}catch{}});}
  function trackVoice(voice){voices=voices.filter(v=>v.end>ctx.currentTime);const group=voices.filter(v=>v.bgm===voice.bgm);if(group.length>=(voice.bgm?30:24)){killVoice(group[0]);voices.splice(voices.indexOf(group[0]),1);}voices.push(voice);}
  function sound(midi,velocity=.7,options={}){
    if(!ctx||ctx.state!=='running'||state.paused||state.muted)return;
    const now=ctx.currentTime,t=Math.max(now,options.time??now),f=440*Math.pow(2,(midi-69)/12),p=presets[options.preset||state.preset],duration=options.duration||p.decay,attack=Math.min(p.attack,duration*.3);
    const gain=ctx.createGain(),filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=Math.min(p.filter,f*9);filter.Q.value=.5;gain.connect(filter);
    if(options.bgm)filter.connect(bgmBus);else{filter.connect(dry);filter.connect(ctx.reverbInput);}
    const amplitude=.21*(p.level||1)*velocity;gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(Math.max(.0002,amplitude),t+attack);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
    const oscs=[],nodes=[gain,filter];
    p.partials.forEach(([ratio,level,type])=>{const osc=ctx.createOscillator(),g=ctx.createGain();osc.type=type;osc.frequency.value=f*ratio;g.gain.setValueAtTime(level,t);if(p.pluck)g.gain.exponentialRampToValueAtTime(.001,t+duration/(ratio>1?2:1));osc.connect(g);g.connect(gain);osc.start(t);osc.stop(t+duration+.1);oscs.push(osc);nodes.push(osc,g);});
    if(p.vibrato){const lfo=ctx.createOscillator(),depth=ctx.createGain();lfo.frequency.value=p.vibrato;depth.gain.value=7;lfo.connect(depth);oscs.forEach(o=>depth.connect(o.detune));lfo.start(t);lfo.stop(t+duration+.1);oscs.push(lfo);nodes.push(lfo,depth);}
    trackVoice({gain,oscs,end:t+duration+.2,bgm:!!options.bgm,quantized:!!options.quantized});oscs[0].onended=()=>nodes.forEach(n=>n.disconnect());
  }
  function drum(kind,time,volume){
    if(state.muted||state.paused)return;const gain=ctx.createGain(),filter=ctx.createBiquadFilter();gain.connect(bgmBus);let source,duration;
    if(kind==='kick'){source=ctx.createOscillator();source.frequency.setValueAtTime(125,time);source.frequency.exponentialRampToValueAtTime(43,time+.18);source.connect(gain);duration=.25;}
    else{source=ctx.createBufferSource();source.buffer=noiseBuffer;filter.type=kind==='hat'?'highpass':'bandpass';filter.frequency.value=kind==='hat'?6800:1800;source.connect(filter);filter.connect(gain);duration=kind==='hat'?.045:.14;}
    gain.gain.setValueAtTime(Math.max(.001,volume),time);gain.gain.exponentialRampToValueAtTime(.0001,time+duration);source.start(time);source.stop(time+duration+.02);trackVoice({gain,oscs:[source],end:time+duration+.05,bgm:true});source.onended=()=>{source.disconnect();gain.disconnect();filter.disconnect();};
  }
  function scheduleBeat(index,time){
    const bar=Math.floor(index/8),step=index%8,chord=chordForBar(bar,state.root,state.scale),beat=60/state.tempo,track=state.track;
    const play=(midi,preset,velocity,duration,offset=0)=>sound(midi,velocity,{preset,duration,time:time+offset,bgm:true});
    if(step===0){chord.notes.forEach((midi,i)=>play(midi,tracks[track].instrument,.48,beat*(track==='forest'?7:3.4),i*.018));play(chord.bass,'epiano',.8,beat*1.8);}
    if(step===4){play(chord.bass+7,'epiano',.5,beat*1.4);if(track==='lofi')chord.notes.forEach((midi,i)=>play(midi,'epiano',.3,beat*1.4,i*.015));}
    if(track==='forest'&&[1,3,6].includes(step))play(chord.notes[(bar+step)%3]+12,'harp',.28,beat*3);
    if(track==='night'&&step%2===0)play(chord.notes[(step/2+bar)%3]+12,'synth',.35,beat*.9);
    if(track==='lofi'&&bar%2===1&&[3,7].includes(step))play(chord.notes[step===3?1:2]+12,'piano',.24,beat*1.3);
    if(track!=='forest'){if(step===0||step===4||(track==='night'&&step===6))drum('kick',time,.32);if(step===2||step===6)drum('snare',time,.075);drum('hat',time+(track==='lofi'&&step%2===1?.025:0),step%2?.018:.032);}
    const timer=setTimeout(()=>{visualTimers.delete(timer);if(!state.bgm||state.paused)return;currentChord=chord;$('#chord-label').textContent=chord.label;document.querySelectorAll('.beat-dots i').forEach((dot,i)=>dot.classList.toggle('on',i===Math.floor(step/2)));$('#bgm-now').dataset.bar=String(bar%8+1);},Math.max(0,(time-ctx.currentTime)*1000));visualTimers.add(timer);
  }
  function schedulerTick(){
    if(!ctx||ctx.state!=='running'||state.paused)return;
    const now=ctx.currentTime;
    if(state.bgm){
      if(nextBeatTime<now-.2){beatIndex=Math.ceil((now-transportOrigin)/(30/state.tempo));nextBeatTime=transportOrigin+beatIndex*30/state.tempo;}
      while(nextBeatTime<now+.12){scheduleBeat(beatIndex++,nextBeatTime);nextBeatTime=transportOrigin+beatIndex*30/state.tempo;}
    }
    for(const [time,event] of beatQueue.drain(now+.02))if(time>=now-.05)performMelody(event,Math.max(time,now),true);
  }
  function stopScheduler(){clearInterval(scheduler);scheduler=null;beatQueue.clear();visualTimers.forEach(clearTimeout);visualTimers.clear();if(ctx)voices.filter(v=>v.bgm||v.quantized).forEach(killVoice);currentChord=null;}
  function startScheduler(){stopScheduler();beatIndex=0;transportOrigin=ctx.currentTime+.06;nextBeatTime=transportOrigin;currentChord=chordForBar(0,state.root,state.scale);schedulerTick();scheduler=setInterval(schedulerTick,10);}
  function syncBgmUI(){const track=tracks[state.track];$('#bgm-now').hidden=!state.bgm;$('#track-title').textContent=track.name;$('#track-subtitle').textContent=track.subtitle;$('#bgm-toggle').setAttribute('aria-pressed',String(state.bgm));$('#bgm-icon').textContent=state.bgm?'□':'▷';$('#bgm-label').textContent=state.bgm?'BGM 끄기':'BGM과 합주';$('#bgm-panel-toggle').textContent=state.bgm?'□ BGM 멈추기':'▷ BGM 시작하기';$('#bgm-panel-toggle').setAttribute('aria-pressed',String(state.bgm));document.querySelectorAll('[data-track]').forEach(b=>{const selected=b.dataset.track===state.track;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));});document.body.classList.toggle('bgm-playing',state.bgm&&!state.paused);}
  async function toggleBgm(){if(state.bgm)state.bgm=false;else{if(!await start())return;state.bgm=true;}restartBgm();applyLevels();syncBgmUI();}
  function restartBgm(){stopScheduler();if((state.bgm||state.timing==='grid')&&!state.paused&&ctx?.state==='running')startScheduler();}
  function flash(index,x,y,midi,caption='IN THE MOMENT'){
    const cell=cells[index];if(!cell)return;cell.classList.add('active');clearTimeout(cell.fade);cell.fade=setTimeout(()=>cell.classList.remove('active'),650);$('#current-note').textContent=noteName(midi);$('#note-caption').textContent=caption;
    if(!reduced){rings.push({x,y,age:0});for(let i=0;i<7;i++)particles.push({x,y,vx:(Math.random()-.5)*1.4,vy:(Math.random()-.5)*1.4-.3,age:0,life:40+Math.random()*35});}
    if(rings.length>30)rings.shift();if(particles.length>240)particles.splice(0,particles.length-240);
  }
  function melodyMidi(midi,time){const chord=state.bgm?chordForBar(Math.max(0,Math.floor((time-transportOrigin+.000001)/(240/state.tempo))),state.root,state.scale):null;return chord&&state.harmonize?harmonize(midi,chord,state.root,state.scale):midi;}
  function performMelody(event,time,quantized=false){
    if(state.paused||state.muted)return;
    const midi=melodyMidi(event.midi,time);sound(midi,event.velocity,{time,quantized});
    const visual=()=>flash(event.index,event.x,event.y,midi,quantized?'IN THE RHYTHM':event.caption);
    if(quantized){const timer=setTimeout(()=>{visualTimers.delete(timer);if(!state.paused)visual();},Math.max(0,(time-ctx.currentTime)*1000));visualTimers.add(timer);}else visual();
  }
  function submitMelody(event){if(!ctx||state.paused||state.muted)return;if(state.timing==='free'){performMelody(event,ctx.currentTime);return;}if(!scheduler)startScheduler();beatQueue.offer(nextGridTime(ctx.currentTime,transportOrigin,state.tempo,state.division),event);}
  function trigger(index,x,y,velocity=.7){if(!state.started||state.paused||!cells[index])return;submitMelody({midi:midiFor(index%cols,Math.floor(index/cols)),index,x,y,velocity,caption:'IN THE MOMENT'});}
  async function start(){if(audioStarting)return audioStarting;audioStarting=(async()=>{try{await initAudio();state.started=true;state.paused=false;document.body.classList.add('started');document.body.classList.remove('paused');$('#welcome').inert=true;updateStatus();applyLevels();if((state.bgm||state.timing==='grid')&&!scheduler)startScheduler();return true;}catch(e){toast(e.message||'소리를 시작할 수 없습니다. 다시 눌러 주세요.');return false;}})();const result=await audioStarting;audioStarting=null;return result;}
  function updateStatus(){$('#status').textContent=state.paused?'PAUSED':state.started?'LIVE · YOUR ORCHESTRA':'READY TO PLAY';$('#pause').textContent=state.paused?'▷':'Ⅱ';$('#pause').setAttribute('aria-label',state.paused?'연주 재개':'연주 일시정지');syncBgmUI();}
  $('#start').addEventListener('click',start);
  window.addEventListener('pointermove',e=>{if(e.target.closest('[data-ui]')){pointer.visible=false;lastCell=-1;return;}pointer={x:e.clientX,y:e.clientY,visible:true};if(!state.started||state.paused||document.body.classList.contains('settings-open'))return;const col=Math.min(cols-1,Math.max(0,Math.floor(e.clientX/width*cols))),row=Math.min(rows-1,Math.max(0,Math.floor(e.clientY/height*rows))),index=row*cols+col,now=performance.now();if(index!==lastCell&&now-lastTime>55){lastCell=index;lastTime=now;trigger(index,e.clientX,e.clientY,.6+Math.random()*.25);}});
  window.addEventListener('pointerdown',async e=>{if(e.target.closest('[data-ui]'))return;if(!state.started){if(!await start())return;}else if(ctx?.state==='suspended'){try{await ctx.resume();}catch{}}if(state.paused)return;const col=Math.min(cols-1,Math.max(0,Math.floor(e.clientX/width*cols))),row=Math.min(rows-1,Math.max(0,Math.floor(e.clientY/height*rows)));lastCell=row*cols+col;trigger(lastCell,e.clientX,e.clientY,.85);});
  document.documentElement.addEventListener('pointerleave',()=>{lastCell=-1;pointer.visible=false;});
  $('#bgm-toggle').addEventListener('click',toggleBgm);$('#bgm-panel-toggle').addEventListener('click',toggleBgm);
  $('#mute').addEventListener('click',()=>{state.muted=!state.muted;beatQueue.clear();document.body.classList.toggle('muted',state.muted);$('#mute').setAttribute('aria-label',state.muted?'음소거 해제':'음소거');$('#mute').setAttribute('aria-pressed',String(state.muted));applyLevels();toast(state.muted?'소리를 잠시 껐어요':'소리를 켰어요');});
  async function togglePause(){if(!state.started){await start();return;}state.paused=!state.paused;if(state.paused)stopScheduler();else{try{await initAudio();restartBgm();}catch(e){state.paused=true;toast(e.message);}}document.body.classList.toggle('paused',state.paused);lastCell=-1;applyLevels();updateStatus();}
  $('#pause').addEventListener('click',togglePause);
  $('#fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('이 환경에서는 전체 화면을 지원하지 않아요');}});
  document.addEventListener('fullscreenchange',()=>$('#fullscreen').setAttribute('aria-label',document.fullscreenElement?'전체 화면 종료':'전체 화면'));
  let closeTimer,hoverTimer;
  function selectTab(name){document.querySelectorAll('[data-tab]').forEach(button=>{const selected=button.dataset.tab===name;button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;$('#pane-'+button.dataset.tab).hidden=!selected;});}
  function openSettings(tab){clearTimeout(closeTimer);if(tab)selectTab(tab);document.body.classList.add('settings-open');$('#settings').inert=false;$('#settings-handle').setAttribute('aria-expanded','true');lastCell=-1;pointer.visible=false;}
  function closeSettings(){clearTimeout(hoverTimer);clearTimeout(closeTimer);if($('#settings').contains(document.activeElement))$('#settings-handle').focus();document.body.classList.remove('settings-open');$('#settings').inert=true;$('#settings-handle').setAttribute('aria-expanded','false');lastCell=-1;}
  $('#settings-handle').addEventListener('pointerenter',e=>{if(e.pointerType==='mouse')hoverTimer=setTimeout(()=>openSettings(),160);});$('#settings-handle').addEventListener('pointerleave',()=>clearTimeout(hoverTimer));$('#settings-handle').addEventListener('click',()=>openSettings());
  $('#sound-pill').addEventListener('click',()=>{openSettings('sounds');$('#close-settings').focus();});$('#bgm-details').addEventListener('click',()=>openSettings('bgm'));$('#close-settings').addEventListener('click',closeSettings);
  $('#settings').addEventListener('pointerenter',()=>clearTimeout(closeTimer));$('#settings').addEventListener('pointerleave',e=>{if(e.pointerType==='mouse')closeTimer=setTimeout(closeSettings,650);});
  document.addEventListener('pointerdown',e=>{if(document.body.classList.contains('settings-open')&&!e.target.closest('#settings,#settings-handle,#sound-pill,#bgm-details,#writing-tempo'))closeSettings();});
  document.querySelectorAll('[data-tab]').forEach((button,index)=>{button.addEventListener('click',()=>selectTab(button.dataset.tab));button.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const tabs=[...document.querySelectorAll('[data-tab]')];const next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(index+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;selectTab(tabs[next].dataset.tab);tabs[next].focus();});});
  $('#presets').innerHTML=Object.entries(presets).map(([id,p])=>`<button class="preset" data-preset="${id}" aria-pressed="false"><span class="preset-art ${id}-art">${p.icon}</span><strong>${p.name}</strong><small>${p.description}</small></button>`).join('');
  function setPreset(value){state.preset=value;document.body.dataset.theme=value;$('#preset-name').textContent=presets[value].name;$('#preset-icon').textContent=presets[value].icon;document.querySelectorAll('[data-preset]').forEach(b=>{const active=b.dataset.preset===value;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});rgb=getComputedStyle(document.body).getPropertyValue('--rgb').trim();syncMoods();persist();}
  document.querySelectorAll('[data-preset]').forEach(b=>b.addEventListener('click',async()=>{setPreset(b.dataset.preset);if(state.started&&!state.paused){try{await initAudio();sound(60+state.root,.8);}catch(e){toast(e.message);}}}));
  document.querySelectorAll('[data-track]').forEach(b=>b.addEventListener('click',()=>{state.track=b.dataset.track;state.tempo=tracks[state.track].tempo;syncRhythm();syncBgmUI();restartBgm();persist();}));
  for(const key of ['root','scale','density'])$('#'+key).addEventListener('change',e=>{state[key]=key==='root'?Number(e.target.value):e.target.value;beatQueue.clear();buildGrid();if(key!=='density')restartBgm();syncMoods();persist();});
  for(const [id,key] of [['volume','volume'],['reverb','reverb'],['bgm-volume','bgmVolume']])$('#'+id).addEventListener('input',e=>{state[key]=Number(e.target.value)/100;$('#'+id+'-value').textContent=e.target.value+'%';applyLevels();syncMoods();persist();});
  function setTempo(value){const number=Number(value);if(value===''||!Number.isFinite(number)){syncRhythm();return;}state.tempo=Math.max(30,Math.min(240,Math.round(number)));syncRhythm();restartBgm();persist();}
  $('#tempo').addEventListener('input',e=>setTempo(e.target.value));
  $('#tempo-number').addEventListener('input',e=>{const value=Number(e.target.value);if(e.target.value!==''&&Number.isInteger(value)&&value>=30&&value<=240)setTempo(value);});
  $('#tempo-number').addEventListener('change',e=>setTempo(e.target.value));
  $('#tempo-number').addEventListener('blur',e=>setTempo(e.target.value));
  function syncRhythm(){const gridMode=state.timing==='grid';$('#tempo').value=state.tempo;$('#tempo-number').value=state.tempo;$('#tempo-value').textContent=state.tempo+' BPM';$('#division').value=state.division;$('#division-wrap').hidden=!gridMode;$('#timing-description').hidden=gridMode;document.querySelectorAll('[data-timing]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.timing===state.timing)));$('#writing-sync').textContent=gridMode?'♩ 박자에 맞춰 연주':'∿ 자유롭게 연주';$('#writing-sync').setAttribute('aria-pressed',String(gridMode));$('#writing-tempo').textContent=state.tempo+' BPM · 리듬 설정 ↗';}
  function setTiming(value){state.timing=value;restartBgm();syncRhythm();persist();}
  document.querySelectorAll('[data-timing]').forEach(b=>b.addEventListener('click',()=>setTiming(b.dataset.timing)));
  $('#division').addEventListener('change',e=>{state.division=Number(e.target.value);restartBgm();persist();});
  $('#writing-sync').addEventListener('click',()=>{setTiming(state.timing==='grid'?'free':'grid');$('#music-text').focus();});
  $('#writing-tempo').addEventListener('click',()=>{openSettings('bgm');$('#tempo-number').focus();});
  $('#moods').innerHTML=Object.entries(moods).map(([id,m])=>`<button class="mood" data-mood="${id}" aria-pressed="false"><span>${m.icon}</span><strong>${m.name}</strong><small>${m.description}</small></button>`).join('');
  function syncMoods(){let selected=null;document.querySelectorAll('[data-mood]').forEach(b=>{const m=moods[b.dataset.mood],active=state.preset===m.preset&&state.root===m.root&&state.scale===m.scale&&Math.abs(state.reverb-m.reverb)<.001;b.setAttribute('aria-pressed',String(active));if(active)selected=m;});$('#mood-status').textContent=selected?'지금의 분위기 · '+selected.name:'지금의 분위기 · 직접 조합한 선율';}
  document.querySelectorAll('[data-mood]').forEach(b=>b.addEventListener('click',()=>{const m=moods[b.dataset.mood];Object.assign(state,{root:m.root,scale:m.scale,reverb:m.reverb});setPreset(m.preset);$('#root').value=state.root;$('#scale').value=state.scale;$('#reverb').value=state.reverb*100;$('#reverb-value').textContent=Math.round(state.reverb*100)+'%';buildGrid();restartBgm();applyLevels();if(state.started&&!state.paused)sound(60+state.root,.65);persist();}));
  $('#harmonize').addEventListener('change',e=>{state.harmonize=e.target.checked;persist();});$('#labels').addEventListener('change',e=>{state.labels=e.target.checked;document.body.classList.toggle('no-labels',!state.labels);persist();});$('#key-mode').addEventListener('change',e=>{state.keyMode=e.target.value;persist();$('#music-text').focus();});
  async function openWriting(){closeSettings();if(!await start())return;$('#writing').hidden=false;document.body.classList.add('typing-open');$('#writing-toggle').setAttribute('aria-expanded','true');$('#music-text').focus();if(state.bgm&&!scheduler)restartBgm();}
  function closeWriting(){$('#writing').hidden=true;document.body.classList.remove('typing-open');$('#writing-toggle').setAttribute('aria-expanded','false');$('#writing-toggle').focus();}
  $('#writing-toggle').addEventListener('click',()=>$('#writing').hidden?openWriting():closeWriting());$('#close-writing').addEventListener('click',closeWriting);
  async function playKey(key){if(state.paused)return;if(!state.started&&!await start())return;if(ctx.state!=='running'){try{await initAudio();}catch{return;}}const midi=keyMidi(key,state.keyMode,state.root,state.scale);let best=0,distance=Infinity;for(let i=0;i<cells.length;i++){const d=Math.abs(midiFor(i%cols,Math.floor(i/cols))-midi);if(d<distance||(d===distance&&Math.random()<.07)){best=i;distance=d;}}submitMelody({midi,index:best,x:(best%cols+.5)*width/cols,y:(Math.floor(best/cols)+.5)*height/rows,velocity:.75,caption:'WORDS INTO MELODY'});}
  const typingGate=Music.createTypingGate();
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&!e.isComposing){if(document.body.classList.contains('settings-open'))closeSettings();else if(!$('#writing').hidden)closeWriting();return;}
    if(e.ctrlKey||e.metaKey||e.altKey)return;
    const writing=e.target===$('#music-text');if(!writing&&e.target.closest('input,select,textarea,[contenteditable=true]'))return;
    const key=typingGate.key(e);
    if(e.repeat)return;
    if(e.code==='Space'){if(!writing&&!e.isComposing&&!e.target.closest('button,a')){e.preventDefault();togglePause();}return;}
    if(key)playKey(key);else if(!writing&&!e.isComposing&&e.key.length===1&&e.key.trim())playKey(e.key);
  });
  $('#music-text').addEventListener('compositionstart',()=>typingGate.compositionStart());
  $('#music-text').addEventListener('compositionend',()=>typingGate.compositionEnd());
  $('#music-text').addEventListener('input',e=>{$('#text-count').textContent=Array.from(e.target.value).length+'자';const key=typingGate.input(e);if(key)playKey(key);});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){stopScheduler();if(ctx)ctx.suspend().catch(()=>{});lastCell=-1;}else if(state.started&&!state.paused){initAudio().then(restartBgm).catch(()=>toast('화면을 눌러 연주를 이어가세요'));}});
  function resize(){beatQueue.clear();width=innerWidth;height=innerHeight;dpr=Math.min(devicePixelRatio||1,2);canvas.width=width*dpr;canvas.height=height*dpr;paint.setTransform(dpr,0,0,dpr,0,0);buildGrid();path=[];}
  let previousFrame=0;
  function draw(now){requestAnimationFrame(draw);if(now-previousFrame<25||document.hidden)return;const delta=Math.min(2,(now-previousFrame)/33.3||1);previousFrame=now;paint.clearRect(0,0,width,height);if(!state.started||state.paused)return;
    for(let i=rings.length-1;i>=0;i--){const r=rings[i];r.age+=delta;const a=Math.max(0,1-r.age/45);if(a<=0){rings.splice(i,1);continue;}const radius=10+r.age*1.5;paint.beginPath();paint.arc(r.x,r.y,radius,0,Math.PI*2);paint.strokeStyle=`rgba(${rgb},${a*.5})`;paint.lineWidth=1;paint.stroke();const gradient=paint.createRadialGradient(r.x,r.y,0,r.x,r.y,radius);gradient.addColorStop(0,`rgba(${rgb},${a*.14})`);gradient.addColorStop(1,`rgba(${rgb},0)`);paint.fillStyle=gradient;paint.fill();}
    for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.age+=delta;p.x+=p.vx*delta;p.y+=p.vy*delta;const a=1-p.age/p.life;if(a<=0){particles.splice(i,1);continue;}paint.beginPath();paint.arc(p.x,p.y,1.5*a,0,Math.PI*2);paint.fillStyle=`rgba(${rgb},${a*.8})`;paint.fill();}
    if(!reduced&&pointer.visible&&!document.body.classList.contains('settings-open'))path.push({x:pointer.x,y:pointer.y,age:0});for(let i=path.length-1;i>=0;i--){path[i].age+=delta;if(path[i].age>20)path.splice(i,1);}if(path.length>1){paint.beginPath();paint.moveTo(path[0].x,path[0].y);for(let i=1;i<path.length;i++)paint.lineTo(path[i].x,path[i].y);paint.strokeStyle=`rgba(${rgb},.25)`;paint.lineWidth=1;paint.lineCap='round';paint.stroke();}if(pointer.visible){paint.beginPath();paint.arc(pointer.x,pointer.y,4,0,Math.PI*2);paint.fillStyle=`rgba(${rgb},.7)`;paint.fill();}}
  for(const key of ['root','scale','density','tempo'])$('#'+key).value=state[key];$('#key-mode').value=state.keyMode;
  for(const [id,key] of [['volume','volume'],['reverb','reverb'],['bgm-volume','bgmVolume']]){$('#'+id).value=Math.round(state[key]*100);$('#'+id+'-value').textContent=Math.round(state[key]*100)+'%';}
  syncRhythm();$('#labels').checked=state.labels;$('#harmonize').checked=state.harmonize;document.body.classList.toggle('no-labels',!state.labels);setPreset(state.preset);syncBgmUI();resize();window.addEventListener('resize',resize);requestAnimationFrame(draw);
})();
