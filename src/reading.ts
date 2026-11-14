import { calculateAge } from './ageEligibility';
import type { Quest } from './types';

type ReadingQuestion = {
  prompt: string;
  options: [string, string, string];
  answer: number;
  hint: string;
};

export type ReadingStory = {
  id: string;
  title: string;
  paragraphs: string[];
  questions: ReadingQuestion[];
};

const stories: Record<'short' | 'standard' | 'advanced', ReadingStory[]> = {
  short: [
    {
      id: 'bean-seed',
      title: 'One Small Bean',
      paragraphs: [
        'On Monday, Amani put a bean seed in a cup of soil. She gave it a little water and left the cup near the window. Each morning, she checked the cup before school. All she saw was brown soil.',
        'On Thursday, Amani wanted to dig up the seed to see if it was growing. Her brother Nuru shook his head. “Give it time,” he said. Amani put down her spoon.',
        'After breakfast on Saturday, Amani spotted a small green shoot. She called Nuru over. Then she drew the shoot in her notebook so she could see how much it grew by next week.',
      ],
      questions: [
        { prompt: 'Where did Amani leave the cup?', options: ['Under the bed', 'Near the window', 'Outside the school'], answer: 1, hint: 'Look at what she did after watering the seed.' },
        { prompt: 'Why did Nuru tell Amani to wait?', options: ['The seed needed time to grow', 'The cup needed more soil', 'She had lost her spoon'], answer: 0, hint: 'Think about what changed between Thursday and Saturday.' },
        { prompt: 'Why did Amani draw the shoot?', options: ['To give Nuru a present', 'To remember where the cup was', 'To compare its size later'], answer: 2, hint: 'Read the last sentence again.' },
      ],
    },
    {
      id: 'rainy-walk',
      title: 'Room Under the Umbrella',
      paragraphs: [
        'Rain began just as Imani left school. She opened her blue umbrella. Her friend Timo stood under the school roof. He had left his umbrella at home.',
        '“Walk with me,” Imani said. They took small steps so both could stay dry. At the corner, a wide puddle covered the path. Timo saw some flat stones near the edge, and they stepped across on the stones.',
        'When they reached Timo’s gate, he thanked Imani. “I helped you stay dry,” she said, “and you helped me cross the puddle.” The two friends waved goodbye.',
      ],
      questions: [
        { prompt: 'Why was Timo waiting under the school roof?', options: ['He was looking for stones', 'He was waiting for breakfast', 'He had left his umbrella at home'], answer: 2, hint: 'The first paragraph tells you what he left behind.' },
        { prompt: 'How did the friends get across the puddle?', options: ['They stepped on flat stones', 'They ran through it', 'They walked around the school'], answer: 0, hint: 'What did Timo see near the edge?' },
        { prompt: 'What did both friends do in the story?', options: ['They carried blue umbrellas', 'They helped each other', 'They waited for the rain to stop'], answer: 1, hint: 'Read what Imani says at the gate.' },
      ],
    },
  ],
  standard: [
    {
      id: 'library-map',
      title: 'The Map in the Library',
      paragraphs: [
        'During lunch, Zuri found a hand-drawn map tucked inside a library book. A dotted line ran from the school gate to a bench near the garden. Beside the bench someone had written, “Look where the shade ends.” Zuri showed the map to her friend Kito. He thought it might lead to a prize.',
        'At the bench, they searched the ground and found only dry leaves. Zuri read the clue again. By then the sun had moved, and the edge of the bench’s shadow reached the garden wall. There, on a ledge, lay a clean envelope weighed down with a pebble.',
        'Inside was a note from last year’s gardening club. It asked whoever found the map to record the first butterfly they saw and leave a new clue for the next reader. Zuri and Kito waited quietly. A yellow butterfly landed on a flower. That afternoon, they added its colour to the note and drew a clue for someone else to follow.',
      ],
      questions: [
        { prompt: 'Where did Zuri find the map?', options: ['On the garden wall', 'Under the bench', 'Inside a library book'], answer: 2, hint: 'Look at the opening sentence.' },
        { prompt: 'What helped Zuri work out where to look next?', options: ['The shadow now reached the wall', 'Kito spotted a butterfly', 'The wind blew the dry leaves away'], answer: 0, hint: 'Think about how the sun changing position affected the clue.' },
        { prompt: 'Why did the two friends leave a new clue?', options: ['To hide the butterfly', 'To let another reader take part', 'To win the prize Kito expected'], answer: 1, hint: 'What did the gardening club ask the finder to do?' },
      ],
    },
    {
      id: 'market-sign',
      title: 'A Sign for Everyone',
      paragraphs: [
        'On market day, Baraka helped his aunt sell mangoes. He made a large sign with his neatest handwriting and stood it in front of their basket. By midmorning, several shoppers had stopped to ask the price, even though it was written on the sign.',
        'Baraka moved across the path to see what the shoppers saw. A basket hid the bottom half of the sign. From farther away, the thin letters also blended into the cardboard. He asked his aunt if he could make another sign.',
        'This time he wrote the price in thick, dark letters and placed it high enough to be seen. He added a drawing of a mango beside the price. A shopper soon pointed at the sign and held up two fingers. Baraka fetched two mangoes. When his aunt asked what had changed, he said, “I tried reading it from where they stand.”',
      ],
      questions: [
        { prompt: 'What hid part of the first sign?', options: ['The stall roof', 'A basket', 'An umbrella'], answer: 1, hint: 'Read what Baraka noticed from across the path.' },
        { prompt: 'Why did Baraka step across the path?', options: ['To see the sign from the shoppers’ viewpoint', 'To buy a darker pen', 'To ask another seller for a price'], answer: 0, hint: 'The shoppers could not easily read the sign. How could he find out why?' },
        { prompt: 'Which detail best shows the new sign worked?', options: ['Baraka used his neatest handwriting', 'His aunt asked what had changed', 'A shopper pointed to the sign and ordered two mangoes'], answer: 2, hint: 'Look for someone using the sign to place an order.' },
      ],
    },
  ],
  advanced: [
    {
      id: 'water-tank',
      title: 'The Silent Water Tank',
      paragraphs: [
        'For three mornings, the school garden’s water tank had been nearly empty. Eli blamed the dry weather, since there had been no rain to refill it. But Rehema remembered that the caretaker had filled the tank with a hose the previous afternoon. If the water had gone somewhere, she wanted to know where.',
        'At lunchtime, they drew a chalk mark level with the water and checked that the tap was closed. When they returned after class, the level had dropped. The soil directly beneath the tank looked dry, so Eli suggested that the chalk mark might have been wrong. Rehema crouched beside the stand and noticed that a patch of grass downhill was darker than the rest.',
        'They followed a narrow line of damp soil back to the tank. Water was escaping from a loose joint underneath the outlet pipe and running along the stand before reaching the ground. They showed the caretaker, who tightened the joint. The next day, another chalk mark confirmed that the water level was holding steady. Eli crossed out “no rain” in his notebook and wrote, “Check what changed.”',
      ],
      questions: [
        { prompt: 'Which fact first made Rehema doubt Eli’s explanation?', options: ['The grass downhill was darker', 'The tap was closed at lunchtime', 'The caretaker had already filled the tank'], answer: 2, hint: 'Look for something Rehema knew before they tested the tank.' },
        { prompt: 'Why was the dry soil directly under the tank misleading?', options: ['Water ran along the stand before reaching the ground', 'The pupils had poured water onto the chalk', 'The soil was covered by the caretaker'], answer: 0, hint: 'Follow the path of the leak in the last paragraph.' },
        { prompt: 'What was the purpose of the second chalk mark?', options: ['To show where the first leak appeared', 'To check whether the repair stopped the water loss', 'To measure how much rain fell that night'], answer: 1, hint: 'What did they learn about the water level after the joint was tightened?' },
      ],
    },
    {
      id: 'debate-seat',
      title: 'The Empty Chair',
      paragraphs: [
        'The school council had one empty chair. Its members disagreed about what to do with it. Wanjiku proposed reserving it for the winner of the debating contest. She argued that a confident speaker would keep meetings moving. Musa suggested inviting a different pupil each week, even if that pupil rarely spoke in front of the class.',
        'They tested Musa’s idea for two meetings. The first visitor hardly said a word, and Wanjiku began to wonder whether the trial had been worth the trouble. Then, just as they were about to vote on moving evening practice ten minutes later, the visitor raised a hand. The last bus left before the proposed finishing time, she explained. Some pupils would have no way home.',
        'The council kept the earlier finishing time. At the following meeting, Wanjiku supported keeping the rotating seat, but she added a suggestion of her own. Give each visitor the agenda a day before the meeting. A good idea, she said, should not have to depend on speaking quickly.',
      ],
      questions: [
        { prompt: 'What was Musa’s original proposal?', options: ['Invite a different pupil each week', 'Choose the winner of the debating contest', 'Move practice ten minutes later'], answer: 0, hint: 'Compare the ideas in the first paragraph.' },
        { prompt: 'What changed Wanjiku’s mind about the rotating seat?', options: ['The visitor won a debate', 'The visitor identified a transport problem the council had missed', 'Musa offered to do the visitor’s work'], answer: 1, hint: 'Which new information changed the council’s decision?' },
        { prompt: 'Why did Wanjiku suggest giving visitors the agenda early?', options: ['To shorten the bus journey', 'To let them leave the meeting early', 'To give them time to think through their ideas'], answer: 2, hint: 'Consider what she says about speaking quickly.' },
      ],
    },
  ],
};

export function isReadingQuest(quest: Quest) {
  return (quest.kind === 'timer' || quest.kind === 'daily') && (
    quest.catalogSlug === 'reading'
    || quest.catalogQuestId === 'catalog-read'
    || (quest.templateId ?? quest.id) === 'read'
  );
}

export function selectReadingStory(day: string, grade: number | null, dateOfBirth: string) {
  const age = calculateAge(dateOfBirth, new Date(`${day}T12:00:00`));
  const level = grade != null
    ? grade <= 4 ? 'short' : grade <= 6 ? 'standard' : 'advanced'
    : age != null && age <= 9 ? 'short' : age != null && age >= 13 ? 'advanced' : 'standard';
  const dayNumber = Math.floor(Date.parse(`${day}T00:00:00Z`) / 86_400_000);
  const levelStories = stories[level];
  return levelStories[((dayNumber % levelStories.length) + levelStories.length) % levelStories.length] ?? levelStories[0];
}

export function readingStoryById(id: string) {
  return Object.values(stories).flat().find(story => story.id === id);
}
