/* Shared musical vocabulary. No audio samples or network requests. */
(function (root) {
  const scales = {major:[0,2,4,7,9],minor:[0,3,5,7,10],diatonic:[0,2,4,5,7,9,11]};
  const names = ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
  const presets = {
    piano:{name:'Felt piano',icon:'♬',description:'포근한 오후의 피아노',attack:.008,decay:2.4,filter:6500,partials:[[1,1,'triangle'],[2,.24,'sine'],[3,.07,'sine']],pluck:true},
    marimba:{name:'Wooden marimba',icon:'▥',description:'햇살을 닮은 나무 울림',attack:.004,decay:1.15,filter:6000,partials:[[1,1,'sine'],[4,.2,'sine'],[10,.035,'sine']],pluck:true},
    strings:{name:'Dream strings',icon:'≋',description:'천천히 번지는 숲의 선율',attack:.2,decay:2.8,filter:2200,level:.55,partials:[[.998,.5,'sawtooth'],[1.002,.5,'sawtooth'],[2,.12,'sine']]},
    synth:{name:'Cosmic synth',icon:'✧',description:'밤하늘을 유영하는 소리',attack:.045,decay:2.1,filter:3000,partials:[[.999,.65,'triangle'],[1.002,.4,'sine'],[2,.18,'sine']]},
    harp:{name:'Moonlit harp',icon:'⋰',description:'달빛 아래 흐르는 하프',attack:.003,decay:2.7,filter:7000,partials:[[1,.9,'triangle'],[2,.3,'sine'],[3,.16,'sine'],[4,.08,'sine']],pluck:true},
    bell:{name:'Crystal bells',icon:'♧',description:'맑게 반짝이는 크리스털',attack:.003,decay:3.1,filter:10000,level:.7,partials:[[1,1,'sine'],[2.76,.28,'sine'],[5.4,.08,'sine']],pluck:true},
    epiano:{name:'Velvet keys',icon:'▤',description:'부드러운 빈티지 전자피아노',attack:.007,decay:2.2,filter:4000,partials:[[1,.85,'sine'],[2,.35,'triangle'],[3,.08,'sine']],pluck:true},
    flute:{name:'Airy flute',icon:'∿',description:'바람을 닮은 가벼운 숨결',attack:.075,decay:1.5,filter:4800,partials:[[1,1,'sine'],[2,.15,'sine'],[3,.04,'sine']],vibrato:4.5},
    kalimba:{name:'Pocket kalimba',icon:'⋮',description:'손끝에 담긴 작은 오르골',attack:.002,decay:1.5,filter:7500,partials:[[1,1,'sine'],[3,.2,'sine'],[6,.09,'sine']],pluck:true},
    organ:{name:'Sunday organ',icon:'▥',description:'공간을 채우는 따뜻한 화음',attack:.025,decay:1.8,filter:4000,level:.65,partials:[[1,.65,'sine'],[2,.35,'sine'],[3,.2,'sine'],[4,.12,'sine']]},
    guitar:{name:'Electric guitar',icon:'ϟ',description:'거칠게 타오르는 일렉기타',family:'electric',attack:.004,decay:1.35,filter:4600,filterEnd:1100,level:.8,drive:8,partials:[[1,.7,'sawtooth'],[1.003,.22,'triangle'],[2,.12,'sine']],pluck:true,vibrato:5.2},
    bass:{name:'Acid bass',icon:'≋',description:'묵직하고 쫀득한 전자 베이스',family:'electric',attack:.006,decay:.72,filter:2800,filterEnd:240,resonance:5,transpose:-24,level:.85,drive:2.5,partials:[[1,.65,'sawtooth'],[.5,.35,'sine']]},
    lead:{name:'Neon lead',icon:'⌁',description:'네온빛처럼 뻗는 전자 리드',family:'electric',attack:.012,decay:1.1,filter:6800,filterEnd:1600,level:.48,partials:[[.996,.45,'sawtooth'],[1.004,.45,'sawtooth'],[2,.1,'square']],vibrato:6},
    arcade:{name:'8-bit arcade',icon:'▦',description:'통통 튀는 레트로 게임 사운드',family:'electric',attack:.002,decay:.42,filter:6500,level:.4,partials:[[1,.8,'square'],[2,.2,'triangle']],pluck:true}
  };
  const tracks = {
    lofi:{name:'느린 오후',subtitle:'LO-FI · KEYS & BEATS',tempo:76,instrument:'epiano'},
    forest:{name:'숲의 호흡',subtitle:'AMBIENT · HARP & STRINGS',tempo:60,instrument:'strings'},
    night:{name:'별빛 산책',subtitle:'CHILL · SYNTH & PULSE',tempo:100,instrument:'synth'}
  };
  const moods = {
    comfort:{name:'포근한 위로',icon:'☁',description:'부드럽고 다정한, 마음이 놓이는 선율',preset:'piano',root:0,scale:'major',reverb:.4},
    sunshine:{name:'햇살 같은 기분',icon:'☀',description:'맑고 통통 튀는, 가벼운 설렘',preset:'kalimba',root:7,scale:'major',reverb:.25},
    rain:{name:'비 오는 밤',icon:'☂',description:'차분하고 아련한, 혼자만의 시간',preset:'epiano',root:9,scale:'minor',reverb:.55},
    forest:{name:'숲속의 쉼',icon:'❧',description:'숨을 고르듯 편안하고 청량하게',preset:'flute',root:5,scale:'major',reverb:.5},
    dream:{name:'꿈속을 걷듯',icon:'☾',description:'몽환적이고 신비로운, 깊은 여운',preset:'synth',root:2,scale:'minor',reverb:.7},
    hope:{name:'새로운 시작',icon:'✦',description:'밝게 펼쳐지는, 작은 용기와 희망',preset:'harp',root:2,scale:'diatonic',reverb:.45}
  };
  function nextGridTime(now,origin,bpm,division){const interval=60/bpm/division;return origin+Math.max(0,Math.ceil((now+.025-origin)/interval-1e-9))*interval;}
  function createBeatQueue(){const events=new Map();return {
    offer(time,event){events.set(time,event);},
    drain(before){const ready=[...events].filter(([time])=>time<=before).sort((a,b)=>a[0]-b[0]);ready.forEach(([time])=>events.delete(time));return ready;},
    clear(){events.clear();},
    get size(){return events.size;}
  };}
  function gridShape(density,mobile){return (mobile?{wide:[6,9],dense:[10,16],fine:[14,22]}:{wide:[12,7],dense:[20,12],fine:[28,16]})[density]||[20,12];}
  function scaleNote(step,root,scale,base=48){const notes=scales[scale];return base+root+Math.floor(step/notes.length)*12+notes[((step%notes.length)+notes.length)%notes.length];}
  function gridMidi(col,row,cols,rows,root,scale){return scaleNote(Math.round(col/(cols-1)*11+(rows-1-row)/(rows-1)*6),root,scale);}
  function chordForBar(bar,root,scale,progression=[0,1,2,3]){const minor=scale==='minor',degree=progression[Math.floor(bar/2)%4];const chords=minor?[[0,3,7],[8,12,15],[3,7,10],[10,14,17]]:[[0,4,7],[9,12,16],[5,9,12],[7,11,14]];const chord=chords[degree];return {notes:chord.map(n=>48+root+n),bass:36+root+chord[0],label:names[(root+chord[0])%12]+((minor&&degree===0)||(!minor&&degree===1)?'m':'')};}
  const progressions=[[0,1,2,3],[0,2,1,3],[1,2,0,3],[2,3,0,1],[0,3,2,1],[1,3,0,2]];
  const grooves={
    lofi:[{name:'느긋한 스윙',chords:[0,4],bass:[0,4],melody:[3,7],kick:[0,4],snare:[2,6],hat:[0,1,2,3,4,5,6,7],swing:.07},
      {name:'엇박의 산책',chords:[0,3,6],bass:[0,3,7],melody:[1,5],kick:[0,3,5],snare:[2,6],hat:[0,2,3,4,6,7],swing:.09},
      {name:'여백 있는 오후',chords:[0],bass:[0,6],melody:[2,5,7],kick:[0,5],snare:[6],hat:[0,2,4,6],swing:.04},
      {name:'가벼운 바운스',chords:[0,5],bass:[0,4,7],melody:[1,3,6],kick:[0,4,7],snare:[2,6],hat:[0,1,2,4,5,6,7],swing:.06}],
    forest:[{name:'숲 사이로',chords:[0],bass:[0],melody:[1,3,6]},
      {name:'물결의 대화',chords:[0],bass:[0,5],melody:[0,2,5,7]},
      {name:'깊은 숨',chords:[0],bass:[0],melody:[2,6]},
      {name:'반짝이는 잎',chords:[0,6],bass:[0,4],melody:[1,2,4,7]}],
    night:[{name:'별빛 펄스',chords:[0,4],bass:[0,4,6],melody:[0,2,4,6],kick:[0,4,6],snare:[2,6],hat:[0,1,2,3,4,5,6,7]},
      {name:'네온 산책',chords:[0,3],bass:[0,3,6],melody:[1,3,5,7],kick:[0,3,4],snare:[2,6],hat:[0,2,3,4,6,7]},
      {name:'고요한 궤도',chords:[0],bass:[0,4],melody:[0,3,6],kick:[0,4],snare:[6],hat:[0,2,4,6]},
      {name:'은하의 파동',chords:[0,6],bass:[0,2,5,7],melody:[0,1,4,5,7],kick:[0,2,4,7],snare:[2,6],hat:[0,1,2,3,4,5,6,7]}]
  };
  function createArrangement(seed=Math.floor(Math.random()*4294967296)){
    seed=seed>>>0;const cache=new Map();
    function phrase(cycle){
      cycle=Math.max(0,Math.floor(cycle));if(cache.has(cycle))return cache.get(cycle);
      let value=(seed^Math.imul(cycle+1,0x9e3779b1))>>>0;
      const random=()=>{value+=0x6d2b79f5;let n=value;n=Math.imul(n^n>>>15,n|1);n^=n+Math.imul(n^n>>>7,n|61);return ((n^n>>>14)>>>0)/4294967296;};
      const result={cycle,progression:progressions[(seed%6+cycle*(seed%2?5:1))%6],groove:(seed%4+cycle*(seed%2?3:1))%4,motif:Array.from({length:8},()=>Math.floor(random()*6)),inversion:Math.floor(random()*3),accent:.88+random()*.2};
      cache.set(cycle,result);if(cache.size>8)cache.delete(cache.keys().next().value);return result;
    }
    return {phrase,chord:(bar,root,scale)=>chordForBar(bar,root,scale,phrase(Math.floor(bar/8)).progression)};
  }
  function bgmStep(bar,step,root,scale,track,arrangement){
    const phrase=arrangement.phrase(Math.floor(bar/8)),groove=grooves[track][phrase.groove],chord=arrangement.chord(bar,root,scale),events=[];
    const note=(midi,preset,velocity,duration,offset=0)=>events.push({midi,preset,velocity:velocity*phrase.accent,duration,offset});
    if(groove.chords.includes(step)){
      const voiced=chord.notes.map((n,i)=>n+(i<phrase.inversion?12:0)).sort((a,b)=>a-b);
      voiced.forEach((n,i)=>note(n,tracks[track].instrument,step===0?.43:.25,track==='forest'?(groove.chords.length===1?4.8:3.1):(step===0?2.7:1.1),i*.025));
    }
    if(groove.bass.includes(step))note(chord.bass+(step===0?0:phrase.motif[(bar+step)%8]%2?7:12),'epiano',step===0?.73:.42,track==='forest'?2.6:1.2);
    if(groove.melody.includes(step)){
      const motif=phrase.motif[(step+(bar%2)*3)%8],midi=chord.notes[motif%3]+(motif>=3?12:0)+12;
      note(midi,track==='forest'?'harp':track==='night'?'synth':'piano',track==='forest'?.25:.23,track==='forest'?2.4:1.05,step%2?(groove.swing||0):0);
    }
    if(track!=='forest')for(const kind of ['kick','snare','hat'])if(groove[kind].includes(step))events.push({drum:kind,velocity:(kind==='kick'?.3:kind==='snare'?.07:step%2?.018:.03)*phrase.accent,offset:step%2?(groove.swing||0):0});
    // Short phrase endings create a gentle turnaround, rather than an extra loop.
    if(bar%4===3&&step===7){if(track!=='forest')events.push({drum:'hat',velocity:.021,offset:.25});note(chord.notes[phrase.motif[bar%8]%3]+12,track==='forest'?'bell':'epiano',.18,.65,.25);}
    return {chord,events,phrase,name:groove.name};
  }
  function harmonize(midi,chord,root,scale){const allowed=chord.notes.map(n=>n%12).filter(n=>scales[scale].some(s=>(s+root)%12===n));let best=midi,distance=Infinity;for(let n=midi-6;n<=midi+6;n++){if(allowed.includes((n+12)%12)&&Math.abs(n-midi)<distance){best=n;distance=Math.abs(n-midi);}}return best;}
  function keyMidi(key,mode,root,scale,random=Math.random){let hash=0;for(const char of key)hash=(hash*31+char.codePointAt(0))>>>0;const step=mode==='random'?Math.floor(random()*15):hash%15;return scaleNote(step,root,scale);}
  function createTypingGate(now=()=>performance.now()){
    let lastPhysical=-Infinity,composing=false,physicalComposition=false,commitUntil=-Infinity;
    return {
      key(event){
        if(event.ctrlKey||event.metaKey||event.altKey)return null;
        if(event.code&&event.code!=='Unidentified'){lastPhysical=now();if(composing)physicalComposition=true;}
        if(event.repeat)return null;
        return /^(Key[A-Z]|Digit[0-9]|Numpad[0-9]|Comma|Period|Semicolon|Quote|BracketLeft|BracketRight|Slash|Backslash|Minus|Equal|Backquote)$/.test(event.code)?event.code:null;
      },
      compositionStart(){composing=true;physicalComposition=now()-lastPhysical<180;},
      compositionEnd(){composing=false;physicalComposition=false;commitUntil=now()+80;},
      input(event){if(event.inputType?.startsWith('delete')||!event.data?.trim()||now()-lastPhysical<180||now()<commitUntil||(composing&&physicalComposition))return null;return Array.from(event.data).at(-1);}
    };
  }
  function driveCurve(amount,size=2048){const curve=new Float32Array(size),normalizer=Math.tanh(amount);for(let i=0;i<size;i++){const x=2*i/(size-1)-1;curve[i]=Math.tanh(amount*x)/normalizer;}return curve;}
  const api={scales,names,presets,tracks,moods,driveCurve,nextGridTime,createBeatQueue,gridShape,gridMidi,scaleNote,chordForBar,createArrangement,bgmStep,harmonize,keyMidi,createTypingGate};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Music=api;
})(globalThis);
