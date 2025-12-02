import { Client } from 'pg';
import { AuroraDSQLClient } from '@aws/aurora-dsql-node-postgres-connector';

let cachedClient: Client | null = null;

async function getConnection(): Promise<Client> {
  if (cachedClient) {
    return cachedClient;
  }

  const client = new AuroraDSQLClient({
    host: process.env.AURORA_ENDPOINT!,
    user: 'admin',
    database: 'postgres',
  });

  await client.connect();
  cachedClient = client;
  return client;
}

export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const client = await getConnection();
  const result = await client.query(text, params);
  return result.rows;
}

export async function queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows.length > 0 ? rows[0] : null;
}

export async function withTransaction<T>(callback: (client: Client) => Promise<T>): Promise<T> {
  const client = await getConnection();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}
