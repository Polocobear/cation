// A sample learner for the dashboard prototype. None of this is measured: CATION has no accounts, finished lessons or
// assessments yet, and the dashboard says so wherever it shows these numbers. Everything the dashboard reports about
// the learner comes from this file, in the shape real records would take, so replacing it replaces them all.
// Days are counted back from today (0 is today, 1 yesterday); due dates count forward.

export const SAMPLE = true;

export const learner = { name: 'Nevin', initials: 'N' };

// Enrolments, most recently studied first. `done` is how many lessons are finished, in outline order, so the module
// and lesson in progress follow from it and the course's modules (catalogue.js). `thumb` names a picture in
// /assets/app/. `next` is set where the next lesson already exists somewhere on the site.
export const enrolments = [
  { course: 'inside-the-particle-zoo', done: 6, lastDay: 0, thumb: 'physics' },
  { course: 'forces-in-structures', done: 9, lastDay: 1, thumb: 'structures',
    next: { title: 'Forces in a Warren truss', href: '/#adaptive' } },
  { course: 'calculus-mathematics-of-change', done: 12, lastDay: 2, thumb: 'calculus' },
  { course: 'chemistry-of-change', done: 5, lastDay: 6, thumb: 'chemistry' },
  { course: 'how-computers-think', done: 23, lastDay: 41, thumb: 'computing' },
  { course: 'circuits-and-sensors', done: 0, lastDay: null, thumb: 'electronics' },
];

// The Understanding Map for the course in progress. Each concept belongs to one of the course's modules (by index)
// and carries its practice record: answers to practice questions on it, oldest first, 1 right and 0 wrong. Its state
// (mastered, developing, needs review, not started) is worked out from that record by mastery.js, as it would be from
// real answers. x and y place it on the map, as percentages of its width and height; label says which side its name
// sits on when not below it.
export const understanding = {
  course: 'inside-the-particle-zoo',
  focus: 'pair-production',
  concepts: [
    { id: 'pair-production', name: 'Pair production', module: 1, x: 50, y: 47, practice: '1101101', lastDay: 0,
      about: 'A high-energy photon passing close to a nucleus turns into an electron and a positron.' },
    { id: 'photons', name: 'Photons', module: 0, x: 8, y: 42, practice: '1111011111', lastDay: 19,
      about: 'Light comes in quanta. A photon’s energy is E = hf; it carries momentum but no charge and no mass.' },
    { id: 'nuclear-atom', name: 'The nuclear atom', module: 0, x: 10, y: 82, practice: '1101111111', lastDay: 23,
      about: 'Almost all of an atom’s mass sits in a small, dense, positive nucleus, with the electrons spread round it.' },
    { id: 'mass-energy', name: 'Mass–energy', module: 1, x: 27, y: 9, label: 'left', practice: '0111111011', lastDay: 4,
      about: 'E = mc². Mass is a form of energy, so energy can become the mass of new particles.' },
    { id: 'antimatter', name: 'Antimatter', module: 1, x: 73, y: 9, label: 'right', practice: '1111111110', lastDay: 3,
      about: 'Every particle has an antiparticle with the same mass and the opposite charge. The positron is the electron’s.' },
    { id: 'annihilation', name: 'Annihilation', module: 1, x: 92, y: 42, practice: '', lastDay: null,
      about: 'A particle meets its antiparticle and both turn into energy, usually two photons.' },
    { id: 'conservation', name: 'Conservation laws', module: 2, x: 36, y: 90, practice: '1011001010', lastDay: 9,
      about: 'Charge, energy and momentum are the same before and after any interaction. Imbalances reveal unseen particles.' },
    { id: 'magnetic-field', name: 'Charges in a field', module: 2, x: 93, y: 72, practice: '10111', lastDay: 5,
      about: 'A magnetic field bends a moving charge into a curve of radius r = p / qB: tighter for slower particles.' },
    { id: 'reading-tracks', name: 'Reading tracks', module: 2, x: 66, y: 88, practice: '', lastDay: null,
      about: 'Telling particles apart from their tracks: which way they curve, how tightly, how long they run, and where they meet.' },
  ],
  // [from, to, why]: the first concept is needed to understand the second.
  links: [
    ['photons', 'pair-production', 'The pair is made from a gamma-ray photon’s energy.'],
    ['mass-energy', 'pair-production', 'The photon needs at least 1.022 MeV, the rest energy of the two particles.'],
    ['antimatter', 'pair-production', 'One of the two is a positron, the electron’s antiparticle.'],
    ['nuclear-atom', 'pair-production', 'A nearby nucleus takes up the recoil, so momentum is conserved.'],
    ['conservation', 'pair-production', 'Charge balances: the electron’s −1 and the positron’s +1 sum to the photon’s 0.'],
    ['antimatter', 'annihilation', 'Annihilation is what happens when antimatter meets matter.'],
    ['pair-production', 'annihilation', 'Annihilation is pair production run backwards.'],
    ['pair-production', 'reading-tracks', 'Two opposite spirals from one point are the signature of a pair.'],
    ['magnetic-field', 'reading-tracks', 'Curvature gives a track’s charge and momentum.'],
    ['conservation', 'reading-tracks', 'Momentum missing from an event points to a particle that left no track.'],
  ],
};

// Time spent studying, in minutes per day, for the last 182 days (index 0 is today). Generated from a fixed seed so
// it is the same on every visit: a few sessions a week, longer at weekends, growing over the last two months.
export const studyLog = (() => {
  let s = 20261031;
  const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const today = new Date();
  return Array.from({ length: 182 }, (_, i) => {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i).getDay();
    const weekend = day === 0 || day === 6;
    const habit = 0.5 + 0.3 * Math.max(0, 1 - i / 60);            // more days studied lately
    if (rand() > habit + (weekend ? 0.15 : 0)) return 0;
    const length = (weekend ? 55 : 32) * (0.85 + 0.35 * Math.max(0, 1 - i / 90)) * (0.55 + rand() * 0.9);
    return Math.round(length / 5) * 5;
  });
})();

// Practice questions answered each week, for the last 12 weeks (oldest first), and how many were right.
export const practice = [
  [18, 11], [22, 13], [25, 16], [20, 13], [28, 19], [31, 21], [24, 17], [30, 22], [33, 24], [29, 22], [36, 28], [41, 33],
].map(([answered, correct]) => ({ answered, correct }));

// Coming up, soonest first. `concept` opens that concept on the map; `href` goes to a page that exists.
export const tasks = [
  { id: 'review-conservation', kind: 'review', title: 'Review conservation laws', course: 'inside-the-particle-zoo',
    detail: 'Flagged for review on your map', due: 1, concept: 'conservation' },
  { id: 'truss-lesson', kind: 'lesson', title: 'Lesson: forces in a Warren truss', course: 'forces-in-structures',
    detail: 'Module 3 · Trusses', due: 2, href: '/#adaptive' },
  { id: 'calculus-set', kind: 'practice', title: 'Problem set: rules of differentiation', course: 'calculus-mathematics-of-change',
    detail: 'Module 3 · Rules of differentiation', due: 5, href: '/courses/calculus-mathematics-of-change/#syllabus-title' },
  { id: 'chemistry-quiz', kind: 'quiz', title: 'Quiz: atoms, ions and bonds', course: 'chemistry-of-change',
    detail: 'Module 1 · Atoms, ions and bonds', due: 8, href: '/courses/chemistry-of-change/#syllabus-title' },
  { id: 'circuits-start', kind: 'start', title: 'Start Circuits and Sensors', course: 'circuits-and-sensors',
    detail: 'Module 1 · Charge, current and voltage', due: 12, href: '/courses/circuits-and-sensors/#syllabus-title' },
];
