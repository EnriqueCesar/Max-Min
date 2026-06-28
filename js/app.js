const COL={dm:0,anio:1,sem:2,ceco:3,tienda:4,cat:5,art:6,uso:7,unidad:8,pickpack:9,factor:10};
const factorPedidos={2:5,3:4,4:3,5:2};
// Nota operativa: data POS por semana individual Sem 18–25; no incluye merma ni variación.
const state={tab:'maxmin',max:[],consulta:[],acomodo:[],markerPosMax:{},markerPosAcomodo:{}};
const $=id=>document.getElementById(id);

const cfg={
  maxmin:{store:'maxStore',weeks:'maxWeeks',orders:'maxOrders',mode:'maxMode',category:null,datalist:'maxItemsList'},
  consulta:{store:'conStore',weeks:'conWeeks',orders:'conOrders',mode:'conMode',category:'conCategory',datalist:'consultaItemsList'},
  acomodo:{store:'acoStore'}
};

function init(){
  ['maxDate','conDate','acoDate'].forEach(id=>$(id).textContent=new Date().toLocaleDateString('es-MX'));
  buildDataIndex();
  const stores=sortStoresByCeCo(window.MAXMIN_STORES||[]);
  window.MAXMIN_STORE_OPTIONS=stores;
  ['maxStore','conStore','acoStore'].forEach(id=>{
    $(id).innerHTML=stores.map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join('');
    enhanceStoreSearch(id);
  });
  const weeks=(window.MAXMIN_META&&Array.isArray(MAXMIN_META.weeks))?MAXMIN_META.weeks:uniq(Object.keys(window.MAXMIN_WEEK_ROWS||{}));
  ['maxWeeks','conWeeks'].forEach(id=>{
    $(id).innerHTML=weeks.map(w=>`<option value="${esc(w)}" selected>Semana ${esc(w)}</option>`).join('');
    enhanceWeekSelect(id);
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
    img.onload=()=>{img.style.display='block'; label.style.display='none'; $('photoWrap'+s)?.classList.add('has-photo'); alignMarkerLayer(s); setTimeout(()=>alignMarkerLayer(s),120);};
    img.src=URL.createObjectURL(f);
  });
  clear.addEventListener('click',()=>{
    input.value=''; img.removeAttribute('src'); img.style.display='none'; label.style.display='block'; $('photoWrap'+s)?.classList.remove('has-photo');
    resetMarkerLayer(s);
  });
}

function imageContentBox(wrap,img){
  const w=wrap.clientWidth, h=wrap.clientHeight;
  if(!w||!h||!img || !img.src || img.style.display==='none') return {left:0,top:0,width:w,height:h};
  const wr=wrap.getBoundingClientRect();
  const ir=img.getBoundingClientRect();
  // Usar el rectángulo REAL renderizado de la imagen.
  // Así los marcadores viven sobre la foto completa, no sobre el recuadro.
  if(ir.width>0 && ir.height>0){
    return {left:ir.left-wr.left, top:ir.top-wr.top, width:ir.width, height:ir.height};
  }
  if(!img.naturalWidth||!img.naturalHeight) return {left:0,top:0,width:w,height:h};
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


// Crea una imagen compuesta SOLO para impresión: foto completa + marcadores.
// Esto evita que Chrome cambie el tamaño del layer al exportar y respeta la ubicación colocada en pantalla.
function preparePrintComposites(){
  makePrintComposite('Max','markerPosMax',state.max);
  makePrintComposite('Acomodo','markerPosAcomodo',state.acomodo);
}
function cleanupPrintComposites(){
  // Restaurar la foto original después de imprimir/exportar.
  document.querySelectorAll('.photo-wrap.has-print-composite').forEach(wrap=>{
    const original=wrap.querySelector('img:not(.print-composite)');
    if(original && original.dataset.prevDisplay!==undefined){
      original.style.display=original.dataset.prevDisplay||'block';
      delete original.dataset.prevDisplay;
    }
    wrap.classList.remove('has-print-composite');
  });
  document.querySelectorAll('.print-composite').forEach(el=>el.remove());
}
function makePrintComposite(s,posKey,items){
  const wrap=$('photoWrap'+s), img=$('rackPhoto'+s);
  if(!wrap||!img||!img.src||img.style.display==='none'||!img.naturalWidth||!img.naturalHeight)return;
  let old=wrap.querySelector('img.print-composite');
  if(old)old.remove();
  const maxSide=1800;
  const scale=Math.min(1,maxSide/Math.max(img.naturalWidth,img.naturalHeight));
  const cw=Math.max(1,Math.round(img.naturalWidth*scale));
  const ch=Math.max(1,Math.round(img.naturalHeight*scale));
  const canvas=document.createElement('canvas');
  canvas.width=cw; canvas.height=ch;
  const ctx=canvas.getContext('2d');
  ctx.drawImage(img,0,0,cw,ch);
  const positions=state[posKey]||{};
  const count=items.length;
  for(let i=0;i<count;i++){
    const n=i+1;
    const pos=positions[n]||{x:7+(i%6)*13,y:9+Math.floor(i/6)*14};
    drawMarker(ctx,cw,ch,n,pos.x,pos.y);
  }
  const out=document.createElement('img');
  out.className='print-composite';
  out.alt='Foto con marcadores';
  out.src=canvas.toDataURL('image/jpeg',0.92);
  // En algunos navegadores móviles la vista de impresión conserva la imagen original
  // aunque el CSS indique ocultarla. La ocultamos también por JS para evitar duplicidad.
  img.dataset.prevDisplay=img.style.display || 'block';
  img.style.display='none';
  out.style.display='block';
  wrap.appendChild(out);
  wrap.classList.add('has-print-composite');
}
function drawMarker(ctx,cw,ch,n,xPct,yPct){
  const mw=Math.max(44,Math.min(70,cw*0.065));
  const mh=mw*0.72;
  let x=(Number(xPct)||0)/100*cw;
  let y=(Number(yPct)||0)/100*ch;
  x=Math.max(0,Math.min(cw-mw,x));
  y=Math.max(0,Math.min(ch-mh,y));
  const r=mh/2;
  ctx.save();
  ctx.shadowColor='rgba(0,0,0,.25)';ctx.shadowBlur=8;ctx.shadowOffsetY=3;
  roundRect(ctx,x,y,mw,mh,r);
  ctx.fillStyle='white';ctx.fill();
  ctx.shadowColor='transparent';ctx.lineWidth=Math.max(4,cw*0.004);ctx.strokeStyle='#45a538';ctx.stroke();
  ctx.fillStyle='#000';ctx.font=`900 ${Math.round(mh*0.56)}px Arial, Helvetica, sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(n),x+mw/2,y+mh/2+1);
  ctx.restore();
}
function roundRect(ctx,x,y,w,h,r){
  ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();
}
function alignAllMarkerLayers(){alignMarkerLayer('Max'); alignMarkerLayer('Acomodo');}
window.addEventListener('resize',()=>requestAnimationFrame(alignAllMarkerLayers));
function beforePrintPrep(){
  alignAllMarkerLayers();
  preparePrintComposites();
  setTimeout(()=>{alignAllMarkerLayers();preparePrintComposites();},80);
  setTimeout(()=>{alignAllMarkerLayers();preparePrintComposites();},250);
}
window.addEventListener('beforeprint',beforePrintPrep);
window.addEventListener('afterprint',cleanupPrintComposites);
if(window.matchMedia){
  const mq=window.matchMedia('print');
  const handler=e=>{ if(e && e.matches){ beforePrintPrep(); } else { cleanupPrintComposites(); } };
  if(mq.addEventListener)mq.addEventListener('change',handler); else if(mq.addListener)mq.addListener(handler);
}


function parseCeCo(store){
  const m=String(store||'').match(/^(\d{3,6})\s*[·\-–]?\s*/);
  return m?Number(m[1]):999999;
}
function normalizeTxt(s){
  return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
}
function sortStoresByCeCo(stores){
  return [...stores].sort((a,b)=>parseCeCo(a)-parseCeCo(b)||String(a).localeCompare(String(b),'es',{numeric:true}));
}
function enhanceStoreSearch(selectId){
  const sel=$(selectId); if(!sel || sel.dataset.searchEnhanced)return; sel.dataset.searchEnhanced='1';
  sel.classList.add('store-native-select');
  const wrap=document.createElement('div'); wrap.className='store-search';
  const input=document.createElement('input'); input.type='search'; input.className='store-search-input'; input.autocomplete='off'; input.placeholder='Escribe CeCo o nombre de tienda…';
  const info=document.createElement('div'); info.className='store-search-info';
  const list=document.createElement('div'); list.className='store-search-results'; list.setAttribute('role','listbox');
  wrap.appendChild(input); wrap.appendChild(info); wrap.appendChild(list); sel.insertAdjacentElement('afterend',wrap);
  const all=window.MAXMIN_STORE_OPTIONS||sortStoresByCeCo(window.MAXMIN_STORES||[]);
  const setValue=(value,notify=true)=>{
    if(!value)return;
    sel.value=value; input.value=value; info.textContent=`Seleccionada: ${value}`; close();
    if(notify) sel.dispatchEvent(new Event('change',{bubbles:true}));
  };
  const close=()=>{list.classList.remove('open'); list.innerHTML='';};
  const render=()=>{
    const q=normalizeTxt(input.value.trim());
    const terms=q.split(/\s+/).filter(Boolean);
    let matches=all.filter(store=>{
      const n=normalizeTxt(store);
      return !terms.length || terms.every(t=>n.includes(t));
    });
    matches=matches.slice(0,60);
    list.innerHTML='';
    if(!matches.length){list.innerHTML='<button type="button" class="store-result empty">Sin coincidencias</button>'; list.classList.add('open'); return;}
    matches.forEach((store,i)=>{
      const b=document.createElement('button'); b.type='button'; b.className='store-result'+(store===sel.value?' active':'');
      const ceco=String(store).match(/^(\d{3,6})/)?.[1]||'';
      const name=String(store).replace(/^\d{3,6}\s*[·\-–]?\s*/,'');
      b.innerHTML=`<strong>${esc(ceco)}</strong><span>${esc(name)}</span>`;
      b.addEventListener('mousedown',e=>{e.preventDefault(); setValue(store,true);});
      list.appendChild(b);
      if(i===0) b.dataset.first='1';
    });
    list.classList.add('open');
  };
  input.addEventListener('focus',render);
  input.addEventListener('input',render);
  input.addEventListener('keydown',e=>{
    if(e.key==='Enter'){
      e.preventDefault();
      const first=list.querySelector('.store-result:not(.empty)');
      if(first){
        const idx=[...list.children].indexOf(first);
        const q=normalizeTxt(input.value.trim());
        const terms=q.split(/\s+/).filter(Boolean);
        const match=all.filter(store=>{const n=normalizeTxt(store); return !terms.length || terms.every(t=>n.includes(t));})[idx];
        if(match)setValue(match,true);
      }
    } else if(e.key==='Escape') close();
  });
  document.addEventListener('click',e=>{if(!wrap.contains(e.target))close();});
  sel.addEventListener('change',()=>{input.value=sel.value; info.textContent=`Seleccionada: ${sel.value}`;});
  setValue(sel.value || all[0], false);
}

function buildDataIndex(){
  window.MAXMIN_STORE_INDEX=new Map((window.MAXMIN_STORES||[]).map((s,i)=>[s,i]));
  window.MAXMIN_STORE_WEEK={};
  const all=window.MAXMIN_WEEK_ROWS||{};
  for(const wk of Object.keys(all)){
    for(const r of all[wk]){
      const si=r[0];
      if(!window.MAXMIN_STORE_WEEK[si]) window.MAXMIN_STORE_WEEK[si]={};
      if(!window.MAXMIN_STORE_WEEK[si][wk]) window.MAXMIN_STORE_WEEK[si][wk]=[];
      window.MAXMIN_STORE_WEEK[si][wk].push(r);
    }
  }
}
function expandRow(r,wk){
  return [window.MAXMIN_DMS?.[r[7]]||'',2026,String(wk),'',window.MAXMIN_STORES[r[0]],window.MAXMIN_CATS[r[1]],window.MAXMIN_ARTS[r[2]],r[3],window.MAXMIN_PRES[r[4]]||'PZA:',window.MAXMIN_PRES[r[5]]||window.MAXMIN_PRES[r[4]]||'PZA:',r[6]||1];
}
function enhanceWeekSelect(id){
  const sel=$(id); if(!sel || sel.dataset.enhanced)return; sel.dataset.enhanced='1'; sel.classList.add('native-weeks');
  const box=document.createElement('div'); box.className='week-chips'; box.id=id+'Chips';
  sel.insertAdjacentElement('afterend',box);
  const sync=()=>{
    const opts=[...sel.options], allSelected=opts.every(o=>o.selected);
    box.innerHTML='';
    const all=document.createElement('button'); all.type='button'; all.className='week-chip all '+(allSelected?'active':''); all.textContent='Todas';
    all.onclick=()=>{opts.forEach(o=>o.selected=true); sel.dispatchEvent(new Event('change',{bubbles:true})); sync();};
    box.appendChild(all);
    opts.forEach(o=>{
      const b=document.createElement('button'); b.type='button'; b.className='week-chip '+(o.selected?'active':''); b.textContent=o.textContent.replace('Semana ','S');
      b.onclick=()=>{o.selected=!o.selected; if(!opts.some(x=>x.selected)) o.selected=true; sel.dispatchEvent(new Event('change',{bubbles:true})); sync();};
      box.appendChild(b);
    });
  };
  sel.addEventListener('change',sync); sync();
}
function selectedWeekValues(tab){
  const vals=selectedWeeks(tab);
  if(vals.length) return vals;
  const all=(window.MAXMIN_META&&Array.isArray(MAXMIN_META.weeks))?MAXMIN_META.weeks:uniq(Object.keys(window.MAXMIN_WEEK_ROWS||{}));
  return all.map(String);
}

function refreshAllFilters(){refreshTab('maxmin'); refreshTab('consulta'); updateSubtitles();}
function refreshTab(tab){
  if(tab==='acomodo')return;
  const c=cfg[tab];
  if(c.category){
    const cur=$(c.category).value;
    const cats=uniq(rowsRaw(tab).map(r=>r[COL.cat]));
    $(c.category).innerHTML='<option value="">Todas</option>'+cats.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
    if(cats.includes(cur))$(c.category).value=cur;
  }
  const list=itemAgg(tab);
  if(c.datalist)$(c.datalist).innerHTML=list.map(x=>`<option value="${esc(x.art)}"></option>`).join('');
}

function rowsRaw(tab){
  const store=$(cfg[tab].store).value;
  const si=window.MAXMIN_STORE_INDEX?.get(store);
  const weeks=selectedWeekValues(tab);
  const out=[];
  if(si===undefined)return out;
  const byWeek=window.MAXMIN_STORE_WEEK?.[si]||{};
  for(const wk of weeks){
    const chunk=byWeek[String(wk)]||[];
    for(const r of chunk) out.push(expandRow(r,wk));
  }
  return out;
}
function selectedWeeks(tab){return [...$(cfg[tab].weeks).selectedOptions].map(o=>o.value);}
function filteredRows(tab){
  const c=cfg[tab], weeks=selectedWeeks(tab);
  let rows=rowsRaw(tab);
  if(c.category && $(c.category).value) rows=rows.filter(r=>r[COL.cat]===$(c.category).value);
  return rows;
}
function itemAgg(tab){
  const rows=filteredRows(tab), weeks=selectedWeekValues(tab), divisor=(weeks.length || 1);
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
  const maxWeeks=selectedWeekValues('maxmin').join(', ')||'Todas';
  const conWeeks=selectedWeekValues('consulta').join(', ')||'Todas';
  $('maxSubtitle').textContent=`${$('maxStore').value} · Uso Sem ${maxWeeks} · POS`;
  $('conSubtitle').textContent=`${$('conStore').value} · Uso Sem ${conWeeks} · POS`;
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
  beforePrintPrep();
  setTimeout(()=>window.print(),120);
}
function uniq(a){return [...new Set(a.filter(v=>v!==undefined&&v!==null&&v!==''))].sort((x,y)=>String(x).localeCompare(String(y),'es',{numeric:true}))}
function fmt(n){return Number(n||0).toLocaleString('es-MX',{maximumFractionDigits:1})}
function fmtUnit(n){return Number(n||0).toLocaleString('es-MX',{minimumFractionDigits:1,maximumFractionDigits:1})}
function fmtMinMax(n,mode){return mode==='unidad'?fmtUnit(n):Number(n||0).toLocaleString('es-MX',{maximumFractionDigits:0})}
function esc(s){return String(s??'').replace(/[&<>\"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]))}
function clean(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'_').replace(/^_|_$/g,'')}
window.addEventListener('DOMContentLoaded',()=>{init(); console.info('Max&Min 2.0 validado', window.MAXMIN_META?.counts); requestAnimationFrame(alignAllMarkerLayers);});
