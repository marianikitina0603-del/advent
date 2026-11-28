"use strict";
(()=>{
const $=id=>document.getElementById(id);
const query=new URLSearchParams(location.search);
const preview=query.get("preview")==="1";
let exam=query.get("exam")==="ege"?"ege":"oge";
const ASSETS="assets/locations/",CHARACTERS="assets/characters/";
const giftNames=["red","green","blue","gold"];
const giftImages=giftNames.map(c=>ASSETS+"day06_gift_"+c+".webp");
const collection=window.ChronburgCollection.mount($("chronburgCollection"),exam);
let bank=null,progress=null,demo=false,demoState={solved:0,lost:0,errors:0};
let activeTask=-1,reserve=false,review=false,busy=false,animationToken=0,focusBefore=null;
let sound=false,audio=null;
const reduced=()=>window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,reduced()?0:ms));
const steps=()=>exam==="ege"?4:3;
const key=()=> "chronburg:2026:day06:"+exam+":v1";
const initial=()=>({solved:[],lost:0,errors:[],hints:0,complete:false});
function load(){
 try{
  const x=JSON.parse(localStorage.getItem(key()));
  if(x&&Array.isArray(x.solved)){
   const solved=[...new Set(x.solved.filter(n=>Number.isInteger(n)&&n>=0&&n<steps()))].sort((a,b)=>a-b);
   return {solved,lost:Math.min(4,Math.max(0,Number(x.lost)||0)),errors:Array.isArray(x.errors)?x.errors:[],hints:Math.max(0,Number(x.hints)||0),complete:x.complete===true||solved.length===steps()};
  }
 }catch(e){}
 return initial();
}
function save(){try{localStorage.setItem(key(),JSON.stringify(progress))}catch(e){$("climbStatus").textContent="Не получилось сохранить прогресс. Проверь настройки браузера."}}
function current(){return demo?demoState:{solved:progress.solved.length,lost:progress.lost,errors:progress.errors.length}}
function reached(){return current().solved}
function complete(){return reached()>=steps()}
const tasks=()=>bank&&bank.exams&&bank.exams[exam];
function tone(freq=620){
 if(!sound)return;
 try{audio=audio||new(window.AudioContext||window.webkitAudioContext)();const oscillator=audio.createOscillator(),gain=audio.createGain();oscillator.frequency.value=freq;gain.gain.setValueAtTime(.035,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.19);oscillator.connect(gain);gain.connect(audio.destination);oscillator.start();oscillator.stop(audio.currentTime+.2)}catch(e){}
}
const gifts=[];
for(let i=0;i<4;i++){
 const img=document.createElement("img");img.className="climb-gift";img.src=giftImages[i];
 img.alt="";img.draggable=false;img.dataset.index=String(i);$("giftsLayer").append(img);gifts.push(img);
}
const markers=[];
function makeMarkers(){
 $("heightMarkers").replaceChildren();markers.length=0;
 for(let i=0;i<steps();i++){
  const img=document.createElement("img");img.src=ASSETS+"day06_height_marker.webp";
  img.alt="";img.className="climb-marker";img.style.top=(75-(i+1)*(57/steps()))+"%";
  $("heightMarkers").append(img);markers.push(img);
 }
}
function giftPos(i,fallen){
 // Four gifts are at the top; fallen boxes remain in a visible foreground snowdrift.
 return fallen?{left:(17+i*7)+"%",top:(87-(i%2)*2)+"%"}:{left:(37+i*5.2)+"%",top:(12+(i%2)*1.5)+"%"};
}
function syncGifts(animate=false,oldLost=0){
 const lost=current().lost;
 for(let i=0;i<4;i++){
  const wasFallen=i>=4-oldLost,fallen=i>=4-lost,p=giftPos(i,fallen);
  gifts[i].style.left=p.left;gifts[i].style.top=p.top;
  gifts[i].classList.toggle("fallen",fallen);
  gifts[i].classList.toggle("restoring",animate&&wasFallen&&!fallen);
 }
}
function syncFinn(animate=false){
 const h=reached()/steps();
 const finn=$("finn");
 finn.classList.toggle("climbing",animate&&!complete());
 finn.classList.toggle("victory",complete());
 finn.style.top=(84-h*65)+"%";
 const pose=complete()?"day06_finn_victory.webp":reached()>0?"day06_finn_climb.webp":"day06_finn_idle.webp";
 if(!finn.src.endsWith(pose))finn.src=CHARACTERS+pose;
 finn.alt=complete()?"Финн достиг вершины":reached()?"Финн поднимается по столбу":"Финн стоит у подножия столба";
}
function mapLink(){return "index.html?exam="+exam+(preview?"&preview=1":"")}
function render(options={}){
 const n=reached(),lost=current().lost,finished=complete();
 $("oge").className="btn "+(exam==="oge"?"selected":"secondary");
 $("ege").className="btn "+(exam==="ege"?"selected":"secondary");
 $("examPill").textContent=exam==="oge"?"ОГЭ":"ЕГЭ профиль";
 $("levelPill").textContent=finished?"Вершина достигнута!":"Подъём "+n+" из "+steps();
 $("stageCount").textContent=n+" из "+steps()+" подъёмов";
 $("timeLabel").textContent=exam==="oge"?"ОГЭ · около 12 минут":"ЕГЭ · около 14 минут";
 $("giftCount").textContent="🎁 "+(4-lost)+" из 4 подарков";
 $("mistakeCount").textContent="Ошибки: "+current().errors;
 $("heightLabel").textContent="Высота "+Math.round(n/steps()*100)+"%";
 $("heightFill").style.width=(n/steps()*100)+"%";
 $("sceneCaption").textContent=finished?"Финн достиг вершины!":n?"Финн на уровне "+n+" из "+steps():"Финн у подножия столба";
 $("climbScene").classList.toggle("complete",finished);
 $("finishPanel").classList.toggle("hidden",!finished);
 $("finishText").textContent=demo?"Демонстрация завершена. Награда не сохраняется.":"Все четыре подарка возвращены. Шестая Искра времени спасена!";
 $("reviewTask").disabled=demo||!tasks();
 const available=!!tasks()&&!demo&&!finished&&!busy;
 $("taskOpen").disabled=!available;
 $("taskOpen").classList.toggle("hidden",finished);
 $("taskOpen").textContent=demo?"🔧 Демонстрация подъёма":available?"📜 Открыть задание "+(n+1):"🔒 Задания ждут публикации";
 $("climbStatus").textContent=finished?demo?"Проверка завершена! Демонстрация не меняет ученический прогресс.":"Все четыре подарка спасены! Колокольчик появился в коллекции.":
  lost?"Упало подарков: "+lost+". Перереши текущее задание — они вернутся, и Финн поднимется.":n?"Молодец! Финн поднялся. Открой следующее задание.":"Финн ждёт первого задания. Помоги ему подняться!";
 $("tikText").textContent=finished?"Тик: «Ура! Подарки спасены, а праздничный колокол звучит над ярмаркой!»":
  lost?"Тик: «Подарок упал, но ничего не потеряно навсегда. Исправь ответ, и мы всё вернём!»":
  n?"Тик: «Отлично! Продолжаем подъём. Все подарки на месте!»":"Тик: «Каждый верный ответ поможет Финну подняться. А упавшие подарки мы обязательно вернём!»";
 $("mapLink").href=mapLink();$("rewardMapLink").href=mapLink();
 $("teacherPanel").classList.toggle("hidden",!preview);
 $("demoToggle").textContent=demo?"Выключить демонстрацию":"Включить демонстрацию";
 $("demoWrong").disabled=!demo||finished||busy;
 $("demoCorrect").disabled=!demo||finished||busy;
 $("demoStatus").textContent=demo?"Демонстрационный режим. Результат и награда НЕ сохраняются.":"Демонстрация выключена.";
 $("levels").replaceChildren();
 for(let i=0;i<steps();i++){
  const row=document.createElement("div");row.className="climb-level "+(i<n?"complete":i===n?"current":"");
  const label=document.createElement("span");label.textContent="Высота "+(i+1);
  const state=document.createElement("span");state.textContent=i<n?"✓ Пройдена":i===n?"Следующая":"Ожидает";
  row.append(label,state);$("levels").append(row);
 }
 markers.forEach((m,i)=>m.classList.toggle("lit",i<n));
 syncGifts(!!options.animateGifts,options.oldLost??lost);
 syncFinn(!!options.animateFinn);
 collection.refresh(exam);
}
function number(raw){
 const s=String(raw??"").trim().replace(/\s/g,"").replace(",",".").replace("−","-");
 if(!/^-?(?:\d+(?:\.\d+)?|\.\d+)(?:\/-?(?:\d+(?:\.\d+)?|\.\d+))?$/.test(s))return NaN;
 const p=s.split("/");if(p.length===2&&Number(p[1])===0)return NaN;
 return p.length===2?Number(p[0])/Number(p[1]):Number(p[0]);
}
function validateBank(x){
 if(x?.kind!=="chronburg-private-day6"||x.day!==6||!x.exams)throw Error("Это не закрытый набор дня 6");
 for(const [name,count] of [["oge",3],["ege",4]]){
  if(!Array.isArray(x.exams[name])||x.exams[name].length!==count)throw Error("Неверное количество заданий "+name);
  for(const [i,t] of x.exams[name].entries()){
   if(!t?.text||t.answer===undefined||!t.reserve?.text||t.reserve.answer===undefined)throw Error("Отсутствует условие или резерв "+name+" №"+(i+1));
   if(!Number.isFinite(number(t.answer))||!Number.isFinite(number(t.reserve.answer)))throw Error("Неверный числовой ключ "+name+" №"+(i+1));
  }
 }
 return x;
}
function currentTask(){
 const t=tasks()?.[activeTask];return t?(reserve?t.reserve:t):null;
}
function setReply(message){$("taskReply").textContent=message}
function drawTask(){
 const t=currentTask();if(!t)return;
 $("taskTitle").textContent=(reserve?"Резервный аналог":"Испытание")+" "+(activeTask+1)+" из "+steps();
 window.ChronburgMath.render($("taskText"),t.text,choice=>{$("answer").value=String(choice)});
 $("taskFigure").replaceChildren();
 if(t.image&&/^assets\/pic\/[a-z0-9_./-]+$/i.test(t.image)){
  const img=document.createElement("img");img.src=t.image;img.alt="Рисунок к математическому заданию";$("taskFigure").append(img);
 }
 if(t.table&&Array.isArray(t.table.columns)&&Array.isArray(t.table.rows)){
  const table=document.createElement("table");
  const tr=document.createElement("tr");for(const v of t.table.columns){const th=document.createElement("th");th.textContent=String(v);tr.append(th)}table.append(tr);
  for(const row of t.table.rows){const tr=document.createElement("tr");for(const v of row){const td=document.createElement("td");td.textContent=String(v);tr.append(td)}table.append(tr)}
  $("taskFigure").append(table);
 }
 $("answer").value="";
 $("reserve").classList.toggle("hidden",review||reserve);
 setReply(review?"Повторение: результат не изменится.":"Правильный ответ поднимет Финна на следующий уровень.");
}
function openTask(index,asReview=false){
 if(demo||busy||!tasks())return;
 if(index<0||index>=steps())return;
 if(!asReview&&index!==reached())return;
 activeTask=index;review=asReview;reserve=false;
 drawTask();focusBefore=document.activeElement;
 $("dialog").classList.remove("hidden");document.body.style.overflow="hidden";$("closeTask").focus();
}
function closeTask(){
 if($("dialog").classList.contains("hidden"))return;
 $("dialog").classList.add("hidden");document.body.style.overflow="";
 if(focusBefore?.isConnected)focusBefore.focus();focusBefore=null;
}
async function animateCorrect(prevLost,token){
 busy=true;
 if(prevLost){
  syncGifts(true,prevLost);
  $("climbStatus").textContent="Подарки возвращаются на вершину!";
  await sleep(900);
  if(token!==animationToken)return;
 }
 render({animateFinn:true});
 tone(780);
 await sleep(1400);
 if(token!==animationToken)return;
 busy=false;$("finn").classList.remove("climbing");
 render();
}
function wrongAnswer(){
 if(review)return;
 const old=progress.lost;progress.lost=Math.min(4,progress.lost+1);
 progress.errors.push({task:activeTask+1,reserve,time:new Date().toISOString()});
 save();syncGifts(false,old);tone(300);
 render();
 setReply(progress.lost>old?"Пока неверно. Один подарок упал! Попробуй ещё раз: после правильного ответа подарки вернутся.":"Подарки уже в сугробе. Попробуй снова — всё восстановится при правильном решении.");
 if(!reserve&&tasks()?.[activeTask]?.reserve)$("reserve").classList.remove("hidden");
}
function check(){
 const t=currentTask();if(!t||busy)return;
 const got=number($("answer").value),want=number(t.answer);
 if(!Number.isFinite(got)){setReply("Введи число; дробь можно записать через /.");return}
 if(!Number.isFinite(want)){setReply("Ошибка ключа задания. Сообщи преподавателю.");return}
 if(Math.abs(got-want)>1e-8){if(review)setReply("Ответ пока неверен, попробуй ещё раз.");else wrongAnswer();return}
 if(review){setReply("Верно! Результат уже сохранён.");tone(730);return}
 const prevLost=progress.lost;
 progress.solved.push(activeTask);
 progress.solved=[...new Set(progress.solved)].sort((a,b)=>a-b);
 progress.lost=0;progress.complete=progress.solved.length===steps();
 save();closeTask();
 const token=++animationToken;
 animateCorrect(prevLost,token);
}
async function demoCorrect(){
 if(!demo||busy||complete())return;
 const prevLost=demoState.lost;
 demoState.solved++;demoState.lost=0;
 const token=++animationToken;await animateCorrect(prevLost,token);
}
function demoWrong(){
 if(!demo||busy||complete())return;
 const old=demoState.lost;
 demoState.lost=Math.min(4,old+1);demoState.errors++;syncGifts(false,old);render();tone(290);
}
function switchDemo(){
 if(!preview)return;
 ++animationToken;busy=false;closeTask();demo=!demo;demoState={solved:0,lost:0,errors:0};
 $("finn").classList.remove("climbing");render();
}
function selectExam(next){
 if(next===exam)return;
 ++animationToken;busy=false;closeTask();demo=false;
 exam=next;progress=load();demoState={solved:0,lost:0,errors:0};
 history.replaceState({},"","day06.html?exam="+exam+(preview?"&preview=1":""));
 makeMarkers();$("finn").classList.remove("climbing");render();
}
function exportProgress(){
 const data={app:"chronburg",day:6,exam,progress};
 const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));
 const a=document.createElement("a");a.href=url;a.download="chronburg-day06-"+exam+"-progress.json";a.click();
 setTimeout(()=>URL.revokeObjectURL(url),1200);
}
$("oge").onclick=()=>selectExam("oge");
$("ege").onclick=()=>selectExam("ege");
$("taskOpen").onclick=()=>openTask(reached());
$("reviewTask").onclick=()=>openTask(0,true);
$("check").onclick=check;
$("answer").addEventListener("keydown",e=>{if(e.key==="Enter")check()});
$("closeTask").onclick=closeTask;
$("dialog").addEventListener("click",e=>{if(e.target===$("dialog"))closeTask()});
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeTask()});
$("reserve").onclick=()=>{reserve=true;drawTask();setReply("Резервный аналог: при правильном ответе вернутся все подарки.")};
$("hint").onclick=()=>{const t=currentTask();if(!t)return;setReply(t.hint||"Перечитай условие, выпиши данные и проверь вычисления. Правильный ответ пока не раскрывается.");if(!review){progress.hints++;save()}};
$("sound").onclick=()=>{sound=!sound;$("sound").textContent=sound?"♫ Звук: вкл.":"♪ Звук: выкл.";if(sound)tone()};
$("exportProgress").onclick=exportProgress;
$("demoToggle").onclick=switchDemo;
$("demoWrong").onclick=demoWrong;
$("demoCorrect").onclick=demoCorrect;
$("resetProgress").onclick=()=>{
 if(!preview||!confirm("Сбросить сохранённый результат 6 декабря для "+exam.toUpperCase()+"?"))return;
 ++animationToken;busy=false;closeTask();demo=false;progress=initial();save();render();
};
$("importTasks").onchange=async e=>{
 const file=e.target.files?.[0];if(!file)return;
 try{bank=validateBank(JSON.parse(await file.text()));$("importStatus").textContent="✓ Локально загружены 3 задачи ОГЭ и 4 задачи ЕГЭ с резервами.";demo=false;render()}
 catch(err){$("importStatus").textContent="Ошибка: "+err.message}
 e.target.value="";
};
for(const v of ["1","2","3","4","5","6","7","8","9","0","/","−",",","⌫"]){
 const b=document.createElement("button");b.type="button";b.textContent=v;
 b.onclick=()=>{const input=$("answer");input.value=v==="⌫"?input.value.slice(0,-1):input.value+(v==="−"?"-":v);input.focus()};
 $("keys").append(b);
}
const canvas=$("scratch"),ctx=canvas.getContext("2d");let drawing=false;
function point(e){const r=canvas.getBoundingClientRect();return [(e.clientX-r.left)*canvas.width/r.width,(e.clientY-r.top)*canvas.height/r.height]}
canvas.addEventListener("pointerdown",e=>{drawing=true;canvas.setPointerCapture(e.pointerId);const [x,y]=point(e);ctx.beginPath();ctx.moveTo(x,y);e.preventDefault()});
canvas.addEventListener("pointermove",e=>{if(!drawing)return;const [x,y]=point(e);ctx.lineTo(x,y);ctx.strokeStyle="#2e455d";ctx.lineWidth=3;ctx.lineCap="round";ctx.stroke()});
canvas.addEventListener("pointerup",()=>drawing=false);
canvas.addEventListener("pointercancel",()=>drawing=false);
$("scratchToggle").onclick=()=>$("scratchWrap").classList.toggle("hidden");
$("clearScratch").onclick=()=>ctx.clearRect(0,0,canvas.width,canvas.height);
// First layout renders without animation; transitions activate only after initial paint.
gifts.forEach(g=>g.style.transition="none");
$("finn").style.transition="none";
progress=load();makeMarkers();render();
requestAnimationFrame(()=>requestAnimationFrame(()=>{
 gifts.forEach(g=>g.style.transition="");$("finn").style.transition="";
}));
window.ChronburgRelease.attach({
 day:6,
 onReady:x=>{try{bank=validateBank(x);render()}catch(e){$("releaseStatus").textContent="Ошибка опубликованного комплекта: "+e.message;$("releaseStatus").dataset.status="error"}},
 onStatus:(msg,kind)=>{const s=$("releaseStatus");s.textContent=msg;s.dataset.status=kind}
});
window.addEventListener("pageshow",()=>{if(demo)return;progress=load();render()});
})();
