#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
set -euo pipefail
set +x
sudo -n docker exec -i alce-lab-api node --input-type=module <<'JS'
import assert from 'node:assert/strict';
import {connectDatabase} from './src/db.mjs';
import {issuePairing} from './src/driver-pairing.mjs';
import {mobilityService} from './src/mobility.mjs';
const pool=await connectDatabase(process.env.DATABASE_URL);
const service=mobilityService(pool,{}, {allowDevelopmentAccounts:true});
const tokens=[];
try {
  assert.equal(new URL(process.env.DATABASE_URL).pathname,'/alce_lab');
  const counts=await pool.query('SELECT (SELECT count(*)::int FROM users) AS users,(SELECT count(*)::int FROM vehicles) AS vehicles,(SELECT count(*)::int FROM rides) AS rides');
  assert.equal(counts.rows[0].users,2);assert.equal(counts.rows[0].vehicles,1);assert.equal(counts.rows[0].rides,0);
  for(const role of ['driver','passenger']){
    const pair=await issuePairing(pool,role);
    const response=await fetch('http://127.0.0.1:8082/v1/'+role+'/pair',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code:pair.code})});
    assert.equal(response.status,200);const session=await response.json();tokens.push(session.token);
    const snapshot=await fetch('http://127.0.0.1:8082/v1/snapshot',{headers:{Authorization:'Bearer '+session.token}});
    assert.equal(snapshot.status,200);const data=await snapshot.json();assert.equal(data.user.role,role);
    const reused=await fetch('http://127.0.0.1:8082/v1/'+role+'/pair',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code:pair.code})});
    assert.equal(reused.status,401);
  }
  console.log(JSON.stringify({isolatedDatabase:true,profilesVerified:true,driverAndPassengerSessionsVerified:true,pairingSingleUseVerified:true,mapsKeyConfigured:Boolean(process.env.GOOGLE_MAPS_SERVER_KEY),pilotUntil:process.env.YATRI_DRIVER_PILOT_UNTIL}));
} finally {
  for(const token of tokens)await service.logout(token);
  await pool.end();
}
JS
curl -fsS --max-time 5 http://127.0.0.1:8080/health >/dev/null
curl -fsS --max-time 5 http://127.0.0.1:8082/health >/dev/null
echo ALCE_SESSIONS_VERIFIED_AND_REVOKED_EXISTING_SERVICES_HEALTHY
