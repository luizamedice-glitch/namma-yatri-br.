// SPDX-License-Identifier: AGPL-3.0-or-later
import {mapPayload} from './TripMap.mjs';
let current=null,latest=null,lastPolyline='',ready=false,callback,lastCamera='';
function allowed(){try{return window.__OS==='ANDROID'&&window.__YATRI_BR_DEVELOPMENT__===true&&
  ['in.juspay.nammayatri.debug','in.juspay.nammayatripartner.debug'].includes(JSON.parse(window.JBridge.getDeviceInfo()).package_name);}catch(_){return false;}}
function fitCamera(id,trip){
  if(!ready||current!==id)return;
  const bounds=JSON.parse(window.JBridge.getLayoutBounds(id));
  if(bounds.width<100||bounds.height<100)return;
  const points=mapPayload(trip,id).routeConfigs[0].locations.points.slice();
  if(trip.gpsFresh)points.push({lat:trip.driverLat,lng:trip.driverLng});
  if(!points.length)return;
  const xs=points.map(p=>(p.lng+180)/360);
  const ys=points.map(p=>(1-Math.log(Math.tan(Math.PI/4+Math.max(-85,Math.min(85,p.lat))*Math.PI/360))/Math.PI)/2);
  const xmin=Math.min.apply(null,xs),xmax=Math.max.apply(null,xs),ymin=Math.min.apply(null,ys),ymax=Math.max.apply(null,ys);
  const zoom=Math.max(7,Math.min(18,Math.log2((bounds.width-96)/(256*Math.max(xmax-xmin,0.000001))),
    Math.log2((bounds.height-96)/(256*Math.max(ymax-ymin,0.000001)))));
  const lat=Math.atan(Math.sinh(Math.PI*(1-ymin-ymax)))*180/Math.PI;
  window.JBridge.animateCamera(lat,(xmin+xmax)*180-180,zoom,'ZOOM');
  lastCamera=JSON.stringify([trip.polyline,trip.gpsFresh,trip.driverLat,trip.driverLng]);
}
function draw(){
  if(!allowed()||!ready||!latest||!current)return;
  try{
    if(lastPolyline!==latest.polyline){
      window.JBridge.removeAllPolylines(JSON.stringify({gmapPursId:current,markersToRemove:['br-origin','br-destination'],polyLinesToRemove:[]}));
      const payload=mapPayload(latest,current);
      if(payload.routeConfigs[0].locations.points.length>=2)window.JBridge.drawRouteV2(JSON.stringify(payload));
      lastPolyline=latest.polyline;
    }
    if(latest.gpsFresh)window.JBridge.showMarker(JSON.stringify({purescriptId:current,lat:String(latest.driverLat),lng:String(latest.driverLng),
      markerSize:100,anchorV:0.5,anchorV1:0.5,markerConfig:{markerId:'br-live-driver',pointerIcon:'ny_ic_vehicle_nav_on_map',rotation:'0',zIndex:10,animationConfig:{animationType:'NONE',animationDuration:0}}}));
    else window.JBridge.removeMarker('br-live-driver');
    const cameraKey=JSON.stringify([latest.polyline,latest.gpsFresh,latest.driverLat,latest.driverLng]);
    if(cameraKey!==lastCamera){const owner=current,trip=latest;setTimeout(()=>{
      if(current===owner&&latest===trip)try{fitCamera(owner,trip);}catch(_){}
    },150);}
    window.__YATRI_TRIP_MAP__={ready:true,routePoints:lastPolyline?mapPayload(latest,current).routeConfigs[0].locations.points.length:0,
      gpsFresh:latest.gpsFresh,driverLat:latest.driverLat,driverLng:latest.driverLng,phase:latest.phase};
  }catch(_){window.__YATRI_TRIP_MAP__={ready:false,error:'Não foi possível desenhar o mapa da viagem.'};}
}
export const mountMapWithMapper=(id,mapCallback)=>{
  if(!allowed()||current===id)return;
  current=id;ready=false;lastPolyline='';lastCamera='';window.__YATRI_TRIP_MAP__={ready:false};
  callback=mapCallback(key=>{if(current===id&&key==='MAP'){ready=true;draw();}});
  window.JBridge.showMap(id,false,'normal',15,callback,'{}');
};
export const updateTripMap=trip=>{latest=trip;draw();};
export const releaseTripMap=()=>{
  if(current&&allowed())window.JBridge.removeAllPolylines(JSON.stringify({gmapPursId:current,
    markersToRemove:['br-live-driver','br-origin','br-destination'],polyLinesToRemove:[]}));
  current=null;latest=null;ready=false;lastPolyline='';lastCamera='';if(allowed())window.__YATRI_TRIP_MAP__={ready:false};
  if(callback){const registry=window.__PROXY_FN;if(registry instanceof Map)registry.delete(callback);else if(registry)delete registry[callback];callback=null;}
};
