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
test('secret page has no firebase, navigation or functional companions',()=>{
 const page=fs.readFileSync('ghali.html','utf8');assert(!/firebase|bear-tab-nav|pixel-companions|shared-settings/.test(page));
 const platform=fs.readFileSync('assets/js/platform.js','utf8');assert(platform.includes('new Set(["khali", "lewis"])'));
 for(const p of fs.readdirSync('.').filter(p=>p.endsWith('.html')))assert(fs.readFileSync(p,'utf8').includes('profile-route.js'),p);
});
