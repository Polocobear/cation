// Q's answers in this prototype. Q isn't connected to an AI service, so it answers only these questions, each written
// and checked by hand. Each answer has the shape a live assistant would return, so one could replace this file (and
// the matching in ask.js) without changing the interface:
//   question   the question as Q states it back
//   match      words that point a typed question here, with weights
//   concept    the Understanding Map concept it practises (a right answer to the check adds to its record)
//   explain    a few short paragraphs (authored HTML: only <b>, <i>, <sub> and <sup>)
//   figure     which diagram to draw (ask.js), its caption, and the parameter the Explore controls change
//   check      one question, each option with its own feedback
//   deeper     lessons and map concepts to go to, and questions to ask next
// Figures quoted: the electron's rest energy is 0.511 MeV; a lead-208 nucleus's is about 193,700 MeV.

export const topics = [
  {
    id: 'annihilation',
    question: 'Why do matter and antimatter annihilate?',
    match: [['annihilat', 3], ['destroy', 1], ['cancel', 1], ['meet', 1], ['collide', 1], ['matter and antimatter', 2]],
    concept: 'annihilation',
    explain: [
      'An electron and a positron are a matched pair: the same mass, opposite charge, and opposite <i>lepton number</i>, a count that physics also keeps balanced. Put them together and everything that makes an electron an electron adds up to zero.',
      'So nothing stops the pair from turning into something that has none of those properties: light. When they meet, the electromagnetic force acting between them lets all their energy, including the 0.511 MeV each holds as mass, leave as photons.',
      'Nothing is destroyed. Mass changes form, and every bit of the energy is still there, carried off by the photons.',
      'There are at least two photons, because momentum must balance too. A pair meeting at rest has no momentum; a single photon always carries some, but two photons going opposite ways carry none in total.',
    ],
    figure: {
      kind: 'annihilation',
      caption: 'An electron and a positron meet. Two photons leave back to back, sharing the pair’s energy.',
      explore: { label: 'Their kinetic energy, together', min: 0, max: 2, step: 0.01, value: 0, unit: 'MeV' },
    },
    check: {
      prompt: 'An electron and a positron annihilate at rest. Why can’t they make just one photon?',
      options: [
        ['One photon couldn’t carry 1.022 MeV', false, 'A single photon can carry any amount of energy. The obstacle is something else.'],
        ['One photon would carry momentum, and the pair had none', true, 'Right. Two photons going opposite ways are the simplest way to carry off the energy with zero momentum in total.'],
        ['Photons are only ever made in pairs', false, 'Atoms give off single photons all the time. Here it’s momentum that calls for two.'],
      ],
    },
    deeper: {
      lessons: [['Lesson 3 · Can light turn into matter?', '#/lesson/1', 'The reverse process, in Inside the Particle Zoo']],
      soon: ['Lesson 4 · Annihilation', 'Next in your path, still being written'],
      concepts: ['annihilation', 'antimatter'],
      next: ['antiparticle', 'light-to-matter'],
      aside: 'Hospital PET scanners work by detecting these back-to-back 0.511 MeV photons, from positrons given off by a tracer in the body.',
    },
  },
  {
    id: 'light-to-matter',
    question: 'Can light turn into matter?',
    match: [['light', 2], ['photon', 1], ['pair production', 3], ['turn into', 1], ['become', 1], ['matter', 1], ['threshold', 2], ['1.022', 2], ['create', 1], ['made', 1]],
    concept: 'pair-production',
    explain: [
      'Yes. A gamma-ray photon with enough energy can become an electron and a positron. It’s called <b>pair production</b>.',
      '“Enough” is set by E = mc². Each particle holds 0.511 MeV as mass, so the photon needs at least 1.022 MeV. Any energy beyond that becomes the pair’s motion.',
      'It makes a pair, never a lone electron, because charge must balance: the photon has none, and −1 + 1 = 0.',
      'And it happens near something else, usually an atomic nucleus. In empty space a single photon can’t do it, because energy and momentum can’t both balance; the nucleus takes up the momentum the pair can’t.',
    ],
    figure: {
      kind: 'pair',
      caption: 'A photon reaches a lead nucleus in a magnetic field. Above 1.022 MeV, a pair curls away, the electron one way and the positron the other.',
      explore: { label: 'Photon energy', min: 0.6, max: 3, step: 0.01, value: 1.6, unit: 'MeV' },
    },
    check: {
      prompt: 'Could a 0.90 MeV photon make a pair near a nucleus?',
      options: [
        ['Yes, the nucleus makes up the difference', false, 'The nucleus helps with momentum, not energy: it takes only a few electronvolts. The photon still needs 1.022 MeV for the two masses.'],
        ['No, it’s 0.122 MeV short of the two masses', true, 'Right. 0.90 MeV can’t pay for 1.022 MeV of mass, however close the nucleus.'],
        ['Yes, but it would make only an electron', false, 'Then charge would go from 0 to −1. Light becomes matter only as a pair.'],
      ],
    },
    deeper: {
      lessons: [['Lesson 3 · Can light turn into matter?', '#/lesson/3', 'Find the threshold yourself in the bubble-chamber experiment']],
      concepts: ['pair-production', 'mass-energy'],
      next: ['momentum', 'annihilation'],
      aside: 'Two photons colliding can also make a pair, with no nucleus at all: between them they can have zero total momentum. This is called the Breit–Wheeler process.',
    },
  },
  {
    id: 'momentum',
    question: 'Why is momentum conserved during pair production?',
    match: [['momentum', 3], ['recoil', 2], ['nucleus', 1], ['empty space', 2], ['conserv', 1], ['why near', 1]],
    concept: 'conservation',
    explain: [
      'Momentum is conserved in every interaction ever measured: the total before equals the total after. It follows from the laws of physics being the same everywhere in space.',
      'What’s interesting is what that demands here. A photon with energy E carries momentum E/c, the most that energy E can carry. An electron and a positron sharing the same energy always carry less, because 1.022 MeV of it is tied up as their mass.',
      'So some momentum is left over, and something has to take it. A nearby nucleus does, by recoiling.',
      'Because a nucleus is so heavy, it takes the momentum while taking almost no energy: a few electronvolts at most, out of more than a million.',
    ],
    figure: {
      kind: 'momentum',
      caption: 'Momentum before and after, to scale. The pair falls short of the photon’s momentum, and the nucleus makes up the rest.',
      explore: { label: 'Photon energy', min: 1.03, max: 4, step: 0.01, value: 1.4, unit: 'MeV' },
    },
    check: {
      prompt: 'Suppose the nucleus were twice as heavy. For the same recoil momentum, how much energy would it take?',
      options: [
        ['Twice as much', false, 'A heavier object moves more slowly for the same momentum, so it carries less energy, not more.'],
        ['Half as much', true, 'Right. Its kinetic energy is p² / 2M, so doubling M halves the energy. That’s why heavy nuclei work so well.'],
        ['The same', false, 'Its kinetic energy is p² / 2M, so it depends on the mass M.'],
      ],
    },
    deeper: {
      lessons: [['Step 3 · The experiment', '#/lesson/3', 'Fire a photon with no nucleus and see what happens']],
      concepts: ['conservation', 'pair-production'],
      next: ['light-to-matter', 'annihilation'],
    },
  },
  {
    id: 'antiparticle',
    question: 'What is the difference between a particle and an antiparticle?',
    match: [['antiparticle', 3], ['positron', 2], ['difference', 1], ['opposite', 1], ['antimatter', 1], ['anti', 1]],
    concept: 'antimatter',
    explain: [
      'An antiparticle has exactly the same mass and spin as its particle, and the opposite electric charge, along with the opposite of other conserved counts such as lepton number.',
      'The positron is the electron’s antiparticle: 0.511 MeV of mass and a charge of +1 instead of −1.',
      'In a magnetic field, an electron and a positron with the same momentum curve by the same amount in opposite directions. That’s how the positron was first recognised, in cloud-chamber photographs of cosmic rays in 1932.',
      'A few neutral particles, the photon among them, are their own antiparticles. And “anti” doesn’t mean negative mass: an antiparticle’s mass is as positive as its particle’s.',
    ],
    figure: {
      kind: 'mirror',
      caption: 'An electron and a positron with the same momentum, starting together in the same magnetic field.',
      explore: { label: 'Momentum of each', min: 0.3, max: 2, step: 0.01, value: 0.9, unit: 'MeV/c', flip: true },
    },
    check: {
      prompt: 'An electron and a positron with the same momentum cross the same magnetic field. How do their tracks compare?',
      options: [
        ['The same radius, curving opposite ways', true, 'Right. The radius r = p / qB depends on momentum and the size of the charge, which they share. Only the sign differs.'],
        ['The positron’s curve is tighter', false, 'Their masses and the size of their charges are equal, so for the same momentum the radius is the same.'],
        ['Identical tracks', false, 'Opposite charges feel opposite forces in the same field, so they curve opposite ways.'],
      ],
    },
    deeper: {
      lessons: [['Lesson 3 · Can light turn into matter?', '#/lesson/2', 'Why light makes matter and antimatter together']],
      concepts: ['antimatter', 'magnetic-field'],
      next: ['annihilation', 'light-to-matter'],
    },
  },
];

// What to suggest first, from where Q was opened: a step of the lesson, a concept on the map, or a chapter.
export const SUGGEST = {
  lesson: { 1: ['light-to-matter', 'antiparticle'], 2: ['antiparticle', 'light-to-matter'], 3: ['momentum', 'light-to-matter'], 4: ['momentum', 'annihilation'], 5: ['annihilation', 'antiparticle'] },
  concept: { 'pair-production': ['light-to-matter', 'momentum'], antimatter: ['antiparticle', 'annihilation'], annihilation: ['annihilation', 'antiparticle'],
    'mass-energy': ['light-to-matter'], photons: ['light-to-matter'], conservation: ['momentum'], 'magnetic-field': ['antiparticle'], 'reading-tracks': ['antiparticle'] },
  chapter: ['light-to-matter', 'annihilation'],
};
