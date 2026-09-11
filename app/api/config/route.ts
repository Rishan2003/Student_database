export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    // Only the public anon/publishable key is exposed. Data is protected by Supabase Auth and RLS.
    let publicKey = !!key && key.startsWith('sb_publishable_');
    if (key?.startsWith('ey')) {
        try {
            publicKey = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role === 'anon';
        }
        catch {
            publicKey = false;
        }
    }
    const configured = !!url && publicKey;
    return Response.json(configured ? { configured, url, key } : { configured: false }, { headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
