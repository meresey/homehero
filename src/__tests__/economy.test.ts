import { coinFriendlyMessage, coinLabel } from '../economy';

describe('coin economy copy', () => {
  test('pluralizes coin balances', () => {
    expect(coinLabel(0)).toBe('0 coins');
    expect(coinLabel(1)).toBe('1 coin');
    expect(coinLabel(9)).toBe('9 coins');
  });

  test('converts legacy star wording before it reaches the UI', () => {
    expect(coinFriendlyMessage('Visit the Star Store')).toBe('Visit the Hero Shop');
    expect(coinFriendlyMessage('Meet your weekly Star goal')).toBe('Meet your weekly coin goal');
    expect(coinFriendlyMessage('Stars and star cost')).toBe('Coins and coin cost');
  });
});
