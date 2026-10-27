const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const route=fs.readFileSync('assets/js/profile-route.js','utf8');
function routing(name,path){let target;const doc={documentElement:{hidden:false}};vm.runInNewContext(route,{localStorage:{getItem:()=>name},document:doc,window:{location:{pathname:path,replace:p=>target=p}}});return target;}
test('ghali is confined to the secret miss screen; normal profiles keep their routes',()=>{
 for(const path of ['/nailongflowerbear/','/nailongflowerbear/pakku.html','/nailongflowerbear/settings.html']) assert.equal(routing(' GhAli ',path),'ghali.html');
 assert.equal(routing('ghali','/nailongflowerbear/ghali.html'),undefined);
 assert.equal(routing('khali','/nailongflowerbear/ghali.html'),'index.html');
 assert.equal(routing('lewis','/nailongflowerbear/pakku.html'),undefined);
 assert.equal(routing(null,'/nailongflowerbear/'),undefined);
});
test('gakku misses are local, throttled and survive reload without touching real misses',()=>{
 const store=new Map([['ily:name','ghali'],['ily:ghali:misses','4']]);const elements={};
 for(const id of ['ghali-count','ghali-response','ghali-sparks','gakku-button','ghali-signout'])elements[id]={textContent:'',addEventListener(k,f){this[k]=f}};
 let now=1000,target;vm.runInNewContext(fs.readFileSync('assets/js/ghali.js','utf8'),{appStorage:{get:(k,f)=>store.get(k)??f,set:(k,v)=>store.set(k,v),remove:k=>store.delete(k)},document:{getElementById:id=>elements[id]},performance:{now:()=>now},window:{matchMedia:()=>({matches:true}),location:{replace:p=>target=p}}});
 assert.equal(elements['ghali-count'].textContent,'4');elements['gakku-button'].click();elements['gakku-button'].click();assert.equal(store.get('ily:ghali:misses'),5);now+=601;elements['gakku-button'].click();assert.equal(store.get('ily:ghali:misses'),6);assert.equal(store.size,2);elements['ghali-signout'].click();assert(!store.has('ily:name'));assert.equal(target,'index.html');
});
test('secret page has no firebase, navigation or main-site companions',()=>{
 const page=fs.readFileSync('ghali.html','utf8');assert(!/firebase|bear-tab-nav|pixel-companions|shared-settings/.test(page));
 const platform=fs.readFileSync('assets/js/platform.js','utf8');assert(platform.includes('new Set(["khali", "lewis"])'));
 for(const p of fs.readdirSync('.').filter(p=>p.endsWith('.html')))assert(fs.readFileSync(p,'utf8').includes('profile-route.js'),p);
});
test('gakku walks, can be dragged and clamped, and saves separately',()=>{
 const listeners={},events={},classes=new Set(),store=new Map([['ily:name','ghali']]);let frame;
 const pet={offsetWidth:80,offsetHeight:80,style:{},classList:{add:x=>classes.add(x),remove:x=>classes.delete(x)},querySelector:()=>({style:{}}),addEventListener:(k,f)=>listeners[k]=f,setPointerCapture(){}};
 const context={appStorage:{get:(k,f)=>store.get(k)??f,getJson:()=>({x:30,bottom:10}),setJson:(k,v)=>store.set(k,v)},document:{hidden:false,getElementById:()=>pet},window:{innerWidth:400,innerHeight:600,matchMedia:()=>({matches:false}),addEventListener:(k,f)=>events[k]=f},requestAnimationFrame:f=>frame=f};
 vm.runInNewContext(fs.readFileSync('assets/js/gakku-companion.js','utf8'),context);
 frame(100);frame(150);assert(parseFloat(pet.style.left)>30);
 listeners.pointerdown({button:0,pointerId:1,clientX:50,clientY:550,preventDefault(){}});
 listeners.pointermove({pointerId:1,clientX:900,clientY:-800});assert.equal(pet.style.left,'320px');assert.equal(pet.style.bottom,'520px');
 listeners.pointerup({pointerId:1});assert(!classes.has('dragging'));assert(store.has('ily:gakku:position'));assert(!store.has('ily:daisyPosition'));
 context.window.innerWidth=200;events.resize();assert.equal(pet.style.left,'120px');
});
