// SPDX-License-Identifier: AGPL-3.0-or-later
export function decodePolyline(encoded){
  if(typeof encoded!=='string'||encoded.length>100000)throw Error('Rota inválida.');
  let index=0,lat=0,lng=0;const points=[];
  function component(){let value=0,shift=0,byte;do{
    if(index>=encoded.length||shift>30)throw Error('Rota incompleta.');
    byte=encoded.charCodeAt(index++)-63;if(byte<0||byte>63)throw Error('Rota inválida.');
    value|=(byte&31)<<shift;shift+=5;
  }while(byte>=32);return value&1?~(value>>1):value>>1;}
  while(index<encoded.length){lat+=component();lng+=component();
    if(Math.abs(lat)>9000000||Math.abs(lng)>18000000)throw Error('Coordenadas de rota inválidas.');
    points.push({lat:lat/1e5,lng:lng/1e5});}
  return points;
}
export function mapPayload(trip,id){
  const points=decodePolyline(trip.polyline);
  return {pureScriptID:id,routeConfigs:[{routeKey:'DEFAULT',locations:{points},isActual:true,
    style:'LineString',routeColor:'#743454',routeWidth:8,routeType:'',
    startMarkerConfig:JSON.stringify({pointerIcon:'ny_ic_source_dot',markerId:'br-origin'}),
    endMarkerConfig:JSON.stringify({pointerIcon:'ny_ic_destination',markerId:'br-destination'}),stopMarkerConfigs:'[]',
    mapRouteConfig:{sourceSpecialTagIcon:'',destSpecialTagIcon:'',vehicleSizeTagIcon:90,isAnimation:false,autoZoom:true,
      dashUnit:1,gapUnit:0,polylineAnimationConfig:{color:'',draw:0,fade:0,delay:0}}}]};
}
