import crypto from 'crypto';
import { Difficulty, RareAnswerChallengeServer, RARE_ANSWER_ROUND_DURATION_MS } from '@mind-clash/shared';
import { QuestionPoolExhaustedError } from '../services/duplicatePrevention.js';

export interface RawRareAnswerItem {
  id: string;
  difficulty: Difficulty;
  category: string;
  prompt: string;
  acceptableAnswers: string[];
}

export const RARE_ANSWER_BANK: RawRareAnswerItem[] = [
  // ===================== EASY (Familiar everyday categories) =====================
  {
    id: 'ra-easy-1',
    difficulty: 'easy',
    category: 'Animals That Fly',
    prompt: 'Name an animal or bird that can fly',
    acceptableAnswers: [
      'bat', 'eagle', 'parrot', 'hawk', 'owl', 'pigeon', 'crow', 'falcon', 'seagull', 'duck',
      'goose', 'swan', 'pelican', 'hummingbird', 'sparrow', 'woodpecker', 'vulture', 'flamingo',
      'swallow', 'albatross', 'bee', 'wasp', 'butterfly', 'moth', 'dragonfly', 'mosquito', 'fly',
      'beetle', 'ladybug', 'flying squirrel', 'flying fish',
    ],
  },
  {
    id: 'ra-easy-2',
    difficulty: 'easy',
    category: 'Common Fruits',
    prompt: 'Name any fruit',
    acceptableAnswers: [
      'apple', 'banana', 'orange', 'grape', 'strawberry', 'blueberry', 'watermelon', 'pineapple',
      'mango', 'peach', 'cherry', 'plum', 'pear', 'lemon', 'lime', 'kiwi', 'raspberry', 'blackberry',
      'pomegranate', 'apricot', 'fig', 'guava', 'papaya', 'grapefruit', 'coconut', 'avocado', 'tomato',
      'cantaloupe', 'honeydew', 'cranberry',
    ],
  },
  {
    id: 'ra-easy-3',
    difficulty: 'easy',
    category: 'Musical Instruments',
    prompt: 'Name a musical instrument',
    acceptableAnswers: [
      'piano', 'guitar', 'violin', 'drums', 'flute', 'trumpet', 'saxophone', 'clarinet', 'cello',
      'harp', 'trombone', 'tuba', 'accordion', 'banjo', 'harmonica', 'ukulele', 'bass guitar',
      'viola', 'oboe', 'bassoon', 'xylophone', 'keyboard', 'organ', 'mandolin', 'tambourine', 'bongo',
    ],
  },
  {
    id: 'ra-easy-4',
    difficulty: 'easy',
    category: 'Ball Sports',
    prompt: 'Name a sport played with a ball',
    acceptableAnswers: [
      'soccer', 'football', 'basketball', 'baseball', 'tennis', 'volleyball', 'golf', 'cricket',
      'rugby', 'table tennis', 'ping pong', 'bowling', 'dodgeball', 'handball', 'water polo', 'lacrosse',
      'badminton', 'squash', 'racquetball', 'softball', 'billiards', 'pool', 'polo',
    ],
  },
  {
    id: 'ra-easy-5',
    difficulty: 'easy',
    category: 'Colors & Hues',
    prompt: 'Name a color or color hue',
    acceptableAnswers: [
      'red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'brown', 'black', 'white',
      'gray', 'grey', 'cyan', 'magenta', 'turquoise', 'violet', 'indigo', 'amber', 'maroon',
      'teal', 'navy', 'olive', 'lime', 'coral', 'crimson', 'gold', 'silver', 'bronze', 'beige',
    ],
  },
  {
    id: 'ra-easy-6',
    difficulty: 'easy',
    category: 'Breakfast Foods',
    prompt: 'Name a food commonly eaten for breakfast',
    acceptableAnswers: [
      'pancake', 'pancakes', 'waffle', 'waffles', 'toast', 'egg', 'eggs', 'bacon', 'cereal',
      'oatmeal', 'bagel', 'croissant', 'muffin', 'yogurt', 'omelet', 'omelette', 'sausage',
      'hash browns', 'french toast', 'fruit', 'smoothie', 'burrito',
    ],
  },
  {
    id: 'ra-easy-7',
    difficulty: 'easy',
    category: 'Kitchen Appliances',
    prompt: 'Name an electrical kitchen appliance',
    acceptableAnswers: [
      'refrigerator', 'fridge', 'microwave', 'toaster', 'blender', 'oven', 'dishwasher',
      'coffee maker', 'air fryer', 'mixer', 'kettle', 'food processor', 'slow cooker',
      'waffle maker', 'rice cooker', 'toaster oven', 'grill',
    ],
  },
  {
    id: 'ra-easy-8',
    difficulty: 'easy',
    category: 'Pizza Toppings',
    prompt: 'Name a popular pizza topping',
    acceptableAnswers: [
      'pepperoni', 'mushrooms', 'mushroom', 'onions', 'onion', 'sausage', 'bacon', 'cheese',
      'black olives', 'olives', 'green peppers', 'peppers', 'pineapple', 'spinach', 'chicken',
      'ham', 'tomatoes', 'basil', 'jalapeno', 'anchovies', 'garlic', 'beef',
    ],
  },
  {
    id: 'ra-easy-9',
    difficulty: 'easy',
    category: 'School Subjects',
    prompt: 'Name an academic school subject',
    acceptableAnswers: [
      'math', 'mathematics', 'science', 'history', 'english', 'art', 'music', 'geography',
      'biology', 'chemistry', 'physics', 'physical education', 'gym', 'literature', 'drama',
      'social studies', 'economics', 'computer science', 'algebra', 'geometry',
    ],
  },
  {
    id: 'ra-easy-10',
    difficulty: 'easy',
    category: 'Major Currencies',
    prompt: 'Name a national currency',
    acceptableAnswers: [
      'dollar', 'us dollar', 'euro', 'yen', 'pound', 'british pound', 'franc', 'swiss franc',
      'peso', 'rupee', 'won', 'ruble', 'yuan', 'dinar', 'dirham', 'shekel', 'rand', 'krona',
    ],
  },

  // ===================== MEDIUM (Broader knowledge & more specific sets) =====================
  {
    id: 'ra-med-1',
    difficulty: 'medium',
    category: 'European Capital Cities',
    prompt: 'Name an official capital city located in Europe',
    acceptableAnswers: [
      'london', 'paris', 'berlin', 'rome', 'madrid', 'vienna', 'dublin', 'oslo', 'stockholm',
      'helsinki', 'warsaw', 'lisbon', 'athens', 'amsterdam', 'brussels', 'prague', 'budapest',
      'copenhagen', 'bern', 'reykjavik', 'zagreb', 'belgrade', 'bratislava', 'ljubljana', 'vilnius',
      'riga', 'tallinn', 'bucharest', 'sofia', 'kiev', 'kyiv', 'minsk', 'sarajevo', 'tirana',
    ],
  },
  {
    id: 'ra-med-2',
    difficulty: 'medium',
    category: 'Chemical Elements',
    prompt: 'Name a chemical element from the periodic table',
    acceptableAnswers: [
      'hydrogen', 'helium', 'lithium', 'beryllium', 'boron', 'carbon', 'nitrogen', 'oxygen',
      'fluorine', 'neon', 'sodium', 'magnesium', 'aluminum', 'silicon', 'phosphorus', 'sulfur',
      'chlorine', 'argon', 'potassium', 'calcium', 'scandium', 'titanium', 'vanadium', 'chromium',
      'manganese', 'iron', 'cobalt', 'nickel', 'copper', 'zinc', 'gallium', 'germanium', 'arsenic',
      'selenium', 'bromine', 'krypton', 'silver', 'gold', 'platinum', 'mercury', 'lead', 'uranium',
    ],
  },
  {
    id: 'ra-med-3',
    difficulty: 'medium',
    category: 'Countries in South America',
    prompt: 'Name a sovereign country in South America',
    acceptableAnswers: [
      'brazil', 'argentina', 'colombia', 'peru', 'chile', 'venezuela', 'ecuador', 'bolivia',
      'paraguay', 'uruguay', 'guyana', 'suriname',
    ],
  },
  {
    id: 'ra-med-4',
    difficulty: 'medium',
    category: 'Oceans and Major Seas',
    prompt: 'Name a recognized ocean or sea',
    acceptableAnswers: [
      'pacific ocean', 'pacific', 'atlantic ocean', 'atlantic', 'indian ocean', 'indian',
      'arctic ocean', 'arctic', 'southern ocean', 'mediterranean sea', 'mediterranean',
      'caribbean sea', 'caribbean', 'baltic sea', 'baltic', 'red sea', 'black sea', 'caspian sea',
      'north sea', 'bering sea', 'coral sea', 'arabian sea', 'south china sea', 'dead sea',
      'tasman sea', 'aegean sea', 'adriatic sea',
    ],
  },
  {
    id: 'ra-med-5',
    difficulty: 'medium',
    category: 'US States Starting With "M"',
    prompt: 'Name a US State that begins with the letter M',
    acceptableAnswers: [
      'maine', 'maryland', 'massachusetts', 'michigan', 'minnesota', 'mississippi', 'missouri', 'montana',
    ],
  },
  {
    id: 'ra-med-6',
    difficulty: 'medium',
    category: 'Zodiac Signs',
    prompt: 'Name a western astrological zodiac sign',
    acceptableAnswers: [
      'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius',
      'capricorn', 'aquarius', 'pisces',
    ],
  },
  {
    id: 'ra-med-7',
    difficulty: 'medium',
    category: 'Asian Capital Cities',
    prompt: 'Name an official national capital city located in Asia',
    acceptableAnswers: [
      'tokyo', 'beijing', 'seoul', 'bangkok', 'new delhi', 'jakarta', 'manila', 'hanoi',
      'singapore', 'kuala lumpur', 'taipei', 'riyadh', 'ankara', 'baghdad', 'tehran',
      'islamabad', 'kathmandu', 'kabul', 'dhaka', 'doha', 'abu dhabi', 'muscat', 'amman',
      'beirut', 'damascus', 'ulan bator', 'ulaanbaatar', 'colombo', 'phnom penh', 'vientiane',
    ],
  },
  {
    id: 'ra-med-8',
    difficulty: 'medium',
    category: 'Programming Languages',
    prompt: 'Name a computer programming language',
    acceptableAnswers: [
      'python', 'javascript', 'typescript', 'java', 'c', 'c++', 'c#', 'rust', 'go', 'golang',
      'ruby', 'swift', 'kotlin', 'php', 'perl', 'haskell', 'scala', 'r', 'matlab', 'lua',
      'dart', 'elixir', 'clojure', 'fortran', 'cobol', 'assembly', 'sql', 'bash',
    ],
  },
  {
    id: 'ra-med-9',
    difficulty: 'medium',
    category: 'World Deserts',
    prompt: 'Name a major world desert',
    acceptableAnswers: [
      'sahara', 'sahara desert', 'arabian desert', 'gobi', 'gobi desert', 'kalahari',
      'patagonian desert', 'atacama', 'atacama desert', 'mojave', 'mojave desert',
      'great victoria desert', 'namib', 'namib desert', 'thar desert', 'sonoran desert',
      'antarctic desert', 'arctic desert', 'chihuahuan desert', 'karakum',
    ],
  },
  {
    id: 'ra-med-10',
    difficulty: 'medium',
    category: 'Major Human Organs',
    prompt: 'Name an internal or external organ of the human body',
    acceptableAnswers: [
      'heart', 'lungs', 'liver', 'brain', 'kidneys', 'kidney', 'stomach', 'pancreas',
      'spleen', 'intestines', 'skin', 'bladder', 'gallbladder', 'thyroid', 'esophagus',
      'trachea', 'larynx', 'pharynx', 'appendix', 'thymus',
    ],
  },

  // ===================== HARD (Specialized, clearly bounded sets) =====================
  {
    id: 'ra-hard-1',
    difficulty: 'hard',
    category: 'African Capital Cities',
    prompt: 'Name an official national capital city in Africa',
    acceptableAnswers: [
      'cairo', 'nairobi', 'pretoria', 'cape town', 'bloemfontein', 'dakar', 'abuja', 'rabat',
      'addis ababa', 'accra', 'kampala', 'tunis', 'kigali', 'luanda', 'bamako', 'tripoli',
      'algiers', 'harare', 'lusaka', 'maputo', 'antananarivo', 'windhoek', 'gaborone', 'djibouti',
      'libreville', 'yaounde', 'kinshasa', 'brazzaville', 'monrovia', 'freetown', 'nouakchott',
    ],
  },
  {
    id: 'ra-hard-2',
    difficulty: 'hard',
    category: 'Shakespearean Plays',
    prompt: 'Name a play written by William Shakespeare',
    acceptableAnswers: [
      'hamlet', 'macbeth', 'othello', 'king lear', 'romeo and juliet', 'the tempest',
      'midsummer night\'s dream', 'a midsummer night\'s dream', 'much ado about nothing',
      'twelfth night', 'julius caesar', 'the merchant of venice', 'as you like it',
      'richard iii', 'henry v', 'the taming of the shrew', 'antony and cleopatra', 'coriolanus',
      'the winter\'s tale', 'cymbeline', 'measure for measure', 'the comedy of errors',
    ],
  },
  {
    id: 'ra-hard-3',
    difficulty: 'hard',
    category: 'Apollo Moonwalkers',
    prompt: 'Name one of the 12 Apollo astronauts who walked on the Moon',
    acceptableAnswers: [
      'neil armstrong', 'armstrong', 'buzz aldrin', 'aldrin', 'pete conrad', 'conrad',
      'alan bean', 'bean', 'alan shepard', 'shepard', 'edgar mitchell', 'mitchell',
      'david scott', 'scott', 'james irwin', 'irwin', 'john young', 'young',
      'charles duke', 'duke', 'gene cernan', 'eugene cernan', 'cernan', 'harrison schmitt', 'schmitt',
    ],
  },
  {
    id: 'ra-hard-4',
    difficulty: 'hard',
    category: 'Landlocked European Nations',
    prompt: 'Name a European country with no direct coastline (landlocked)',
    acceptableAnswers: [
      'switzerland', 'austria', 'czech republic', 'czechia', 'slovakia', 'hungary', 'serbia',
      'belarus', 'luxembourg', 'liechtenstein', 'andorra', 'san marino', 'vatican city', 'vatican',
      'moldova', 'north macedonia', 'kosovo',
    ],
  },
  {
    id: 'ra-hard-5',
    difficulty: 'hard',
    category: 'Chemical Elements Named After Places or Scientists',
    prompt: 'Name a chemical element named after a scientist or geographic location',
    acceptableAnswers: [
      'curium', 'einsteinium', 'fermium', 'mendelevium', 'nobelium', 'lawrencium', 'rutherfordium',
      'seaborgium', 'bohrium', 'meitnerium', 'roentgenium', 'copernicium', 'polonium', 'francium',
      'americium', 'californium', 'europium', 'gallium', 'germanium', 'scandium', 'berkelium',
      'hassium', 'darmstadtium', 'tennessine', 'nihonium', 'moscovium',
    ],
  },
  {
    id: 'ra-hard-6',
    difficulty: 'hard',
    category: 'Former Roman Emperors',
    prompt: 'Name a recognized Roman Emperor',
    acceptableAnswers: [
      'augustus', 'tiberius', 'caligula', 'claudius', 'nero', 'galba', 'otho', 'vitellius',
      'vespasian', 'titus', 'domitian', 'nerva', 'trajan', 'hadrian', 'antoninus pius',
      'marcus aurelius', 'commodus', 'septimius severus', 'caracalla', 'diocletian',
      'constantine', 'justinian', 'valerian', 'aurelian',
    ],
  },
  {
    id: 'ra-hard-7',
    difficulty: 'hard',
    category: 'Halogens and Noble Gases',
    prompt: 'Name an element that belongs to either the halogens (Group 17) or noble gases (Group 18)',
    acceptableAnswers: [
      'fluorine', 'chlorine', 'bromine', 'iodine', 'astatine', 'tennessine',
      'helium', 'neon', 'argon', 'krypton', 'xenon', 'radon', 'oganesson',
    ],
  },
  {
    id: 'ra-hard-8',
    difficulty: 'hard',
    category: 'Moons of Jupiter',
    prompt: 'Name a recognized natural moon of the planet Jupiter',
    acceptableAnswers: [
      'io', 'europa', 'ganymede', 'callisto', 'amalthea', 'himalia', 'elara', 'pasiphae',
      'sinope', 'lysithea', 'carme', 'ananke', 'leda', 'thebe', 'adrastea', 'metis',
    ],
  },
  {
    id: 'ra-hard-9',
    difficulty: 'hard',
    category: 'Landlocked Asian Countries',
    prompt: 'Name a sovereign landlocked nation in Asia',
    acceptableAnswers: [
      'afghanistan', 'armenia', 'azerbaijan', 'bhutan', 'kazakhstan', 'kyrgyzstan', 'laos',
      'mongolia', 'nepal', 'tajikistan', 'turkmenistan', 'uzbekistan',
    ],
  },
  {
    id: 'ra-hard-10',
    difficulty: 'hard',
    category: 'Black Sea Bordering Countries',
    prompt: 'Name a sovereign nation that borders the Black Sea',
    acceptableAnswers: [
      'turkey', 'bulgaria', 'romania', 'ukraine', 'russia', 'georgia',
    ],
  },
];

/**
 * Normalizes answer text for consistent rarity comparison.
 */
export function normalizeAnswer(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()'"?]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Checks whether a candidate answer matches an acceptable answer.
 */
export function isAnswerAcceptable(candidate: string, acceptableList: string[]): boolean {
  const normCandidate = normalizeAnswer(candidate);
  if (!normCandidate) return false;

  return acceptableList.some((acc) => {
    const normAcc = normalizeAnswer(acc);
    return normAcc === normCandidate || normCandidate.includes(normAcc) || normAcc.includes(normCandidate);
  });
}

/**
 * Retrieves a non-repeating Rare Answer challenge for the requested difficulty.
 * Guaranteed never to substitute an easier level.
 */
export function getRandomRareAnswer(
  usedChallengeIds: Set<string>,
  difficulty: Difficulty = 'medium',
  allowRecycle = false
): RareAnswerChallengeServer {
  const pool = RARE_ANSWER_BANK.filter((item) => item.difficulty === difficulty);
  let available = pool.filter((item) => !usedChallengeIds.has(item.id));
  if (available.length === 0) {
    if (!allowRecycle) {
      throw new QuestionPoolExhaustedError(
        `Offline Rare Answer pool exhausted: All available prompts for difficulty '${difficulty}' have been recently played in this room. Please select a different difficulty or reset room history.`
      );
    }
    available = pool;
  }

  const selectedIndex = crypto.randomInt(0, available.length);
  const selected = available[selectedIndex];

  return {
    id: selected.id,
    category: selected.category,
    prompt: selected.prompt,
    difficulty: selected.difficulty,
    durationMs: RARE_ANSWER_ROUND_DURATION_MS,
    acceptableAnswers: selected.acceptableAnswers,
  };
}
