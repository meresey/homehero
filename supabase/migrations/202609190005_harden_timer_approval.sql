-- Timed quests may only be awarded through the parent-authorized review path.
-- Both review_quest and award_quest already reject a timer whose expected end
-- is in the future; removing direct RPC access closes the remaining bypass.

revoke execute on function public.award_quest(uuid) from public,anon,authenticated;
grant execute on function public.review_quest(uuid,boolean,text) to authenticated;
