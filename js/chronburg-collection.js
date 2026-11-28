"use strict";
window.ChronburgCollection=(function(){
const known=[
 {day:1,name:"Золотой фонарик",file:"assets/ornaments/ornament_day01_lantern.png"},
 {day:2,name:"Пряник Марты",file:"assets/ornaments/ornament_day02_gingerbread.png"},
 {day:3,name:"Почтовый ящик",file:"assets/ornaments/ornament_day03_mailbox.png"},
 {day:4,name:"Золотая заводная шестерёнка",file:"assets/ornaments/ornament_day04_clockwork_gear.png"},
 {day:5,name:"Компас зимнего пути",file:"assets/ornaments/ornament_day05_winter_compass.png"},
 {day:6,name:"Ярмарочный колокольчик",file:"assets/ornaments/ornament_day06_fair_bell.webp"}
];
function read(key){try{return JSON.parse(localStorage.getItem(key))}catch(e){return null}}
function earned(exam){
 const p=read("chronburg:2026:"+exam+":v1");
 const d1=!!(p&&Array.isArray(p.completed)&&p.completed.includes(1));
 return new Set([...(d1?[1]:[]),...[2,3,4,5,6].filter(n=>{const x=read("chronburg:2026:day0"+n+":"+exam+":v1");return !!(x&&x.complete===true)})]);
}
function elt(type,classes,text){const el=document.createElement(type);if(classes)el.className=classes;if(text!==undefined)el.textContent=text;return el}
function image(src,alt,classes){const img=document.createElement("img");img.src=src;img.alt=alt;if(classes)img.className=classes;return img}
function mount(root,initialExam){
 if(!root)return {refresh:()=>{}};
 root.classList.add("chronburg-collect");
 const heading=elt("h2","collect-heading","Ёлка Хронбурга");
 const tree=elt("div","collect-tree");
 tree.append(image("assets/trees/christmas_tree_empty.png","Общая новогодняя ёлка Хронбурга","tree-art"));
 const toys=new Map();
 for(const o of known){const img=image(o.file,o.name+" на ёлке","tree-toy");img.dataset.day=String(o.day);img.hidden=true;tree.append(img);toys.set(o.day,img)}
 const meta=elt("p","collect-meta","0 из 24 украшений");
 const open=elt("button","btn secondary collect-open","🎁 Коллекция игрушек");open.type="button";open.setAttribute("aria-haspopup","dialog");
 const overlay=elt("div","collect-overlay");overlay.hidden=true;
 overlay.setAttribute("role","dialog");overlay.setAttribute("aria-modal","true");overlay.setAttribute("aria-label","Коллекция игрушек Хронбурга");
 const windowBox=elt("div","collect-window");
 const head=elt("div","collect-head");
 const titleWrap=elt("div");
 const title=elt("h2","collect-title","Коллекция игрушек");
 const subtitle=elt("p","collect-subtitle","Полученные игрушки цветные. Остальные — чёрно-белые; будущие сюрпризы пока скрыты.");
 titleWrap.append(title,subtitle);
 const close=elt("button","collect-close","×");close.type="button";close.setAttribute("aria-label","Закрыть коллекцию");
 head.append(titleWrap,close);
 const grid=elt("div","collect-grid");
 windowBox.append(head,grid);overlay.append(windowBox);
 root.replaceChildren(heading,tree,meta,open,overlay);
 let exam=initialExam==="ege"?"ege":"oge";
 let priorFocus=null;
 const dismiss=()=>{overlay.hidden=true;document.body.classList.remove("chronburg-collection-open");(priorFocus||open).focus()};
 const show=()=>{priorFocus=document.activeElement;build();overlay.hidden=false;document.body.classList.add("chronburg-collection-open");close.focus()};
 function build(){
  const have=earned(exam);grid.replaceChildren();
  for(let n=1;n<=24;n++){
   const item=known.find(o=>o.day===n),isEarned=have.has(n);
   const card=elt("div","collect-item "+(isEarned?"earned":"locked"));
   card.setAttribute("aria-label","День "+n+": "+(item?item.name:"Секретная игрушка")+(isEarned?", получена":", пока не получена"));
   card.append(elt("small",null,"День "+n));
   if(item)card.append(image(item.file,item.name));
   else card.append(elt("div","mystery","?"));
   card.append(elt("strong",null,item?item.name:"Секретная игрушка"));
   card.append(elt("span","collect-state",isEarned?"✓ Получена":"Не получена"));
   grid.append(card);
  }
 }
 function refresh(nextExam){exam=nextExam==="ege"?"ege":"oge";const have=earned(exam);for(const [day,img] of toys)img.hidden=!have.has(day);meta.textContent=have.size+" из 24 украшений";if(!overlay.hidden)build()}
 open.addEventListener("click",show);
 close.addEventListener("click",dismiss);
 overlay.addEventListener("click",e=>{if(e.target===overlay)dismiss()});
 overlay.addEventListener("keydown",e=>{if(e.key==="Escape"){e.stopPropagation();dismiss()}else if(e.key==="Tab"){const nodes=[...overlay.querySelectorAll("button:not([disabled])")];if(nodes.length===1){e.preventDefault();close.focus()}}});
 refresh(exam);
 return {refresh};
}
return {mount,earned};
})();
