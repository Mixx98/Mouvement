const assert=require('node:assert/strict');
const test=require('node:test');
const M=require('../music.js');
test('guide preference defaults to visible, persists opt-out and can be enabled again',()=>{
  const entries=new Map(),storage={getItem:key=>entries.get(key),setItem:(key,value)=>entries.set(key,value),removeItem:key=>entries.delete(key)};
  const guide=M.createGuidePreference(storage);assert.equal(guide.hidden(),false);assert.equal(guide.setHidden(true),true);assert.equal(M.createGuidePreference(storage).hidden(),true);
  assert.equal(guide.setHidden(false),true);assert.equal(M.createGuidePreference(storage).hidden(),false);
  const blocked=M.createGuidePreference({getItem(){throw Error('blocked');},setItem(){throw Error('blocked');},removeItem(){throw Error('blocked');}});
  assert.equal(blocked.hidden(),false);assert.equal(blocked.setHidden(true),false);assert.equal(blocked.setHidden(false),false);
});
test('overlapping keys and touches survive quantization as a bounded chord, sequential typing stays single',()=>{
  const held=M.createHeldNotes(),queue=M.createBeatQueue();
  const a={midi:60,index:0},b={midi:64,index:1},c={midi:67,index:2};
  queue.offer(.5,{notes:held.press('key:KeyA',a)});
  queue.offer(.5,{notes:held.press('key:KeyS',b)});
  queue.offer(.5,{notes:held.press('touch:12',c)});
  held.release('key:KeyA');held.release('key:KeyS');held.release('touch:12');
  assert.deepEqual(queue.drain(.5)[0][1].notes,[a,b,c]);
  queue.offer(1,{notes:held.press('key:KeyA',a)});held.release('key:KeyA');
  queue.offer(1,{notes:held.press('key:KeyS',b)});held.release('key:KeyS');
  assert.deepEqual(queue.drain(1)[0][1].notes,[b]);
  held.press('touch:1',a);assert.deepEqual(held.press('touch:1',b),[b]);
  for(let i=0;i<20;i++)assert.ok(held.press('key:'+i,{midi:48+i}).length<=6);
  held.clear();assert.deepEqual(held.press('touch:2',c),[c]);
  const chord=M.chordForBar(0,0,'major');
  const voiced=M.melodyVoicing([{midi:60},{midi:61},{midi:64},{midi:67}],midi=>M.harmonize(midi,chord,0,'major'));
  assert.deepEqual(voiced.map(n=>n.midi),[60,64,67]);
});
test('panel Back, close button, Forward and rapid reopen consume only panel history',()=>{
  const entries=[{previousPage:true},null];let cursor=1,pending=0;const renders=[];
  const history={get state(){return entries[cursor];},pushState(state){entries.splice(cursor+1);entries.push(state);cursor++;},back(){pending++;}};
  const panel=M.createPanelNavigation({history,onChange:open=>renders.push(open)});
  panel.open();panel.open();assert.equal(cursor,2);assert.equal(entries.length,3);
  cursor--;panel.pop(history.state);assert.equal(panel.opened,false);assert.equal(cursor,1);
  cursor++;panel.pop(history.state);assert.equal(panel.opened,true);
  panel.close();panel.close();assert.equal(pending,1);assert.equal(panel.opened,false);
  panel.open();cursor--;pending--;panel.pop(history.state);assert.equal(panel.opened,true);assert.equal(cursor,2);assert.equal(entries.length,3);
  panel.close();cursor--;pending--;panel.pop(history.state);assert.equal(panel.opened,false);assert.equal(cursor,1);assert.equal(pending,0);
  panel.close();assert.equal(pending,0);assert.equal(renders.at(-1),false);
});
test('arrangements change every phrase and remain deterministic across lookahead boundaries',()=>{
  for(const seed of [0,1,42,987654321,4294967295]){
    const arrangement=M.createArrangement(seed),again=M.createArrangement(seed),progressions=new Set(),grooves=new Set();let previous;
    for(let cycle=0;cycle<24;cycle++){
      const phrase=arrangement.phrase(cycle);assert.deepEqual(phrase,again.phrase(cycle));
      progressions.add(phrase.progression.join());grooves.add(phrase.groove);
      if(previous){assert.notDeepEqual(phrase.progression,previous.progression);assert.notEqual(phrase.groove,previous.groove);}previous=phrase;
    }
    assert.equal(progressions.size,6);assert.equal(grooves.size,4);
    assert.deepEqual(arrangement.phrase(0),again.phrase(0));
    const boundary=arrangement.chord(8,9,'minor');arrangement.chord(7,9,'minor');assert.deepEqual(boundary,arrangement.chord(8,9,'minor'));
  }
  assert.notDeepEqual(M.createArrangement(123).phrase(0),M.createArrangement(124).phrase(0));
});
test('all evolving BGM events stay bounded, tonal, and aligned with live harmonization',()=>{
  const arrangement=M.createArrangement(42),signatures={};
  for(const track of Object.keys(M.tracks)){
    signatures[track]=new Set();
    for(const scale of Object.keys(M.scales))for(const root of [0,2,4,5,7,9])for(let bar=0;bar<48;bar++){
      const chord=arrangement.chord(bar,root,scale);assert.equal(chord.notes.length,3);
      for(let step=0;step<8;step++){
        const result=M.bgmStep(bar,step,root,scale,track,arrangement);assert.deepEqual(result.chord,chord);assert.ok(result.events.length<12);
        if(root===0&&scale==='major'&&bar%8===0)signatures[track].add(result.name);
        for(const event of result.events){assert.ok(event.offset>=0&&event.offset<.5);assert.ok(event.velocity>0&&event.velocity<=1);
          if(event.drum){assert.notEqual(track,'forest');assert.ok(['kick','snare','hat'].includes(event.drum));}
          else{assert.ok(M.presets[event.preset]);assert.ok(Number.isFinite(event.duration)&&event.duration>0&&event.duration<=5);assert.ok(event.midi>=24&&event.midi<=108);assert.ok(chord.notes.some(n=>n%12===event.midi%12));}
        }
      }
      for(const midi of [48,61,79,95]){const adjusted=M.harmonize(midi,chord,root,scale);assert.ok(chord.notes.some(n=>n%12===adjusted%12));assert.ok(M.scales[scale].includes((adjusted-root+120)%12));}
    }
    assert.equal(signatures[track].size,4);
  }
});
test('distortion stays bounded and symmetric while adding soft clipping',()=>{
  for(const amount of [2.5,8]){
    const curve=M.driveCurve(amount);assert.equal(curve[0],-1);assert.equal(curve.at(-1),1);
    for(let i=0;i<curve.length;i++){assert.ok(Number.isFinite(curve[i])&&Math.abs(curve[i])<=1);assert.ok(Math.abs(curve[i]+curve[curve.length-1-i])<1e-6);if(i)assert.ok(curve[i]>=curve[i-1]);}
    assert.ok(curve[Math.floor(curve.length*.75)]>.5);
  }
});
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
