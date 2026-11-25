"use strict";
window.ChronburgMath=(function(){
 function clean(text){return String(text??"").split(/\r?\n/).filter(line=>!/^\s*\[МЕСТО ДЛЯ РИСУНКА/i.test(line)).join("\n").trim()}
 function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n}
 function katexNode(latex,display){
  const node=el(display?"div":"span",display?"math-display":"math-inline");
  if(window.katex)try{window.katex.render(latex,node,{throwOnError:false,displayMode:display,strict:"ignore"});return node}catch(e){}
  node.textContent=latex;return node
 }
 const expression=/(\$\$[\s\S]*?\$\$|\$[^$\n]+\$|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]|\d+\/\d+|√\s*(?:\([^)]*\)|\d+)|[A-Za-zА-Яа-я]\s*[²³⁴⁵⁶⁷⁸⁹])/g;
 function inline(target,text){
  let previous=0,m;expression.lastIndex=0;
  while((m=expression.exec(text))!==null){
    if(m.index>previous)target.append(document.createTextNode(text.slice(previous,m.index)));
    const token=m[0];
    if(token.startsWith("$$")&&token.endsWith("$$"))target.append(katexNode(token.slice(2,-2),true));
    else if(token.startsWith("\\[")&&token.endsWith("\\]"))target.append(katexNode(token.slice(2,-2),true));
    else if(token.startsWith("$")&&token.endsWith("$"))target.append(katexNode(token.slice(1,-1),false));
    else if(token.startsWith("\\(")&&token.endsWith("\\)"))target.append(katexNode(token.slice(2,-2),false));
    else if(/^\d+\/\d+$/.test(token)){const [a,b]=token.split("/");target.append(katexNode("\\frac{"+a+"}{"+b+"}",false))}
    else if(token.startsWith("√")){const contents=token.slice(1).trim().replace(/^\(|\)$/g,"");target.append(katexNode("\\sqrt{"+contents+"}",false))}
    else {const pow=token.match(/^([A-Za-zА-Яа-я])\s*([²³⁴⁵⁶⁷⁸⁹])$/);const supers="²³⁴⁵⁶⁷⁸⁹";target.append(pow?katexNode(pow[1]+"^{"+(supers.indexOf(pow[2])+2)+"}",false):document.createTextNode(token))}
    previous=m.index+token.length;
  }
  if(previous<text.length)target.append(document.createTextNode(text.slice(previous)));
 }
 function options(text){
  const matches=[...text.matchAll(/(?:^|;\s*|\s{2,})([1-4])\)\s*([^;\n]+?)(?=(?:;\s*|\s{2,})[1-4]\)|;?\s*$)/g)];
  if(matches.length!==4||matches.map(m=>Number(m[1])).join("")!=="1234")return null;
  return matches.map(m=>m[2].trim().replace(/;$/,""))
 }
 function render(target,raw){
  target.replaceChildren();const text=clean(raw);if(!text)return;
  const rows=text.split(/\n+/);
  for(const row of rows){
   const line=row.trim();if(!line)continue;
   const opts=options(line);
   if(opts){
    const grid=el("div","math-options");grid.setAttribute("aria-label","Варианты ответа");
    opts.forEach((value,i)=>{const item=el("div","math-option"),number=el("span","math-option-number",String(i+1)),body=el("span","math-option-value");inline(body,value);item.append(number,body);grid.append(item)});
    target.append(grid);continue;
   }
   const p=el("div","math-question-line");inline(p,line);target.append(p);
  }
 }
 return {render,clean,inline};
})();
