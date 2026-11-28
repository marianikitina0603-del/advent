"use strict";
(()=>{
const $=id=>document.getElementById(id);
const query=new URLSearchParams(location.search);
const preview=query.has("preview")&&query.get("preview")!=="0";
let exam=query.get("exam")==="ege"?"ege":"oge";
const partInfo=[
 {title:"Малая шестерёнка",icon:"⚙",file:"day04_part_gear_small",socket:"Первый шестерёнчатый узел"},
 {title:"Заводная пружина",icon:"⌁",file:"day04_part_spring_core",socket:"Пружинный вал"},
 {title:"Средняя шестерёнка",icon:"⚙",file:"day04_part_gear_medium",socket:"Передаточное колесо"},
 {title:"Золотое сердце",icon:"⚙",file:"day04_part_final_reward_gear",socket:"Сердце механизма"}
];
const scenePaths=[
 "day04_toy_workshop_base.png",
 "day04_toy_workshop_stage1.png",
 "day04_toy_workshop_stage2.png",
 "day04_toy_workshop_stage3.png",
 "day04_toy_workshop_complete.png"
];
const fallback="assets/locations/day04_workshop_fallback.svg";
const collection=window.ChronburgCollection.mount($("chronburgCollection"),exam);
let bank=null,progress,activeIndex=-1,alternate=false,review=false,sound=false,audio=null;
let backgroundRequest=0,lastFocused=null;
function storageKey(){return "chronburg:2026:day04:"+exam+":v1"}
function fresh(){return {solved:[],errors:[],hints:0,complete:false}}
function load(){
 try{const p=JSON.parse(localStorage.getItem(storageKey()));if(p&&Array.isArray(p.solved))return {
  solved:[...new Set(p.solved.filter(x=>Number.isInteger(x)&&x>=0&&x<4))].sort((a,b)=>a-b),
  errors:Array.isArray(p.errors)?p.errors:[],hints:Math.max(0,Number(p.hints)||0),complete:p.complete===true
 }}catch(e){}
 return fresh();
}
function save(){try{localStorage.setItem(storageKey(),JSON.stringify(progress))}catch(e){$("releaseStatus").textContent="Не удалось сохранить прогресс в браузере."}}
progress=load();
const tasks=()=>bank&&bank.exams&&bank.exams[exam];
const steps=()=>exam==="ege"?4:3;
const completed=()=>progress.solved.filter(i=>i<steps()).length;
const done=()=>progress.complete||completed()===steps();
const nextIndex=()=>Array.from({length:steps()},(_,i)=>i).find(i=>!progress.solved.includes(i))??-1;
function ensureComplete(){if(!progress.complete&&completed()===steps()){progress.complete=true;save()}}
function audioTone(freq=590){
 if(!sound)return;try{audio=audio||new(window.AudioContext||window.webkitAudioContext)();const osc=audio.createOscillator(),gain=audio.createGain();osc.type="sine";osc.frequency.value=freq;gain.gain.setValueAtTime(.055,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.19);osc.connect(gain);gain.connect(audio.destination);osc.start();osc.stop(audio.currentTime+.2)}catch(e){}
}
function updateBackground(){
 const count=completed(),stage=done()?4:Math.min(count,3);
 const src="assets/locations/"+scenePaths[stage],version=++backgroundRequest;
 const img=new Image();
 img.onload=()=>{if(version===backgroundRequest)$("workshopBg").src=src};
 img.onerror=()=>{if(version===backgroundRequest)$("workshopBg").src=fallback};
 img.src=src;
}
function makePart(index,state){
 const button=document.createElement("button");
 button.className="work-part "+state+(state==="pending"?" disabled-part":"");
 button.type="button";button.disabled=state!=="current";
 const info=partInfo[index];
 const img=document.createElement("img");
 img.src="assets/locations/"+info.file+(state==="current"?"_active":"")+".png";
 img.className="part-picture";img.alt="";img.draggable=false;
 img.onload=()=>img.classList.add("loaded");
 img.onerror=()=>{img.hidden=true};
 const fallbackIcon=document.createElement("span");fallbackIcon.className="part-fallback";fallbackIcon.textContent=info.icon;
 const label=document.createElement("span");label.className="part-label";label.textContent=info.title;
 button.append(img,fallbackIcon,label);
 if(state==="current"){button.setAttribute("aria-label","Установить: "+info.title+"; открыть математическое задание");button.onclick=()=>openTask(index)}
 return button;
}
function fillSocket(index,state){
 const el=$("socket"+index);
 el.className="part-socket "+(state==="done"?"installed":state==="current"?"pulsing":"locked");
 el.setAttribute("aria-label",partInfo[index].socket+" — "+(state==="done"?"деталь установлена":state==="current"?"следующая деталь":"ожидает"));
 const center=el.querySelector(".socket-icon");
 center.textContent=state==="done"?(index===1?"✺":partInfo[index].icon):"◌";
 center.classList.toggle("rotating",state==="done"&&index!==1);
}
function render(){
 ensureComplete();
 const data=tasks(),n=steps(),count=completed(),active=nextIndex(),finished=done();
 $("oge").className="btn "+(exam==="oge"?"active":"secondary");
 $("ege").className="btn "+(exam==="ege"?"active":"secondary");
 $("sceneMode").textContent=exam==="oge"?"ОГЭ":"ЕГЭ профиль";
 $("countLabel").textContent="Установлено деталей: "+count+" из "+n;
 $("doneCount").textContent=count+" / "+n;
 $("questionCount").textContent=data?n+" заданий":"Набор ожидается";
 $("progressBar").style.width=(count/n*100)+"%";
 $("timeLabel").textContent=exam==="oge"?"ОГЭ · около 11 минут":"ЕГЭ · около 14 минут";
 $("stageLabel").textContent=finished?"Мастерская снова работает!":"Сборка механизма · этап "+(count+1)+" из "+n;
 $("finishPanel").classList.toggle("hidden",!finished);
 $("taskOpen").disabled=!data||finished;
 $("taskOpen").classList.toggle("hidden",finished);
 $("taskOpen").textContent=!data?"Задания появятся 4 декабря":active>=0?"⚙ Установить: "+partInfo[active].title:"Все детали установлены";
 $("replay").classList.toggle("hidden",!finished||!data);
 $("tray").replaceChildren();
 for(let i=0;i<4;i++){
  const already=progress.solved.includes(i)||finished;
  const state=already?"done":i===active?"current":"pending";
  fillSocket(i,state);
  // OGE has three mathematical stages; fourth part is installed automatically at the finale.
  if(i<steps()&&!already)$("tray").append(makePart(i,state));
 }
 if(!finished&&!data)$("tray").append(Object.assign(document.createElement("span"),{className:"work-hint",textContent:"Механизм ждёт заданий. После публикации детали станут доступны автоматически."}));
 const lines=[
  "Тик: «У часовщика остановилось Сердце мастерской. Начнём с малой шестерёнки!»",
  "Тик: «Первое колесо на месте. Теперь нужно закрепить заводную пружину».",
  "Тик: «Передача почти готова! Установим среднюю шестерёнку».",
  "Тик: «Осталась золотая заводная шестерёнка. Это последний ключ к запуску!»"
 ];
 $("storyText").textContent=finished?"Тик: «Слышишь? Все шестерёнки вращаются! Мастерская снова делает новогодние игрушки. Тебе — золотая шестерёнка с красным бантом!»":lines[Math.max(0,Math.min(active,3))];
 collection.refresh(exam);
 updateBackground();
}
function displayText(text){window.ChronburgMath.render($("questionText"),text,choice=>{$("answer").value=String(choice);$("answer").focus()})}
function currentTask(){const b=tasks();if(!b||activeIndex<0||activeIndex>=b.length)return null;return alternate?b[activeIndex].reserve:b[activeIndex]}
function feedback(message,level){$("feedback").textContent=message;$("feedback").className="feedback"+(level?" "+level:"")}
function renderTask(){
 const t=currentTask();if(!t)return;
 $("taskCount").textContent=(alternate?"Резервный аналог":"Деталь "+(activeIndex+1))+" из "+steps();
 $("questionTitle").textContent=(alternate?"Дополнительное испытание: ":"Математический замок: ")+partInfo[activeIndex].title;
 displayText(t.text||"");
 $("source").textContent=t.source?"Источник: "+t.source:"";
 const media=$("taskMedia");media.replaceChildren();
 if(t.image&&/^assets\/pic\/[a-zA-Z0-9_/.+-]+$/.test(t.image)){
  const img=document.createElement("img");img.src=t.image;img.alt="Рисунок к заданию";img.className="work-task-img";media.append(img);
 }
 if(t.table?.columns&&Array.isArray(t.table.rows)){
  const tbl=document.createElement("table");tbl.className="work-table";
  const head=document.createElement("tr");for(const value of t.table.columns){let el=document.createElement("th");el.textContent=value;head.append(el)}tbl.append(head);
  for(const row of t.table.rows){const tr=document.createElement("tr");for(const v of row){const el=document.createElement("td");el.textContent=v;tr.append(el)}tbl.append(tr)}media.append(tbl);
 }
 $("answer").value="";$("answer").disabled=false;$("check").disabled=false;
 $("reserve").classList.add("hidden");
 feedback(review?"Режим повторения: прогресс сохранится.":"Реши задачу, чтобы деталь встала на место.");
}
function openTask(i,asReview=false){
 if(!tasks()){feedback("Набор заданий пока не опубликован.","bad");return}
 if(i<0||i>=tasks().length)return;
 if(!asReview&&nextIndex()!==i)return;
 review=asReview;alternate=false;activeIndex=i;renderTask();
 lastFocused=document.activeElement;
 $("dialog").classList.remove("hidden");document.body.style.overflow="hidden";$("close").focus();audioTone(450);
}
function closeTask(){
 if($("dialog").classList.contains("hidden"))return;
 $("dialog").classList.add("hidden");document.body.style.overflow="";
 if(lastFocused?.isConnected)lastFocused.focus();lastFocused=null;
}
function numeric(raw){
 const s=String(raw||"").replace(/\s/g,"").replace(",",".").replace("−","-");
 if(!/^-?(?:\d+(?:\.\d+)?|\.\d+)(?:\/-?(?:\d+(?:\.\d+)?|\.\d+))?$/.test(s))return NaN;
 const v=s.split("/");return v.length===2?Number(v[0])/Number(v[1]):Number(v[0]);
}
function check(){
 const t=currentTask();if(!t)return;
 const got=numeric($("answer").value),want=numeric(t.answer);
 if(!Number.isFinite(got)){feedback("Введи число (дробь можно записать через /).","bad");return}
 if(!Number.isFinite(want)){feedback("В наборе нет проверенного числового ключа. Сообщи преподавателю.","bad");return}
 if(Math.abs(got-want)<=1e-8){
  if(!review&&!progress.solved.includes(activeIndex)){
   progress.solved.push(activeIndex);progress.solved.sort((a,b)=>a-b);
   if(completed()===steps())progress.complete=true;
   save();
  }
  audioTone(750);closeTask();render();
 }else{
  feedback("Пока неверно. Проверь степени, корни и порядок вычислений. При необходимости используй резервную задачу.","bad");
  if(!review){
   progress.errors.push({task:activeIndex+1,answer:$("answer").value,reserve:alternate,time:new Date().toISOString()});save();
   if(!alternate&&tasks()[activeIndex].reserve)$("reserve").classList.remove("hidden");
  }
 }
}
function selectExam(next){
 closeTask();exam=next;progress=load();review=false;alternate=false;
 history.replaceState({},"","day04.html?exam="+exam+(preview?"&preview=1":""));
 $("mapLink").href="index.html?exam="+exam+(preview?"&preview=1":"");
 $("sceneBackLink").href=$("mapLink").href;$("rewardMapLink").href=$("mapLink").href;const now=new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Moscow",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());const dateOf=t=>now.find(x=>x.type===t)?.value||"00";const today=dateOf("year")+"-"+dateOf("month")+"-"+dateOf("day");$("nextDayLink").classList.toggle("hidden",!preview&&today<"2026-12-05");$("nextDayLink").href="day05.html?exam="+exam+(preview?"&preview=1":"");
 render();
}
function validateBank(x){
 if(x?.kind!=="chronburg-private-day4"||x.day!==4||!x.exams)throw Error("Неверный комплект четвёртого дня");
 for(const [name,n] of [["oge",3],["ege",4]]){
  if(!Array.isArray(x.exams[name])||x.exams[name].length!==n)throw Error("Неверное количество заданий "+name);
  for(const t of x.exams[name])if(!t?.text||!t.reserve?.text||t.answer===undefined||t.reserve.answer===undefined)throw Error("Неполное задание или резерв");
 }
 return x;
}
$("import").onchange=async e=>{
 const file=e.target.files?.[0];if(!file)return;
 try{bank=validateBank(JSON.parse(await file.text()));$("importStatus").textContent="✓ Локально загружены ОГЭ (3) и ЕГЭ (4) с резервами.";render()}
 catch(err){$("importStatus").textContent="Ошибка: "+err.message}
 e.target.value="";
};
$("oge").onclick=()=>selectExam("oge");$("ege").onclick=()=>selectExam("ege");
$("taskOpen").onclick=()=>openTask(nextIndex());
$("check").onclick=check;$("answer").addEventListener("keydown",e=>{if(e.key==="Enter")check()});
$("close").onclick=closeTask;$("curtain").onclick=closeTask;
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeTask()});
$("reserve").onclick=()=>{alternate=true;renderTask()};
$("hint").onclick=()=>{feedback("Подсказка: сначала преобразуй выражение по свойствам степеней, корней или логарифмов, затем подставляй числа.");if(!review){progress.hints++;save()}};
$("sound").onclick=()=>{sound=!sound;$("sound").textContent=sound?"♫ Звук: вкл.":"♪ Звук: выкл.";if(sound)audioTone()};
$("replay").onclick=()=>openTask(0,true);
$("reset").onclick=()=>{if(confirm("Сбросить прогресс 4 декабря для "+exam.toUpperCase()+"?")){closeTask();progress=fresh();save();render()}};
$("export").onclick=()=>{
 const content=JSON.stringify({app:"chronburg",day:4,exam,progress},null,2);
 const url=URL.createObjectURL(new Blob([content],{type:"application/json"}));
 const a=document.createElement("a");a.href=url;a.download="chronburg-day04-"+exam+"-progress.json";a.click();
 setTimeout(()=>URL.revokeObjectURL(url),1200);
};
const keypad=$("keyboard");
for(const k of ["1","2","3","4","5","6","7","8","9","0","/","−",",","⌫"]){
 const b=document.createElement("button");b.type="button";b.textContent=k;
 b.onclick=()=>{const el=$("answer");el.value=k==="⌫"?el.value.slice(0,-1):el.value+(k==="−"?"-":k);el.focus()};keypad.append(b);
}
const cv=$("draftCanvas"),ctx=cv.getContext("2d");let drawing=false;
function point(e){const b=cv.getBoundingClientRect();return{x:(e.clientX-b.left)*cv.width/b.width,y:(e.clientY-b.top)*cv.height/b.height}}
cv.addEventListener("pointerdown",e=>{drawing=true;cv.setPointerCapture(e.pointerId);const p=point(e);ctx.beginPath();ctx.moveTo(p.x,p.y)});
cv.addEventListener("pointermove",e=>{if(!drawing)return;const p=point(e);ctx.lineTo(p.x,p.y);ctx.strokeStyle="#2e455d";ctx.lineWidth=3;ctx.lineCap="round";ctx.stroke()});
cv.addEventListener("pointerup",()=>drawing=false);cv.addEventListener("pointercancel",()=>drawing=false);
$("draftBtn").onclick=()=>$("draftWrap").classList.toggle("hidden");
$("clearDraft").onclick=()=>ctx.clearRect(0,0,cv.width,cv.height);
$("teacherPanel").classList.toggle("hidden",!preview);
selectExam(exam);
window.ChronburgRelease.attach({
 day:4,
 onReady:x=>{try{if(!bank){bank=validateBank(x);render()}return true}catch(e){$("releaseStatus").textContent="Ошибка формата опубликованного комплекта: "+e.message;return false}},
 onStatus:(message,kind)=>{const el=$("releaseStatus");el.textContent=message;el.dataset.status=kind}
});
window.addEventListener("pageshow",()=>{progress=load();render()});
})();
