const assert=require('node:assert/strict');
const test=require('node:test');
const M=require('../dist/music.js');
test('moods are complete, distinct musical combinations',()=>{
  assert.equal(Object.keys(M.moods).length,6);
  const signatures=new Set();for(const mood of Object.values(M.moods)){assert.ok(M.presets[mood.preset]);assert.ok(M.scales[mood.scale]);assert.ok([0,2,4,5,7,9].includes(mood.root));assert.ok(mood.reverb>=0&&mood.reverb<=1);signatures.add([mood.preset,mood.root,mood.scale,mood.reverb].join(':'));}assert.equal(signatures.size,6);
});
test('quantized melody stays on the shared BGM clock at 30–240 BPM',()=>{
  const origin=12.06;
  for(const bpm of [30,76,120,240])for(const division of [1,2,4])for(const elapsed of [0,.01,.07,.12,.333,1.999,2,13.32,95.9]){
    const now=origin+elapsed,time=M.nextGridTime(now,origin,bpm,division),interval=60/bpm/division;
    assert.ok(time>=now+.025-1e-8);assert.ok(time-now<=interval+.025+1e-8);
    const slots=(time-origin)/interval;assert.ok(Math.abs(slots-Math.round(slots))<1e-8);
    if(division===2)assert.ok(Math.abs((time-origin)/(30/bpm)-Math.round((time-origin)/(30/bpm)))<1e-8);
  }
});
test('fast typing coalesces to the last note per beat without a delayed backlog',()=>{
  const queue=M.createBeatQueue();
  for(let n=0;n<100;n++)queue.offer(M.nextGridTime(.10+n*.001,0,120,1),{note:n});
  assert.equal(queue.size,1);assert.deepEqual(queue.drain(.48),[]);assert.deepEqual(queue.drain(.5),[[.5,{note:99}]]);
  queue.offer(1,{note:'a'});queue.offer(1.5,{note:'b'});assert.deepEqual(queue.drain(1.1),[[1,{note:'a'}]]);queue.clear();assert.deepEqual(queue.drain(10),[]);
});
test('denser grids preserve the same playable range and ascend along both axes',()=>{
  for(const scale of Object.keys(M.scales))for(const root of [0,2,4,5,7,9])for(const density of ['wide','dense','fine'])for(const mobile of [false,true]){
    const [cols,rows]=M.gridShape(density,mobile),note=(c,r)=>M.gridMidi(c,r,cols,rows,root,scale);
    assert.equal(note(0,rows-1),48+root);assert.equal(note(cols-1,0),M.scaleNote(17,root,scale));
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){if(c)assert.ok(note(c,r)>=note(c-1,r));if(r)assert.ok(note(c,r)<=note(c,r-1));assert.ok(M.scales[scale].includes((note(c,r)-root)%12));}
  }
});
test('all 8 bars harmonize into both the active chord and selected scale',()=>{
  for(const scale of Object.keys(M.scales))for(const root of [0,2,4,5,7,9])for(let bar=0;bar<8;bar++){
    const chord=M.chordForBar(bar,root,scale);
    for(let midi=48;midi<96;midi++){const result=M.harmonize(midi,chord,root,scale);assert.ok(chord.notes.some(n=>n%12===result%12));assert.ok(M.scales[scale].includes((result-root+120)%12));assert.ok(Math.abs(result-midi)<=6);}
  }
});
test('fixed letters are reproducible; random notes stay in the selected scale',()=>{
  for(const key of ['KeyM','KeyA','Digit8','오늘','😊']){assert.equal(M.keyMidi(key,'fixed',0,'major'),M.keyMidi(key,'fixed',0,'major'));for(let n=0;n<100;n++){const note=M.keyMidi(key,'random',9,'minor');assert.ok(M.scales.minor.includes((note-9)%12));}}
});
test('Hangul physical keystrokes do not replay input or delayed composition commit',()=>{
  let time=0;const gate=M.createTypingGate(()=>time);
  assert.equal(gate.key({code:'KeyD'}),'KeyD');gate.compositionStart();assert.equal(gate.input({data:'ㅇ',inputType:'insertCompositionText'}),null);
  time=300;assert.equal(gate.key({code:'KeyH'}),'KeyH');assert.equal(gate.input({data:'오',inputType:'insertCompositionText'}),null);
  time=900;assert.equal(gate.input({data:'오',inputType:'insertCompositionText'}),null);gate.compositionEnd();assert.equal(gate.input({data:'오',inputType:'insertText'}),null);
  time=1100;assert.equal(gate.key({code:'Space'}),null);assert.equal(gate.input({data:' ',inputType:'insertText'}),null);
});
test('virtual keyboards play composition updates once; edits and shortcuts stay quiet',()=>{
  let time=0;const gate=M.createTypingGate(()=>time);gate.compositionStart();assert.equal(gate.input({data:'ㅇ',inputType:'insertCompositionText'}),'ㅇ');
  time=100;assert.equal(gate.input({data:'오',inputType:'insertCompositionText'}),'오');gate.compositionEnd();assert.equal(gate.input({data:'오',inputType:'insertText'}),null);
  time=300;assert.equal(gate.input({data:'',inputType:'deleteContentBackward'}),null);assert.equal(gate.key({code:'KeyC',ctrlKey:true}),null);assert.equal(gate.key({code:'KeyA',repeat:true}),null);assert.equal(gate.input({data:'a',inputType:'insertText'}),null);
});
