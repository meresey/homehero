import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const usernamePattern = /^[a-z][a-z0-9_]{2,19}$/;
const pinPattern = /^\d{6}$/;

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return response({ error: 'Method not allowed' }, 405);

  const authorization = request.headers.get('Authorization');
  if (!authorization) return response({ error: 'Authentication required' }, 401);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const callerClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
  const adminClient = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: { user }, error: userError } = await callerClient.auth.getUser();
  if (userError || !user) return response({ error: 'Your session has expired. Please sign in again.' }, 401);

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return response({ error: 'Invalid request body' }, 400); }
  const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
  const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
  const dateOfBirth = typeof body.dateOfBirth === 'string' ? body.dateOfBirth : '';
  const pin = typeof body.pin === 'string' ? body.pin : '';

  if (!displayName || displayName.length > 60) return response({ error: 'Enter a valid Hero name.' }, 400);
  if (!usernamePattern.test(username)) return response({ error: 'Username must be 3–20 characters and use only letters, numbers, or underscores.' }, 400);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return response({ error: 'Enter a valid birth date.' }, 400);
  if (!pinPattern.test(pin)) return response({ error: 'PIN must contain exactly six digits.' }, 400);

  const { data: membership, error: membershipError } = await adminClient.from('household_members').select('household_id').eq('user_id', user.id).eq('role', 'parent').maybeSingle();
  if (membershipError || !membership) return response({ error: 'Only a Party Leader can enroll a Hero.' }, 403);

  const { data: existing } = await adminClient.from('managed_hero_accounts').select('user_id').eq('username', username).maybeSingle();
  if (existing) return response({ error: 'That username is already taken. Choose another one.' }, 409);

  const email = `${username}@heroes.homehero.invalid`;
  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password: pin,
    email_confirm: true,
    user_metadata: { display_name: displayName, managed_hero: true, hero_username: username },
  });
  if (createError || !created.user) {
    const duplicate = createError?.message.toLowerCase().includes('already') || createError?.message.toLowerCase().includes('registered');
    return response({ error: duplicate ? 'That username is already taken. Choose another one.' : createError?.message ?? 'Could not create the Hero account.' }, duplicate ? 409 : 400);
  }

  const { error: finalizeError } = await adminClient.rpc('finalize_managed_hero', {
    p_user_id: created.user.id,
    p_household_id: membership.household_id,
    p_created_by: user.id,
    p_display_name: displayName,
    p_username: username,
    p_date_of_birth: dateOfBirth,
  });
  if (finalizeError) {
    await adminClient.auth.admin.deleteUser(created.user.id);
    return response({ error: finalizeError.message }, 400);
  }

  return response({ userId: created.user.id, displayName, username }, 201);
});

function response(body: Record<string, unknown>, status: number) {
  return Response.json(body, { status, headers: corsHeaders });
}
