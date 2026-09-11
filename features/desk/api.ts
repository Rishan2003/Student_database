import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Snapshot } from './model';
type Json = string | number | boolean | null | {
    [key: string]: Json | undefined;
} | Json[];
type Database = {
    public: {
        Tables: Record<string, never>;
        Views: Record<string, never>;
        Functions: {
            desk_snapshot: {
                Args: Record<string, never>;
                Returns: Json;
            };
            desk_write: {
                Args: {
                    action: string;
                    payload: Json;
                };
                Returns: Json;
            };
        };
        Enums: Record<string, never>;
        CompositeTypes: Record<string, never>;
    };
};
let client: SupabaseClient<Database> | null = null;
export async function initialize() {
    const response = await fetch('/api/config', { cache: 'no-store' });
    if (!response.ok)
        throw new Error('The app could not check its connection. Please reload.');
    const config = await response.json() as {
        url?: string;
        key?: string;
        configured: boolean;
    };
    if (!config.configured)
        return null;
    if (!config.url || !config.key)
        throw new Error('The database connection is incomplete.');
    client = createClient<Database>(config.url, config.key);
    return client;
}
export function getClient() { return client; }
export async function snapshot(): Promise<Snapshot> { if (!client)
    throw new Error('Database connection is not configured.'); const { data, error } = await client.rpc('desk_snapshot'); if (error)
    throw new Error(error.message); return data as unknown as Snapshot; }
export async function write(action: string, payload: unknown) { if (!client)
    throw new Error('Database connection is not configured.'); const { data, error } = await client.rpc('desk_write', { action, payload: payload as Json }); if (error)
    throw new Error(error.message); return data; }
