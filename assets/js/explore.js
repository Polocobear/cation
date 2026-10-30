// Explore: search every subject and filter by discipline. State is kept in the URL (?q=, ?d=) so a
// filtered list can be shared. Without this script the full index is shown.

const input = document.getElementById('search');
const groups = [...document.querySelectorAll('.x-group')];
const buttons = [...document.querySelectorAll('.x-filter button')];
const count = document.querySelector('.x-count');
const empty = document.querySelector('.x-empty');

if (input && groups.length) {
  const params = new URLSearchParams(location.search);
  let discipline = params.get('d') || '';
  input.value = params.get('q') || '';

  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

  const apply = () => {
    const terms = input.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let subjects = 0, courses = 0;
    for (const group of groups) {
      const inScope = !discipline || group.dataset.discipline === discipline;
      let shown = 0;
      for (const s of group.querySelectorAll('.x-subject')) {
        const hit = inScope && terms.every((t) => s.dataset.search.includes(t));
        s.hidden = !hit;
        if (hit) { shown++; courses += s.querySelectorAll('.x-courses a').length; }
      }
      group.hidden = shown === 0;
      subjects += shown;
    }
    count.textContent = `${plural(subjects, 'subject')} · ${plural(courses, 'course')}`;
    empty.hidden = subjects > 0;
    for (const b of buttons) b.setAttribute('aria-pressed', String(b.dataset.discipline === discipline));

    const next = new URLSearchParams();
    if (input.value.trim()) next.set('q', input.value.trim());
    if (discipline) next.set('d', discipline);
    const qs = next.toString();
    history.replaceState(null, '', `${location.pathname}${qs ? `?${qs}` : ''}${location.hash}`);
  };

  input.addEventListener('input', apply);
  for (const b of buttons) {
    b.addEventListener('click', () => { discipline = b.dataset.discipline; apply(); });
  }
  if (location.hash === '#search') input.focus({ preventScroll: true });
  apply();
}
