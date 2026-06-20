const COL={dm:0,anio:1,sem:2,ceco:3,tienda:4,cat:5,art:6,uso:7,unidad:8,pickpack:9,factor:10};
const state={selected:[],markerPos:{}};
const $=id=>document.getElementById(id);
const factorPedidos={2:5,3:4,4:3,5:2};
function uniq(a){return [...new Set(a.filter(v=>v!==undefined&&v!==null&&v!==''))].sort((x,y)=>String(x).localeCompare(String(y),'es',{numeric:true}))}
function init(){
  $('dateLabel').textContent=new Date().toLocaleDateString('es-MX');
  const stores=uniq(MAXMIN_ROWS.map(r=>r[COL.tienda]));
  $('storeFilter').innerHTML=stores.map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join('');
  const weeks=uniq(MAXMIN_ROWS.map(r=>r[COL.sem]));
  $('weekFilter').innerHTML=weeks.map(w=>`<option value="${w}">${w}</option>`).join('');
  [...$('weekFilter').options].slice(-4).forEach(o=>o.selected=true);
  bind(); refreshFilters(); refreshItemsDatalist(); updateSubtitle();
}
function bind(){['storeFilter','weekFilter','categoryFilter','ordersFilter','modeFilter','campaign'].forEach(id=>$(id).addEventListener('change',()=>{refreshFilters(); refreshItemsDatalist(); recalc(); updateSubtitle();}));
$('btnAdd').addEventListener('click',addSelected);$('searchItem').addEventListener('keydown',e=>{if(e.key==='Enter')addSelected()});
$('btnReset').addEventListener('click',()=>{state.selected=[];state.markerPos={};renderSelected()});
$('btnExport').addEventListener('click',()=>{document.title=`Max&Min_${clean($('storeFilter').value)}_${clean($('campaign').value)}`;window.print()});
$('photoInput').addEventListener('change',e=>{const f=e.target.files[0];if(!f)return;const url=URL.createObjectURL(f);$('rackPhoto').src=url;$('rackPhoto').style.display='block';$('photoLabel').style.display='none'});
}
function selectedWeeks(){return [...$('weekFilter').selectedOptions].map(o=>Number(o.value))}
function baseRows(){const store=$('storeFilter').value;const weeks=selectedWeeks();return MAXMIN_ROWS.filter(r=>r[COL.tienda]===store && (weeks.length===0||weeks.includes(Number(r[COL.sem]))));}
function refreshFilters(){const cur=$('categoryFilter').value;const cats=uniq(baseRows().map(r=>r[COL.cat]));$('categoryFilter').innerHTML='<option value="">Todas</option>'+cats.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');if(cats.includes(cur))$('categoryFilter').value=cur;}
function filteredRows(){const cat=$('categoryFilter').value;return baseRows().filter(r=>!cat||r[COL.cat]===cat)}
function itemAgg(){const map=new Map();for(const r of filteredRows()){const art=r[COL.art];if(!map.has(art))map.set(art,{art,cat:r[COL.cat],uso:0,unidad:r[COL.unidad]||'Unidad',pickpack:r[COL.pickpack]||'Pick Pack',factor:Number(r[COL.factor]||1)});map.get(art).uso+=Number(r[COL.uso]||0)}return [...map.values()].sort((a,b)=>a.art.localeCompare(b.art,'es'))}
function refreshItemsDatalist(){const list=itemAgg();$('itemsList').innerHTML=list.map(x=>`<option value="${esc(x.art)}"></option>`).join('');}
function addSelected(){const val=$('searchItem').value.trim();if(!val)return;const item=itemAgg().find(x=>x.art===val)||itemAgg().find(x=>x.art.toLowerCase().includes(val.toLowerCase()));if(!item)return alert('Artículo no encontrado con los filtros actuales.');if(state.selected.some(x=>x.art===item.art))return;$('searchItem').value='';state.selected.push(item);renderSelected();}
function recalc(){state.selected=state.selected.map(sel=>itemAgg().find(x=>x.art===sel.art)||sel);renderSelected();}
function calc(item){const pedidos=Number($('ordersFilter').value);const maxFactor=factorPedidos[pedidos]||5;const diario=item.uso/7;let min=diario;let max=diario*maxFactor;let pres=item.unidad, note='Unidad';if($('modeFilter').value==='pickpack'){const f=Number(item.factor||1);min=Math.ceil(min/f);max=Math.ceil(max/f);pres=item.pickpack;note=f>1?`Pick Pack ÷ ${f}`:'Pick Pack no aplica';}else{min=Math.ceil(min);max=Math.ceil(max);}
return {ideal:item.uso,min,max,diario,pres,note};}
function renderSelected(){
  const body=$('selectedBody');
  body.innerHTML='';
  state.selected.forEach((item,i)=>{
    const c=calc(item);
    body.insertAdjacentHTML('beforeend',`<tr><td class="num">${i+1}</td><td>${esc(item.art)}</td><td><b>${fmt(c.min)}</b></td><td><b>${fmt(c.max)}</b></td><td><span class="pill">${esc(c.pres)}</span><br><small>${esc(c.note)}</small></td><td class="no-print"><button class="del" onclick="removeItem(${i})">Quitar</button></td></tr>`);
  });
  renderMarkers();
}
function removeItem(i){state.selected.splice(i,1);renderSelected()}
window.removeItem=removeItem;
function renderMarkers(){const layer=$('markerLayer');layer.innerHTML='';state.selected.forEach((it,i)=>{const n=i+1;const pos=state.markerPos[n]||{x:8+(i%6)*14,y:10+Math.floor(i/6)*16};const el=document.createElement('div');el.className='marker';el.textContent=n;el.style.left=pos.x+'%';el.style.top=pos.y+'%';drag(el,n);layer.appendChild(el);});}
function drag(el,n){let on=false,dx=0,dy=0;el.addEventListener('pointerdown',e=>{on=true;el.setPointerCapture(e.pointerId);dx=e.offsetX;dy=e.offsetY});el.addEventListener('pointermove',e=>{if(!on)return;const rect=$('markerLayer').getBoundingClientRect();let x=(e.clientX-rect.left-dx)/rect.width*100;let y=(e.clientY-rect.top-dy)/rect.height*100;x=Math.max(0,Math.min(94,x));y=Math.max(0,Math.min(92,y));state.markerPos[n]={x,y};el.style.left=x+'%';el.style.top=y+'%';});el.addEventListener('pointerup',()=>on=false);}
function updateSubtitle(){const weeks=selectedWeeks().join(', ')||'Todas';$('subtitle').textContent=`${$('storeFilter').value} · Semanas ${weeks}`;}
function fmt(n){return Number(n||0).toLocaleString('es-MX',{maximumFractionDigits:1})}
function esc(s){return String(s??'').replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]))}
function clean(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'_').replace(/^_|_$/g,'')}
window.addEventListener('DOMContentLoaded',init);
