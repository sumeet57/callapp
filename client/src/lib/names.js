// 40 adjectives x 25 animals = a pool of exactly 1000 names, built once at load.
// Names are NOT checked for uniqueness across users: two people can share a name.
const ADJ = [
  'Brave', 'Calm', 'Clever', 'Cosmic', 'Crisp', 'Daring', 'Eager', 'Fancy', 'Gentle', 'Golden',
  'Happy', 'Hazy', 'Icy', 'Jolly', 'Keen', 'Lucky', 'Mellow', 'Misty', 'Noble', 'Odd',
  'Peppy', 'Quick', 'Quiet', 'Rapid', 'Royal', 'Shiny', 'Silent', 'Sleepy', 'Snowy', 'Solar',
  'Spicy', 'Sunny', 'Swift', 'Tiny', 'Vivid', 'Warm', 'Wild', 'Witty', 'Zesty', 'Zen',
];
const ANI = [
  'Otter', 'Falcon', 'Panda', 'Fox', 'Tiger', 'Koala', 'Lynx', 'Heron', 'Gecko', 'Bison',
  'Moose', 'Raven', 'Whale', 'Zebra', 'Yak', 'Wolf', 'Eagle', 'Badger', 'Cobra', 'Dingo',
  'Ferret', 'Lemur', 'Parrot', 'Turtle', 'Walrus',
];

export const NAMES = ADJ.flatMap((a) => ANI.map((n) => `${a} ${n}`));

export const randomName = () => NAMES[Math.floor(Math.random() * NAMES.length)];
