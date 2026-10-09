const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
function setup() {
  const store = new Map(), elements = {};
  const classes = new Set();
  const cat = { offsetWidth: 88, offsetHeight: 88, style: { setProperty() {} }, dataset: {},
    classList: { add: x=>classes.add(x), remove: x=>classes.delete(x), toggle: (x,on)=>on?classes.add(x):classes.delete(x) }, setAttribute() {},
    getBoundingClientRect() { return { left: pet.catDrag.x, top: 800-pet.catDrag.bottom-88, width:88, height:88 }; } };
  for (const id of ['daisy-park','daisy-lake','daisy-bed','lake-option','bed-option','daisy-status']) elements[id] = { listeners: {}, addEventListener(k,f){this.listeners[k]=f}, clientLeft:8, clientTop:8, clientWidth:500, clientHeight:380 };
  elements['daisy-park'].getBoundingClientRect=()=>({left:100,top:100,width:516,height:396});
  elements['daisy-lake'].getBoundingClientRect=()=>({left:130,top:250,width:250,height:130});
  elements['daisy-bed'].getBoundingClientRect=()=>({left:440,top:350,width:130,height:80});
  const pet={cat,direction:1,reducedMotion:{matches:false},catDrag:{x:450,bottom:350,isDragging:false,render(){}}};
  const context={window:{innerHeight:800},document:{getElementById:id=>elements[id]},appStorage:{getJson:(k,f)=>store.get(k)||f,setJson:(k,v)=>store.set(k,v)}};
  vm.runInNewContext(fs.readFileSync(path.join(root,'assets/js/daisy-park.js'),'utf8'),context);
  const park=new context.window.DaisyPark(pet,{storageKey:'daisy',initialState:{inside:true,x:.68,y:.7}});
  return {park,pet,store,elements,classes};
}
test('daisy swims into the lake, comes ashore, then returns; dragging interrupts',()=>{
 const {park,classes}=setup();park.start('swim');park.swim(3);assert(classes.has('is-swimming'));park.swim(6);assert(!classes.has('is-swimming'));park.swim(6);assert(classes.has('is-swimming'));park.beginDrag();assert.equal(park.mode,null);assert(!classes.has('is-swimming'));
});
test('bed rests her, leaving persists, dropping on the lake restarts swimming',()=>{
 const {park,pet,store}=setup();park.start('bed');park.update(1600,.1,{name:'walking'});assert.equal(pet.cat.dataset.behavior,'idle');assert.equal(park.mode,'bed');pet.catDrag.x=20;pet.catDrag.bottom=8;assert(park.drop());assert.equal(store.get('daisy').inside,false);park.start('swim');assert.equal(park.mode,null);pet.catDrag.x=190;pet.catDrag.bottom=800-270-88;park.drop();assert.equal(park.inside,true);assert.equal(park.mode,'swim');assert.equal(store.get('daisy').inside,true);
});
test('reduced motion avoids travelling and preserves her size',()=>{
 const {park,pet}=setup();pet.reducedMotion.matches=true;park.start('swim');park.swim(1);const first=[pet.catDrag.x,pet.catDrag.bottom];park.swim(10);assert.deepEqual([pet.catDrag.x,pet.catDrag.bottom],first);assert.equal(pet.cat.offsetWidth,88);
});
test('all navigation pages load daisy once after shared drag support',()=>{
 for(const name of fs.readdirSync(root).filter(n=>n.endsWith('.html'))){const html=fs.readFileSync(path.join(root,name),'utf8');if(!html.includes('pixel-companions.js'))continue;assert.equal((html.match(/daisy-companion.js/g)||[]).length,1,name);assert(html.indexOf('pixel-companions.js')<html.indexOf('daisy-companion.js'),name);}
 assert(!fs.readFileSync(path.join(root,'pakku.html'),'utf8').includes('id="sandbox-samoyed"'));
 assert(!fs.readFileSync(path.join(root,'assets/css/pakku-sandbox.css'),'utf8').includes('.pixel-cat.in-sandbox {'));
});
test('daisy restores roaming state, rejects pakku’s room and portals to her park',()=>{
 const storage=new Map([['ily:daisyPosition',{x:120,bottom:8,direction:1}]]);
 const cat={style:{setProperty(){}},classList:{remove(){}},setAttribute(){},addEventListener(){},getBoundingClientRect:()=>({left:120,top:120,width:92,height:92})};
 let destination,tree=null;
 const room={getBoundingClientRect:()=>({left:100,top:100,right:400,bottom:400})};
 const window={innerHeight:800,addEventListener(){},matchMedia:()=>({matches:false}),location:{assign:p=>destination=p},CompanionDraggable:class{constructor(el,options){this.options=options;this.x=120;this.bottom=8;this.dragged=true;}clamp(){}render(){}save(){}setPosition(x,bottom){this.x=x;this.bottom=bottom}}};
 const document={hidden:false,body:{appendChild(){}},getElementById:id=>id==='pakku-sandbox'?room:null,createElement:()=>cat,querySelector:()=>tree};
 const context={window,document,performance:{now:()=>0},requestAnimationFrame(){},isAppAuthenticated:()=>true,appStorage:{getJson:(k,f)=>storage.get(k)||f,setJson:(k,v)=>storage.set(k,v)}};
 vm.runInNewContext(fs.readFileSync(path.join(root,'assets/js/daisy-companion.js'),'utf8'),context);
 const daisy=window.initializeDaisy();assert.equal(cat.hidden,false);assert(daisy.catDrag.options.onDrop());assert.equal(daisy.catDrag.bottom,8);
 tree=room;daisy.catDrag.options.onDrop();assert.equal(destination,'daisy.html');assert.equal(storage.get('ily:daisyPark').inside,true);assert.equal(storage.has('ily:pakkuSandbox'),false);
});
test('landscape keeps daisy below the horizon without changing toy interaction',()=>{
 const {park,pet}=setup();park.placeAt(200,108);
 const top=800-pet.catDrag.bottom-pet.cat.offsetHeight;
 assert(top>=108+380*.60-88*.7);
 park.start('bed');park.update(1600,.1,{name:'walking'});
 assert.equal(pet.cat.dataset.behavior,'idle');
});
