import { supabase } from './lib/supabase.js';

const TOKEN = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN || import.meta.env.VITE_MAPBOX_TOKEN || '';
let mapboxPromise;
function loadMapbox(){
  if(window.mapboxgl) return Promise.resolve(window.mapboxgl);
  if(mapboxPromise) return mapboxPromise;
  mapboxPromise=new Promise((resolve,reject)=>{
    const css=document.createElement('link');css.rel='stylesheet';css.href='https://api.mapbox.com/mapbox-gl-js/v3.30.0/mapbox-gl.css';document.head.appendChild(css);
    const script=document.createElement('script');script.src='https://api.mapbox.com/mapbox-gl-js/v3.30.0/mapbox-gl.js';script.onload=()=>resolve(window.mapboxgl);script.onerror=()=>reject(new Error('Map service could not load'));document.head.appendChild(script);
  });
  return mapboxPromise;
}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>v==null||v===''?null:Number(v);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function toast(msg){let el=document.querySelector('.eg-live-toast');if(!el){el=document.createElement('div');el.className='eg-live-toast';document.body.appendChild(el)}el.textContent=msg;el.classList.add('show');clearTimeout(window.__egLiveToast);window.__egLiveToast=setTimeout(()=>el.classList.remove('show'),3200)}
async function currentUser(){const {data}=await supabase.auth.getUser();return data?.user||null}
async function activeErrands(user){
  const {data,error}=await supabase.from('errands').select('*').or(`customer_id.eq.${user.id},runner_id.eq.${user.id}`).in('status',['accepted','runner_assigned','runner_going_to_pickup','arrived_at_pickup','in_progress','going_to_destination','arrived_at_destination']).order('updated_at',{ascending:false}).limit(5);
  if(error) console.error('[ErrandGo tracking]',error);
  return data||[];
}
function openTracking(errand){window.dispatchEvent(new CustomEvent('errandgo-open-tracking',{detail:errand}));}

async function getRoute(from,to){
  if(!TOKEN||!from||!to)return null;
  const url=`https://api.mapbox.com/directions/v5/mapbox/driving/${from[0]},${from[1]};${to[0]},${to[1]}?geometries=geojson&overview=full&steps=false&access_token=${encodeURIComponent(TOKEN)}`;
  const r=await fetch(url);if(!r.ok)throw new Error('Route unavailable');
  const j=await r.json();return j.routes?.[0]||null;
}
async function geocode(q){
  if(!TOKEN||!q)return [];
  const url=`https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(q)}&limit=5&autocomplete=true&access_token=${encodeURIComponent(TOKEN)}`;
  const r=await fetch(url);if(!r.ok)throw new Error('Address search unavailable');
  const j=await r.json();
  return (j.features||[]).map(f=>({label:f.properties?.full_address||f.properties?.name||f.place_name||'Location',lng:f.geometry.coordinates[0],lat:f.geometry.coordinates[1]}));
}
function markerEl(kind,label){
  const el=document.createElement('div');
  el.className=`eg-map-marker ${kind}`;
  const inner=document.createElement('div');
  inner.className='eg-marker-inner';
  inner.innerHTML=kind==='runner'
    ? '<div class="eg-runner-pulse"></div><span class="eg-runner-icon" aria-hidden="true">🛵</span>'
    : kind==='pickup'
      ? '<span class="eg-marker-glyph">●</span>'
      : kind==='destination'
        ? '<span class="eg-marker-glyph">◆</span>'
        : '<span class="eg-marker-glyph">⌖</span>';
  el.appendChild(inner);
  el.title=label||kind;
  el.setAttribute('aria-label',label||kind);
  return el;
}
function statusLabel(s){
  return ({open:'Requested',requested:'Requested',searching_for_runner:'Finding a runner',accepted:'Runner assigned',runner_assigned:'Runner assigned',runner_going_to_pickup:'Going to pickup',arrived_at_pickup:'Arrived at pickup',in_progress:'Errand in progress',going_to_destination:'Going to destination',arrived_at_destination:'Arrived at destination',completed:'Completed',cancelled:'Cancelled',disputed:'Disputed'})[s]||s;
}
function trackingMarkup(e,user){
  const active=e.status!=='completed'&&e.status!=='cancelled';
  const owner=user.id===e.customer_id;
  const runner=user.id===e.runner_id;
  const phase=statusLabel(e.status);
  return `<div class="eg-track-modal" role="dialog" aria-modal="true">
    <div class="eg-track-card">
      <button class="eg-track-close" aria-label="Close">×</button>
      <div class="eg-map-stage">
        <div class="eg-map" id="eg-map"></div>
        <div class="eg-map-topbar">
          <div class="eg-trip-chip"><span class="eg-trip-live"></span><b>${active?'LIVE TRACKING':'TRIP COMPLETE'}</b><small>ErrandGo</small></div>
          <button class="eg-map-control" data-map-style type="button" title="Change map view">◈</button>
        </div>
        <div class="eg-map-controls">
          <button class="eg-round-control" data-map-follow type="button" title="Follow runner">⌖</button>
          <button class="eg-round-control" data-map-recenter type="button" title="Recenter">◎</button>
        </div>
        <div class="eg-map-legend"><span class="eg-legend-pickup"></span>Pickup <span class="eg-legend-destination"></span>Drop-off</div>
      </div>

      <div class="eg-trip-sheet">
        <div class="eg-sheet-handle"></div>
        <div class="eg-trip-head">
          <div>
            <span class="eg-track-kicker">ERRAND ${active?'IN MOTION':'FINISHED'}</span>
            <h2>${esc(e.title)}</h2>
            <p class="eg-trip-status"><i></i>${esc(phase)} <span>•</span> <em id="eg-live-age">Updating live</em></p>
          </div>
          <div class="eg-trip-badge"><strong id="eg-eta">—</strong><small>ETA</small></div>
        </div>

        <div class="eg-progress-track">
          <span class="${['accepted','runner_assigned'].includes(e.status)?'active':''}"></span>
          <span class="${['runner_going_to_pickup','arrived_at_pickup'].includes(e.status)?'active':''}"></span>
          <span class="${['in_progress'].includes(e.status)?'active':''}"></span>
          <span class="${['going_to_destination','arrived_at_destination'].includes(e.status)?'active':''}"></span>
          <span class="${e.status==='completed'?'active':''}"></span>
        </div>

        <div class="eg-location-cards">
          <div><span class="eg-route-dot pickup"></span><div><small>Pickup</small><b>${esc(e.pickup_address||'Pickup location not set')}</b></div></div>
          <div><span class="eg-route-line"></span></div>
          <div><span class="eg-route-dot destination"></span><div><small>Drop-off</small><b>${esc(e.delivery_address||'Destination not set')}</b></div></div>
        </div>

        <div class="eg-trip-stats">
          <span><strong id="eg-distance">—</strong><small>Remaining</small></span>
          <span><strong id="eg-speed">—</strong><small>Runner speed</small></span>
          <span><strong id="eg-last">Waiting</strong><small>Location</small></span>
        </div>

        ${owner&&active?`<div class="eg-safety-row">
          <button type="button" data-share-trip>↗ Share live trip</button>
          <button type="button" data-safety>🛡 Safety</button>
        </div>
        <div class="eg-location-setup">
          <button data-location="pickup">Set pickup</button>
          <button data-location="destination">Set destination</button>
        </div>
        <div class="eg-address-search">
          <input data-geocode-input placeholder="Search a pickup or destination"/>
          <select data-geocode-kind><option value="pickup">Pickup</option><option value="destination">Destination</option></select>
          <button data-geocode-search>Search</button>
        </div>
        <div class="eg-geocode-results"></div>`:''}

        ${runner&&active?`<div class="eg-runner-tools">
          <div class="eg-driver-status"><span></span><div><b>You're live</b><small>ErrandGo is sharing your position with the customer</small></div></div>
          <button type="button" data-runner-follow>Keep me on route</button>
        </div>`:''}

        <div class="eg-track-actions">
          ${runner&&e.status==='accepted'?'<button data-runner-status="runner_going_to_pickup">Start trip</button>':''}
          ${runner&&e.status==='runner_going_to_pickup'?'<button data-runner-status="arrived_at_pickup">Arrived at pickup</button>':''}
          ${runner&&e.status==='arrived_at_pickup'?'<button data-runner-status="in_progress">Start errand</button>':''}
          ${runner&&e.status==='in_progress'?'<button data-runner-status="going_to_destination">Heading to destination</button>':''}
          ${runner&&e.status==='going_to_destination'?'<button data-runner-status="arrived_at_destination">Arrived at destination</button>':''}
          ${runner&&['going_to_destination','arrived_at_destination','in_progress'].includes(e.status)?'<button data-runner-status="completed">Complete errand</button>':''}
        </div>
      </div>
    </div>
  </div>`;
}
async function ensureMapCss(){}
async function mountMap(e,user){
  const mapEl=document.getElementById('eg-map');if(!mapEl)return;
  if(!TOKEN){mapEl.innerHTML='<div class="eg-map-missing"><b>Live map is almost ready.</b><span>Add VITE_MAPBOX_PUBLIC_TOKEN in Vercel and redeploy.</span></div>';return;}
  try{
    const mapbox=await loadMapbox();mapbox.accessToken=TOKEN;
    const pickup=e.pickup_longitude!=null&&e.pickup_latitude!=null?[e.pickup_longitude,e.pickup_latitude]:null;
    const destination=e.delivery_longitude!=null&&e.delivery_latitude!=null?[e.delivery_longitude,e.delivery_latitude]:null;
    const runnerStart=e.runner_id?await latestRunner(e.id):null;
    const center=runnerStart?[runnerStart.longitude,runnerStart.latitude]:pickup||destination?[...(pickup||destination)]:[7.4951,9.0579];
    const map=new mapbox.Map({
      container:mapEl,
      style:'mapbox://styles/mapbox/standard',
      center,
      zoom:pickup||destination?14:11,
      pitch:35,
      bearing:0,
      attributionControl:true,
      antialias:true
    });
    window.__egMap=map;
    map.addControl(new mapbox.NavigationControl({showCompass:true,showZoom:false,visualizePitch:true}),'bottom-right');

    const markers=[];
    const add=(coords,kind,label)=>{if(!coords)return null;const m=new mapbox.Marker({element:markerEl(kind,label),anchor:'center'}).setLngLat(coords).addTo(map);markers.push(m);return m};
    add(pickup,'pickup',e.pickup_address);
    add(destination,'destination',e.delivery_address);
    let runnerMarker=add(runnerStart?[runnerStart.longitude,runnerStart.latitude]:null,'runner','Runner');

    const fit=()=>{const pts=[pickup,destination,runnerMarker?.getLngLat&&[runnerMarker.getLngLat().lng,runnerMarker.getLngLat().lat]].filter(Boolean);if(pts.length>1){const b=pts.reduce((b,p)=>b.extend(p),new mapbox.LngLatBounds(pts[0],pts[0]));map.fitBounds(b,{padding:{top:100,bottom:300,left:45,right:45},maxZoom:16,duration:900,pitch:35})}};
    const follow=()=>{
      window.__egTrackingFollowing=true;
      const p=runnerMarker?.getLngLat();
      if(p)map.easeTo({center:p,zoom:16,pitch:48,duration:800});
    };
    map.on('dragstart',()=>{window.__egTrackingFollowing=false});
    map.on('zoomstart',()=>{window.__egTrackingFollowing=false});

    map.once('load',async()=>{
      const routeTarget=['runner_going_to_pickup','arrived_at_pickup'].includes(e.status)?pickup:destination;
      await drawRoute(map,pickup||runnerStart&&[runnerStart.longitude,runnerStart.latitude],routeTarget,runnerStart);
      fit();
    });

    document.querySelector('[data-map-recenter]')?.addEventListener('click',fit);
    document.querySelector('[data-map-follow]')?.addEventListener('click',follow);
    document.querySelector('[data-runner-follow]')?.addEventListener('click',follow);
    document.querySelector('[data-map-style]')?.addEventListener('click',()=>{toast('Map style is optimized for live delivery tracking.')});

    document.querySelectorAll('[data-location]').forEach(btn=>btn.addEventListener('click',()=>chooseLocation(e,btn.dataset.location,map)));

    document.querySelector('[data-share-trip]')?.addEventListener('click',async()=>{
      const url=location.href;
      if(navigator.share){try{await navigator.share({title:'ErrandGo live trip',text:'Track this ErrandGo delivery live.',url})}catch{}}
      else if(navigator.clipboard){await navigator.clipboard.writeText(url);toast('Live trip link copied.')}
      else toast('Share is not available on this device.');
    });
    document.querySelector('[data-safety]')?.addEventListener('click',()=>toast('Safety tools: use Support if you need immediate help.'));

    document.querySelector('[data-geocode-search]')?.addEventListener('click',async()=>{
      const input=document.querySelector('[data-geocode-input]'),kind=document.querySelector('[data-geocode-kind]')?.value||'pickup',box=document.querySelector('.eg-geocode-results');
      if(!input?.value.trim()||!box)return;
      box.innerHTML='<span>Searching…</span>';
      try{const results=await geocode(input.value.trim());box.innerHTML=results.length?results.map((r,i)=>`<button data-result-index="${i}">${esc(r.label)}</button>` ).join(''):'<span>No matching places found.</span>';
        box.querySelectorAll('[data-result-index]').forEach((btn,i)=>btn.addEventListener('click',async()=>{const r=results[i];await saveChosenLocation(e,kind,r.lat,r.lng,r.label);}));
      }catch(err){box.innerHTML='<span>Address search is unavailable right now.</span>';console.warn(err)}
    });

    if(e.status!=='completed'&&e.status!=='cancelled'&&user.id===e.runner_id) await startRunnerTracking(e,map,runnerMarker);
    else if(e.runner_id) await subscribeRunner(e,map,runnerMarker);

    return ()=>{markers.forEach(m=>m.remove());map.remove();};
  }catch(err){console.error(err);mapEl.innerHTML='<div class="eg-map-missing"><b>Map could not load.</b><span>Check the Mapbox public token and network connection.</span></div>'}
}
async function drawRoute(map,from,to,runner=null){
  const routeFrom=runner?[runner.longitude,runner.latitude]:from;
  if(!routeFrom||!to)return;
  try{
    const route=await getRoute(routeFrom,to);if(!route)return;
    const id='eg-route';
    if(map.getSource(id)){if(map.getLayer(id+'-glow'))map.removeLayer(id+'-glow');if(map.getLayer(id))map.removeLayer(id);map.removeSource(id)}
    map.addSource(id,{type:'geojson',data:{type:'Feature',geometry:route.geometry}});
    map.addLayer({id:id+'-glow',type:'line',source:id,paint:{'line-color':'#b8ff00','line-width':13,'line-opacity':.16,'line-blur':5,'line-cap':'round','line-join':'round'}});
    map.addLayer({id,type:'line',source:id,paint:{'line-color':'#8d4dff','line-width':6,'line-opacity':.92,'line-cap':'round','line-join':'round'}});
    document.getElementById('eg-distance').textContent=`${(route.distance/1000).toFixed(1)} km`;
    document.getElementById('eg-eta').textContent=`${Math.max(1,Math.round(route.duration/60))} min`;
  }catch(e){console.warn('[ErrandGo route]',e)}
}
async function latestRunner(errandId){const{data}=await supabase.from('runner_locations').select('*').eq('errand_id',errandId).order('recorded_at',{ascending:false}).limit(1).maybeSingle();return data||null}
async function subscribeRunner(e,map,marker){
  if(!marker)return;
  const ch=supabase.channel(`runner-location-${e.id}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'runner_locations',filter:`errand_id=eq.${e.id}`},async payload=>{
    const p=payload.new;if(!p)return;
    const next=[p.longitude,p.latitude],current=marker.getLngLat();
    const heading=p.heading==null?null:Number(p.heading);
    animateMarker(marker,[current.lng,current.lat],next,900,heading);
    document.getElementById('eg-last')?.replaceChildren(document.createTextNode('Live'));
    document.getElementById('eg-live-age')?.replaceChildren(document.createTextNode('Just now'));
    document.getElementById('eg-speed')?.replaceChildren(document.createTextNode(p.speed!=null?`${Math.round(Number(p.speed)*3.6)} km/h`:'—'));
    if(window.__egTrackingFollowing){
      map.easeTo({center:next,duration:850,zoom:15.5,pitch:42});
    }
    const target=e.status==='runner_going_to_pickup'||e.status==='arrived_at_pickup'?[e.pickup_longitude,e.pickup_latitude]:[e.delivery_longitude,e.delivery_latitude];
    if(target[0]!=null&&target[1]!=null){
      try{const route=await getRoute(next,target);if(route){
        document.getElementById('eg-distance').textContent=`${(route.distance/1000).toFixed(1)} km`;
        document.getElementById('eg-eta').textContent=`${Math.max(1,Math.round(route.duration/60))} min`;
        const src=map.getSource('eg-route');if(src)src.setData({type:'Feature',geometry:route.geometry});
      }}catch{}
    }
  }).subscribe();
  window.__egTrackChannel=ch;
}
function animateMarker(marker,from,to,duration,heading=null){const started=performance.now();function frame(now){const t=Math.min(1,(now-started)/duration);const ease=t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;marker.setLngLat([from[0]+(to[0]-from[0])*ease,from[1]+(to[1]-from[1])*ease]);if(heading!=null){const inner=marker.getElement().querySelector('.eg-runner-icon');if(inner)inner.style.transform=`rotate(${heading}deg)`;}if(t<1)requestAnimationFrame(frame)}requestAnimationFrame(frame)}
async function startRunnerTracking(e,map,marker){
  if(!navigator.geolocation){toast('GPS is not available on this device.');return;}
  const permission=await navigator.permissions?.query?.({name:'geolocation'}).catch(()=>null);
  if(permission?.state==='denied'){toast('Location is blocked. Enable location permission in your browser settings.');return;}
  try{await supabase.rpc('set_runner_status',{p_status:'BUSY'})}catch{}
  let last=null,lastSent=0;
  const send=async pos=>{
    const c=pos.coords;const now=Date.now();const moved=!last||distance(last.lat,last.lng,c.latitude,c.longitude)>=.05;const timed=now-lastSent>=10000;
    if(moved||timed){last={lat:c.latitude,lng:c.longitude};lastSent=now;const{error}=await supabase.rpc('record_runner_location',{p_errand_id:e.id,p_latitude:c.latitude,p_longitude:c.longitude,p_heading:c.heading,p_speed:c.speed,p_accuracy:c.accuracy});if(error)console.warn('[ErrandGo location]',error);}
    if(marker){const cur=marker.getLngLat();animateMarker(marker,[cur.lng,cur.lat],[c.longitude,c.latitude],700);}
    document.getElementById('eg-last')?.replaceChildren(document.createTextNode('Live'));
  };
  const watch=navigator.geolocation.watchPosition(send,err=>{console.warn(err);toast('Runner location temporarily unavailable.');},{enableHighAccuracy:true,maximumAge:5000,timeout:15000});
  window.__egGeoWatch=watch;
  window.addEventListener('beforeunload',()=>navigator.geolocation.clearWatch(watch),{once:true});
}
function distance(a,b,c,d){const R=6371;const p1=a*Math.PI/180,p2=c*Math.PI/180,dp=(c-a)*Math.PI/180,dl=(d-b)*Math.PI/180;const x=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x))}
async function saveChosenLocation(e,kind,lat,lng,address){
  const user=await currentUser();if(!user)return;
  const field=kind==='pickup'?{pickup_latitude:lat,pickup_longitude:lng,pickup_address:address}:{delivery_latitude:lat,delivery_longitude:lng,delivery_address:address};
  const {error}=await supabase.from('errands').update(field).eq('id',e.id).eq('customer_id',user.id);
  if(error)toast(error.message);else{toast(`${kind==='pickup'?'Pickup':'Destination'} saved.`);window.location.reload();}
}
async function chooseLocation(e,kind,map){
  if(!navigator.geolocation){toast('Your device does not provide GPS.');return;}
  toast(`Tap the map to set ${kind==='pickup'?'pickup':'destination'}.`);
  const handler=async ev=>{
    const {lng,lat}=ev.lngLat;
    const rev=await fetch(`https://api.mapbox.com/search/geocode/v6/reverse?longitude=${lng}&latitude=${lat}&limit=1&access_token=${encodeURIComponent(TOKEN)}`).then(r=>r.json()).catch(()=>({}));
    const address=rev.features?.[0]?.properties?.full_address||`${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    const field=kind==='pickup'?{pickup_latitude:lat,pickup_longitude:lng,pickup_address:address}:{delivery_latitude:lat,delivery_longitude:lng,delivery_address:address};
    const{error}=await supabase.from('errands').update(field).eq('id',e.id).eq('customer_id',(await currentUser()).id);
    if(error)toast(error.message);else{toast(`${kind==='pickup'?'Pickup':'Destination'} saved.`);window.location.reload();}
    map.off('click',handler);
  };
  map.once('click',handler);
}
async function showForActiveUser(){
  if(!supabase)return;const user=await currentUser();if(!user)return;
  const list=await activeErrands(user);if(!list.length){removeAvailabilityPill();document.querySelector('.eg-active-pill')?.remove();return;}
  document.querySelector('.eg-availability-pill')?.remove();
  if(document.querySelector('.eg-active-pill'))return;
  const pill=document.createElement('button');pill.className='eg-active-pill';pill.innerHTML='<span></span> Live errand';pill.addEventListener('click',()=>openTracking(list[0]));document.body.appendChild(pill);
}
let modalCleanup=null;
window.addEventListener('errandgo-open-tracking',async ev=>{
  const user=await currentUser();if(!user||!ev.detail)return;
  if(modalCleanup)modalCleanup();
  const wrap=document.createElement('div');wrap.innerHTML=trackingMarkup(ev.detail,user);document.body.appendChild(wrap.firstElementChild);
  const modal=document.querySelector('.eg-track-modal');const close=()=>{if(window.__egTrackChannel)supabase.removeChannel(window.__egTrackChannel);if(window.__egGeoWatch)navigator.geolocation.clearWatch(window.__egGeoWatch);modal?.remove();modalCleanup=null};modalCleanup=close;
  modal.querySelector('.eg-track-close').addEventListener('click',close);
  modal.querySelectorAll('[data-runner-status]').forEach(btn=>btn.addEventListener('click',async()=>{
    btn.disabled=true;
    const next=btn.dataset.runnerStatus;
    const {data,error}=await supabase.rpc('transition_errand_status',{p_errand_id:ev.detail.id,p_status:next});
    if(error){toast(error.message);btn.disabled=false;return}
    toast(`Errand updated: ${statusLabel(next)}`);
    close();
    setTimeout(()=>openTracking(data),120);
  }));
  await mountMap(ev.detail,user);
});
setInterval(showForActiveUser,5000);
showForActiveUser();

let availabilityWatch=null,availabilityLast=null,availabilityLastSent=0;
function removeAvailabilityPill(){document.querySelector('.eg-availability-pill')?.remove()}
async function setAvailability(status){
  const {error}=await supabase.rpc('set_runner_status',{p_status:status});
  if(error){toast(error.message);return false}
  if(status==='ONLINE') startAvailabilityTracking(); else stopAvailabilityTracking();
  renderAvailability(status);
  return true;
}
function renderAvailability(status){
  removeAvailabilityPill();
  const pill=document.createElement('button');pill.className='eg-availability-pill';
  if(status==='ONLINE'){pill.innerHTML='<span class="online-dot"></span><b>Online</b><small>Tap to go offline</small>';pill.addEventListener('click',()=>setAvailability('OFFLINE'))}
  else{pill.innerHTML='<span>⚡</span><b>Available for errands</b><small>Go online</small>';pill.addEventListener('click',()=>setAvailability('ONLINE'))}
  document.body.appendChild(pill);
}
function stopAvailabilityTracking(){if(availabilityWatch!=null){navigator.geolocation.clearWatch(availabilityWatch);availabilityWatch=null}availabilityLast=null;availabilityLastSent=0}
function startAvailabilityTracking(){
  stopAvailabilityTracking();
  if(!navigator.geolocation){toast('GPS is unavailable. You can still receive errands without live availability.');return}
  availabilityWatch=navigator.geolocation.watchPosition(async pos=>{
    const c=pos.coords,now=Date.now();
    const moved=!availabilityLast||distance(availabilityLast.lat,availabilityLast.lng,c.latitude,c.longitude)>=.1;
    if(moved||now-availabilityLastSent>=30000){
      availabilityLast={lat:c.latitude,lng:c.longitude};availabilityLastSent=now;
      const {error}=await supabase.rpc('update_runner_presence',{p_latitude:c.latitude,p_longitude:c.longitude,p_accuracy:c.accuracy});
      if(error)console.warn('[ErrandGo availability]',error);
    }
  },()=>toast('Location is unavailable. You can still stay online; update your location when GPS returns.'),{enableHighAccuracy:false,maximumAge:15000,timeout:15000});
}
async function showAvailability(){
  if(!supabase||document.querySelector('.eg-track-modal'))return;
  const user=await currentUser();if(!user)return;
  const active=await activeErrands(user);if(active.length){removeAvailabilityPill();return}
  const {data}=await supabase.from('profiles').select('runner_status').eq('id',user.id).maybeSingle();
  const status=data?.runner_status||'OFFLINE';
  if(!document.querySelector('.eg-availability-pill'))renderAvailability(status);
}
window.addEventListener('beforeunload',()=>{stopAvailabilityTracking()},{once:true});

setInterval(showAvailability,7000);
showAvailability();
