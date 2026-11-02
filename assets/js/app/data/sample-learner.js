// A sample learner for the dashboard prototype. None of this is measured: CATION has no accounts, finished lessons or
// assessments yet, and the dashboard says so wherever it shows these numbers. Everything the dashboard reports about
// the learner comes from this file, in the shape real records would take, so replacing it replaces them all.
// Days are counted back from today (0 is today, 1 yesterday).

export const SAMPLE = true;

export const learner = { name: 'Nevin', initials: 'N' };

// Enrolments, most recently studied first. `done` is how many lessons are finished, in outline order, so the module
// and lesson in progress follow from it and the course's modules (catalogue.js). `thumb` names the course list's
// picture in /assets/app/ and `picture` the wider one the home page's course cards use. `next` is set where the next
// lesson already exists somewhere on the site.
export const enrolments = [
  { course: 'inside-the-particle-zoo', done: 6, lastDay: 1, thumb: 'physics', picture: '/assets/atlas/physics-960.webp' },
  { course: 'forces-in-structures', done: 9, lastDay: 2, thumb: 'structures', picture: '/assets/atlas/structures-960.webp',
    next: { title: 'Forces in a Warren truss', href: '/#adaptive' } },
  { course: 'calculus-mathematics-of-change', done: 12, lastDay: 4, thumb: 'calculus', picture: '/assets/atlas/calculus-1440.webp' },
  { course: 'chemistry-of-change', done: 5, lastDay: 6, thumb: 'chemistry', picture: '/assets/atlas/chemistry-1440.webp' },
  { course: 'how-computers-think', done: 23, lastDay: 41, thumb: 'computing', picture: '/assets/atlas/computing-960.webp' },
  { course: 'circuits-and-sensors', done: 0, lastDay: null, thumb: 'electronics', picture: '/assets/atlas/electronics-960.webp' },
];

// The Understanding Map for the course in progress. Each concept belongs to one of the course's modules (by index)
// and carries its practice record: answers to practice questions on it, oldest first, 1 right and 0 wrong. Its state
// (mastered, developing, needs review, not started) is worked out from that record by model.js, as it would be from
// real answers. x and y place it on the map, as percentages of its width and height; label says which side its name
// sits on when not below it.
export const understanding = {
  course: 'inside-the-particle-zoo',
  focus: 'pair-production',
  concepts: [
    { id: 'pair-production', name: 'Pair production', module: 1, x: 50, y: 47, practice: '1101101', lastDay: 1,
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

// Learning activity: one event per meaningful learning action, as the platform would log them. `kind` is 'problem'
// (a problem solved), 'practice' (a concept practised) or 'lesson' (a lesson finished); opening the site is not an
// event. Real events would also name the course and concept. Generated from a fixed seed for the last 53 weeks, so it
// is the same on every visit: more days lately than a year ago, a run of the last twelve days, a rest day before it,
// a fortnight away in the summer, and nothing yet today.
export const activity = (() => {
  let s = 20261102;
  const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const now = new Date(), events = [];
  for (let i = 371; i >= 1; i--) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const weekend = day.getDay() === 0 || day.getDay() === 6;
    const run = i <= 12, away = i === 13 || (i >= 96 && i <= 109);
    const chance = 0.26 + 0.42 * Math.max(0, 1 - i / 260) + (weekend ? 0.1 : 0);
    if (away || (!run && rand() > chance)) continue;
    const count = 1 + Math.floor(rand() * rand() * (weekend ? 11 : 8));
    for (let j = 0; j < count; j++) {
      const r = rand();
      events.push({ at: new Date(day.getTime() + (16 + rand() * 6) * 3600e3), kind: r < 0.64 ? 'problem' : r < 0.95 ? 'practice' : 'lesson' });
    }
  }
  return events;
})();
