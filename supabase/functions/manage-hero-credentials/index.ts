import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const usernamePattern = /^[a-z][a-z0-9_]{2,19}$/;
const pinPattern = /^\d{6}$/;

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return response({ error: 'Method not allowed' }, 405);
  const authorization = request.headers.get('Authorization');
  if (!authorization) return response({ error: 'Authentication required' }, 401);

  const url = Deno.env.get('SUPABASE_URL')!;
  const callerClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } } });
  const adminClient = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser();
  if (callerError || !caller) return response({ error: 'Your session has expired. Please sign in again.' }, 401);

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return response({ error: 'Invalid request body' }, 400); }
  const userId = typeof body.userId === 'string' ? body.userId : '';
  const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
  const pin = typeof body.pin === 'string' ? body.pin : null;
  if (!userId) return response({ error: 'Choose a Hero to update.' }, 400);
  if (!usernamePattern.test(username)) return response({ error: 'Username must be 3–20 characters and use only letters, numbers, or underscores.' }, 400);
  if (pin !== null && !pinPattern.test(pin)) return response({ error: 'PIN must contain exactly six digits.' }, 400);

  const { data: membership } = await adminClient.from('household_members').select('household_id').eq('user_id', caller.id).eq('role', 'parent').maybeSingle();
  if (!membership) return response({ error: 'Only a Party Leader can manage Hero logins.' }, 403);
  const { data: account, error: accountError } = await adminClient.from('managed_hero_accounts').select('user_id,username').eq('user_id', userId).eq('household_id', membership.household_id).maybeSingle();
  if (accountError || !account) return response({ error: 'This managed Hero account was not found in your household.' }, 404);
  if (username === account.username && pin === null) return response({ error: 'No login changes were provided.' }, 400);

  if (username !== account.username) {
    const { data: duplicate } = await adminClient.from('managed_hero_accounts').select('user_id').eq('username', username).neq('user_id', userId).maybeSingle();
    if (duplicate) return response({ error: 'That username is already taken. Choose another one.' }, 409);
  }

  const { data: authRecord, error: authReadError } = await adminClient.auth.admin.getUserById(userId);
  if (authReadError || !authRecord.user) return response({ error: 'The Hero login could not be loaded.' }, 404);

  if (username !== account.username) {
    const { error: tableError } = await adminClient.from('managed_hero_accounts').update({ username }).eq('user_id', userId).eq('household_id', membership.household_id);
    if (tableError) return response({ error: tableError.code === '23505' ? 'That username is already taken. Choose another one.' : tableError.message }, tableError.code === '23505' ? 409 : 400);
  }

  const updates: Record<string, unknown> = {
    user_metadata: { ...(authRecord.user.user_metadata ?? {}), managed_hero: true, hero_username: username },
  };
  if (username !== account.username) { updates.email = `${username}@heroes.homehero.invalid`; updates.email_confirm = true; }
  if (pin !== null) updates.password = pin;
  const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(userId, updates);
  if (authUpdateError) {
    if (username !== account.username) await adminClient.from('managed_hero_accounts').update({ username: account.username }).eq('user_id', userId);
    const duplicate = authUpdateError.message.toLowerCase().includes('already') || authUpdateError.message.toLowerCase().includes('registered');
    return response({ error: duplicate ? 'That username is already taken. Choose another one.' : authUpdateError.message }, duplicate ? 409 : 400);
  }

  return response({ userId, username, pinChanged: pin !== null }, 200);
});

function response(body: Record<string, unknown>, status: number) { return Response.json(body, { status, headers: corsHeaders }); }
