const { Pool } = require("pg");
const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");

let pool; // reused across Lambda invocations

async function getDbPool() {
  if (pool) {
    return pool;
  }

  const creds = await getDbCredentials();

  pool = new Pool({
    host: creds.host,
    user: creds.username,
    password: creds.password,
    database: creds.dbname,
    port: 5432,
    ssl: {
      rejectUnauthorized: false, // adjust if using RDS CA certs
    },

    // Pool configuration
    max: 10, // max clients in pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  // Optional: log pool errors
  pool.on("error", (err) => {
    console.error("Unexpected PG pool error", err);
  });

  return pool;
}

async function getDbCredentials() {
  const client = new SecretsManagerClient({ region: process.env.region });
  const response = await client.send(new GetSecretValueCommand({ SecretId: process.env.DB_SECRET_ARN }));
  return JSON.parse(response.SecretString);
}

module.exports = {
  getDbPool,
};
