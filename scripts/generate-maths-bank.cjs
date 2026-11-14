const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'docs/cbc-maths-question-bank.md'), 'utf8');
const target = path.join(root, 'src/mathsBank.json');

// These questions use answer choices or need an explicit response format.
const choices = {
  'G4-B2': ['Njeri', 'Amina', 'They jump the same distance'],
  'G4-C5': ['x + 5', 'x − 5', '5x'],
  'G4-D2': ['Blue by 1 tile', 'Red by 1 tile', 'They cover the same number of tiles'],
  'G4-D5': ['The book corner', 'The round plate rim', 'The middle of the ruler edge'],
  'G4-G3': ['2x', 'x + 2', 'x − 2'],
  'G4-G5': ['The player who makes a half turn', 'The player who makes a quarter turn', 'Both turn through the same angle'],
  'G4-H2': ['Triangle', 'Rectangle', 'Circle'],
  'G4-H3': ['Tuesday', 'Monday', 'Wednesday'],
  'G4-H4': ['8', '5', '6'],
  'G5-A5': [
    'Bread and bananas · KSh 280',
    'Bananas and juice · KSh 285',
    'Bread and juice · KSh 305',
    'Bread and bananas · KSh 270',
  ],
  'G5-B5': ['Parallel', 'Perpendicular'],
  'G5-E4': ['Kendi', 'Musa', 'They have painted equal areas'],
  'G5-E5': ['x + 12 = 39', 'x − 12 = 39', '12x = 39'],
  'G5-F4': ['4 km 200 m', '3 km 200 m', '3 km 300 m'],
  'G5-G3': ['Perpendicular', 'Parallel'],
  'G5-G5': ['Cuboid', 'Cube', 'Cylinder'],
  'G5-H2': ['4 kg 350 g', '3 kg 350 g', '4 kg 250 g'],
  'G5-H4': ['4 min 20 s', '3 min 20 s', '4 min 10 s'],
  'G5-H5': ['Circle', 'Rectangle', 'Triangle'],
  'G5-I2': ['No', 'Yes'],
  'G6-A4': ['x > 350', 'x < 350', 'x = 350'],
  'G6-B5': ['6 faces, 12 edges, 8 vertices', '8 faces, 12 edges, 6 vertices', '6 faces, 8 edges, 12 vertices'],
  'G6-E3': ['4 t 150 kg', '3 t 150 kg', '4 t 50 kg'],
  'G6-F1': ['Perpendicular', 'Parallel'],
  'G6-F5': ['Circles', 'Squares', 'Triangles'],
  'G6-G1': ['x < 18', 'x > 18', 'x = 18'],
  'G7-A3': ['4 ≤ n ≤ 8', '4 < n < 8', '4 ≤ n < 8'],
  'G7-B2': ['8x', '8 + x', '15x'],
  'G7-D3': ['2² × 3 × 7', '2 × 3 × 7', '2² × 21'],
  'G7-F1': ['5x', '9x', '5'],
  'G7-F3': ['20 < h ≤ 32', '20 ≤ h ≤ 32', '20 < h < 32'],
  'G7-H4': ['5 votes per step', '1 vote per step', '10 votes per step'],
};

const bank = {};
const seen = new Set();
let grade;
let quest;
let context;
for (const line of source.split('\n')) {
  const gradeHeading = line.match(/^## Grade ([4-7])$/);
  const questHeading = line.match(/^### ([A-Z])\. (.+)$/);
  if (gradeHeading) {
    grade = gradeHeading[1];
    bank[grade] = [];
    quest = undefined;
    continue;
  }
  if (questHeading) {
    quest = { title: questHeading[2], questions: [] };
    bank[grade].push(quest);
    context = undefined;
    continue;
  }
  if (line.startsWith('For this set,')) {
    context = line;
    continue;
  }
  if (!line.startsWith('| G')) continue;
  const [id, topic, prompt, hint, answer] = line.slice(1, -1).split('|').map(cell => cell.trim());
  if (seen.has(id) || id !== `G${grade}-${String.fromCharCode(64 + bank[grade].length)}${quest.questions.length + 1}`) {
    throw new Error(`Unexpected question ID ${id}`);
  }
  seen.add(id);
  const [, short, working] = answer.match(/^\*\*(.+?)\*\* (.+)$/) ?? [];
  if (!working) throw new Error(`Missing answer or worked solution for ${id}`);
  const options = choices[id];
  if (options && id !== 'G5-A5' && options[0] !== short.replace(/\.$/, '')) {
    throw new Error(`Choice key disagrees with Markdown for ${id}`);
  }
  const numeric = short.match(/^(?:About |KSh )?((?:\d{1,3}(?:,\d{3})+|\d+)(?:(?::\d{2})|(?:\.\d+)|(?: \d+\/\d+)|(?:\/\d+))?)\.?\s*(.*)$/);
  if (!options && !numeric) throw new Error(`Add an explicit response format for ${id}`);
  let answers;
  let answerPrompt;
  let shuffledOptions;
  if (options) {
    answers = options.slice(0, id === 'G5-A5' ? 2 : 1);
    const offset = (seen.size + Number(grade)) % options.length;
    shuffledOptions = [...options.slice(offset), ...options.slice(0, offset)];
  } else {
    const [, value, unit] = numeric;
    answers = [value.replace(/,/g, '')];
    const normalizedUnit = short.startsWith('KSh ') ? 'KSh' : unit === '° each.' ? '°' : unit.replace(/\.$/, '');
    answerPrompt = value.includes(':') ? 'Enter a time as HH:MM.'
      : value.includes('/') ? `Enter a fraction or mixed number${normalizedUnit ? ` in ${normalizedUnit}` : ''}.`
      : normalizedUnit ? `Enter the number in ${normalizedUnit}.` : 'Enter a number.';
  }
  quest.questions.push({ id, topic, prompt, context, hint, solution: `${short} ${working}`, answers, options: shuffledOptions, answerPrompt });
}

if (Object.keys(choices).some(id => !seen.has(id))) throw new Error('Unused answer choice configuration');
for (const [grade, quests] of Object.entries(bank)) {
  if (quests.length < 2 || quests.some(quest => quest.questions.length !== 5)) {
    throw new Error(`Incomplete five-question sets for Grade ${grade}`);
  }
}
const output = JSON.stringify(bank, null, 2) + '\n';
if (process.argv.includes('--check')) {
  if (fs.readFileSync(target, 'utf8') !== output) throw new Error('Run node scripts/generate-maths-bank.cjs to update the app bank.');
} else {
  fs.writeFileSync(target, output);
}
