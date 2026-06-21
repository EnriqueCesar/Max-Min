const COL={dm:0,anio:1,sem:2,ceco:3,tienda:4,cat:5,art:6,uso:7,unidad:8,pickpack:9,factor:10};
const factorPedidos={2:5,3:4,4:3,5:2};
const state={tab:'maxmin',max:[],consulta:[],acomodo:[],markerPosMax:{},markerPosAcomodo:{}};
const $=id=>document.getElementById(id);

const cfg={
  maxmin:{store:'maxStore',weeks:'maxWeeks',orders:'maxOrders',mode:'maxMode',category:null,datalist:'maxItemsList'},
  consulta:{store:'conStore',weeks:'conWeeks',orders:'conOrders',mode:'conMode',category:'conCategory',datalist:'consultaItemsList'},
  acomodo:{store:'acoStore'}
};

function init(){
  ['maxDate','conDate','acoDate'].forEach(id=>$(id).textContent=new Date().toLocaleDateString('es-MX'));
  const stores=uniq(MAXMIN_ROWS.map(r=>r[COL.tienda]));
  ['maxStore','conStore','acoStore'].forEach(id=>$(id).innerHTML=stores.map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join(''));
  const weeks=uniq(MAXMIN_ROWS.map(r=>Number(r[COL.sem])));
  ['maxWeeks','conWeeks'].forEach(id=>{
    $(id).innerHTML=weeks.map(w=>`<option value="${w}">${w}</option>`).join('');
    [...$(id).options].slice(-4).forEach(o=>o.selected=true);
  });
  bind();
  refreshAllFilters();
  renderAll();
}

function bind(){
  document.querySelectorAll('.tab-btn').forEach(btn=>btn.addEventListener('click',()=>setTab(btn.dataset.tab)));
  ['maxStore','maxWeeks','maxOrders','maxMode'].forEach(id=>$(id).addEventListener('change',()=>{refreshTab('maxmin');recalcTab('maxmin');renderMax();updateSubtitles();}));
  ['conStore','conWeeks','conCategory','conOrders','conMode'].forEach(id=>$(id).addEventListener('change',()=>{refreshTab('consulta');recalcTab('consulta');renderConsulta();updateSubtitles();}));
  ['acoStore','acoTitle'].forEach(id=>$(id).addEventListener('change',updateSubtitles));
  $('btnExport').addEventListener('click',exportPDF);
  $('btnReset').addEventListener('click',resetCurrent);
  $('btnAddMax').addEventListener('click',addMax);
  $('searchItemMax').addEventListener('keydown',e=>{if(e.key==='Enter')addMax()});
  $('btnAddConsulta').addEventListener('click',addConsultaOrFiltered);
  $('searchItemConsulta').addEventListener('keydown',e=>{if(e.key==='Enter')addConsultaOrFiltered()});
  $('btnClearConsulta').addEventListener('click',()=>{state.consulta=[];renderConsulta();});
  $('btnAddAcomodo').addEventListener('click',addAcomodo);
  $('acomodoName').addEventListener('keydown',e=>{if(e.key==='Enter')addAcomodo()});
  bindPhoto('Max'); bindPhoto('Acomodo');
}

function setTab(tab){
  state.tab=tab;
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
  document.querySelectorAll('.tab-panel').forEach(p=>p.classList.toggle('active',p.id==='tab-'+tab));
  refreshTab(tab); updateSubtitles(); requestAnimationFrame(alignAllMarkerLayers);
}

function bindPhoto(s){
  const input=$('photoInput'+s), img=$('rackPhoto'+s), label=$('photoLabel'+s), clear=$('clearPhoto'+s);
  input.addEventListener('change',e=>{
    const f=e.target.files[0]; if(!f)return;
    img.onload=()=>{img.style.display='block'; label.style.display='none'; alignMarkerLayer(s);};
    img.src=URL.createObjectURL(f);
  });
  clear.addEventListener('click',()=>{
    input.value=''; img.removeAttribute('src'); img.style.display='none'; label.style.display='block';
    resetMarkerLayer(s);
  });
}

function imageContentBox(wrap,img){
  const w=wrap.clientWidth, h=wrap.clientHeight;
  if(!w||!h||!img.naturalWidth||!img.naturalHeight||img.style.display==='none') return {left:0,top:0,width:w,height:h};
  const scale=Math.min(w/img.naturalWidth,h/img.naturalHeight);
  const width=img.naturalWidth*scale, height=img.naturalHeight*scale;
  return {left:(w-width)/2, top:(h-height)/2, width, height};
}
function alignMarkerLayer(s){
  const wrap=$('photoWrap'+s), img=$('rackPhoto'+s), layer=$('markerLayer'+s);
  if(!wrap||!img||!layer)return;
  const box=imageContentBox(wrap,img);
  layer.style.left=box.left+'px'; layer.style.top=box.top+'px'; layer.style.width=box.width+'px'; layer.style.height=box.height+'px';
  layer.style.right='auto'; layer.style.bottom='auto';
}
function resetMarkerLayer(s){
  const layer=$('markerLayer'+s); if(!layer)return;
  layer.style.left='0'; layer.style.top='0'; layer.style.width='100%'; layer.style.height='100%'; layer.style.right='0'; layer.style.bottom='0';
}
function alignAllMarkerLayers(){alignMarkerLayer('Max'); alignMarkerLayer('Acomodo');}
window.addEventListener('resize',()=>requestAnimationFrame(alignAllMarkerLayers));
window.addEventListener('beforeprint',()=>{alignAllMarkerLayers(); setTimeout(alignAllMarkerLayers,80);});
if(window.matchMedia){
  const mq=window.matchMedia('print');
  const handler=()=>{requestAnimationFrame(alignAllMarkerLayers); setTimeout(alignAllMarkerLayers,80)};
  if(mq.addEventListener)mq.addEventListener('change',handler); else if(mq.addListener)mq.addListener(handler);
}

function refreshAllFilters(){refreshTab('maxmin'); refreshTab('consulta'); updateSubtitles();}
function refreshTab(tab){
  if(tab==='acomodo')return;
  const c=cfg[tab];
  if(c.category){
    const cur=$(c.category).value;
    const cats=uniq(rowsRaw(tab).filter(r=>selectedWeeks(tab).length===0||selectedWeeks(tab).includes(Number(r[COL.sem]))).map(r=>r[COL.cat]));
    $(c.category).innerHTML='<option value="">Todas</option>'+cats.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
    if(cats.includes(cur))$(c.category).value=cur;
  }
  const list=itemAgg(tab);
  if(c.datalist)$(c.datalist).innerHTML=list.map(x=>`<option value="${esc(x.art)}"></option>`).join('');
}

function rowsRaw(tab){return MAXMIN_ROWS.filter(r=>r[COL.tienda]===$(cfg[tab].store).value)}
function selectedWeeks(tab){return [...$(cfg[tab].weeks).selectedOptions].map(o=>Number(o.value));}
function filteredRows(tab){
  const c=cfg[tab], weeks=selectedWeeks(tab);
  let rows=rowsRaw(tab).filter(r=>weeks.length===0||weeks.includes(Number(r[COL.sem])));
  if(c.category && $(c.category).value) rows=rows.filter(r=>r[COL.cat]===$(c.category).value);
  return rows;
}
function itemAgg(tab){
  const rows=filteredRows(tab), weeks=selectedWeeks(tab), divisor=weeks.length || uniq(rowsRaw(tab).map(r=>Number(r[COL.sem]))).length || 1;
  const map=new Map();
  for(const r of rows){
    const art=r[COL.art]; if(!art)continue;
    if(!map.has(art))map.set(art,{art,cat:r[COL.cat],usoSum:0,uso:0,unidad:r[COL.unidad]||'Unidad',pickpack:r[COL.pickpack]||r[COL.unidad]||'Unidad',factor:Number(r[COL.factor]||1)});
    const it=map.get(art);
    it.usoSum += Number(r[COL.uso]||0);
    if(!it.cat && r[COL.cat])it.cat=r[COL.cat];
    if((!it.unidad || it.unidad==='Unidad') && r[COL.unidad])it.unidad=r[COL.unidad];
    if((!it.pickpack || it.pickpack==='Unidad') && r[COL.pickpack])it.pickpack=r[COL.pickpack];
    if(!it.factor && r[COL.factor])it.factor=Number(r[COL.factor]);
  }
  for(const it of map.values()) it.uso=it.usoSum/divisor;
  return [...map.values()].sort((a,b)=>a.art.localeCompare(b.art,'es'));
}
function findItem(tab,text){
  const val=(text||'').trim(); if(!val)return null;
  const list=itemAgg(tab);
  return list.find(x=>x.art===val)||list.find(x=>x.art.toLowerCase().includes(val.toLowerCase()));
}
function recalcTab(tab){
  const agg=itemAgg(tab);
  if(tab==='maxmin')state.max=state.max.map(sel=>agg.find(x=>x.art===sel.art)||sel);
  if(tab==='consulta')state.consulta=state.consulta.map(sel=>agg.find(x=>x.art===sel.art)||sel);
}

function calc(tab,item){
  const pedidos=Number($(cfg[tab].orders).value), maxFactor=factorPedidos[pedidos]||5, mode=$(cfg[tab].mode).value;
  const ideal=Number(item.uso||0), diario=ideal/7;
  let min=diario, max=diario*maxFactor, pres=item.unidad||'Unidad', valueMode='unidad';
  if(mode==='pickpack'){
    const f=Number(item.factor||1) || 1;
    min=Math.ceil(min/f);
    max=Math.ceil(max/f);
    pres=item.pickpack||item.unidad||'Pick Pack';
    valueMode='pickpack';
  } else {
    // En Unidad se respeta una decimal para no perder precisión operativa.
    min=round1(min);
    max=round1(max);
    pres=item.unidad||'Unidad';
  }
  return {ideal,diario,min,max,pres:cleanPresentation(pres),valueMode};
}
function round1(n){return Math.round((Number(n)||0)*10)/10}
function cleanPresentation(p){
  let x=String(p||'Unidad').replace(/\s+/g,' ').trim();
  // Presentación limpia: quita el código inicial (CJA:, BTL:, PZA:) pero conserva la descripción operativa.
  x=x.replace(/^([A-ZÁÉÍÓÚÑ0-9]+):\s*/i,'');
  x=x.replace(/^Pza\s+/i,'').trim();
  if(!x || /^PZA$/i.test(x)) return 'PZA';
  return x;
}

function addMax(){
  const item=findItem('maxmin',$('searchItemMax').value);
  if(!item)return alert('Artículo no encontrado con los filtros actuales.');
  if(state.max.some(x=>x.art===item.art))return;
  $('searchItemMax').value=''; state.max.push(item); renderMax();
}
function addConsultaOrFiltered(){
  const search=$('searchItemConsulta').value.trim();
  if(search){
    const item=findItem('consulta',search); if(!item)return alert('Artículo no encontrado con los filtros actuales.');
    if(!state.consulta.some(x=>x.art===item.art))state.consulta.push(item);
    $('searchItemConsulta').value=''; renderConsulta(); return;
  }
  const exist=new Set(state.consulta.map(x=>x.art));
  itemAgg('consulta').forEach(x=>{if(!exist.has(x.art))state.consulta.push(x)});
  renderConsulta();
}
function addAcomodo(){
  const name=$('acomodoName').value.trim(); if(!name)return;
  state.acomodo.push({name,min:$('acomodoMin').value.trim(),max:$('acomodoMax').value.trim()});
  $('acomodoName').value=''; $('acomodoMin').value=''; $('acomodoMax').value=''; renderAcomodo();
}

function renderAll(){renderMax();renderConsulta();renderAcomodo();updateSubtitles();}
function renderMax(){
  const body=$('selectedBodyMax'); body.innerHTML='';
  if(!state.max.length) body.innerHTML='<tr><td colspan="6" class="empty-row">Agrega artículos para construir tu guía visual.</td></tr>';
  state.max.forEach((item,i)=>{const c=calc('maxmin',item); body.insertAdjacentHTML('beforeend',`<tr><td class="num">${i+1}</td><td>${esc(item.art)}</td><td><b>${fmtMinMax(c.min,c.valueMode)}</b></td><td><b>${fmtMinMax(c.max,c.valueMode)}</b></td><td><span class="pill">${esc(c.pres)}</span></td><td class="no-print"><button class="del" onclick="removeMax(${i})">Quitar</button></td></tr>`)});
  renderMarkers(state.max,'markerLayerMax','markerPosMax');
}
function renderConsulta(){
  const body=$('selectedBodyConsulta'); body.innerHTML='';
  if(!state.consulta.length) body.innerHTML='<tr><td colspan="6" class="empty-row">Selecciona categoría y presiona “Agregar consulta”, o busca un artículo específico.</td></tr>';
  state.consulta.forEach((item,i)=>{
    const c=calc('consulta',item);
    body.insertAdjacentHTML('beforeend',`<tr><td class="num">${i+1}</td><td>${esc(item.art)}</td><td>${fmt(c.ideal)}</td><td><b>${fmtMinMax(c.min,c.valueMode)}</b></td><td><b>${fmtMinMax(c.max,c.valueMode)}</b></td><td class="no-print"><button class="del" onclick="removeConsulta(${i})">Quitar</button></td></tr>`);
  });
}

function renderAcomodo(){
  const body=$('selectedBodyAcomodo'); body.innerHTML='';
  if(!state.acomodo.length) body.innerHTML='<tr><td colspan="5" class="empty-row">Agrega nombres editables para marcar la foto.</td></tr>';
  state.acomodo.forEach((item,i)=>{body.insertAdjacentHTML('beforeend',`<tr><td class="num">${i+1}</td><td><div class="editable" contenteditable="true" oninput="editAcomodo(${i},'name',this.textContent)">${esc(item.name)}</div></td><td><div class="editable" contenteditable="true" oninput="editAcomodo(${i},'min',this.textContent)">${esc(item.min||'')}</div></td><td><div class="editable" contenteditable="true" oninput="editAcomodo(${i},'max',this.textContent)">${esc(item.max||'')}</div></td><td class="no-print"><button class="del" onclick="removeAcomodo(${i})">Quitar</button></td></tr>`)});
  renderMarkers(state.acomodo,'markerLayerAcomodo','markerPosAcomodo');
}
function removeMax(i){state.max.splice(i,1);renderMax()} function removeConsulta(i){state.consulta.splice(i,1);renderConsulta()} function removeAcomodo(i){state.acomodo.splice(i,1);renderAcomodo()}
function editAcomodo(i,k,v){if(state.acomodo[i])state.acomodo[i][k]=v.trim()}
window.removeMax=removeMax; window.removeConsulta=removeConsulta; window.removeAcomodo=removeAcomodo; window.editAcomodo=editAcomodo;

function renderMarkers(items,layerId,posKey){
  const layer=$(layerId); layer.innerHTML='';
  items.forEach((it,i)=>{const n=i+1; const pos=state[posKey][n]||{x:7+(i%6)*13,y:9+Math.floor(i/6)*14}; const el=document.createElement('div'); el.className='marker'; el.textContent=n; el.style.left=pos.x+'%'; el.style.top=pos.y+'%'; drag(el,n,layerId,posKey); layer.appendChild(el);});
  if(layerId==='markerLayerMax') requestAnimationFrame(()=>alignMarkerLayer('Max'));
  if(layerId==='markerLayerAcomodo') requestAnimationFrame(()=>alignMarkerLayer('Acomodo'));
}
function drag(el,n,layerId,posKey){
  let dragging=false,shiftX=0,shiftY=0;
  const moveTo=(clientX,clientY)=>{const rect=$(layerId).getBoundingClientRect(); const markerW=el.offsetWidth||54, markerH=el.offsetHeight||42; let x=((clientX-rect.left-shiftX)/rect.width)*100; let y=((clientY-rect.top-shiftY)/rect.height)*100; const maxX=((rect.width-markerW)/rect.width)*100, maxY=((rect.height-markerH)/rect.height)*100; x=Math.max(0,Math.min(maxX,x)); y=Math.max(0,Math.min(maxY,y)); state[posKey][n]={x,y}; el.style.left=x+'%'; el.style.top=y+'%';};
  el.addEventListener('pointerdown',e=>{e.preventDefault(); e.stopPropagation(); dragging=true; const r=el.getBoundingClientRect(); shiftX=e.clientX-r.left; shiftY=e.clientY-r.top; el.classList.add('dragging'); try{el.setPointerCapture(e.pointerId)}catch(err){}});
  el.addEventListener('pointermove',e=>{if(!dragging)return; e.preventDefault(); moveTo(e.clientX,e.clientY);});
  const stop=e=>{if(!dragging)return; dragging=false; el.classList.remove('dragging'); try{el.releasePointerCapture(e.pointerId)}catch(err){}};
  el.addEventListener('pointerup',stop); el.addEventListener('pointercancel',stop); el.addEventListener('lostpointercapture',()=>{dragging=false; el.classList.remove('dragging')});
}

function updateSubtitles(){
  const maxWeeks=selectedWeeks('maxmin').join(', ')||'Todas';
  const conWeeks=selectedWeeks('consulta').join(', ')||'Todas';
  $('maxSubtitle').textContent=`${$('maxStore').value} · Semanas ${maxWeeks}`;
  $('conSubtitle').textContent=`${$('conStore').value} · Semanas ${conWeeks}`;
  $('acoSubtitle').textContent=`${$('acoStore').value} · ${$('acoTitle').value || 'Acomodo visual'}`;
}
function resetCurrent(){
  if(state.tab==='maxmin'){state.max=[];state.markerPosMax={};renderMax()}
  else if(state.tab==='consulta'){state.consulta=[];renderConsulta()}
  else {state.acomodo=[];state.markerPosAcomodo={};renderAcomodo()}
}
function exportPDF(){
  const labels={maxmin:'MaxMin',consulta:'Consulta',acomodo:'Acomodo'};
  const store=state.tab==='consulta'?$('conStore').value:state.tab==='acomodo'?$('acoStore').value:$('maxStore').value;
  document.title=`${labels[state.tab]}_${clean(store)}`;
  window.print();
}
function uniq(a){return [...new Set(a.filter(v=>v!==undefined&&v!==null&&v!==''))].sort((x,y)=>String(x).localeCompare(String(y),'es',{numeric:true}))}
function fmt(n){return Number(n||0).toLocaleString('es-MX',{maximumFractionDigits:1})}
function fmtUnit(n){return Number(n||0).toLocaleString('es-MX',{minimumFractionDigits:1,maximumFractionDigits:1})}
function fmtMinMax(n,mode){return mode==='unidad'?fmtUnit(n):Number(n||0).toLocaleString('es-MX',{maximumFractionDigits:0})}
function esc(s){return String(s??'').replace(/[&<>\"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]))}
function clean(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'_').replace(/^_|_$/g,'')}
window.addEventListener('DOMContentLoaded',()=>{init(); requestAnimationFrame(alignAllMarkerLayers);});
