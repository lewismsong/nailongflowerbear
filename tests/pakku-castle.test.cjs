const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function setup(){
 const classes=new Set(), elements={};
 const classList={add(...xs){xs.forEach(x=>classes.add(x))},remove(...xs){xs.forEach(x=>classes.delete(x))},toggle(x,on){on?classes.add(x):classes.delete(x)}};
 for(const id of ['pakku-sandbox','sandbox-slide','sandbox-yarn','sandbox-suitcase','sandbox-castle','slide-option','yarn-option','suitcase-option','castle-option'])elements[id]={dataset:{},style:{},classList:{toggle(){}},listeners:{},addEventListener(k,f){this.listeners[k]=f},clientLeft:8,clientWidth:600,clientHeight:400,getBoundingClientRect(){return {left:100,top:200,width:170,height:130}}};
 const cat={offsetWidth:92,offsetHeight:92,dataset:{},style:{setProperty(){}},classList,setAttribute(){},getBoundingClientRect(){return {left:pet.catDrag.x,top:800-pet.catDrag.bottom-92,width:92,height:92}}};
 const pet={cat,direction:1,reducedMotion:{matches:false},setSleepingAppearance(){},scheduleNextSleep(){},catDrag:{x:150,bottom:100,isDragging:false,render(){},save(){},setPosition(x,b){this.x=x;this.bottom=b}}};
 const context={window:{innerHeight:800,addEventListener(){}},document:{getElementById:id=>elements[id]},appStorage:{getJson:()=>({inside:true}),setJson(){}}};
 vm.runInNewContext(fs.readFileSync('assets/js/pakku-sandbox.js','utf8'),context);
 return {room:new context.window.PakkuSandbox(pet),pet,classes,elements};
}
test('castle hides pakku, peeks at both windows and returns him',()=>{
 const {room,classes,elements}=setup();elements['castle-option'].listeners.click();assert(!classes.has('in-castle'));room.castleFrame(10);assert(classes.has('in-castle'));
 room.castleFrame(1);assert.equal(elements['sandbox-castle'].dataset.peek,'left');
 room.castleFrame(2.2);assert.equal(elements['sandbox-castle'].dataset.peek,'right');
 room.castleFrame(3);assert.equal(room.castleRun,null);assert(!classes.has('in-castle'));assert.equal(elements['sandbox-castle'].dataset.peek,'');
});
test('switching toys and leaving restore pakku; outside activation does nothing',()=>{
 const {room,classes}=setup();room.startCastle();room.startYarn();assert(!classes.has('in-castle'));assert.equal(room.castleRun,null);
 room.startCastle();room.startSlide();assert(!classes.has('in-castle'));
 room.startCastle();room.leave();assert(!classes.has('in-castle'));room.startCastle();assert.equal(room.castleRun,null);
});
test('reduced motion has a single still peek and returns',()=>{
 const {room,pet,elements,classes}=setup();pet.reducedMotion.matches=true;room.startCastle();room.castleFrame(1);assert.equal(elements['sandbox-castle'].dataset.peek,'left');room.castleFrame(2);assert(!classes.has('in-castle'));assert.equal(room.castleRun,null);
});

test('pakku walks visibly to the doorway before the peek timer begins',()=>{
 const {room,pet,classes,elements}=setup();room.startCastle();
 const before=pet.cat.getBoundingClientRect();room.castleFrame(.1);const after=pet.cat.getBoundingClientRect();
 assert.equal(pet.cat.dataset.behavior,'walking');assert(!classes.has('in-castle'));assert.equal(elements['sandbox-castle'].dataset.peek,'');
 assert(Math.hypot(after.left-before.left,after.top-before.top)<=10.51);assert.equal(room.castleRun.elapsed,0);
 room.castleFrame(10);assert(classes.has('in-castle'));assert.equal(room.castleRun.elapsed,0);assert.equal(elements['sandbox-castle'].dataset.peek,'');
 room.castleFrame(1);assert.equal(elements['sandbox-castle'].dataset.peek,'left');
 room.beginDrag();assert.equal(room.castleRun,null);assert(!classes.has('in-castle'));
});
test('yarn stays in its front play area and mirrored slide moves left',()=>{
 const {room,pet}=setup();room.startYarn();assert.equal(room.yarnRun.from,.14);assert.equal(room.yarnRun.target,.94);
 room.yarnX=.94;room.startYarn();assert.equal(room.yarnRun.target,.14);
 room.startSlide();room.slideFrame(0);const start=pet.catDrag.x;room.slideFrame(.8);assert(pet.catDrag.x<start);assert.equal(pet.direction,-1);
});
