const grid = document.querySelector('#projects');
const search = document.querySelector('#search');
const count = document.querySelector('#project-count');
const accountAction = document.querySelector('#account-action');
const bugForm = document.querySelector('#bug-form');
let projects = [];
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

function renderProjects() {
  const query = search.value.trim().toLowerCase();
  const visible = projects.filter(project => `${project.title} ${project.description} ${(project.tags || []).join(' ')}`.toLowerCase().includes(query));
  count.textContent = `${visible.length} ${visible.length === 1 ? 'project' : 'projects'}`;
  if (!visible.length) {
    grid.innerHTML = `<div class="empty">${projects.length ? 'No projects match that search.' : 'Projects are on the way. Check back soon.'}</div>`;
    return;
  }
  grid.innerHTML = visible.map(project => `<article class="card project-card"><div class="project-image">${project.image ? `<img src="${escapeHtml(project.image)}" alt="" loading="lazy">` : `<span>${escapeHtml(project.title.slice(0,2).toUpperCase())}</span>`}</div><div class="card-body"><div class="d-flex justify-content-between align-items-center gap-2 w-100"><h3 class="h5 card-title mb-0">${escapeHtml(project.title)}</h3><span class="d-flex gap-1">${project.featured ? '<span class="badge bg-secondary featured">Featured</span>' : ''}${project.memberOnly ? '<span class="badge bg-dark featured">Members</span>' : ''}</span></div><p class="card-text mt-3">${escapeHtml(project.description)}</p><div class="project-tags">${(project.tags || []).map(tag => `<span class="badge bg-light text-dark project-tag">${escapeHtml(tag)}</span>`).join('')}</div><a class="btn btn-primary mt-auto" href="${escapeHtml(project.url)}" target="_blank" rel="noopener noreferrer">Visit project ↗</a></div></article>`).join('');
  grid.querySelectorAll('.project-image img').forEach(image => image.addEventListener('error', () => image.remove(), { once: true }));
}

document.querySelector('#project-search-form').addEventListener('submit', event => event.preventDefault());
search.addEventListener('input', renderProjects);
document.querySelector('#year').textContent = new Date().getFullYear();

async function loadProjects() {
  const response = await fetch('/api/projects');
  if (!response.ok) throw new Error();
  projects = await response.json();
  renderProjects();
}

async function loadAccount() {
  try {
    const response = await fetch('/api/session');
    const session = await response.json();
    if (!session.authenticated) return;
    accountAction.href = '#';
    accountAction.textContent = `${session.username} · Sign out`;
    accountAction.addEventListener('click', async event => {
      event.preventDefault();
      await fetch('/api/logout', { method: 'POST' });
      location.reload();
    });
    document.querySelector('#bug-login-note').textContent = `Signed in as ${session.username}. Reports go to the site team.`;
    bugForm.classList.remove('hidden');
    const note = document.querySelector('#member-note');
    note.textContent = session.role === 'member' || session.role === 'admin' ? 'Member projects are unlocked for your account.' : 'Join the community Discord to unlock member projects.';
  } catch {
    // The public project list can still render if the account endpoint is unavailable.
  }
}

bugForm.addEventListener('submit', async event => {
  event.preventDefault();
  const message = document.querySelector('#bug-message');
  message.textContent = 'Sending…';
  const payload = {
    title: document.querySelector('#bug-title').value,
    details: document.querySelector('#bug-details').value,
    pageUrl: location.href,
    website: document.querySelector('#website').value
  };
  try {
    const response = await fetch('/api/bug-reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not send report.');
    message.textContent = result.notified ? 'Thanks! The report was sent to the team.' : 'Thanks! The report was saved. Discord notifications are not configured yet.';
    event.currentTarget.reset();
  } catch (error) {
    message.textContent = error.message;
  }
});

const params = new URLSearchParams(location.search);
if (params.get('error') === 'server-members-only') document.querySelector('#member-note').textContent = 'Join the configured Discord server or role to unlock member projects.';
else if (params.get('error') === 'setup') document.querySelector('#member-note').textContent = 'Discord sign-in is not set up yet. Please check back later.';
Promise.all([loadAccount(), loadProjects()]).catch(() => {
  grid.innerHTML = '<div class="empty">Could not load projects right now. Please refresh in a moment.</div>';
});
