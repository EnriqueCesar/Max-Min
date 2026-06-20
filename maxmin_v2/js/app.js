const COL={dm:0,anio:1,sem:2,ceco:3,tienda:4,cat:5,art:6,uso:7,unidad:8,pickpack:9,factor:10};
const state={tab:'maxmin',max:[],consulta:[],acomodo:[],markerPosMax:{},markerPosAcomodo:{}};
const factorPedidos={2:5,3:4,4:3,5:2};
const $=id=>document.getElementById(id);
function init(){
  ['Max','Consulta','Acomodo'].forEach(s=>{const el=$('dateLabel'+s); if(el)el.textContent=new Date().toLocaleDateString('es-MX')});
  const stores=uniq(MAXMIN_ROWS.map(r=>r[COL.tienda]));
  $('storeFilter').innerHTML=stores.map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join('');
  const weeks=uniq(MAXMIN_ROWS.map(r=>r[COL.sem]));
  $('weekFilter').innerHTML=weeks.map(w=>`<option value="${w}">${w}</option>`).join('');
  [...$('weekFilter').options].slice(-4).forEach(o=>o.selected=true);
  bind(); refreshFilters(); refreshItemsDatalist(); updateSubtitles(); renderAll();
}
function bind(){
  document.querySelectorAll('.tab-btn').forEach(btn=>btn.addEventListener('click',()=>setTab(btn.dataset.tab)));
  ['storeFilter','weekFilter','categoryFilter','ordersFilter','modeFilter','campaign'].forEach(id=>$(id).addEventListener('change',()=>{refreshFilters();refreshItemsDatalist();recalcAll();updateSubtitles();}));
  $('btnExport').addEventListener('click',exportPDF); $('btnReset').addEventListener('click',resetCurrent);
  $('btnAddMax').addEventListener('click',addMax); $('searchItemMax').addEventListener('keydown',e=>{if(e.key==='Enter')addMax()});
  $('btnAddConsulta').addEventListener('click',addConsulta); $('searchItemConsulta').addEventListener('keydown',e=>{if(e.key==='Enter')addConsulta()}); $('btnAddAllFiltered').addEventListener('click',addAllFilteredConsulta);
  $('btnAddAcomodo').addEventListener('click',addAcomodo); $('acomodoName').addEventListener('keydown',e=>{if(e.key==='Enter')addAcomodo()});
  bindPhoto('Max','markerLayerMax','markerPosMax'); bindPhoto('Acomodo','markerLayerAcomodo','markerPosAcomodo');
}
function bindPhoto(s){
  const input=$('photoInput'+s), img=$('rackPhoto'+s), label=$('photoLabel'+s), clear=$('clearPhoto'+s);
  input.addEventListener('change',e=>{const f=e.target.files[0]; if(!f)return; const url=URL.createObjectURL(f); img.src=url; img.style.display='block'; label.style.display='none';});
  clear.addEventListener('click',()=>{input.value=''; img.removeAttribute('src'); img.style.display='none'; label.style.display='block';});
}
function setTab(tab){state.tab=tab; document.querySelectorAll('.tab-btn').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab)); document.querySelectorAll('.tab-panel').forEach(p=>p.classList.toggle('active',p.id==='tab-'+tab)); document.body.classList.toggle('show-category',tab==='consulta'); refreshFilters(); refreshItemsDatalist(); updateSubtitles();}
function selectedWeeks(){return [...$('weekFilter').selectedOptions].map(o=>Number(o.value))}
function weekDivisor(){const w=selectedWeeks(); return w.length || uniq(baseRowsRaw().map(r=>r[COL.sem])).length || 1}
function baseRowsRaw(){const store=$('storeFilter').value; return MAXMIN_ROWS.filter(r=>r[COL.tienda]===store)}
function baseRows(){const weeks=selectedWeeks(); return baseRowsRaw().filter(r=>weeks.length===0||weeks.includes(Number(r[COL.sem])))}
function refreshFilters(){const cur=$('categoryFilter').value; const cats=uniq(baseRows().map(r=>r[COL.cat])); $('categoryFilter').innerHTML='<option value="">Todas</option>'+cats.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join(''); if(cats.includes(cur))$('categoryFilter').value=cur;}
function filteredRows(){const cat=$('categoryFilter').value; const rows=baseRows(); return state.tab==='consulta' && cat ? rows.filter(r=>r[COL.cat]===cat) : rows;}
function itemAgg(){
  const map=new Map(); const divisor=weekDivisor();
  for(const r of filteredRows()){
    const art=r[COL.art]; if(!art)continue;
    if(!map.has(art))map.set(art,{art,cat:r[COL.cat],usoSum:0,uso:0,unidad:r[COL.unidad]||'Unidad',pickpack:r[COL.pickpack]||r[COL.unidad]||'Unidad',factor:Number(r[COL.factor]||1)});
    const it=map.get(art); it.usoSum += Number(r[COL.uso]||0); if(!it.cat && r[COL.cat])it.cat=r[COL.cat];
  }
  for(const it of map.values()) it.uso=it.usoSum/divisor;
  return [...map.values()].sort((a,b)=>a.art.localeCompare(b.art,'es'));
}
function refreshItemsDatalist(){const list=itemAgg(); const opts=list.map(x=>`<option value="${esc(x.art)}"></option>`).join(''); $('itemsList').innerHTML=opts; $('consultaItemsList').innerHTML=opts;}
function findItem(text){const val=(text||'').trim(); if(!val)return null; const list=itemAgg(); return list.find(x=>x.art===val)||list.find(x=>x.art.toLowerCase().includes(val.toLowerCase()));}
function addMax(){const item=findItem($('searchItemMax').value); if(!item)return alert('Artículo no encontrado con los filtros actuales.'); if(state.max.some(x=>x.art===item.art))return; $('searchItemMax').value=''; state.max.push(item); renderMax();}
function addConsulta(){const item=findItem($('searchItemConsulta').value); if(!item)return alert('Artículo no encontrado con los filtros actuales.'); if(state.consulta.some(x=>x.art===item.art))return; $('searchItemConsulta').value=''; state.consulta.push(item); renderConsulta();}
function addAllFilteredConsulta(){const exist=new Set(state.consulta.map(x=>x.art)); itemAgg().forEach(x=>{if(!exist.has(x.art))state.consulta.push(x)}); renderConsulta();}
function addAcomodo(){const name=$('acomodoName').value.trim(); if(!name)return; state.acomodo.push({name,min:$('acomodoMin').value.trim(),max:$('acomodoMax').value.trim()}); $('acomodoName').value=''; $('acomodoMin').value=''; $('acomodoMax').value=''; renderAcomodo();}
function recalcAll(){const agg=itemAgg(); state.max=state.max.map(sel=>agg.find(x=>x.art===sel.art)||sel); state.consulta=state.consulta.map(sel=>agg.find(x=>x.art===sel.art)||sel); renderAll();}
function calc(item){
  const pedidos=Number($('ordersFilter').value); const maxFactor=factorPedidos[pedidos]||5;
  const diario=Number(item.uso||0)/7; let min=diario; let max=diario*maxFactor; let pres=item.unidad||'Unidad';
  if($('modeFilter').value==='pickpack'){
    const f=Number(item.factor||1); min=Math.ceil(min/f); max=Math.ceil(max/f); pres=item.pickpack||item.unidad||'Pick Pack';
  } else {min=Math.ceil(min); max=Math.ceil(max); pres=item.unidad||'Unidad';}
  return {ideal:item.uso,diario,min,max,pres};
}
function renderAll(){renderMax();renderConsulta();renderAcomodo();}
function renderMax(){const body=$('selectedBodyMax'); body.innerHTML=''; if(!state.max.length) body.innerHTML='<tr><td colspan="6" class="empty-row">Agrega artículos para construir tu guía visual.</td></tr>'; state.max.forEach((item,i)=>{const c=calc(item); body.insertAdjacentHTML('beforeend',`<tr><td class="num">${i+1}</td><td>${esc(item.art)}</td><td><b>${fmt(c.min)}</b></td><td><b>${fmt(c.max)}</b></td><td><span class="pill">${esc(c.pres)}</span></td><td class="no-print"><button class="del" onclick="removeMax(${i})">Quitar</button></td></tr>`)}); renderMarkers('Max',state.max,'markerLayerMax','markerPosMax');}
function renderConsulta(){const body=$('selectedBodyConsulta'); body.innerHTML=''; if(!state.consulta.length) body.innerHTML='<tr><td colspan="10" class="empty-row">Agrega artículos o usa “Agregar filtrados” para validar la lista.</td></tr>'; state.consulta.forEach((item,i)=>{const c=calc(item); body.insertAdjacentHTML('beforeend',`<tr><td class="num">${i+1}</td><td>${esc(item.art)}</td><td>${esc(item.cat||'')}</td><td>${fmt(c.ideal)}</td><td>${fmt(c.diario)}</td><td><b>${fmt(c.min)}</b></td><td><b>${fmt(c.max)}</b></td><td><span class="pill">${esc(item.unidad||'Unidad')}</span></td><td><span class="pill">${esc(item.pickpack||'Pick Pack')}</span></td><td class="no-print"><button class="del" onclick="removeConsulta(${i})">Quitar</button></td></tr>`)});}
function renderAcomodo(){const body=$('selectedBodyAcomodo'); body.innerHTML=''; if(!state.acomodo.length) body.innerHTML='<tr><td colspan="5" class="empty-row">Agrega nombres editables para marcar la foto.</td></tr>'; state.acomodo.forEach((item,i)=>{body.insertAdjacentHTML('beforeend',`<tr><td class="num">${i+1}</td><td><div class="editable" contenteditable="true" oninput="editAcomodo(${i},'name',this.textContent)">${esc(item.name)}</div></td><td><div class="editable" contenteditable="true" oninput="editAcomodo(${i},'min',this.textContent)">${esc(item.min||'')}</div></td><td><div class="editable" contenteditable="true" oninput="editAcomodo(${i},'max',this.textContent)">${esc(item.max||'')}</div></td><td class="no-print"><button class="del" onclick="removeAcomodo(${i})">Quitar</button></td></tr>`)}); renderMarkers('Acomodo',state.acomodo,'markerLayerAcomodo','markerPosAcomodo');}
function removeMax(i){state.max.splice(i,1);renderMax()} function removeConsulta(i){state.consulta.splice(i,1);renderConsulta()} function removeAcomodo(i){state.acomodo.splice(i,1);renderAcomodo()}
function editAcomodo(i,k,v){if(state.acomodo[i])state.acomodo[i][k]=v.trim()}
window.removeMax=removeMax; window.removeConsulta=removeConsulta; window.removeAcomodo=removeAcomodo; window.editAcomodo=editAcomodo;
function renderMarkers(label,items,layerId,posKey){const layer=$(layerId); layer.innerHTML=''; items.forEach((it,i)=>{const n=i+1; const pos=state[posKey][n]||{x:8+(i%6)*14,y:10+Math.floor(i/6)*16}; const el=document.createElement('div'); el.className='marker'; el.textContent=n; el.style.left=pos.x+'%'; el.style.top=pos.y+'%'; drag(el,n,layerId,posKey); layer.appendChild(el);});}
function drag(el,n,layerId,posKey){let dragging=false,shiftX=0,shiftY=0; const moveTo=(clientX,clientY)=>{const rect=$(layerId).getBoundingClientRect(); const markerW=el.offsetWidth||54, markerH=el.offsetHeight||42; let x=((clientX-rect.left-shiftX)/rect.width)*100; let y=((clientY-rect.top-shiftY)/rect.height)*100; const maxX=((rect.width-markerW)/rect.width)*100, maxY=((rect.height-markerH)/rect.height)*100; x=Math.max(0,Math.min(maxX,x)); y=Math.max(0,Math.min(maxY,y)); state[posKey][n]={x,y}; el.style.left=x+'%'; el.style.top=y+'%';}; el.addEventListener('pointerdown',e=>{e.preventDefault(); e.stopPropagation(); dragging=true; const r=el.getBoundingClientRect(); shiftX=e.clientX-r.left; shiftY=e.clientY-r.top; el.classList.add('dragging'); try{el.setPointerCapture(e.pointerId)}catch(err){}}); el.addEventListener('pointermove',e=>{if(!dragging)return; e.preventDefault(); moveTo(e.clientX,e.clientY);}); const stop=e=>{if(!dragging)return; dragging=false; el.classList.remove('dragging'); try{el.releasePointerCapture(e.pointerId)}catch(err){}}; el.addEventListener('pointerup',stop); el.addEventListener('pointercancel',stop); el.addEventListener('lostpointercapture',()=>{dragging=false; el.classList.remove('dragging')});}
function updateSubtitles(){const weeks=selectedWeeks().join(', ')||'Todas'; const store=$('storeFilter').value; const camp=$('campaign').value; $('subtitleMax').textContent=`${store} · ${camp} · Semanas ${weeks}`; $('subtitleConsulta').textContent=`${store} · ${camp} · Semanas ${weeks}`; $('subtitleAcomodo').textContent=`${store} · ${camp}`;}
function resetCurrent(){if(state.tab==='maxmin'){state.max=[];state.markerPosMax={};renderMax()} else if(state.tab==='consulta'){state.consulta=[];renderConsulta()} else {state.acomodo=[];state.markerPosAcomodo={};renderAcomodo()}}
function exportPDF(){const names={maxmin:'Max&Min',consulta:'Consulta',acomodo:'Acomodo'}; document.title=`${names[state.tab]}_${clean($('storeFilter').value)}_${clean($('campaign').value)}`; window.print();}
function uniq(a){return [...new Set(a.filter(v=>v!==undefined&&v!==null&&v!==''))].sort((x,y)=>String(x).localeCompare(String(y),'es',{numeric:true}))}
function fmt(n){return Number(n||0).toLocaleString('es-MX',{maximumFractionDigits:1})}
function esc(s){return String(s??'').replace(/[&<>\"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]))}
function clean(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'_').replace(/^_|_$/g,'')}
window.addEventListener('DOMContentLoaded',init);
