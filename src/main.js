import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/hanken-grotesk";
import "@fontsource/dm-mono/400.css";
import "@fontsource/dm-mono/500.css";
import "./style.css";
import { Preferences } from "@capacitor/preferences";
import { art } from "./art.js";
import { MESI, MES3, MES3L, LET, V, BY, CATS } from "./data.js";
import { guida, TYPES, TLAB } from "./guida.js";

var NOW=new Date(), NOW_M=NOW.getMonth()+1;
function $(s,r){return (r||document).querySelector(s)}
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}

/* ---------- icons ---------- */
var IC={
  x:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  pin:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/></svg>'
};

/* ---------- state ---------- */
var state={month:NOW_M,seg:"stagione",cat:"Tutte",q:"",open:null};
var DAY=864e5, garden=[], lastFocus=null, toastT=null;
var STORE_KEY="ortomio-orto";
function parseGarden(raw){try{var a=JSON.parse(raw);if(Array.isArray(a))return a.filter(function(g){return g&&BY[g.id]})}catch(e){}return null}
async function loadGarden(){
  var raw=null;
  try{raw=(await Preferences.get({key:STORE_KEY})).value}catch(e){}
  if(!raw){try{raw=localStorage.getItem(STORE_KEY)}catch(e){}}
  var a=raw?parseGarden(raw):null;
  garden=a||[{id:"aglio",d:Date.now()-14*DAY,ex:true},{id:"fave",d:Date.now()-9*DAY,ex:true},{id:"spinaci",d:Date.now()-21*DAY,ex:true}];
}
function saveGarden(){
  var s=JSON.stringify(garden);
  try{Preferences.set({key:STORE_KEY,value:s}).catch(function(){})}catch(e){}
  try{localStorage.setItem(STORE_KEY,s)}catch(e){}
}

/* ---------- helpers ---------- */
function rangeText(arr){
  var on=[];for(var i=1;i<=12;i++)on[i]=arr.indexOf(i)>-1;
  if(!arr.length)return "—";
  var f=-1;for(var j=1;j<=12;j++){if(!on[j]){f=j;break}}
  if(f===-1)return "tutto l'anno";
  var runs=[],cur=null;
  for(var k=1;k<=12;k++){var m=((f-1+k)%12)+1;
    if(on[m]){if(!cur){cur={a:m,b:m};runs.push(cur)}else cur.b=m}else cur=null}
  return runs.map(function(r){return r.a===r.b?MES3L[r.a-1]:MES3L[r.a-1]+"–"+MES3L[r.b-1]}).join(", ");
}
function seasonBar(v,mo){var s='<span class="sb" aria-hidden="true">';for(var i=1;i<=12;i++){s+='<i class="'+(v.m.indexOf(i)>-1?"on":"")+(i===mo?" cur":"")+'"></i>'}return s+"</span>"}
function fmtNum(n){return String(n).replace(".",",")}
function toast(msg){var t=$("#toast");t.textContent=msg;t.hidden=false;clearTimeout(toastT);toastT=setTimeout(function(){t.hidden=true},2300)}

/* ---------- STAGIONE ---------- */
function filtered(){
  var m=state.month,q=state.q.trim().toLowerCase();
  return V.filter(function(v){
    if(state.seg==="stagione"&&v.m.indexOf(m)<0)return false;
    if(state.seg==="semina"&&v.s.indexOf(m)<0)return false;
    if(state.cat!=="Tutte"&&v.cat!==state.cat)return false;
    if(q&&v.n.toLowerCase().indexOf(q)<0)return false;
    return true;
  }).sort(function(a,b){return a.n.localeCompare(b.n,"it")});
}
function card(v,i){
  var m=state.month,tag=v.m.indexOf(m)>-1?"In raccolta":(v.s.indexOf(m)>-1?"Da seminare":"");
  var rot=[-5,4,-3,6,-6,3][i%6];
  return '<button class="card" data-act="open" data-id="'+v.id+'" style="--c:'+v.bg+';--rot:'+rot+'deg">'+
    (tag?'<span class="tag">'+tag+'</span>':'')+
    '<span class="aw">'+art(v)+'</span>'+
    '<span class="nm">'+v.n+'</span>'+
    '<span class="mt">raccolta '+rangeText(v.m)+'</span>'+
    seasonBar(v,m)+'</button>';
}
function renderGrid(){
  var L=filtered();
  var label=state.seg==="stagione"?"di stagione":(state.seg==="semina"?"da seminare":"in elenco");
  $("#count").textContent=L.length+" "+(L.length===1?"verdura":"verdure")+" "+label+" · "+MESI[state.month-1].toLowerCase();
  $("#grid").innerHTML=L.length?L.map(card).join(""):
    '<div class="empty"><b>Niente con questi filtri</b>Prova un altro mese o togli la ricerca.<br><br><button class="btn" data-act="reset">Azzera filtri</button></div>';
}
function renderStagione(){
  var m=state.month;
  $("#monthName").textContent=MESI[m-1];
  var h=V.filter(function(v){return v.m.indexOf(m)>-1}), s=V.filter(function(v){return v.s.indexOf(m)>-1});
  $("#heroSub").textContent=h.length+" verdure da raccogliere · "+s.length+" da seminare";
  $("#collage").innerHTML=h.slice(0,3).map(function(v,i){return '<span class="cl cl'+i+'">'+art(v)+'</span>'}).join("");
  var strip=$("#months");
  strip.innerHTML=MES3.map(function(t,i){return '<button class="mbtn'+(i+1===NOW_M?" now":"")+'" role="tab" aria-selected="'+(i+1===m)+'" data-act="month" data-m="'+(i+1)+'">'+t+'</button>'}).join("");
  var sel=$('.mbtn[aria-selected="true"]',strip);
  if(sel)strip.scrollLeft=sel.offsetLeft-strip.clientWidth/2+sel.offsetWidth/2;
  $("#seg").innerHTML=[["stagione","Di stagione"],["semina","Da seminare"],["tutte","Tutte"]].map(function(x){return '<button data-act="seg" data-k="'+x[0]+'" aria-pressed="'+(state.seg===x[0])+'">'+x[1]+'</button>'}).join("");
  $("#cats").innerHTML=CATS.map(function(c){return '<button class="chip" data-act="cat" data-k="'+c+'" aria-pressed="'+(state.cat===c)+'">'+c+'</button>'}).join("");
  renderGrid();
}

/* ---------- ORTO ---------- */
var LANES=[
 {k:"s",t:"Semina",c:"var(--c-sow)",h:"Seme in terra o in semenzaio"},
 {k:"t",t:"Trapianto",c:"var(--c-plant)",h:"Piantine da mettere nell'orto"},
 {k:"m",t:"Raccolta",c:"var(--c-harvest)",h:"Pronte da cogliere"}
];
function plotRow(g){
  var v=BY[g.id],el=Math.max(0,Math.floor((Date.now()-g.d)/DAY)),avg=(v.d[0]+v.d[1])/2,pct=Math.min(100,Math.round(el/avg*100)),ready=el>=avg;
  return '<li class="plot" style="--c:'+v.bg+'"><button class="plot-art" data-act="open" data-id="'+v.id+'" aria-label="Apri la scheda di '+v.n+'">'+art(v)+'</button>'+
   '<div class="plot-b"><div class="plot-t"><b>'+v.n+'</b>'+(g.ex?'<span class="ex">esempio</span>':'')+'</div>'+
   '<div class="plot-s">'+(el===0?"Messa a dimora oggi":"In orto da "+el+(el===1?" giorno":" giorni"))+" · "+(ready?"pronta da raccogliere":"pronta tra ~"+Math.round(avg-el)+" gg")+'</div>'+
   '<div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+pct+'" aria-label="Avanzamento verso il raccolto"><i style="width:'+pct+'%"></i></div></div>'+
   '<button class="x" data-act="rm" data-id="'+v.id+'" aria-label="Togli '+v.n+' dal mio orto">'+IC.x+'</button></li>';
}
function renderOrto(){
  var m=state.month;
  $("#ortoTitle").textContent="Da fare a "+MESI[m-1].toLowerCase();
  $("#lanes").innerHTML=LANES.map(function(l){
    var L=V.filter(function(v){return v[l.k].indexOf(m)>-1}).sort(function(a,b){return a.n.localeCompare(b.n,"it")});
    return '<section class="lane" style="--lc:'+l.c+'"><span class="big" aria-hidden="true">'+L.length+'</span><h3>'+l.t+'</h3><span class="hint">'+l.h+'</span>'+
      (L.length?'<div class="minis">'+L.map(function(v){return '<button class="mini" data-act="open" data-id="'+v.id+'" style="--c:'+v.bg+'"><span class="mi">'+art(v)+'</span>'+v.n+'</button>'}).join("")+'</div>':'<span class="none">Niente in programma questo mese.</span>')+'</section>';
  }).join("");
  $("#plotCount").textContent=garden.length+(garden.length===1?" verdura":" verdure");
  $("#plots").innerHTML=garden.length?garden.map(plotRow).join(""):
    '<li class="empty" style="grid-column:auto"><b>Il tuo orto è vuoto</b>Apri una verdura dalla sezione Stagione e tocca «Aggiungi al mio orto».</li>';
}

/* ---------- GUIDA ---------- */
function fmtKm(km){return km<1?Math.round(km*1000)+" m":km.toFixed(1).replace(".",",")+" km"}
function safeUrl(u){u=String(u||"").trim();if(!u)return null;if(/^[a-z][a-z0-9+.-]*:/i.test(u)&&!/^https?:/i.test(u))return null;if(!/^https?:\/\//i.test(u))u="https://"+u;return /^https?:\/\/[^\s"'<>]+$/i.test(u)?u:null}
function safePhone(p){p=String(p||"").split(";")[0].trim();return /^[+\d][\d\s().\/-]{4,}$/.test(p)?p.replace(/[^\d+]/g,""):null}
function placeCard(p,s){
  var web=safeUrl(p.website),tel=safePhone(p.phone);
  var dir="https://www.google.com/maps/dir/?api=1&destination="+p.lat+","+p.lng;
  var links='<a class="lnk" href="'+dir+'" target="_blank" rel="noopener">Indicazioni</a>'+
    (web?'<a class="lnk" href="'+esc(web)+'" target="_blank" rel="noopener">Sito</a>':"")+
    (tel?'<a class="lnk" href="tel:'+tel+'">Chiama</a>':"");
  var where=[p.city,p.sigla?"("+p.sigla+")":""].filter(Boolean).join(" ");
  return '<li class="prod" style="--tc:var(--t-'+p.type+')"><div class="prod-main">'+
    '<span class="prod-h"><span><span class="h4">'+esc(s.displayName(p))+'</span><span class="tpill">'+TLAB[p.type]+'</span></span>'+
    (p.km!=null?'<span class="dist"><b>'+fmtKm(p.km)+'</b>da te</span>':"")+'</span>'+
    (where?'<span class="hrs"><b>'+esc(where)+'</b></span>':"")+
    (p.addr&&p.addr!==p.city?'<span class="hrs">'+esc(p.addr)+'</span>':"")+
    '<span class="hrs">'+(p.hours?esc(p.hours):"Orari non indicati")+'</span></div>'+
    '<div class="prod-links">'+links+'</div></li>';
}
function opts(list,cur,all,keyOf,labOf){
  return '<option value="">'+all+'</option>'+list.map(function(o){var k=keyOf(o);return '<option value="'+esc(k)+'"'+(k===cur?" selected":"")+'>'+esc(labOf(o))+'</option>'}).join("");
}
function renderGuida(){
  var s=guida.getState(),f=s.f;
  var st;
  if(s.loadError)st="Non riesco a caricare l’elenco dei luoghi. Riavvia l’app e riprova.";
  else if(!s.loaded)st="Carico l’elenco dei luoghi…";
  else if(!s.total)st="L’elenco dei luoghi non è ancora stato creato. Riprova dopo il prossimo aggiornamento.";
  else st="<b>"+s.total.toLocaleString("it-IT")+" luoghi</b> in tutta Italia: aziende agricole, mercati e fruttivendoli."+(s.date?" Dati OpenStreetMap del "+s.date+".":"");
  if(s.nearMsg)st=s.nearMsg;
  $("#gStatus").innerHTML=st;
  $("#fReg").innerHTML=opts(s.regOpts,f.reg,"Tutta Italia",function(o){return o},function(o){return o});
  $("#fProv").innerHTML=opts(s.provOpts,f.prov,"Tutte le province",function(o){return o},function(o){return o});
  $("#fCom").innerHTML=opts(s.comOpts,f.com,"Tutte le città",function(o){return o.key},function(o){return o.name+" · "+o.n});
  $("#fProv").disabled=!s.provOpts.length;$("#fCom").disabled=!s.comOpts.length;
  if($("#gq").value!==f.q)$("#gq").value=f.q;
  var tot=s.counts.farm+s.counts.contadino+s.counts.frutt;
  $("#gchips").innerHTML=TYPES.map(function(t){
    var n=t.k==="all"?tot:(s.counts[t.k]||0);
    return '<button class="chip" data-act="ptype" data-k="'+t.k+'" aria-pressed="'+(f.type===t.k)+'">'+(t.k!=="all"?'<span class="dot" style="background:var(--t-'+t.k+')"></span>':"")+t.l+' · '+n+'</button>';
  }).join("");
  var html;
  if(!s.loaded)html="";
  else if(!s.active)html='<li class="empty" style="grid-column:auto"><b>Scegli dove cercare</b>Seleziona una regione, una provincia o una città, scrivi un nome oppure tocca «Vicino a me».</li>';
  else if(!s.list.length)html='<li class="empty" style="grid-column:auto"><b>Nessun risultato</b>In questa zona non risultano luoghi di questo tipo. Prova un altro filtro o cerca in una città vicina: l’elenco si basa su quanto è mappato in OpenStreetMap.</li>';
  else html='<li class="count" style="margin:2px 2px 0;list-style:none">'+s.found.toLocaleString("it-IT")+(s.found===1?" luogo":" luoghi")+(s.near?" · dal più vicino":"")+'</li>'+s.list.map(function(p){return placeCard(p,s)}).join("");
  $("#prods").innerHTML=html;
  var more=$("#gmore");more.hidden=!s.more;if(s.more)more.textContent="Mostra altri ("+s.more.toLocaleString("it-IT")+")";
}

/* ---------- DETAIL SHEET ---------- */
function meter(n,color){var s='<span class="meter" style="--mc:'+color+'" aria-hidden="true">';for(var i=1;i<=3;i++)s+='<i class="'+(i<=n?"on":"")+'"></i>';return s+"</span>"}
function sheetHTML(v){
  var inG=garden.some(function(g){return g.id===v.id}), m=state.month;
  function row(lab,arr,k){return '<div class="cal-r"><span class="lab">'+lab+'</span>'+MES3.map(function(_,i){return '<i class="'+k+(arr.indexOf(i+1)>-1?" on":"")+(i+1===m?" cur":"")+'"></i>'}).join("")+'</div>'}
  var aria="Calendario: semina "+rangeText(v.s)+"; "+(v.t.length?"trapianto "+rangeText(v.t)+"; ":"")+"raccolta "+rangeText(v.m);
  var cal='<div class="cal" role="img" aria-label="'+aria+'"><div class="cal-r cal-h"><span class="lab"></span>'+LET.map(function(l,i){return '<b class="'+(i+1===m?"cur":"")+'">'+l+'</b>'}).join("")+'</div>'+row("Semina",v.s,"k-s")+(v.t.length?row("Trapianto",v.t,"k-t"):"")+row("Raccolta",v.m,"k-m")+'</div>'+(v.t.length?"":'<p class="note" style="margin:10px 0 0">Si semina direttamente in campo, senza trapianto.</p>');
  var pairs="";
  if(v.am.length||v.no.length){
    pairs='<div class="pairs">'+(v.am.length?'<div><p class="lbl">Buoni vicini</p><div class="row">'+v.am.map(function(x){return '<span class="pill ok">'+x+'</span>'}).join("")+'</div></div>':"")+(v.no.length?'<div><p class="lbl">Meglio lontano da</p><div class="row">'+v.no.map(function(x){return '<span class="pill no">'+x+'</span>'}).join("")+'</div></div>':"")+'</div>';
  }else pairs='<p class="note" style="margin:0">Nessuna indicazione particolare sui vicini.</p>';
  var stats=
   '<div class="stat"><div class="k">Sole</div><div class="v">'+["Mezz’ombra","Sole","Pieno sole"][v.sun-1]+'</div>'+meter(v.sun,"var(--sun)")+'</div>'+
   '<div class="stat"><div class="k">Acqua</div><div class="v">'+["Poca","Regolare","Abbondante"][v.water-1]+'</div>'+meter(v.water,"var(--water)")+'</div>'+
   '<div class="stat"><div class="k">Al raccolto</div><div class="v">'+v.d[0]+"–"+v.d[1]+' giorni</div><div class="s">'+v.da+'</div></div>'+
   '<div class="stat"><div class="k">Difficoltà</div><div class="v">'+["Facile","Media","Esigente"][v.dif-1]+'</div>'+meter(v.dif,"var(--accent)")+'</div>'+
   '<div class="stat"><div class="k">Distanza tra piante</div><div class="v">'+fmtNum(v.sp)+' cm</div></div>'+
   '<div class="stat"><div class="k">Profondità</div><div class="v">'+fmtNum(v.dp)+' cm</div></div>';
  return '<div class="scrim" data-act="scrim"><div class="sheet" role="dialog" aria-modal="true" aria-label="'+v.n+'">'+
   '<div class="sh-head" style="--c:'+v.bg+'"><button class="sh-close" data-act="close" aria-label="Chiudi">'+IC.x+'</button><h2>'+v.n+'</h2>'+
   '<div class="sh-pills"><span class="pill">'+v.cat+'</span><span class="pill">'+v.kcal+' kcal / 100 g</span></div>'+
   '<div class="sh-art">'+art(v)+'</div></div>'+
   '<div class="sh-body">'+
    '<div><p class="lbl">Calendario</p>'+cal+'</div>'+
    '<div><p class="lbl">Come si coltiva</p><div class="stats">'+stats+'</div></div>'+
    '<div><p class="lbl">Vicini di orto</p>'+pairs+'</div>'+
    '<div class="tip"><p class="lbl">Il consiglio</p><p>'+v.tip+'</p></div>'+
   '</div>'+
   '<div class="sh-cta"><button class="btn pri" id="gBtn" data-act="toggle" data-id="'+v.id+'" aria-pressed="'+inG+'">'+(inG?IC.check+"Nel mio orto":IC.plus+"Aggiungi all’orto")+'</button><button class="btn" data-act="find" data-id="'+v.id+'">'+IC.pin+'Dove comprarla</button></div>'+
  '</div></div>';
}
function openSheet(id){
  var v=BY[id];if(!v)return;
  lastFocus=document.activeElement;state.open=id;
  $("#sheetRoot").innerHTML=sheetHTML(v);
  document.body.style.overflow="hidden";
  var c=$(".sh-close");if(c)c.focus();
}
function closeSheet(){
  if(!state.open)return;
  state.open=null;$("#sheetRoot").innerHTML="";document.body.style.overflow="";
  if(lastFocus&&document.contains(lastFocus)&&lastFocus.focus)lastFocus.focus();
}

/* ---------- routing ---------- */
var VIEWS=["stagione","orto","guida"];
function currentView(){var h=location.hash.slice(1);if(h==="mappa")h="guida";return VIEWS.indexOf(h)<0?"stagione":h}
function route(){
  var h=currentView();
  VIEWS.forEach(function(k){$("#v-"+k).hidden=k!==h});
  document.querySelectorAll(".tab").forEach(function(a){if(a.dataset.tab===h)a.setAttribute("aria-current","page");else a.removeAttribute("aria-current")});
  if(h==="stagione")renderStagione();
  if(h==="orto")renderOrto();
  if(h==="guida"){guida.mount(renderGuida);renderGuida()}
  window.scrollTo(0,0);
}

/* ---------- events ---------- */
document.addEventListener("click",function(e){
  var t=e.target.closest("[data-act]");if(!t)return;
  var a=t.dataset.act,id=t.dataset.id;
  if(a==="scrim"){if(e.target===t)closeSheet();return}
  if(a==="open"){openSheet(id)}
  else if(a==="close"){closeSheet()}
  else if(a==="month"){state.month=+t.dataset.m;renderStagione()}
  else if(a==="mprev"||a==="mnext"){state.month=((state.month-1+(a==="mnext"?1:-1)+12)%12)+1;renderOrto()}
  else if(a==="seg"){state.seg=t.dataset.k;renderStagione()}
  else if(a==="cat"){state.cat=t.dataset.k;renderStagione()}
  else if(a==="reset"){state.seg="tutte";state.cat="Tutte";state.q="";$("#q").value="";renderStagione()}
  else if(a==="rm"){garden=garden.filter(function(g){return g.id!==id});saveGarden();renderOrto();toast(BY[id].n+" tolta dal tuo orto")}
  else if(a==="toggle"){
    var has=garden.some(function(g){return g.id===id});
    if(has){garden=garden.filter(function(g){return g.id!==id});toast(BY[id].n+" tolta dal tuo orto")}
    else{garden.push({id:id,d:Date.now(),ex:false});toast(BY[id].n+" aggiunta al tuo orto")}
    saveGarden();
    t.setAttribute("aria-pressed",String(!has));
    t.innerHTML=!has?IC.check+"Nel mio orto":IC.plus+"Aggiungi all’orto";
  }
  else if(a==="find"){closeSheet();if(location.hash==="#guida")window.scrollTo(0,0);else location.hash="#guida"}
  else if(a==="ptype"){guida.setType(t.dataset.k)}
  else if(a==="gnear"){guida.mount(renderGuida);guida.nearMe()}
  else if(a==="greset"){guida.reset()}
  else if(a==="gmore"){guida.more()}
});
document.addEventListener("keydown",function(e){
  if(e.key==="Escape"&&state.open){closeSheet()}
});
$("#q").addEventListener("input",function(e){state.q=e.target.value;renderGrid()});
window.addEventListener("hashchange",route);

loadGarden().then(route);

document.addEventListener("change",function(e){
  var id=e.target.id;
  if(id==="fReg")guida.setReg(e.target.value);
  else if(id==="fProv")guida.setProv(e.target.value);
  else if(id==="fCom")guida.setCom(e.target.value);
});
document.addEventListener("input",function(e){if(e.target.id==="gq")guida.setQuery(e.target.value)});
