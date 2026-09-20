import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Snapshot } from './model';
import type { ClubDay, ClubRosterRow } from './club-model';
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
            desk_save_review: {
                Args: { action: string; payload: Json };
                Returns: Json;
            };
            desk_club_roster: { Args: { campus: string; session_date: string }; Returns: Json };
            desk_club_day: { Args: { campus: string; session_date: string }; Returns: Json };
            desk_club_write: { Args: { action: string; payload: Json }; Returns: Json };
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
    throw new Error('Database connection is not configured.'); const rpc = ['save_student_review', 'save_weekly_review'].includes(action) ? 'desk_save_review' : 'desk_write'; const { data, error } = await client.rpc(rpc, { action, payload: payload as Json }); if (error)
    throw new Error(error.message); return data; }

function clubError(error: { code?: string; message: string }) {
    return new Error(['PGRST202', '42P01', '42883'].includes(error.code || '') ? 'Club attendance is not set up yet. Ask an administrator to finish the update.' : error.message);
}
export async function clubRoster(campus: string, session_date: string): Promise<ClubRosterRow[]> {
    if (!client) throw new Error('Database connection is not configured.');
    const { data, error } = await client.rpc('desk_club_roster', { campus, session_date });
    if (error) throw clubError(error);
    return data as unknown as ClubRosterRow[];
}
export async function clubDay(campus: string, session_date: string): Promise<ClubDay> {
    if (!client) throw new Error('Database connection is not configured.');
    const { data, error } = await client.rpc('desk_club_day', { campus, session_date });
    if (error) throw clubError(error);
    return data as unknown as ClubDay;
}
export async function clubWrite(action: 'import' | 'remove', payload: unknown): Promise<{ added: number; already_recorded: number; session_id: string }> {
    if (!client) throw new Error('Database connection is not configured.');
    const { data, error } = await client.rpc('desk_club_write', { action, payload: payload as Json });
    if (error) throw clubError(error);
    return data as unknown as { added: number; already_recorded: number; session_id: string };
}
