const COL={dm:0,anio:1,sem:2,ceco:3,tienda:4,cat:5,art:6,uso:7,unidad:8,pickpack:9,factor:10};
const state={tab:'maxmin',selected:[],consulta:[],acomodo:[],markerPos:{},acomodoMarkerPos:{}};
const $=id=>document.getElementById(id);
const factorPedidos={2:5,3:4,4:3,5:2};
function uniq(a){return [...new Set(a.filter(v=>v!==undefined&&v!==null&&v!==''))].sort((x,y)=>String(x).localeCompare(String(y),'es',{numeric:true}))}
function init(){
  ['dateLabel','dateLabelConsulta','dateLabelAcomodo'].forEach(id=>$(id).textContent=new Date().toLocaleDateString('es-MX'));
  const stores=uniq(MAXMIN_ROWS.map(r=>r[COL.tienda]));
  $('storeFilter').innerHTML=stores.map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join('');
  const weeks=uniq(MAXMIN_ROWS.map(r=>r[COL.sem]));
  $('weekFilter').innerHTML=weeks.map(w=>`<option value="${w}">${w}</option>`).join('');
  [...$('weekFilter').options].slice(-4).forEach(o=>o.selected=true);
  bind(); refreshFilters(); refreshItemsDatalist(); updateSubtitle(); renderAll();
}
function bind(){
  document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.tab)));
  ['storeFilter','weekFilter','categoryFilter','ordersFilter','modeFilter','campaign'].forEach(id=>$(id).addEventListener('change',()=>{refreshFilters();refreshItemsDatalist();recalc();updateSubtitle();}));
  $('btnAdd').addEventListener('click',()=>addDataItem('maxmin'));
  $('searchItem').addEventListener('keydown',e=>{if(e.key==='Enter')addDataItem('maxmin')});
  $('btnAddConsulta').addEventListener('click',()=>addDataItem('consulta'));
  $('consultaSearch').addEventListener('keydown',e=>{if(e.key==='Enter')addDataItem('consulta')});
  $('btnAddAcomodo').addEventListener('click',addAcomodo);
  $('acomodoName').addEventListener('keydown',e=>{if(e.key==='Enter')addAcomodo()});
  $('btnReset').addEventListener('click',resetCurrent);
  $('btnExport').addEventListener('click',()=>{document.title=`${titlePrefix()}_${clean($('storeFilter').value)}_${clean($('campaign').value)}`;window.print()});
  photoBind('photoInput','rackPhoto','photoLabel');
  photoBind('acomodoPhotoInput','acomodoPhoto','acomodoPhotoLabel');
}
function setTab(tab){state.tab=tab;document.body.dataset.tab=tab;document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));document.querySelector(`.view-${tab}`).classList.add('active');updateSubtitle();}
function titlePrefix(){return state.tab==='consulta'?'Consulta_MaxMin':state.tab==='acomodo'?'Acomodo':'Max&Min'}
function resetCurrent(){if(state.tab==='maxmin'){state.selected=[];state.markerPos={};}else if(state.tab==='consulta'){state.consulta=[];}else{state.acomodo=[];state.acomodoMarkerPos={};}renderAll();}
function photoBind(inputId,imgId,labelId){$(inputId).addEventListener('change',e=>{const f=e.target.files[0];if(!f)return;const url=URL.createObjectURL(f);$(imgId).src=url;$(imgId).style.display='block';$(labelId).style.display='none';});}
function selectedWeeks(){return [...$('weekFilter').selectedOptions].map(o=>Number(o.value))}
function baseRows(){const store=$('storeFilter').value;const weeks=selectedWeeks();return MAXMIN_ROWS.filter(r=>r[COL.tienda]===store && (weeks.length===0||weeks.includes(Number(r[COL.sem]))));}
function refreshFilters(){const cur=$('categoryFilter').value;const cats=uniq(baseRows().map(r=>r[COL.cat]));$('categoryFilter').innerHTML='<option value="">Todas</option>'+cats.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');if(cats.includes(cur))$('categoryFilter').value=cur;}
function filteredRows(){const cat=$('categoryFilter').value;return baseRows().filter(r=>!cat||r[COL.cat]===cat)}
function itemAgg(){
  const map=new Map();
  for(const r of filteredRows()){
    const art=r[COL.art];
    if(!map.has(art))map.set(art,{art,cat:r[COL.cat],sum:0,count:0,unidad:r[COL.unidad]||'Unidad',pickpack:r[COL.pickpack]||'Pick Pack',factor:Number(r[COL.factor]||1)});
    const m=map.get(art);m.sum+=Number(r[COL.uso]||0);m.count+=1;
    if((!m.pickpack||m.pickpack==='PickPack') && r[COL.pickpack])m.pickpack=r[COL.pickpack];
    if((!m.unidad||m.unidad==='Unidad') && r[COL.unidad])m.unidad=r[COL.unidad];
    if(!m.factor || m.factor===1)m.factor=Number(r[COL.factor]||1);
  }
  return [...map.values()].map(m=>({...m,uso:m.count?m.sum/m.count:0})).sort((a,b)=>a.art.localeCompare(b.art,'es'))
}
function refreshItemsDatalist(){const list=itemAgg();$('itemsList').innerHTML=list.map(x=>`<option value="${esc(x.art)}"></option>`).join('');$('itemsListConsulta').innerHTML=$('itemsList').innerHTML;}
function addDataItem(target){const input=target==='consulta'?'consultaSearch':'searchItem';const arr=target==='consulta'?state.consulta:state.selected;const val=$(input).value.trim();if(!val)return;const items=itemAgg();const item=items.find(x=>x.art===val)||items.find(x=>x.art.toLowerCase().includes(val.toLowerCase()));if(!item)return alert('Artículo no encontrado con los filtros actuales.');if(arr.some(x=>x.art===item.art))return;$(input).value='';arr.push(item);renderAll();}
function recalc(){const items=itemAgg();state.selected=state.selected.map(sel=>items.find(x=>x.art===sel.art)||sel);state.consulta=state.consulta.map(sel=>items.find(x=>x.art===sel.art)||sel);renderAll();}
function calc(item){
  const pedidos=Number($('ordersFilter').value);const maxFactor=factorPedidos[pedidos]||5;const diario=item.uso/7;
  let min=diario;let max=diario*maxFactor;let pres=item.unidad, note='';
  if($('modeFilter').value==='pickpack'){
    const f=Number(item.factor||1);min=Math.ceil(min/f);max=Math.ceil(max/f);pres=item.pickpack;note=f>1?`÷ ${fmt(f)}`:'';
  }else{min=Math.ceil(min);max=Math.ceil(max)}
  return {ideal:item.uso,diario,min,max,pres,note};
}
function renderAll(){renderSelected();renderConsulta();renderAcomodo();}
function renderSelected(){
  const body=$('selectedBody');body.innerHTML='';
  state.selected.forEach((item,i)=>{const c=calc(item);body.insertAdjacentHTML('beforeend',`<tr><td class="num">${i+1}</td><td>${esc(item.art)}</td><td><b>${fmt(c.min)}</b></td><td><b>${fmt(c.max)}</b></td><td><span class="pill">${esc(c.pres)}</span>${c.note?`<small class="presentation-note">${esc(c.note)}</small>`:''}</td><td class="no-print"><button class="del" onclick="removeItem(${i})">Quitar</button></td></tr>`);});
  renderMarkers('markerLayer',state.selected,state.markerPos,false);
}
function renderConsulta(){
  const body=$('consultaBody');body.innerHTML='';
  state.consulta.forEach((item,i)=>{const c=calc(item);body.insertAdjacentHTML('beforeend',`<tr><td class="num">${i+1}</td><td>${esc(item.art)}</td><td>${esc(item.cat)}</td><td>${fmt(c.ideal)}</td><td>${fmt(c.diario)}</td><td><b>${fmt(c.min)}</b></td><td><b>${fmt(c.max)}</b></td><td><span class="pill">${esc(c.pres)}</span></td><td class="no-print"><button class="del" onclick="removeConsulta(${i})">Quitar</button></td></tr>`);});
}
function addAcomodo(){const name=$('acomodoName').value.trim();if(!name)return;state.acomodo.push({name,min:$('acomodoMin').value.trim(),max:$('acomodoMax').value.trim()});$('acomodoName').value='';$('acomodoMin').value='';$('acomodoMax').value='';renderAcomodo();}
function renderAcomodo(){
  const body=$('acomodoBody');body.innerHTML='';
  state.acomodo.forEach((item,i)=>{body.insertAdjacentHTML('beforeend',`<tr><td class="num">${i+1}</td><td contenteditable="true" oninput="editAcomodo(${i},'name',this.textContent)">${esc(item.name)}</td><td contenteditable="true" oninput="editAcomodo(${i},'min',this.textContent)">${esc(item.min)}</td><td contenteditable="true" oninput="editAcomodo(${i},'max',this.textContent)">${esc(item.max)}</td><td class="no-print"><button class="del" onclick="removeAcomodo(${i})">Quitar</button></td></tr>`);});
  renderMarkers('acomodoMarkerLayer',state.acomodo,state.acomodoMarkerPos,true);
}
function renderMarkers(layerId,arr,posObj,isAcomodo){const layer=$(layerId);layer.innerHTML='';arr.forEach((it,i)=>{const n=i+1;const pos=posObj[n]||{x:7+(i%6)*14,y:9+Math.floor(i/6)*16};const el=document.createElement('div');el.className='marker';el.textContent=n;el.style.left=pos.x+'%';el.style.top=pos.y+'%';drag(el,n,layerId,posObj);layer.appendChild(el);});}
function drag(el,n,layerId,posObj){let dragging=false,shiftX=0,shiftY=0;const moveTo=(clientX,clientY)=>{const layer=$(layerId);const rect=layer.getBoundingClientRect();const markerW=el.offsetWidth||54,markerH=el.offsetHeight||42;let x=((clientX-rect.left-shiftX)/rect.width)*100;let y=((clientY-rect.top-shiftY)/rect.height)*100;const maxX=((rect.width-markerW)/rect.width)*100,maxY=((rect.height-markerH)/rect.height)*100;x=Math.max(0,Math.min(maxX,x));y=Math.max(0,Math.min(maxY,y));posObj[n]={x,y};el.style.left=x+'%';el.style.top=y+'%';};el.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();dragging=true;const r=el.getBoundingClientRect();shiftX=e.clientX-r.left;shiftY=e.clientY-r.top;el.classList.add('dragging');try{el.setPointerCapture(e.pointerId)}catch(err){}});el.addEventListener('pointermove',e=>{if(!dragging)return;e.preventDefault();moveTo(e.clientX,e.clientY);});const stop=e=>{if(!dragging)return;dragging=false;el.classList.remove('dragging');try{el.releasePointerCapture(e.pointerId)}catch(err){}};el.addEventListener('pointerup',stop);el.addEventListener('pointercancel',stop);el.addEventListener('lostpointercapture',()=>{dragging=false;el.classList.remove('dragging')});}
function removeItem(i){state.selected.splice(i,1);renderAll()}function removeConsulta(i){state.consulta.splice(i,1);renderAll()}function removeAcomodo(i){state.acomodo.splice(i,1);renderAll()}function editAcomodo(i,k,v){if(state.acomodo[i])state.acomodo[i][k]=v.trim()}
window.removeItem=removeItem;window.removeConsulta=removeConsulta;window.removeAcomodo=removeAcomodo;window.editAcomodo=editAcomodo;
function updateSubtitle(){const weeks=selectedWeeks().join(', ')||'Todas';const base=`${$('storeFilter').value} · ${$('campaign').value} · Semanas ${weeks}`;$('subtitle').textContent=base;$('consultaSubtitle').textContent=base;$('acomodoSubtitle').textContent=`${$('storeFilter').value} · ${$('campaign').value}`;}
function fmt(n){return Number(n||0).toLocaleString('es-MX',{maximumFractionDigits:1})}
function esc(s){return String(s??'').replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]))}
function clean(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'_').replace(/^_|_$/g,'')}
window.addEventListener('DOMContentLoaded',init);
