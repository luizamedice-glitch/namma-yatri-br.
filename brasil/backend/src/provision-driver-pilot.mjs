// SPDX-License-Identifier: AGPL-3.0-or-later
// Operator-only command. Reads real vehicle data from a private file, never stdout.
import {readFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {connectDatabase,transaction} from './db.mjs';
import {passwordHash} from './domain.mjs';
import {driverPilotId} from './driver-pilot.mjs';

export function validateVehicle(input) {
  const vehicle={plate:String(input?.plate||'').trim().toUpperCase(),model:input?.model,color:input?.color};
  if(!/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(vehicle.plate)||
      typeof vehicle.model!=='string'||vehicle.model.trim().length<2||vehicle.model.length>80||
      typeof vehicle.color!=='string'||vehicle.color.trim().length<2||vehicle.color.length>40)
    throw Error('Informe placa brasileira, modelo e cor reais do veiculo de testes.');
  vehicle.model=vehicle.model.trim();vehicle.color=vehicle.color.trim();return vehicle;
}

export async function provisionDriverPilot(pool,input) {
  const vehicle=validateVehicle(input);
  const password=await passwordHash(randomBytes(32).toString('hex'));
  await transaction(pool,async db=>{
    const existing=await db.query('SELECT name,role FROM users WHERE id=$1',[driverPilotId]);
    if(existing.rowCount && (existing.rows[0].name!=='Giselo'||existing.rows[0].role!=='driver'))throw Error('DRIVER_ID_CONFLICT');
    const previous=await db.query('SELECT plate,model,color FROM vehicles WHERE driver_id=$1',[driverPilotId]);
    if(previous.rowCount && Object.keys(vehicle).some(k=>previous.rows[0][k]!==vehicle[k]))throw Error('EXISTING_VEHICLE_DIFFERS');
    if(!existing.rowCount)await db.query('INSERT INTO users(id,name,email,password_hash,role) VALUES($1,$2,$3,$4,$5)',
      [driverPilotId,'Giselo','driver@development.yatri.invalid',password,'driver']);
    await db.query('INSERT INTO drivers(user_id) VALUES($1) ON CONFLICT DO NOTHING',[driverPilotId]);
    if(!previous.rowCount)await db.query('INSERT INTO vehicles(driver_id,plate,model,color) VALUES($1,$2,$3,$4)',
      [driverPilotId,vehicle.plate,vehicle.model,vehicle.color]);
  });
}

export async function provisionPassengerPilot(pool){
  const id='b1a51100-0000-4000-8000-000000000001';
  const password=await passwordHash(randomBytes(32).toString('hex'));
  await transaction(pool,async db=>{
    const existing=await db.query('SELECT name,role FROM users WHERE id=$1',[id]);
    if(existing.rowCount && (existing.rows[0].name!=='Fagner'||existing.rows[0].role!=='passenger'))throw Error('PASSENGER_ID_CONFLICT');
    if(!existing.rowCount)await db.query('INSERT INTO users(id,name,email,password_hash,role) VALUES($1,$2,$3,$4,$5)',
      [id,'Fagner','passenger@development.yatri.invalid',password,'passenger']);
  });
}

if(process.argv[1]===new URL(import.meta.url).pathname){
  if(process.env.YATRI_DRIVER_PILOT_MODE!=='true'||process.env.NODE_ENV==='production')throw Error('DRIVER_PILOT_DISABLED');
  if(!process.argv[2])throw Error('Informe arquivo privado do veiculo.');
  const pool=await connectDatabase(process.env.DATABASE_URL);
  try {
    if(process.argv[2]==='--passenger')await provisionPassengerPilot(pool);
    else await provisionDriverPilot(pool,JSON.parse(await readFile(process.argv[2],'utf8')));
    console.log('Perfil de testes provisionado; dados privados omitidos.');
  }
  finally {await pool.end();}
}
