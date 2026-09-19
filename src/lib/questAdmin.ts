import { supabase } from './supabase';

export type QuestAdminInput = {
  householdId: string;
  childIds: string[];
  templateId?: string;
  catalogQuestId?: string;
  title: string;
  description?: string;
  iconKey?: string;
  cadence: 'daily' | 'weekly' | 'guild';
  stars: number;
  xp: number;
  timerMinutes?: number;
  daysOfWeek: number[];
  localCutoff?: string;
  scheduleLabel?: string;
  minimumAge?: number;
  maximumAge?: number;
};

export async function saveQuest(input: QuestAdminInput) {
  if (!supabase) throw new Error('Supabase is not configured');
  const { data, error } = await supabase.rpc('save_quest_admin', {
    p_household_id: input.householdId,
    p_child_ids: input.childIds,
    p_template_id: input.templateId ?? null,
    p_title: input.title,
    p_description: input.description ?? '',
    p_icon_key: input.iconKey ?? 'sparkles',
    p_cadence: input.cadence,
    p_star_reward: input.stars,
    p_xp_reward: input.xp,
    p_timer_seconds: input.timerMinutes ? input.timerMinutes * 60 : null,
    p_days_of_week: input.daysOfWeek,
    p_local_cutoff: input.localCutoff ?? null,
    p_schedule_label: input.scheduleLabel ?? null,
    p_minimum_age: input.minimumAge ?? null,
    p_maximum_age: input.maximumAge ?? null,
    p_catalog_quest_id: input.catalogQuestId ?? null,
  });
  if (error) throw error;
  const savedQuest = Array.isArray(data) ? data[0] : data;
  if (!savedQuest?.id) throw new Error('The quest could not be saved');
  return savedQuest;
}

export async function archiveQuest(templateId: string) {
  if (!supabase) throw new Error('Supabase is not configured');
  const { error } = await supabase.rpc('archive_quest_admin', { p_template_id: templateId });
  if (error) throw error;
}

export async function restoreQuest(templateId: string) {
  if (!supabase) throw new Error('Supabase is not configured');
  const { error } = await supabase.rpc('restore_quest_admin', { p_template_id: templateId });
  if (error) throw error;
}
