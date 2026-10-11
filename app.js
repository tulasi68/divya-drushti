(() => {
"use strict";
const $ = id => document.getElementById(id);
const state = { position:null, watchId:null, recognition:null, destination:null, maneuvers:[], geometry:[], step:0, routeActive:false, cameraStream:null, cameraTimer:null, lastSpoken:"" };
const lang = () => $("language").value;
function say(message, remember=true) {
  if (!("speechSynthesis" in window)) { setStatus("Speech output is not supported by this browser."); return; }
  if (remember) state.lastSpoken = message;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(message);
  utterance.lang = lang(); utterance.rate = 0.88; utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
  $("instruction").textContent = message;
}
function setStatus(message) { $("status").textContent = message; }
function distanceM(a,b) {
  const rad = n => n * Math.PI / 180, R=6371000;
  const dLat=rad(b.lat-a.lat), dLon=rad(b.lon-a.lon);
  const x=Math.sin(dLat/2)**2 + Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLon/2)**2;
  return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
}
function getPosition() {
  return new Promise((resolve,reject) => {
    if (!navigator.geolocation) return reject(new Error("Location is not supported by this browser."));
    setStatus("Requesting your location…");
    navigator.geolocation.getCurrentPosition(pos => {
      state.position={lat:pos.coords.latitude,lon:pos.coords.longitude,accuracy:pos.coords.accuracy};
      $("locationText").textContent="Location received (GPS accuracy about "+Math.round(pos.coords.accuracy)+" metres).";
      setStatus("Location ready.");
      resolve(state.position);
    }, err => reject(new Error(err.code===1?"Location permission was denied. Please allow location in browser settings.":"Could not get GPS location. Move outdoors and try again.")), {enableHighAccuracy:true,timeout:20000,maximumAge:5000});
  });
}
async function reverseGeocode(p) {
  const url="https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat="+encodeURIComponent(p.lat)+"&lon="+encodeURIComponent(p.lon);
  const res=await fetch(url,{headers:{"Accept":"application/json"}});
  if(!res.ok) throw new Error("Place lookup is temporarily unavailable.");
  return (await res.json()).display_name || "Your current location";
}
async function speakLocation() {
  try { const p=await getPosition(); const name=await reverseGeocode(p); $("locationText").textContent=name; say("Your current location is: "+name); }
  catch(e){setStatus(e.message);say(e.message);}
}
function makeRecognition() {
  const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!Recognition) return null;
  const r=new Recognition(); r.lang=lang(); r.interimResults=false; r.maxAlternatives=1; return r;
}
function startVoice() {
  say("Welcome to Divya Dhrushti. I will request your location. After that, tell me your destination.");
  getPosition().then(async p=>{
    try { const place=await reverseGeocode(p); $("locationText").textContent=place; say("You are near "+place+". Where would you like to go?"); listenForDestination(); }
    catch(e){say("Your GPS location is ready. Tell me or type your destination.");listenForDestination();}
  }).catch(e=>{setStatus(e.message);say(e.message+" You can still type a destination.");});
}
function listenForDestination() {
  const r=makeRecognition();
  if(!r){setStatus("Voice input is not supported here. Type the destination instead.");return;}
  state.recognition=r; r.onstart=()=>setStatus("Listening for your destination…");
  r.onresult=e=>{const text=e.results[0][0].transcript;$("destination").value=text;setStatus("I heard: "+text);searchDestination(text);};
  r.onerror=e=>setStatus("Voice input stopped ("+e.error+"). You can type the destination.");
  r.onend=()=>{if(!state.destination && !$("destination").value) setStatus("Ready. Type your destination or tap Start voice guide again.");};
  try{r.start();}catch(e){setStatus("Voice input is already active or unavailable. Type your destination.");}
}
async function searchDestination(query) {
  if(!query.trim()){say("Please say or type a destination.");return;}
  $("results").replaceChildren(); $("routeSummary").hidden=true; $("beginRouteBtn").disabled=true;
  setStatus("Searching for "+query+"…");
  try {
    const url="https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q="+encodeURIComponent(query);
    const res=await fetch(url,{headers:{"Accept":"application/json"}});
    if(!res.ok) throw new Error("Place search is temporarily unavailable.");
    const places=await res.json();
    if(!places.length){setStatus("No matching places found. Try a fuller address or landmark.");say("I could not find that place. Please try another name.");return;}
    places.forEach(place=>{
      const btn=document.createElement("button");btn.type="button";btn.className="place";
      const title=document.createElement("strong");title.textContent=place.name||place.display_name.split(",")[0];
      const detail=document.createElement("span");detail.textContent=place.display_name;
      btn.append(title,detail);btn.addEventListener("click",()=>selectDestination(place));$("results").append(btn);
    });
    setStatus(places.length+" possible destinations found. Choose the correct one.");
    say("I found "+places.length+" possible places. Please choose your destination on the screen.");
  }catch(e){setStatus(e.message);say(e.message);}
}
function selectDestination(place) {
  state.destination={lat:Number(place.lat),lon:Number(place.lon),name:place.display_name};
  $("destination").value=place.name||place.display_name;
  $("results").replaceChildren();
  $("routeSummary").hidden=false;$("routeSummary").textContent="Selected: "+place.display_name;
  $("beginRouteBtn").disabled=false;
  say("Destination selected: "+place.display_name+". I will calculate a walking route.");
  buildRoute();
}
async function buildRoute() {
  try {
    if(!state.position) await getPosition();
    if(!state.destination) return;
    setStatus("Calculating a pedestrian route…");
    const response=await fetch("https://valhalla1.openstreetmap.de/route",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({locations:[{lat:state.position.lat,lon:state.position.lon},{lat:state.destination.lat,lon:state.destination.lon}],costing:"pedestrian",units:"kilometers",shape_format:"geojson",directions_options:{language:"en-US"}})
    });
    if(!response.ok) throw new Error("The public route service is unavailable. Please try again later.");
    const data=await response.json();
    const leg=data.trip&&data.trip.legs&&data.trip.legs[0];
    if(!leg||!leg.maneuvers||!leg.maneuvers.length) throw new Error("No walking route was returned for this destination.");
    state.maneuvers=leg.maneuvers;state.geometry=(leg.shape&&leg.shape.coordinates)||[];state.step=0;
    const km=data.trip.summary&&data.trip.summary.length;
    $("routeSummary").textContent="Walking route ready"+(Number.isFinite(km)?": about "+(km<1?Math.round(km*1000)+" metres":km.toFixed(1)+" km"):"")+". Step counts are rough estimates only.";
    $("beginRouteBtn").disabled=false;setStatus("Route ready. Tap Begin spoken directions when you are ready.");
    say("Walking route ready. Tap Begin spoken directions to start.");
  }catch(e){setStatus(e.message);say(e.message);}
}
function maneuverPoint(m) {
  const idx=Math.min(Math.max(0,Number(m.end_shape_index)||0),state.geometry.length-1);
  const c=state.geometry[idx]; return c?{lat:c[1],lon:c[0]}:null;
}
function instructionFor(m) {
  const text=m.instruction||"Continue along the route.";
  const meters=Math.max(0,(Number(m.length)||0)*1000);
  const steps=Math.round(meters/0.7);
  return meters>=8?text+" (approximately "+steps+" steps; this is only a distance estimate.)":text;
}
function beginRoute() {
  if(!state.maneuvers.length){say("Please select a destination and wait for the walking route.");return;}
  state.routeActive=true;state.step=0;
  say(instructionFor(state.maneuvers[0]));
  if(state.watchId!==null) navigator.geolocation.clearWatch(state.watchId);
  state.watchId=navigator.geolocation.watchPosition(onPosition,error=>setStatus("GPS update unavailable. "+error.message),{enableHighAccuracy:true,maximumAge:1500,timeout:15000});
  setStatus("Spoken guidance is active. Keep the phone accessible and stay aware of your surroundings.");
}
function onPosition(pos) {
  state.position={lat:pos.coords.latitude,lon:pos.coords.longitude,accuracy:pos.coords.accuracy};
  if(!state.routeActive) return;
  const m=state.maneuvers[state.step]; if(!m) return;
  const target=maneuverPoint(m); if(!target) return;
  const remaining=distanceM(state.position,target);
  if(remaining<25) {
    state.step++;
    if(state.step>=state.maneuvers.length) {
      state.routeActive=false; say("You may have arrived at your destination. Please confirm your surroundings independently.");setStatus("Route guidance ended.");return;
    }
    say(instructionFor(state.maneuvers[state.step]));
  }
}
function stopAll() {
  state.routeActive=false;
  if(state.watchId!==null){navigator.geolocation.clearWatch(state.watchId);state.watchId=null;}
  if(state.recognition){try{state.recognition.stop();}catch(e){}}
  window.speechSynthesis&&window.speechSynthesis.cancel();
  setStatus("Guidance stopped.");
}
async function startCamera() {
  try {
    if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia) throw new Error("Camera access is not supported by this browser.");
    state.cameraStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}},audio:false});
    const video=$("camera");video.srcObject=state.cameraStream;video.hidden=false;await video.play();
    $("cameraBtn").disabled=true;$("cameraStopBtn").disabled=false;
    $("cameraStatus").textContent="Camera on. Snapshots are processed only in this page; no image-description service is connected.";
    const capture=()=>{
      if(!video.videoWidth||!video.videoHeight)return;
      const canvas=$("snapshot");canvas.width=Math.min(video.videoWidth,640);canvas.height=Math.round(canvas.width*video.videoHeight/video.videoWidth);
      canvas.getContext("2d").drawImage(video,0,0,canvas.width,canvas.height);
      $("cameraStatus").textContent="Latest snapshot captured locally at "+new Date().toLocaleTimeString()+". No visual description is available in this version.";
    };
    capture();state.cameraTimer=setInterval(capture,8000);
    say("Camera snapshots started. I can capture pictures, but this version cannot describe what they show.");
  }catch(e){$("cameraStatus").textContent=e.message; say(e.message);}
}
function stopCamera() {
  if(state.cameraTimer)clearInterval(state.cameraTimer);state.cameraTimer=null;
  if(state.cameraStream)state.cameraStream.getTracks().forEach(track=>track.stop());state.cameraStream=null;
  $("camera").srcObject=null;$("camera").hidden=true;$("cameraBtn").disabled=false;$("cameraStopBtn").disabled=true;
  $("cameraStatus").textContent="Camera is off.";
}
$("startBtn").addEventListener("click",startVoice);
$("locBtn").addEventListener("click",speakLocation);
$("destinationForm").addEventListener("submit",e=>{e.preventDefault();searchDestination($("destination").value);});
$("beginRouteBtn").addEventListener("click",beginRoute);
$("repeatBtn").addEventListener("click",()=>{if(state.lastSpoken)say(state.lastSpoken,false);});
$("stopBtn").addEventListener("click",stopAll);
$("cameraBtn").addEventListener("click",startCamera);
$("cameraStopBtn").addEventListener("click",stopCamera);
$("language").addEventListener("change",()=>{if(state.recognition)state.recognition.lang=lang();});
if("serviceWorker" in navigator && location.protocol!=="file:") navigator.serviceWorker.register("./sw.js").catch(()=>{});
})();