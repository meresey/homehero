export type EmojiSuggestionKind = 'quest' | 'reward';

type EmojiRule = {
  emoji: string;
  terms: string[];
};

const sharedRules: EmojiRule[] = [
  { emoji: '🪥', terms: ['brush teeth', 'toothbrush', 'teeth', 'dental'] },
  { emoji: '🧺', terms: ['do laundry', 'fold clothes', 'washing clothes', 'laundry'] },
  { emoji: '🍽️', terms: ['wash dishes', 'dishwasher', 'set the table', 'clear the table', 'dishes'] },
  { emoji: '🛏️', terms: ['make the bed', 'make bed', 'bedroom', 'bed'] },
  { emoji: '🗑️', terms: ['take out trash', 'take out rubbish', 'recycling', 'garbage', 'rubbish', 'trash', 'bins'] },
  { emoji: '🧼', terms: ['clean bathroom', 'wash hands', 'bathroom', 'toilet', 'soap'] },
  { emoji: '🚿', terms: ['take a shower', 'take a bath', 'shower', 'bathe'] },
  { emoji: '🍳', terms: ['cook dinner', 'make dinner', 'prepare a meal', 'cooking', 'baking', 'kitchen', 'meal'] },
  { emoji: '🪴', terms: ['water plants', 'plant care', 'houseplant', 'plants'] },
  { emoji: '🌳', terms: ['outside time', 'outdoor', 'fresh air', 'nature', 'garden', 'yard'] },
  { emoji: '📚', terms: ['read a book', 'reading', 'library', 'books', 'book'] },
  { emoji: '✏️', terms: ['do homework', 'homework', 'schoolwork', 'revision', 'study', 'writing'] },
  { emoji: '🎨', terms: ['arts and crafts', 'drawing', 'painting', 'creative', 'craft', 'colouring', 'coloring', 'art'] },
  { emoji: '🎵', terms: ['practice music', 'instrument', 'singing', 'piano', 'guitar', 'music'] },
  { emoji: '🚲', terms: ['bike ride', 'bicycle', 'cycling', 'bike'] },
  { emoji: '🏊', terms: ['swimming', 'swim'] },
  { emoji: '⚽', terms: ['football', 'soccer'] },
  { emoji: '🏀', terms: ['basketball'] },
  { emoji: '🏃', terms: ['workout', 'exercise', 'running', 'run'] },
  { emoji: '🚶', terms: ['go for a walk', 'walking', 'walk'] },
  { emoji: '🐾', terms: ['feed the pet', 'walk the dog', 'pet care', 'dog', 'cat', 'pet'] },
  { emoji: '🌙', terms: ['bedtime', 'go to sleep', 'sleep', 'night routine'] },
  { emoji: '🌅', terms: ['morning routine', 'wake up', 'morning'] },
  { emoji: '🗂️', terms: ['organize', 'organise', 'sort out', 'declutter'] },
  { emoji: '🧹', terms: ['vacuum', 'sweep', 'mop', 'tidy', 'clean'] },
  { emoji: '🤝', terms: ['work together', 'teamwork', 'family task', 'together', 'help out'] },
  { emoji: '❤️', terms: ['kindness', 'kind act', 'volunteer', 'help someone', 'caring'] },
];

const rewardRules: EmojiRule[] = [
  { emoji: '🎮', terms: ['screen time', 'video game', 'gaming', 'game time'] },
  { emoji: '🎬', terms: ['movie night', 'watch a movie', 'cinema', 'movie', 'film'] },
  { emoji: '🍦', terms: ['ice cream', 'dessert', 'sweet treat', 'treat'] },
  { emoji: '🍕', terms: ['pizza'] },
  { emoji: '🍿', terms: ['popcorn'] },
  { emoji: '🥳', terms: ['sleepover', 'invite a friend', 'party'] },
  { emoji: '🛍️', terms: ['shopping trip', 'go shopping', 'shopping'] },
  { emoji: '🧸', terms: ['new toy', 'toy'] },
  { emoji: '💰', terms: ['allowance', 'pocket money', 'money'] },
  { emoji: '🎟️', terms: ['theme park', 'day out', 'outing', 'adventure', 'tickets'] },
  { emoji: '👨‍👩‍👧‍👦', terms: ['family activity', 'family day', 'family time'] },
  { emoji: '🍽️', terms: ['choose dinner', 'choose a meal', 'favorite meal', 'favourite meal'] },
  { emoji: '🌙', terms: ['stay up late', 'later bedtime'] },
  { emoji: '🎁', terms: ['present', 'surprise', 'gift', 'reward'] },
];

function normalize(value: string) {
  return value.toLocaleLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function suggestEmoji(name: string, description: string, kind: EmojiSuggestionKind) {
  const text = normalize(`${name} ${description}`);
  if (!text) return null;
  const searchableText = ` ${text} `;

  const rules = kind === 'reward' ? [...rewardRules, ...sharedRules] : sharedRules;
  let bestEmoji: string | null = null;
  let bestScore = -1;
  let bestOrder = Number.MAX_SAFE_INTEGER;

  for (let order = 0; order < rules.length; order += 1) {
    const rule = rules[order];
    for (const term of rule.terms) {
      if (!searchableText.includes(` ${term} `)) continue;
      // Prefer a more specific phrase over a short, generic keyword.
      const score = term.split(' ').length * 100 + term.length;
      if (score > bestScore || (score === bestScore && order < bestOrder)) {
        bestEmoji = rule.emoji;
        bestScore = score;
        bestOrder = order;
      }
    }
  }

  return bestEmoji;
}
