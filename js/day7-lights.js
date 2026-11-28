"use strict";
(()=>{
const $=id=>document.getElementById(id);
const query=new URLSearchParams(location.search);
const preview=query.get("preview")==="1";
let exam=query.get("exam")==="ege"?"ege":"oge";
const collection=window.ChronburgCollection.mount($("chronburgCollection"),exam);
const NS="http://www.w3.org/2000/svg";
const routes=[
 {name:"Левая гирлянда",path:"M 170 486 Q 475 650 850 476",color:"#ffd278",bulbs:19},
 {name:"Правая гирлянда",path:"M 1070 476 Q 1455 642 1760 476",color:"#9ce4ad",bulbs:19},
 {name:"Огни часовой башни",path:"M 966 868 Q 930 731 956 585 Q 995 465 963 300",color:"#ffbf76",bulbs:16},
 {name:"Праздничная дуга",path:"M 240 337 Q 960 -22 1680 337",color:"#c8b3ff",bulbs:27}
];
const lightState={};
let bank=null,progress=null,demo=false,demoData={solved:0,errors:0,fault:false};
let activeTask=-1,reserve=false,review=false,busy=false,animationId=0,faultTimer=null,prevFocus=null,sound=false,audio=null,visualLitCount=0;
const reduced=()=>window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches===true;
const steps=()=>exam==="ege"?4:3;
const key=()=> "chronburg:2026:day07:"+exam+":v1";
const initial=()=>({solved:[],errors:[],hints:0,complete:false});
function load(){
 try{const x=JSON.parse(localStorage.getItem(key()));
  if(x&&Array.isArray(x.solved)){
   const solved=[...new Set(x.solved.filter(n=>Number.isInteger(n)&&n>=0&&n<steps()))].sort((a,b)=>a-b);
   return {solved,errors:Array.isArray(x.errors)?x.errors:[],hints:Math.max(0,Number(x.hints)||0),complete:x.complete===true||solved.length===steps()};
  }
 }catch(e){}
 return initial();
}
function save(){try{localStorage.setItem(key(),JSON.stringify(progress))}catch(e){$("status").textContent="Не удалось сохранить прогресс. Проверь настройки браузера."}}
const count=()=>demo?demoData.solved:progress.solved.length;
const errors=()=>demo?demoData.errors:progress.errors.length;
const finished=()=>count()===steps();
const tasks=()=>bank&&bank.exams&&bank.exams[exam];
function soundNote(freq=590){
 if(!sound)return;
 try{audio=audio||new(window.AudioContext||window.webkitAudioContext)();const osc=audio.createOscillator(),gain=audio.createGain();osc.type="sine";osc.frequency.value=freq;gain.gain.setValueAtTime(.035,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.17);osc.connect(gain);gain.connect(audio.destination);osc.start();osc.stop(audio.currentTime+.18)}catch(e){}
}
function svg(tag,attrs={},parent=null){
 const e=document.createElementNS(NS,tag);
 for(const [k,v] of Object.entries(attrs))e.setAttribute(k,String(v));
 if(parent)parent.append(e);
 return e;
}
function makeRoutes(){
 const stage=$("garlandSVG");stage.replaceChildren();
 for(const [i,r] of routes.entries()){
  const group=svg("g",{"data-route":i},stage);
  const wire=svg("path",{d:r.path,class:"garland-wire"},group);
  const litWire=svg("path",{d:r.path,class:"garland-wire-lit"},group);
  const bulbs=[];
  // SVG coordinates are defined for the same 1920x1080 viewBox as the rendered background.
  const length=wire.getTotalLength();
  for(let n=0;n<r.bulbs;n++){
   const point=wire.getPointAtLength(length*(n+.5)/r.bulbs);
   const casing=svg("circle",{cx:point.x,cy:point.y-7,r:7,fill:"#c5aa7e",stroke:"#544739","stroke-width":2},group);
   const bulb=svg("circle",{cx:point.x,cy:point.y+7,r:11,class:"garland-bulb"},group);
   bulb.style.color=r.color;
   bulbs.push(bulb);
  }
  lightState[i]={group,wire,litWire,bulbs,length};
 }
 // The glowing star is a separate ornament: only activated in the true finale.
 const star=svg("path",{id:"towerStar",class:"tower-star",d:"M 960 117 L 979 163 L 1027 167 L 990 200 L 1001 248 L 960 222 L 919 248 L 930 200 L 893 167 L 941 163 Z"},stage);
 lightState.star=star;
 const spark=svg("circle",{id:"lightSpark",class:"garland-spark",r:10,cx:-100,cy:-100},stage);
 lightState.spark=spark;
}
function litRoutes(){return visualLitCount}
function applyLights(partial=-1,ratio=0){
 const lit=litRoutes();
 for(let i=0;i<4;i++){
  const r=lightState[i],active=i<lit;
  r.litWire.classList.toggle("active",active||(i===partial&&ratio>0));
  r.bulbs.forEach((b,j)=>{
   const on=active||(i===partial&&(j+.5)/r.bulbs.length<=ratio);
   b.classList.toggle("on",on);
   b.setAttribute("fill",on?routes[i].color:"#4a5866");
  });
 }
 lightState.star.classList.toggle("on",lit===4);
 $("lightScene").classList.toggle("complete",lit===4);
}
function stopAnimation(){
 animationId++;
 if(faultTimer!==null){clearTimeout(faultTimer);faultTimer=null}
 busy=false;visualLitCount=finished()?4:count();lightState.spark.setAttribute("cx",-100);lightState.spark.setAttribute("cy",-100);
 for(let i=0;i<4;i++)lightState[i].bulbs.forEach(b=>b.classList.remove("fault"));
 applyLights();
}
function moveSpark(i,p){
 const route=lightState[i];const point=route.wire.getPointAtLength(route.length*Math.min(1,Math.max(0,p)));
 lightState.spark.setAttribute("cx",point.x);lightState.spark.setAttribute("cy",point.y);
}
function animateRoute(i,token){
 return new Promise(resolve=>{
  if(token!==animationId){resolve(false);return}
  if(reduced()){applyLights(i,1);resolve(true);return}
  const duration=i===3?2300:2050;
  let start=null;
  function tick(now){
   if(token!==animationId){resolve(false);return}
   if(start===null)start=now;
   const t=Math.min(1,(now-start)/duration);
   moveSpark(i,t);applyLights(i,t);
   if(t<1)requestAnimationFrame(tick);
   else{soundNote(i===3?880:660);resolve(true)}
  }
  requestAnimationFrame(tick);
 });
}
async function runWave(oldCount){
 const token=++animationId;busy=true;render();
 const routesToRun=[];
 if(exam==="oge"&&count()===3&&oldCount===2)routesToRun.push(2,3);
 else routesToRun.push(oldCount);
 for(const i of routesToRun){
  const success=await animateRoute(i,token);
  if(!success)return;
  // Commit visual state only after the spark has travelled across this route.
  visualLitCount=Math.max(visualLitCount,i+1);
  applyLights();
 }
 if(token!==animationId)return;
 busy=false;visualLitCount=finished()?4:count();lightState.spark.setAttribute("cx",-100);lightState.spark.setAttribute("cy",-100);
 applyLights();render();
}
function fault(){
 if(busy||finished())return;
 const i=count(),r=lightState[i];if(!r)return;
 if(faultTimer!==null)clearTimeout(faultTimer);
 r.bulbs.slice(0,Math.min(4,r.bulbs.length)).forEach(b=>b.classList.add("fault"));
 faultTimer=setTimeout(()=>{r.bulbs.forEach(b=>b.classList.remove("fault"));faultTimer=null},1500);
 soundNote(310);
}
function link(){return "index.html?exam="+exam+(preview?"&preview=1":"")}
function render(){
 const n=count(),done=finished(),lit=litRoutes();
 $("oge").className="btn "+(exam==="oge"?"selected":"secondary");
 $("ege").className="btn "+(exam==="ege"?"selected":"secondary");
 $("examPill").textContent=exam==="oge"?"ОГЭ":"ЕГЭ профиль";
 $("stagePill").textContent=done?"Площадь освещена!":"Участок "+(n+1)+" из "+steps();
 $("stageCount").textContent=n+" из "+steps()+" заданий";
 $("timeLabel").textContent=exam==="oge"?"ОГЭ · около 12–17 минут":"ЕГЭ · около 14–17 минут";
 $("litCount").textContent=lit+" из 4 световых маршрутов";
 $("errorCount").textContent="Ошибки: "+errors();
 $("meterText").textContent="Освещение "+Math.round(lit/4*100)+"%";
 $("meterFill").style.width=(lit/4*100)+"%";
 $("sceneLabel").textContent=done?"Праздничные гирлянды сияют!":n?"Освещено участков: "+lit+" из 4":"Гирлянды ждут первой искры";
 $("finishPanel").classList.toggle("hidden",!done||busy);
 $("finishText").textContent=demo?"Демонстрация завершена. Награда не сохранена.":"Праздничные гирлянды вновь освещают Хронбург. Седьмая Искра времени спасена!";
 $("reviewTask").disabled=!tasks()||demo;
 $("openTask").classList.toggle("hidden",done);
 $("openTask").disabled=busy||demo||done||!tasks();
 $("openTask").textContent=demo?"🔧 Демонстрация":!tasks()?"🔒 Задания ждут публикации":"📜 Открыть задание "+(n+1);
 $("status").textContent=done?"Праздничная площадь засияла!":"Правильный ответ запустит световой импульс. Ранее включённые участки не гаснут.";
 $("tikText").textContent=done?"Тик: «Ура! Огоньки добрались до звезды на часовой башне. Седьмая Искра времени с нами!»":
  n?"Тик: «Свет уже бежит по городу! Продолжим зажигать гирлянды!»":
  "Тик: «Восстановим гирлянды по одной! За каждой искрой последует целая волна огней».";
 $("teacherPanel").classList.toggle("hidden",!preview);
 $("demoToggle").textContent=demo?"Выключить демонстрацию":"Включить демонстрацию";
 $("demoStatus").textContent=demo?"Проверка анимаций: достижения не сохраняются.":"Демонстрация выключена.";
 $("demoWrong").disabled=!demo||done||busy;
 $("demoCorrect").disabled=!demo||done||busy;
 $("mapLink").href=link();$("finishMap").href=link();
 $("routeList").replaceChildren();
 for(let i=0;i<4;i++){
  const row=document.createElement("div");
  row.className="light-route "+(i<lit?"done":i===lit?"current":"");
  const title=document.createElement("span");title.textContent=(i+1)+". "+routes[i].name;
  const state=document.createElement("small");state.textContent=i<lit?"✓ Горит":i===lit?"Следующий":"Ожидает";
  row.append(title,state);$("routeList").append(row);
 }
 applyLights();
 collection.refresh(exam);
}
function numeric(raw){
 const s=String(raw??"").replace(/\s/g,"").replace(",",".").replace("−","-");
 if(!/^-?(?:\d+(?:\.\d+)?|\.\d+)(?:\/-?(?:\d+(?:\.\d+)?|\.\d+))?$/.test(s))return NaN;
 const v=s.split("/");if(v.length===2&&Number(v[1])===0)return NaN;
 return v.length===2?Number(v[0])/Number(v[1]):Number(v[0]);
}
function validateBank(x){
 if(x?.kind!=="chronburg-private-day7"||x.day!==7||!x.exams)throw Error("Это не комплект дня 7");
 for(const [e,n] of [["oge",3],["ege",4]]){
  if(!Array.isArray(x.exams[e])||x.exams[e].length!==n)throw Error(e+": неверное число заданий");
  for(const [i,t] of x.exams[e].entries()){
   if(!t?.text||!t.reserve?.text||t.answer===undefined||t.reserve.answer===undefined)throw Error(e+" №"+(i+1)+": нет основного задания или резерва");
   if(!Number.isFinite(numeric(t.answer))||!Number.isFinite(numeric(t.reserve.answer)))throw Error(e+" №"+(i+1)+": неверный числовой ключ");
  }
 }
 return x;
}
function currentTask(){const t=tasks()?.[activeTask];return t?(reserve?t.reserve:t):null}
function reply(s){$("taskReply").textContent=s}
function showTask(){
 const t=currentTask();if(!t)return;
 $("taskTitle").textContent=(reserve?"Резервный аналог":"Световой замок")+" "+(activeTask+1)+" из "+steps();
 window.ChronburgMath.render($("taskText"),t.text,choice=>{$("answer").value=String(choice)});
 $("taskFigure").replaceChildren();
 if(t.image&&/^assets\/pic\/[a-z0-9_./-]+$/i.test(t.image)){
  const img=document.createElement("img");img.src=t.image;img.alt="Рисунок к заданию";$("taskFigure").append(img);
 }
 if(Array.isArray(t.table?.columns)&&Array.isArray(t.table.rows)){
  const table=document.createElement("table");
  const head=document.createElement("tr");for(const v of t.table.columns){const th=document.createElement("th");th.textContent=String(v);head.append(th)}table.append(head);
  for(const row of t.table.rows){const tr=document.createElement("tr");for(const v of row){const td=document.createElement("td");td.textContent=String(v);tr.append(td)}table.append(tr)}
  $("taskFigure").append(table);
 }
 $("answer").value="";
 const attempted=progress.errors.some(x=>x.task===activeTask+1);
 $("reserve").classList.toggle("hidden",review||reserve||!attempted);
 reply(review?"Повторение не изменяет прогресс.":"Реши задачу и запусти световой импульс.");
}
function openTask(i,asReview=false){
 if(demo||busy||!tasks()||i<0||i>=steps()||(!asReview&&i!==count()))return;
 activeTask=i;reserve=false;review=asReview;showTask();prevFocus=document.activeElement;
 $("dialog").classList.remove("hidden");document.body.style.overflow="hidden";$("closeTask").focus();
}
function closeTask(){
 if($("dialog").classList.contains("hidden"))return;
 $("dialog").classList.add("hidden");document.body.style.overflow="";
 if(prevFocus?.isConnected)prevFocus.focus();prevFocus=null;
}
function check(){
 if(busy)return;
 const t=currentTask();if(!t)return;
 const got=numeric($("answer").value),want=numeric(t.answer);
 if(!Number.isFinite(got)){reply("Введи числовой ответ (для дроби можно использовать /).");return}
 if(!Number.isFinite(want)){reply("Не удалось проверить ключ задания. Сообщи преподавателю.");return}
 if(Math.abs(got-want)>1e-8){
  if(review){reply("Проверь вычисления и попробуй снова.");return}
  progress.errors.push({task:activeTask+1,reserve,time:new Date().toISOString()});save();fault();
  $("errorCount").textContent="Ошибки: "+errors();
  reply("Импульс остановился на текущей гирлянде! Проверь решение и повтори ответ — зажжённые гирлянды останутся гореть.");
  if(!reserve)$("reserve").classList.remove("hidden");
  return;
 }
 if(review){reply("Верно! Это задание уже было решено.");soundNote(720);return}
 const old=count();
 progress.solved.push(activeTask);
 progress.solved=[...new Set(progress.solved)].sort((a,b)=>a-b);
 progress.complete=progress.solved.length===steps();
 save();closeTask();runWave(old);
}
function toggleDemo(){
 if(!preview)return;
 stopAnimation();closeTask();demo=!demo;demoData={solved:0,errors:0,fault:false};visualLitCount=demo?0:(progress.complete?4:progress.solved.length);render();
}
function demoWrong(){
 if(!demo||busy||finished())return;
 demoData.errors++;fault();render();
}
function demoCorrect(){
 if(!demo||busy||finished())return;
 const old=count();demoData.solved++;runWave(old);
}
function changeExam(e){
 if(e===exam)return;
 stopAnimation();closeTask();demo=false;
 exam=e;progress=load();demoData={solved:0,errors:0,fault:false};visualLitCount=progress.complete?4:progress.solved.length;
 history.replaceState({},"","day07.html?exam="+exam+(preview?"&preview=1":""));
 render();
}
function exportProgress(){
 const content=JSON.stringify({app:"chronburg",day:7,exam,progress},null,2);
 const url=URL.createObjectURL(new Blob([content],{type:"application/json"}));
 const a=document.createElement("a");a.href=url;a.download="chronburg-day07-"+exam+"-progress.json";a.click();
 setTimeout(()=>URL.revokeObjectURL(url),1200);
}
$("oge").onclick=()=>changeExam("oge");$("ege").onclick=()=>changeExam("ege");
$("openTask").onclick=()=>openTask(count());$("reviewTask").onclick=()=>openTask(0,true);
$("closeTask").onclick=closeTask;$("check").onclick=check;
$("answer").addEventListener("keydown",e=>{if(e.key==="Enter")check()});
$("dialog").addEventListener("click",e=>{if(e.target===$("dialog"))closeTask()});
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeTask()});
$("reserve").onclick=()=>{reserve=true;showTask();reply("Это резервный аналог: при верном решении световой импульс продолжится.")};
$("hint").onclick=()=>{const t=currentTask();if(!t)return;reply(t.hint||"Выпиши известные данные и внимательно проверь последовательность вычислений.");if(!review){progress.hints++;save()}};
$("sound").onclick=()=>{sound=!sound;$("sound").textContent=sound?"♫ Звук: вкл.":"♪ Звук: выкл.";if(sound)soundNote(550)};
$("exportProgress").onclick=exportProgress;
$("demoToggle").onclick=toggleDemo;$("demoWrong").onclick=demoWrong;$("demoCorrect").onclick=demoCorrect;
$("resetProgress").onclick=()=>{
 if(!preview||!confirm("Сбросить результаты 7 декабря для "+exam.toUpperCase()+"?"))return;
 stopAnimation();closeTask();demo=false;progress=initial();visualLitCount=0;save();render();
};
$("importTasks").onchange=async e=>{
 const file=e.target.files?.[0];if(!file)return;
 try{bank=validateBank(JSON.parse(await file.text()));$("importStatus").textContent="✓ Локально загружены 3 задачи ОГЭ и 4 задачи ЕГЭ с резервами.";demo=false;stopAnimation();render()}
 catch(err){$("importStatus").textContent="Ошибка: "+err.message}
 e.target.value="";
};
for(const value of ["1","2","3","4","5","6","7","8","9","0","/","−",",","⌫"]){
 const button=document.createElement("button");button.type="button";button.textContent=value;
 button.onclick=()=>{const input=$("answer");input.value=value==="⌫"?input.value.slice(0,-1):input.value+(value==="−"?"-":value);input.focus()};
 $("keys").append(button);
}
const canvas=$("scratch"),ctx=canvas.getContext("2d");let drawing=false;
function point(e){const r=canvas.getBoundingClientRect();return [(e.clientX-r.left)*canvas.width/r.width,(e.clientY-r.top)*canvas.height/r.height]}
canvas.addEventListener("pointerdown",e=>{drawing=true;canvas.setPointerCapture(e.pointerId);const [x,y]=point(e);ctx.beginPath();ctx.moveTo(x,y);e.preventDefault()});
canvas.addEventListener("pointermove",e=>{if(!drawing)return;const [x,y]=point(e);ctx.lineTo(x,y);ctx.strokeStyle="#2e455d";ctx.lineWidth=3;ctx.lineCap="round";ctx.stroke()});
canvas.addEventListener("pointerup",()=>drawing=false);canvas.addEventListener("pointercancel",()=>drawing=false);
$("scratchToggle").onclick=()=>$("scratchWrap").classList.toggle("hidden");
$("clearScratch").onclick=()=>ctx.clearRect(0,0,canvas.width,canvas.height);
progress=load();visualLitCount=progress.complete?4:progress.solved.length;makeRoutes();render();
window.ChronburgRelease.attach({
 day:7,
 onReady:x=>{try{bank=validateBank(x);render()}catch(e){$("releaseStatus").textContent="Ошибка комплекта: "+e.message;$("releaseStatus").dataset.status="error"}},
 onStatus:(msg,kind)=>{const s=$("releaseStatus");s.textContent=msg;s.dataset.status=kind}
});
window.addEventListener("pageshow",()=>{if(demo)return;stopAnimation();progress=load();visualLitCount=progress.complete?4:progress.solved.length;render()});
})();
