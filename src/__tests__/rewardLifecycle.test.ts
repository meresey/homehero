import { isRewardAvailable, isRewardAwaitingFulfillment, isRewardPurchasePending, rewardLifecycleLabel } from '../rewardLifecycle';

describe('reward fulfillment lifecycle', () => {
  test('distinguishes purchase approval from claiming and fulfillment', () => {
    expect(isRewardPurchasePending('requested')).toBe(true);
    expect(isRewardAvailable('approved')).toBe(true);
    expect(isRewardAwaitingFulfillment('claimed')).toBe(true);
    expect(isRewardAvailable('fulfilled')).toBe(false);
  });

  test.each([
    ['requested', 'Awaiting approval'],
    ['approved', 'Available to use'],
    ['claimed', 'Awaiting fulfillment'],
    ['fulfilled', 'Used'],
  ] as const)('labels %s rewards as %s', (status, label) => {
    expect(rewardLifecycleLabel(status)).toBe(label);
  });
});
