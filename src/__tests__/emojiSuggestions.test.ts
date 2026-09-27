import { suggestEmoji } from '../emojiSuggestions';

describe('emoji suggestions', () => {
  test('suggests a quest emoji from its name', () => {
    expect(suggestEmoji('Brush teeth', '', 'quest')).toBe('🪥');
  });

  test('uses the description when the name has no match', () => {
    expect(suggestEmoji('Morning mission', 'Read a book for twenty minutes', 'quest')).toBe('📚');
  });

  test('uses reward-specific suggestions for shop items', () => {
    expect(suggestEmoji('Bonus', 'Extra screen time', 'reward')).toBe('🎮');
  });

  test('returns null when there is no meaningful match', () => {
    expect(suggestEmoji('Mystery', 'Something entirely different', 'quest')).toBeNull();
  });
});
