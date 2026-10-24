// SPDX-License-Identifier: AGPL-3.0-or-later
export function tripView(ride,phase=ride.status){
  const cents=Number(ride.fare_cents??ride.fareCents);
  if(!Number.isInteger(cents)||cents<0)throw Error('Valor da viagem inválido no servidor.');
  const meters=Number(ride.route?.distanceMeters);
  return {id:ride.id,phase,origin:ride.origin?.address||'',destination:ride.destination?.address||'',
    fare:new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100),
    distance:Number.isFinite(meters)?new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1}).format(meters/1000)+' km':'',
    passenger:ride.passenger_name||'',driver:ride.driver_name||'',
    vehicle:[ride.model,ride.color,ride.plate].filter(Boolean).join(' · ')};
}
