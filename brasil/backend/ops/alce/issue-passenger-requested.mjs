// Owner-requested passenger activation; never log plaintext credentials.
const e=process.env;
if(e.ALCE_ISOLATED_MODE!=='true'||e.NODE_ENV!=='development'||new URL(e.DATABASE_URL).pathname!=='/alce_lab'||Date.now()>=Date.parse(e.YATRI_DRIVER_PILOT_UNTIL))throw Error('INVALID_ISOLATED_LAB');
const {connectDatabase}=await import('/app/src/db.mjs');
const {issuePairing}=await import('/app/src/driver-pairing.mjs');
const pool=await connectDatabase(e.DATABASE_URL);
try {const activation=await issuePairing(pool,'passenger');process.stdout.write(JSON.stringify({code:activation.code,expiresAt:activation.expiresAt}));}finally{await pool.end();}
