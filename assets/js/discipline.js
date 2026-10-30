// Discipline pages: narrow the course list by level, or by subject from a subject card's link.
// Without this script every course is simply listed.

const filter = document.querySelector('.filter');
const rows = [...document.querySelectorAll('.course-row')];
const empty = document.querySelector('.filter-empty');

if (filter && rows.length) {
  const names = Object.fromEntries([...document.querySelectorAll('.subject-card')].map((card) => {
    const link = card.querySelector('.sc-link[data-subject]');
    return [link?.dataset.subject, card.querySelector('h3').textContent];
  }));
  let level = '';
  let subject = '';

  const clear = document.createElement('button');
  clear.type = 'button';
  clear.className = 'filter-subject';
  clear.hidden = true;
  filter.append(clear);

  const apply = () => {
    for (const row of rows) {
      row.hidden = (level && row.dataset.level !== level) || (subject && row.dataset.subject !== subject);
    }
    empty.hidden = rows.some((row) => !row.hidden);
    for (const b of filter.querySelectorAll('button[data-level]')) b.setAttribute('aria-pressed', String(b.dataset.level === level));
    clear.hidden = !subject;
    clear.setAttribute('aria-pressed', 'true');
    clear.textContent = subject ? `${names[subject]}  ✕` : '';
    clear.setAttribute('aria-label', subject ? `Showing ${names[subject]} only. Show every subject` : '');
  };

  filter.hidden = false;
  filter.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b === clear) subject = '';
    else level = b.dataset.level;
    apply();
  });
  for (const link of document.querySelectorAll('.sc-link[data-subject]')) {
    link.addEventListener('click', () => { subject = link.dataset.subject; level = ''; apply(); });
  }
  apply();
}
