const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function setup(stored=new Map()) {
 const elements={};
 for(const id of ['appearance-form','dark-mode','apply-appearance','appearance-status']) elements[id]={checked:false,disabled:false,textContent:'',classList:{add(){},remove(){}},addEventListener(type,fn){this[type]=fn;}};
 const root={dataset:{}};
 const storage={getItem:k=>stored.get(k)??null,setItem:(k,v)=>stored.set(k,v)};
 const context=vm.createContext({document:{documentElement:root,getElementById:id=>elements[id]},localStorage:storage,sessionStorage:{getItem:()=>null},window:{dispatchEvent(){}},CustomEvent:class{},console:{error(){}}});
 for(const file of ['session-appearance','settings-appearance'])vm.runInContext(fs.readFileSync(`assets/js/${file}.js`,'utf8'),context);
 return {elements,root,storage,stored};
}
test('appearance stays a draft until apply and survives a fresh page',()=>{
 const h=setup(); const e=h.elements;
 assert.equal(e['apply-appearance'].disabled,true);
 e['dark-mode'].checked=true;e['dark-mode'].change();
 assert.equal(h.root.dataset.appearance,'light');assert.equal(h.stored.size,0);assert.equal(e['apply-appearance'].disabled,false);
 assert.equal(setup(h.stored).root.dataset.appearance,'light');
 e['appearance-form'].submit({preventDefault(){}});
 assert.equal(h.root.dataset.appearance,'dark');assert.equal(e['apply-appearance'].disabled,true);
 const next=setup(h.stored);assert.equal(next.root.dataset.appearance,'dark');assert.equal(next.elements['dark-mode'].checked,true);
 next.elements['dark-mode'].checked=false;next.elements['dark-mode'].change();next.elements['appearance-form'].submit({preventDefault(){}});
 assert.equal(setup(h.stored).root.dataset.appearance,'light');
});
test('storage failure leaves applied appearance unchanged and permits retry',()=>{
 const h=setup();const e=h.elements; const save=h.storage.setItem;
 h.storage.setItem=()=>{throw new Error('blocked')};
 e['dark-mode'].checked=true;e['dark-mode'].change();e['appearance-form'].submit({preventDefault(){}});
 assert.equal(h.root.dataset.appearance,'light');assert.equal(e['apply-appearance'].disabled,false);assert.match(e['appearance-status'].textContent,/couldn't save/);
 h.storage.setItem=save;e['appearance-form'].submit({preventDefault(){}});
 assert.equal(h.root.dataset.appearance,'dark');assert.equal(e['apply-appearance'].disabled,true);
});
