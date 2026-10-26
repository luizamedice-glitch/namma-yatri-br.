// SPDX-License-Identifier: AGPL-3.0-or-later
import {mapPayload} from './TripMap.mjs';
let current=null,latest=null,lastPolyline='',ready=false,callback,lastCamera='',lastRoute=null,vehiclePoint=null,vehicleHeading=0;
function allowed(){try{return window.__OS==='ANDROID'&&window.__YATRI_BR_DEVELOPMENT__===true&&
  ['in.juspay.nammayatri.debug','in.juspay.nammayatripartner.debug'].includes(JSON.parse(window.JBridge.getDeviceInfo()).package_name);}catch(_){return false;}}
function passenger(){try{return JSON.parse(window.JBridge.getDeviceInfo()).package_name==='in.juspay.nammayatri.debug';}catch(_){return false;}}
function markerIds(){return passenger()?['br-origin','br-destination','ny_ic_source_dot','ny_ic_destination','ny_ic_src_marker','ny_ic_dest_marker']:['br-origin','br-destination'];}
function showPoint(id,point,icon,size,anchor=0.5,rotation=0){
  const scale=Math.max(1,Math.min(4,Number(window.devicePixelRatio)||1));
  window.JBridge.showMarker(JSON.stringify({purescriptId:current,lat:String(point.lat),lng:String(point.lng),
    markerSize:Math.round(size*scale),anchorV:0.5,anchorV1:anchor,
    markerConfig:{markerId:id,pointerIcon:icon,rotation:String(rotation),zIndex:id==='br-live-driver'?10:7,
      animationConfig:{animationType:'NONE',animationDuration:0}}}));
}
function cameraKey(trip){return JSON.stringify(passenger()?[trip.polyline,['accepted','arrived'].includes(trip.phase)]:[trip.polyline,trip.gpsFresh,trip.driverLat,trip.driverLng]);}
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
  // Native getLayoutBounds already returns dp, matching Google camera world units.
  const padding=48;
  const zoom=Math.max(7,Math.min(18,Math.log2(Math.max(1,bounds.width-2*padding)/(256*Math.max(xmax-xmin,0.000001))),
    Math.log2(Math.max(1,bounds.height-2*padding)/(256*Math.max(ymax-ymin,0.000001)))));
  const lat=Math.atan(Math.sinh(Math.PI*(1-ymin-ymax)))*180/Math.PI;
  window.JBridge.animateCamera(lat,(xmin+xmax)*180-180,zoom,'ZOOM');
  lastCamera=cameraKey(trip);
}
function draw(){
  if(!allowed()||!ready||!latest||!current)return;
  try{
    const isPassenger=passenger(),pickup=['accepted','arrived'].includes(latest.phase);
    const routeKey=latest.polyline+'|'+(isPassenger&&pickup);
    if(lastRoute!==routeKey){
      window.JBridge.removeAllPolylines(JSON.stringify({gmapPursId:current,markersToRemove:markerIds(),polyLinesToRemove:[]}));
      const payload=mapPayload(latest,current,isPassenger);
      if(payload.routeConfigs[0].locations.points.length>=2)window.JBridge.drawRouteV2(JSON.stringify(payload));
      if(isPassenger){
        const points=payload.routeConfigs[0].locations.points;
        if(points.length){
          if(!pickup)showPoint('br-origin',points[0],'yatri_map_origin',28);
          showPoint('br-destination',points[points.length-1],pickup?'yatri_map_origin':'yatri_map_destination',pickup?28:38,pickup?0.5:0.92);
        }
      }
      lastPolyline=latest.polyline;lastRoute=routeKey;
    }
    if(isPassenger&&latest.gpsFresh){
      const point={lat:latest.driverLat,lng:latest.driverLng};
      if(vehiclePoint){
        const dy=(point.lat-vehiclePoint.lat)*111000,dx=(point.lng-vehiclePoint.lng)*111000*Math.cos(point.lat*Math.PI/180);
        if(Math.hypot(dx,dy)>4)vehicleHeading=(Math.atan2(dx,dy)*180/Math.PI+360)%360;
      }
      showPoint('br-live-driver',point,'ny_ic_vehicle_nav_on_map',36,0.5,vehicleHeading);vehiclePoint=point;
    }else if(latest.gpsFresh)window.JBridge.showMarker(JSON.stringify({purescriptId:current,lat:String(latest.driverLat),lng:String(latest.driverLng),
      markerSize:100,anchorV:0.5,anchorV1:0.5,markerConfig:{markerId:'br-live-driver',pointerIcon:'ny_ic_vehicle_nav_on_map',rotation:'0',zIndex:10,animationConfig:{animationType:'NONE',animationDuration:0}}}));
    else window.JBridge.removeMarker('br-live-driver');
    const nextCamera=cameraKey(latest);
    if(nextCamera!==lastCamera){const owner=current,trip=latest;setTimeout(()=>{
      if(current===owner&&latest===trip)try{fitCamera(owner,trip);}catch(_){}
    },150);}
    window.__YATRI_TRIP_MAP__={ready:true,routePoints:lastPolyline?mapPayload(latest,current).routeConfigs[0].locations.points.length:0,
      gpsFresh:latest.gpsFresh,driverLat:latest.driverLat,driverLng:latest.driverLng,phase:latest.phase};
  }catch(_){window.__YATRI_TRIP_MAP__={ready:false,error:'Não foi possível desenhar o mapa da viagem.'};}
}
export const mountMapWithMapper=(id,mapCallback)=>{
  if(!allowed()||current===id)return;
  current=id;ready=false;lastPolyline='';lastCamera='';lastRoute=null;vehiclePoint=null;vehicleHeading=0;window.__YATRI_TRIP_MAP__={ready:false};
  callback=mapCallback(key=>{if(current===id&&key==='MAP'){ready=true;draw();}});
  window.JBridge.showMap(id,false,'normal',15,callback,'{}');
};
export const updateTripMap=trip=>{latest=trip;draw();};
export const releaseTripMap=()=>{
  if(current&&allowed())window.JBridge.removeAllPolylines(JSON.stringify({gmapPursId:current,
    markersToRemove:['br-live-driver',...markerIds()],polyLinesToRemove:[]}));
  current=null;latest=null;ready=false;lastPolyline='';lastCamera='';lastRoute=null;vehiclePoint=null;if(allowed())window.__YATRI_TRIP_MAP__={ready:false};
  if(callback){const registry=window.__PROXY_FN;if(Object.prototype.toString.call(registry)==='[object Map]')registry.delete(callback);else if(registry)delete registry[callback];callback=null;}
};
