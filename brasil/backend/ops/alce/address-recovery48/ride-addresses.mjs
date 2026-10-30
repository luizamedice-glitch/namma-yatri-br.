// SPDX-License-Identifier: AGPL-3.0-or-later
const generic=/^(origem selecionada|destino selecionado)$/i;
const useful=value=>typeof value==='string'&&value.trim().length>=3&&!generic.test(value.trim());
export async function recoverRideAddresses(points,{user,pool,maps={}}){
  const entries=await Promise.all(['origin','destination'].map(async role=>{
    const point=points[role];
    if(useful(point.address))return [role,{...point,address:point.address.trim()}];
    // Exact selected coordinate, scoped to this authenticated passenger.
    // Never choose a nearest neighbour: adjacent house numbers must stay distinct.
    const saved=pool?await pool.query(`SELECT address FROM alce_saved_addresses WHERE user_id=$1
      AND abs(lat-$2)<0.000001 AND abs(lng-$3)<0.000001
      ORDER BY searched_at DESC NULLS LAST,id DESC LIMIT 1`,[user.id,point.lat,point.lng]):null;
    const address=saved?.rows?.[0]?.address;
    if(useful(address))return [role,{...point,address:address.trim()}];
    if(maps.reverse){try{const found=await maps.reverse(point);if(useful(found?.address))return [role,{...point,address:found.address.trim()}];}catch{/* Provider failure must not change the selected position or block a ride. */}}
    return [role,{...point,address:`${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`}];
  }));
  return Object.fromEntries(entries);
}
