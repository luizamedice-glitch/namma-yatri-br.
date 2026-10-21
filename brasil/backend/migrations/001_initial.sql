CREATE TABLE users (
 id uuid PRIMARY KEY,
 name text NOT NULL,
 email text UNIQUE NOT NULL,
 password_hash text NOT NULL,
 role text NOT NULL CHECK (role IN ('passenger','driver')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sessions (
 token_hash text PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES users,
 expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days'
);
CREATE TABLE vehicles (
 driver_id uuid PRIMARY KEY REFERENCES users,
 plate text UNIQUE NOT NULL,
 model text NOT NULL,
 color text NOT NULL
);
CREATE TABLE drivers (
 user_id uuid PRIMARY KEY REFERENCES users,
 available boolean NOT NULL DEFAULT false,
 lat double precision CHECK (lat BETWEEN -90 AND 90),
 lng double precision CHECK (lng BETWEEN -180 AND 180),
 location_at timestamptz
);
CREATE TABLE quotes (
 id uuid PRIMARY KEY,
 passenger_id uuid NOT NULL REFERENCES users,
 origin jsonb NOT NULL,
 destination jsonb NOT NULL,
 route jsonb NOT NULL,
 fare_cents integer NOT NULL CHECK (fare_cents >= 0),
 expires_at timestamptz NOT NULL DEFAULT now() + interval '5 minutes'
);
CREATE TABLE rides (
 id uuid PRIMARY KEY,
 passenger_id uuid NOT NULL REFERENCES users,
 driver_id uuid REFERENCES drivers(user_id),
 quote_id uuid UNIQUE NOT NULL REFERENCES quotes,
 status text NOT NULL CHECK (status IN ('searching','accepted','arrived','in_progress','completed','cancelled')),
 version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (status IN ('searching','cancelled') OR driver_id IS NOT NULL)
);
CREATE UNIQUE INDEX passenger_one_active ON rides(passenger_id) WHERE status IN ('searching','accepted','arrived','in_progress');
CREATE UNIQUE INDEX driver_one_active ON rides(driver_id) WHERE status IN ('accepted','arrived','in_progress');
CREATE TABLE offers (
 ride_id uuid NOT NULL REFERENCES rides,
 driver_id uuid NOT NULL REFERENCES drivers(user_id),
 rejected boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (ride_id,driver_id)
);
CREATE TABLE events (
 id bigserial PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES users,
 kind text NOT NULL,
 payload jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX events_user_cursor ON events(user_id,id);
CREATE INDEX rides_status ON rides(status,created_at);
