// Existing motor issuer only; owner requested a new driver activation.
const e=process.env;
if(e.ALCE_ISOLATED_MODE!=='true'||e.NODE_ENV!=='development'||new URL(e.DATABASE_URL).pathname!=='/alce_lab'||Date.now()>=Date.parse(e.YATRI_DRIVER_PILOT_UNTIL))throw Error('INVALID_ISOLATED_LAB');
const {connectDatabase}=await import('/app/src/db.mjs');
const {issuePairing,pairingHash}=await import('/app/src/driver-pairing.mjs');
const {createHash}=await import('node:crypto');
const pool=await connectDatabase(e.DATABASE_URL);
try{
 const profile=async()=>{const r=await pool.query("SELECT u.id,u.name,u.email,u.role,v.plate,v.model,v.color FROM users u JOIN vehicles v ON v.driver_id=u.id WHERE u.id='b1a51100-0000-4000-8000-000000000002' AND u.role='driver'");if(r.rowCount!==1)throw Error('DRIVER_PROFILE_REQUIRED');return createHash('sha256').update(JSON.stringify(r.rows[0])).digest('hex');};
 const beforeProfile=await profile();const previous=(await pool.query('SELECT token_hash FROM sessions')).rows.map(x=>x.token_hash);
 const activation=await issuePairing(pool,'driver');
 const verified=await pool.query("SELECT user_id,expires_at FROM sessions WHERE token_hash=$1 AND user_id='b1a51100-0000-4000-8000-000000000002' AND expires_at>now()",[pairingHash(activation.code,'driver')]);
 const after=new Set((await pool.query('SELECT token_hash FROM sessions')).rows.map(x=>x.token_hash));
 const preserved=previous.every(h=>after.has(h));const profilePreserved=beforeProfile===await profile();
 if(verified.rowCount!==1||!preserved||!profilePreserved)throw Error('ACTIVATION_VERIFICATION_FAILED');
 process.stdout.write(JSON.stringify({...activation,verifiedStored:true,existingSessionsPreserved:preserved,profilePreserved,pilotUntil:e.YATRI_DRIVER_PILOT_UNTIL}));
}finally{await pool.end();}
