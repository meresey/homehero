import { supabase } from './supabase';

export type RewardAdminInput = {
  householdId: string;
  rewardId?: string;
  catalogRewardId?: string;
  title: string;
  description?: string;
  iconKey?: string;
  starCost: number;
};

export async function saveReward(input: RewardAdminInput) {
  if (!supabase) throw new Error('Supabase is not configured');
  const { data, error } = await supabase.rpc('upsert_reward_admin', {
    p_household_id: input.householdId,
    p_reward_id: input.rewardId ?? null,
    p_catalog_reward_id: input.catalogRewardId ?? null,
    p_title: input.title,
    p_description: input.description ?? '',
    p_icon_key: input.iconKey ?? '🎁',
    p_star_cost: input.starCost,
  });
  if (error) throw error;
  return data;
}

export async function archiveReward(rewardId: string) {
  if (!supabase) throw new Error('Supabase is not configured');
  const { error } = await supabase.rpc('archive_reward_admin', { p_reward_id: rewardId });
  if (error) throw error;
}
