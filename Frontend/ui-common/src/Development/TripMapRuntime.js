// SPDX-License-Identifier: AGPL-3.0-or-later
import {mapPayload} from './TripMap.mjs';
let current=null,latest=null,lastPolyline='',ready=false,callback;
function allowed(){try{return window.__OS==='ANDROID'&&window.__YATRI_BR_DEVELOPMENT__===true&&
  ['in.juspay.nammayatri.debug','in.juspay.nammayatripartner.debug'].includes(JSON.parse(window.JBridge.getDeviceInfo()).package_name);}catch(_){return false;}}
function draw(){
  if(!allowed()||!ready||!latest||!current)return;
  try{
    if(lastPolyline!==latest.polyline){
      window.JBridge.removeAllPolylines(JSON.stringify({gmapPursId:current,markersToRemove:[],polyLinesToRemove:[]}));
      const payload=mapPayload(latest,current);
      if(payload.routeConfigs[0].locations.points.length>=2)window.JBridge.drawRouteV2(JSON.stringify(payload));
      lastPolyline=latest.polyline;
    }
    if(latest.gpsFresh)window.JBridge.showMarker(JSON.stringify({purescriptId:current,lat:String(latest.driverLat),lng:String(latest.driverLng),
      markerSize:100,anchorV:0.5,anchorV1:0.5,markerConfig:{markerId:'br-live-driver',pointerIcon:'ny_ic_vehicle_nav_on_map',rotation:'0',zIndex:10,animationConfig:{animationType:'NONE',animationDuration:0}}}));
    else window.JBridge.removeMarker('br-live-driver');
    window.__YATRI_TRIP_MAP__={ready:true,routePoints:lastPolyline?mapPayload(latest,current).routeConfigs[0].locations.points.length:0,
      gpsFresh:latest.gpsFresh,driverLat:latest.driverLat,driverLng:latest.driverLng,phase:latest.phase};
  }catch(_){window.__YATRI_TRIP_MAP__={ready:false,error:'Não foi possível desenhar o mapa da viagem.'};}
}
export const mountMapWithMapper=(id,mapCallback)=>{
  if(!allowed()||current===id)return;
  current=id;ready=false;lastPolyline='';window.__YATRI_TRIP_MAP__={ready:false};
  callback=mapCallback(key=>{if(current===id&&key==='MAP'){ready=true;draw();}});
  window.JBridge.showMap(id,false,'normal',15,callback,'{}');
};
export const updateTripMap=trip=>{latest=trip;draw();};
export const releaseTripMap=()=>{
  if(current&&allowed())window.JBridge.removeAllPolylines(JSON.stringify({gmapPursId:current,
    markersToRemove:['br-live-driver','br-origin','br-destination'],polyLinesToRemove:[]}));
  current=null;latest=null;ready=false;lastPolyline='';if(allowed())window.__YATRI_TRIP_MAP__={ready:false};
  if(callback){const registry=window.__PROXY_FN;if(registry instanceof Map)registry.delete(callback);else if(registry)delete registry[callback];callback=null;}
};
