import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Bun handles .env automatically, so no need for dotenv/config here
const queryClient = postgres(process.env.DIGITALEQUB_API_DATABASE_LOCAL_URL!);
export const db = drizzle(queryClient, { schema });         