"use strict";
(()=>{
const $=id=>document.getElementById(id);
const query=new URLSearchParams(location.search);
const preview=query.has("preview")&&query.get("preview")!=="0";
let exam=query.get("exam")==="ege"?"ege":"oge";
let bank=null,progress=null,previewStage=0,previewDemo=false,activeTask=-1,reserve=false,travel=false,travelToken=0,latestFocus=null,wrongCount=0;
const MAP_W=1648,MAP_H=928;
// Route points measured against the supplied 1648 × 928 map. These can be
// calibrated from real screenshots without changing the state machine.
const start=[318,807];
const junctions=[
 {name:"Лесная развилка",at:[386,747],hint:"Нашим саням нужна широкая дорога. Узкая тропа среди елей для высокой ёлки не подойдёт.",
  good:{label:"Широкая дорога",icon:"↘",button:[35,80],path:[[386,747],[418,822],[520,861],[600,832]]},
  bad:{label:"Узкая лесная тропа",icon:"↖",button:[15,50],path:[[386,747],[286,586],[212,455]]},
  from:[[318,807],[355,805],[386,747]],returnMessage:"Сани не поместятся между заснеженными елями."},
 {name:"Переправа через реку",at:[600,832],hint:"Тяжёлые сани смогут пересечь реку только по широкому каменному мосту.",
  good:{label:"Каменный мост",icon:"↗",button:[44,69],path:[[600,832],[522,792],[486,731],[523,657],[618,611],[745,605],[836,597]]},
  bad:{label:"Деревянный мост",icon:"↖",button:[23,37],path:[[600,832],[475,667],[350,450],[389,331]]},
  returnMessage:"Деревянная переправа слишком узкая для тяжёлых саней."},
 {name:"Городские улицы",at:[836,597],hint:"Дорога к площади идёт мимо горящих латунных фонарей. Закрытые железные ворота ведут в тупик.",
  good:{label:"Улица фонарей",icon:"↗",button:[65,40],path:[[836,597],[930,561],[998,484],[1020,393],[1090,315]]},
  bad:{label:"Закрытые ворота",icon:"↖",button:[60,30],path:[[836,597],[921,494],[986,362]]},
  returnMessage:"Железные ворота закрыты. Выбери освещённую улицу."},
 {name:"Въезд на площадь",at:[1090,315],hint:"Через низкую арку высокая ёлка не пройдёт. Нужен широкий въезд с золотыми воротами.",
  good:{label:"Широкие золотые ворота",icon:"↗",button:[85,43],path:[[1090,315],[1050,388],[1030,445],[1050,488],[1160,485],[1280,463],[1350,427],[1450,420],[1474,364],[1465,274],[1405,219]]},
  bad:{label:"Низкая каменная арка",icon:"↖",button:[66,19],path:[[1090,315],[1080,225],[1096,165]]},
  returnMessage:"Арка слишком низкая для верхушки ели. Нужно выбрать широкие ворота."}
];
const finish=[1405,219];
function safeRead(){try{return JSON.parse(localStorage.getItem("chronburg:2026:day05:"+exam+":v1"))}catch(e){return null}}
function initial(){return {stage:0,solved:[],errors:[],wrongTurns:0,complete:false}}
function load(){const p=safeRead();if(!p||!Array.isArray(p.solved))return initial();return {stage:Math.max(0,Math.min(4,Number(p.stage)||0)),solved:[...new Set(p.solved.filter(x=>Number.isInteger(x)&&x>=0&&x<4))],errors:Array.isArray(p.errors)?p.errors:[],wrongTurns:Math.max(0,Number(p.wrongTurns)||0),complete:p.complete===true}}
function save(){try{localStorage.setItem("chronburg:2026:day05:"+exam+":v1",JSON.stringify(progress))}catch(e){$("status").textContent="Не удалось сохранить результат в браузере."}}
const length=()=>exam==="oge"?3:4;
const stage=()=>previewDemo?previewStage:progress.stage;
const completed=()=>stage()>=4;
const tasks=()=>bank&&bank.exams&&bank.exams[exam];
const taskUnlocked=()=>!!tasks()&&stage()<4&&(exam==="oge"&&stage()===3||progress.solved.includes(stage()));
const canChoose=()=>previewDemo||taskUnlocked();
function pos(el,p){el.style.left=(p[0]/MAP_W*100)+"%";el.style.top=(p[1]/MAP_H*100)+"%"}
function currentPosition(n=stage()){return n===0?start:n<4?junctions[n].at:finish}
function makeSvg(tag,attrs){const node=document.createElementNS("http://www.w3.org/2000/svg",tag);for(const [k,v] of Object.entries(attrs))node.setAttribute(k,v);return node}
function pathD(arr){return arr.map((p,i)=>(i?"L":"M")+p.join(" ")).join(" ")}
function drawLines(){
 const svg=$("routes");svg.replaceChildren();
 let n=stage();
 for(let i=0;i<Math.min(n,4);i++){
  if(i===0)svg.append(makeSvg("path",{d:pathD(junctions[0].from),class:"route-line"}));
  svg.append(makeSvg("path",{d:pathD(junctions[i].good.path),class:"route-line"}));
 }
 if(n===0)svg.append(makeSvg("path",{d:pathD(junctions[0].from),class:"route-line-preview"}));
 // Do not reveal the correct branch before the pupil chooses the route.
}
function moveSprite(p,glowing=false){
 pos($("sleigh"),p);
 $("sleighImage").src="assets/locations/"+(glowing?"day05_sleigh_tree_glow.png":"day05_sleigh_tree.png");
}
function setButtons(){
 const n=stage();
 const choices=$("choices");choices.replaceChildren();
 if(n>=4)return;
 const junction=junctions[n];
 for(const [which,detail] of [["bad",junction.bad],["good",junction.good]]){
  const button=document.createElement("button");
  button.type="button";button.className="route-hotspot";button.textContent=detail.icon+" "+detail.label;
  button.disabled=travel||!canChoose();
  button.title=detail.label;button.setAttribute("aria-label",detail.label);
  button.style.left=detail.button[0]+"%";button.style.top=detail.button[1]+"%";
  button.onclick=()=>choose(which);
  choices.append(button);
 }
}
function note(message){$("routeLog").textContent=message}
function render(){
 const n=stage(),done=completed();
 $("oge").className="btn "+(exam==="oge"?"selected":"secondary");
 $("ege").className="btn "+(exam==="ege"?"selected":"secondary");
 $("examPill").textContent=exam==="oge"?"ОГЭ":"ЕГЭ профиль";
 $("stagePill").textContent=done?"Ёлка доставлена!":"Развилка "+(n+1)+" из 4";
 $("progressBar").style.width=(n*25)+"%";
 $("routeCount").textContent=n+" / 4";
 $("mathCount").textContent=exam==="oge"?"3 математических задания":"4 математических задания";
 $("timer").textContent=exam==="oge"?"15–17 минут":"14–15 минут";
 $("finished").classList.toggle("hidden",!done);
 $("mapArea").classList.toggle("hidden",done);
 $("choiceInfo").classList.toggle("hidden",done);
 $("startMath").classList.toggle("hidden",done||previewDemo||taskUnlocked());
 $("startMath").disabled=!tasks();
 $("startMath").textContent=tasks()?"📜 Открыть математическое задание":"🔒 Задания ожидают публикации";
 $("previewTools").classList.toggle("hidden",!preview);
 $("demoButton").textContent=previewDemo?"Выключить проверку маршрутов":"Проверить маршруты без заданий";
 $("teacherDemo").classList.toggle("hidden",!previewDemo);
 $("lastStep").textContent=done?"Праздничная ёлка на площади":junctions[n].name;
 $("hintText").textContent=done?"«Мы успели! Главная ёлка снова в центре Хронбурга!»":junctions[n].hint;
 $("tikText").textContent=done?"Тик: «Ура! Теперь в Хронбурге есть главная ёлка. Компас зимнего пути заслуженно твой!»":n===0?"Тик: «Везём ёлку с лесной станции. Обращай внимание на ширину дорог!»":n===1?"Тик: «Нам нужно пересечь реку. Сани тяжёлые — выбирай осторожно!»":n===2?"Тик: «Знакомые фонари помогают нам найти путь к городской площади».":"Тик: «Осталась последняя развилка. Ёлка очень высокая!»";
 $("mathStatus").textContent=previewDemo?"Демонстрация маршрута: математика отключена":done?"Все этапы маршрута пройдены":!tasks()?"Математические задания пока недоступны":taskUnlocked()?"Математика решена. Выбери дорогу.":"Сначала реши математическое задание";
 $("wrongCount").textContent=String(previewDemo?wrongCount:progress.wrongTurns);
 $("rewardTip").textContent=previewDemo?"Тестовый маршрут завершён — награда не сохраняется.":"Награда добавлена на общую ёлку и в коллекцию Хронбурга.";
 drawLines();setButtons();moveSprite(currentPosition(),false);
 window.ChronburgCollectionView.refresh(exam);
 if(!done)note(canChoose()?"Выбери дорогу прямо на карте. Неверный поворот не отнимет решённое задание.":previewDemo?"Испытай развилки.":"Сначала открой задание кнопкой ниже.");
}
function interpolate(points,p){
 const distances=[];let total=0;
 for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];const d=Math.hypot(b[0]-a[0],b[1]-a[1]);distances.push(d);total+=d}
 let left=p*total;
 for(let i=0;i<distances.length;i++){
  if(left<=distances[i]||i===distances.length-1){const f=Math.max(0,Math.min(1,left/(distances[i]||1)));return [points[i][0]+(points[i+1][0]-points[i][0])*f,points[i][1]+(points[i+1][1]-points[i][1])*f]}
  left-=distances[i];
 }
 return points.at(-1);
}
function animate(points,duration){
 const token=++travelToken;travel=true;setButtons();$("sleigh").classList.add("moving");
 return new Promise(resolve=>{
  if(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches){moveSprite(points.at(-1),true);resolve(token===travelToken);return}
  let began=null;
  function tick(ts){
   if(token!==travelToken){resolve(false);return}
   if(began===null)began=ts;
   const f=Math.min(1,(ts-began)/duration);
   moveSprite(interpolate(points,f),true);
   if(f<1)requestAnimationFrame(tick);else resolve(true);
  }
  requestAnimationFrame(tick);
 });
}
async function choose(which){
 if(travel||stage()>=4||!canChoose())return;
 const n=stage(),j=junctions[n],good=which==="good";
 if(good){
  note("✓ Верное направление! Сани отправляются дальше.");
  let ok=await animate(n===0?[...j.from,...j.good.path.slice(1)]:j.good.path,2400);if(!ok)return;
  travel=false;$("sleigh").classList.remove("moving");
  if(previewDemo)previewStage=Math.min(4,previewStage+1);
  else{progress.stage=Math.min(4,progress.stage+1);if(progress.stage===4)progress.complete=true;save()}
  render();
 }else{
  note("⛔ "+j.returnMessage+" Сани возвращаются на развилку.");
  if(previewDemo)wrongCount++;
  else{progress.wrongTurns++;save()}
  const wrongPath=n===0?[...j.from,...j.bad.path.slice(1)]:j.bad.path;
  const out=await animate(wrongPath,1450);if(!out)return;
  const back=await animate([...wrongPath].reverse(),1250);if(!back)return;
  travel=false;$("sleigh").classList.remove("moving");render();note("↩ "+j.returnMessage+" Выбери другое направление.");
 }
}
const formatNumber=raw=>{
 const s=String(raw??"").trim().replace(/[\s\u00a0]/g,"").replace(",",".").replace("−","-");
 if(!/^-?(?:\d+(?:\.\d+)?|\.\d+)(?:\/-?(?:\d+(?:\.\d+)?|\.\d+))?$/.test(s))return NaN;
 const parts=s.split("/");return parts.length===2?Number(parts[0])/Number(parts[1]):Number(parts[0]);
};
function validateBank(p){
 if(!p||p.kind!=="chronburg-private-day5"||p.day!==5)throw new Error("Это не комплект дня 5");
 for(const [e,n] of [["oge",3],["ege",4]]){
  if(!Array.isArray(p.exams?.[e])||p.exams[e].length!==n)throw new Error(e+": неверное число заданий");
  for(const [i,t] of p.exams[e].entries()){
   if(!t?.text||t.answer===undefined||!t.reserve?.text||t.reserve.answer===undefined)throw new Error(e+" задача "+(i+1)+": отсутствует условие или резерв");
  }
 }
 return p;
}
function problem(){return tasks()?.[activeTask]?.[reserve?"reserve":""]||null}
function resolveTask(){const t=tasks()?.[activeTask];return t?(reserve?t.reserve:t):null}
function taskView(){
 const t=resolveTask();if(!t)return;
 $("taskTitle").textContent=(reserve?"Резервный аналог":"Математический замок")+" · "+(activeTask+1)+" из "+length();
 $("taskText").replaceChildren();
 window.ChronburgMath.render($("taskText"),t.text||"",choice=>{$("answer").value=String(choice)});
 $("taskFigure").replaceChildren();
 if(t.image&&/^assets\/pic\/[a-z0-9_./-]+$/i.test(t.image)){
  const img=document.createElement("img");img.src=t.image;img.alt="Рисунок к задаче";$("taskFigure").append(img);
 }
 if(t.table?.columns&&Array.isArray(t.table.rows)){
  const table=document.createElement("table");table.id="taskTable";
  const head=document.createElement("tr");for(const v of t.table.columns){const th=document.createElement("th");th.textContent=String(v);head.append(th)}table.append(head);
  for(const row of t.table.rows){const tr=document.createElement("tr");for(const v of row){const td=document.createElement("td");td.textContent=String(v);tr.append(td)}table.append(tr)}
  $("taskFigure").append(table);
 }
 $("answer").value="";$("reserve").classList.add("hidden");$("taskReply").textContent="Реши задачу, чтобы получить право выбрать дорогу.";
}
function openTask(){
 const n=stage();if(!tasks()||n>=length()||n>=4||progress.solved.includes(n))return;
 activeTask=n;reserve=false;taskView();latestFocus=document.activeElement;
 $("dialog").classList.remove("hidden");document.body.style.overflow="hidden";$("closeTask").focus();
}
function closeTask(){$("dialog").classList.add("hidden");document.body.style.overflow="";if(latestFocus?.isConnected)latestFocus.focus();latestFocus=null}
function check(){
 const t=resolveTask();if(!t)return;
 const got=formatNumber($("answer").value),want=formatNumber(t.answer);
 if(!Number.isFinite(got)){$("taskReply").textContent="Введи числовой ответ (можно использовать / для дробей).";return}
 if(!Number.isFinite(want)){$("taskReply").textContent="Не удалось проверить ключ задания. Сообщи преподавателю.";return}
 if(Math.abs(got-want)<=1e-8){
  progress.solved.push(activeTask);progress.solved=[...new Set(progress.solved)].sort((a,b)=>a-b);save();closeTask();render();
  note("✓ Математическое задание решено. Теперь выбери подходящую дорогу.");
 }else{
  progress.errors.push({task:activeTask+1,reserve,at:new Date().toISOString()});save();
  $("taskReply").textContent="Пока неверно. Проверь вычисления. Если нужно, используй резервный аналог.";
  if(!reserve&&tasks()[activeTask].reserve)$("reserve").classList.remove("hidden");
 }
}
function changeExam(e){
 travelToken++;travel=false;closeTask();exam=e;progress=load();previewStage=0;wrongCount=0;
 history.replaceState({},"","day05.html?exam="+exam+(preview?"&preview=1":""));
 const back="index.html?exam="+exam+(preview?"&preview=1":"");
 $("mapLink").href=back;$("finalMapLink").href=back;
 previewDemo=false;render();
}
function moveInitial(){moveSprite(currentPosition());render()}
const path=document.createElement("img");path.src="assets/locations/day05_route_map.png";
$("routeMap").src=path.src;
$("routeMap").onerror=()=>{note("Не удалось загрузить карту — проверь файл day05_route_map.png.")};
$("sleighImage").onerror=()=>{note("Не удалось загрузить сани — проверь файл day05_sleigh_tree.png.")};
$("oge").onclick=()=>changeExam("oge");$("ege").onclick=()=>changeExam("ege");
$("startMath").onclick=openTask;$("check").onclick=check;$("closeTask").onclick=closeTask;
$("answer").addEventListener("keydown",e=>{if(e.key==="Enter")check()});
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeTask()});
$("reserve").onclick=()=>{reserve=true;taskView()};
$("hint").onclick=()=>{$("taskReply").textContent="Подсказка: приведи выражение к удобному виду, аккуратно выполни вычисления и проверь знак результата."};
$("importTasks").onchange=async e=>{
 const file=e.target.files?.[0];if(!file)return;
 try{bank=validateBank(JSON.parse(await file.text()));$("importStatus").textContent="✓ Комплект загружен локально: ОГЭ 3 и ЕГЭ 4 задания с резервами.";render()}
 catch(err){$("importStatus").textContent="Ошибка: "+err.message}
 e.target.value="";
};
$("demoButton").onclick=()=>{
 if(!preview)return;travelToken++;travel=false;previewDemo=!previewDemo;previewStage=0;wrongCount=0;render();
};
$("resetProgress").onclick=()=>{
 if(!preview||!confirm("Сбросить математический и маршрутный прогресс пятого дня для "+exam.toUpperCase()+"?"))return;
 travelToken++;travel=false;progress=initial();save();previewDemo=false;render();
};
$("exportProgress").onclick=()=>{
 const json=JSON.stringify({day:5,exam,progress},null,2),url=URL.createObjectURL(new Blob([json],{type:"application/json"}));
 const a=document.createElement("a");a.href=url;a.download="chronburg-day05-"+exam+"-progress.json";a.click();
 setTimeout(()=>URL.revokeObjectURL(url),1200);
};
const keys=$("keys");
for(const v of ["1","2","3","4","5","6","7","8","9","0","/","−",",","⌫"]){
 const btn=document.createElement("button");btn.type="button";btn.textContent=v;
 btn.onclick=()=>{$("answer").value=v==="⌫"?$("answer").value.slice(0,-1):$("answer").value+(v==="−"?"-":v);$("answer").focus()};
 keys.append(btn);
}
const canvas=$("scratch"),ctx=canvas.getContext("2d");let drawing=false;
function pt(e){const r=canvas.getBoundingClientRect();return [(e.clientX-r.left)*canvas.width/r.width,(e.clientY-r.top)*canvas.height/r.height]}
canvas.addEventListener("pointerdown",e=>{drawing=true;canvas.setPointerCapture(e.pointerId);const [x,y]=pt(e);ctx.beginPath();ctx.moveTo(x,y)});
canvas.addEventListener("pointermove",e=>{if(!drawing)return;const [x,y]=pt(e);ctx.lineTo(x,y);ctx.strokeStyle="#2e455d";ctx.lineWidth=3;ctx.stroke()});
canvas.addEventListener("pointerup",()=>drawing=false);canvas.addEventListener("pointercancel",()=>drawing=false);
$("scratchToggle").onclick=()=>$("scratchWrap").classList.toggle("hidden");
$("clearScratch").onclick=()=>ctx.clearRect(0,0,canvas.width,canvas.height);
window.ChronburgCollectionView=window.ChronburgCollection.mount($("chronburgCollection"),exam);
$("previewTools").classList.toggle("hidden",!preview);
progress=load();moveInitial();
window.ChronburgRelease.attach({
 day:5,
 onReady:x=>{try{bank=validateBank(x);render()}catch(err){$("status").textContent="Ошибка опубликованного комплекта: "+err.message}},
 onStatus:(message,kind)=>{$("status").textContent=message;$("status").dataset.status=kind}
});
window.addEventListener("pageshow",()=>{if(!previewDemo){progress=load();render()}});
})();
