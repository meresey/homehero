import { RewardRedemption, RewardRedemptionStatus } from './types';

export function isRewardPurchasePending(status: RewardRedemptionStatus) {
  return status === 'requested';
}

export function isRewardAvailable(status: RewardRedemptionStatus) {
  return status === 'approved';
}

export function isRewardAwaitingFulfillment(status: RewardRedemptionStatus) {
  return status === 'claimed';
}

export function rewardLifecycleLabel(status: RewardRedemptionStatus) {
  switch (status) {
    case 'requested': return 'Awaiting approval';
    case 'approved': return 'Available to use';
    case 'claimed': return 'Awaiting fulfillment';
    case 'fulfilled': return 'Used';
    case 'rejected': return 'Declined';
    case 'cancelled': return 'Cancelled';
  }
}

export function sortRewardEntitlements(items: RewardRedemption[]) {
  const priority: Record<RewardRedemptionStatus, number> = {
    approved: 0,
    claimed: 1,
    requested: 2,
    fulfilled: 3,
    rejected: 4,
    cancelled: 5,
  };
  return [...items].sort((a, b) => priority[a.status] - priority[b.status]
    || new Date(b.claimedAt ?? b.reviewedAt ?? b.requestedAt).getTime() - new Date(a.claimedAt ?? a.reviewedAt ?? a.requestedAt).getTime());
}
