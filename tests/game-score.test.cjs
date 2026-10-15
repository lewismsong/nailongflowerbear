const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const score=vm.runInNewContext(fs.readFileSync('assets/js/game-score.js','utf8')+';GameScore');
test('france dates include both endpoints and no neighbouring days',()=>{
 assert(!score.isFranceDay('2026-08-12'));assert(score.isFranceDay('2026-08-13'));assert(score.isFranceDay('2026-08-27'));assert(!score.isFranceDay('2026-08-28'));
});
test('toggle changes both trophy scores without changing records; ties and unfinished days do not win',()=>{
 const days={'2026-08-12':{k:3,l:1},'2026-08-13':{k:2,l:5},'2026-08-27':{k:9,l:1},'2026-08-28':{k:1,l:7},'2026-08-29':{k:4,l:4},'2026-10-15':{k:99,l:0},'2026-10-16':{k:0,l:99}};
 const before=JSON.stringify(days);
 assert.equal(JSON.stringify(score.tally(days,'2026-10-15',true)),JSON.stringify({khali:2,lewis:2}));
 assert.equal(JSON.stringify(score.tally(days,'2026-10-15',false)),JSON.stringify({khali:1,lewis:1}));
 assert.equal(JSON.stringify(days),before);
 assert.equal(score.tally(days,'2026-10-15',true).khali,2);
});
