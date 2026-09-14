export type QuestKind = 'daily' | 'timer' | 'guild' | 'bedtime';
export type QuestStatus = 'available' | 'in_progress' | 'pending_approval' | 'rewarded' | 'expired';

export type Quest = {
  id: string;
  templateId?: string;
  instanceId?: string;
  title: string;
  description: string;
  emoji: string;
  kind: QuestKind;
  status: QuestStatus;
  stars: number;
  xp: number;
  timerMinutes?: number;
  cutoffLabel?: string;
  cadence?: 'daily' | 'weekly' | 'guild';
  scheduleLabel?: string;
};

export type Reward = { id: string; title: string; emoji: string; cost: number; subtitle: string };
