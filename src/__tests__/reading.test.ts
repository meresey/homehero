import { isReadingQuest, readingStoryById, selectReadingStory } from '../reading';
import type { Quest } from '../types';

const timedQuest: Quest = {
  id: 'instance-id', templateId: 'template-id', title: 'Family quest',
  description: '', emoji: '📖', kind: 'timer', status: 'available', stars: 1, xp: 2,
};

test('recognizes the catalog reading quest without treating other timers as reading', () => {
  expect(isReadingQuest({ ...timedQuest, catalogSlug: 'reading' })).toBe(true);
  expect(isReadingQuest({ ...timedQuest, catalogQuestId: 'catalog-read' })).toBe(true);
  expect(isReadingQuest({ ...timedQuest, templateId: 'read' })).toBe(true);
  expect(isReadingQuest({ ...timedQuest, title: 'Reading adventure' })).toBe(false);
  expect(isReadingQuest({ ...timedQuest, catalogSlug: 'reading', kind: 'guild' })).toBe(false);
});

test('uses grade first and falls back to age when no grade is saved', () => {
  const day = '2026-11-14';
  expect(selectReadingStory(day, 4, '2013-01-01')).toBe(selectReadingStory(day, null, '2018-01-01'));
  expect(selectReadingStory(day, 6, '2013-01-01')).toBe(selectReadingStory(day, null, '2015-01-01'));
  expect(selectReadingStory(day, 7, '')).toBe(selectReadingStory(day, null, '2013-01-01'));
  expect(selectReadingStory(day, null, '')).toBe(selectReadingStory(day, 5, ''));
});

test('rotates stories and preserves a valid answer and hint for every question', () => {
  const ids = new Set<string>();
  for (const grade of [4, 5, 7]) {
    for (const day of ['2026-11-14', '2026-11-15']) {
      const story = selectReadingStory(day, grade, '');
      ids.add(story.id);
      expect(readingStoryById(story.id)).toBe(story);
      expect(story.paragraphs.length).toBeGreaterThan(1);
      expect(story.questions).toHaveLength(3);
      for (const question of story.questions) {
        expect(new Set(question.options).size).toBe(3);
        expect(question.options[question.answer]).toBeTruthy();
        expect(question.hint).toBeTruthy();
      }
    }
  }
  expect(ids.size).toBe(6);
});
