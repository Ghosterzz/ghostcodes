const loginPanel = document.querySelector('#login-panel');
const manager = document.querySelector('#manager');
const memberPanel = document.querySelector('#member-panel');
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

function showMessage(id, text, error = false) {
  const node = document.getElementById(id);
  node.textContent = text;
  node.classList.toggle('error', error);
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(data?.error || 'Something went wrong.');
  return data;
}

async function loadProjects() {
  const projects = await api('/api/projects');
  const list = document.querySelector('#project-list');
  if (!projects.length) {
    list.innerHTML = '<p class="small-muted">No projects yet. Add one above.</p>';
    return;
  }
  list.innerHTML = projects.map(project => `<div class="project-row"><div><strong>${escapeHtml(project.title)}${project.memberOnly ? ' · Members only' : ''}${project.featured ? ' · Featured' : ''}</strong><a href="${escapeHtml(project.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(project.url)}</a></div><button class="btn btn-outline-danger btn-sm" type="button" data-delete="${escapeHtml(project.id)}" aria-label="Delete ${escapeHtml(project.title)}">Delete</button></div>`).join('');
}

function showAccount(user) {
  loginPanel.classList.add('hidden');
  document.querySelector('#member-name').textContent = user.username;
  if (user.role === 'admin') {
    manager.classList.remove('hidden');
    loadProjects().catch(error => showMessage('form-message', error.message, true));
  } else {
    memberPanel.classList.remove('hidden');
    document.querySelector('#member-copy').textContent = user.role === 'member'
      ? 'Your account can access member projects and send bug reports. Project editing is reserved for the site administrator.'
      : 'Your account can send bug reports. Join the configured Discord server or role to unlock member-only projects.';
  }
}

async function signOut() {
  try {
    await api('/api/logout', { method: 'POST' });
    location.href = '/admin';
  } catch (error) {
    showMessage('login-message', error.message, true);
  }
}

document.querySelector('#project-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const values = new FormData(form);
  const data = {
    title: values.get('title'),
    url: values.get('url'),
    description: values.get('description'),
    image: values.get('image'),
    tags: String(values.get('tags') || '').split(',').map(tag => tag.trim()).filter(Boolean),
    featured: values.has('featured'),
    memberOnly: values.has('memberOnly')
  };
  try {
    await api('/api/projects', { method: 'POST', body: JSON.stringify(data) });
    form.reset();
    showMessage('form-message', 'Project saved.');
    await loadProjects();
  } catch (error) {
    showMessage('form-message', error.message, true);
  }
});

document.querySelector('#project-list').addEventListener('click', async event => {
  const button = event.target.closest('[data-delete]');
  if (!button) return;
  button.disabled = true;
  try {
    await api(`/api/projects/${encodeURIComponent(button.dataset.delete)}`, { method: 'DELETE' });
    await loadProjects();
  } catch (error) {
    button.disabled = false;
    showMessage('form-message', error.message, true);
  }
});

document.querySelector('#logout').addEventListener('click', signOut);
document.querySelector('#member-logout').addEventListener('click', signOut);

const error = new URLSearchParams(location.search).get('error');
if (error === 'setup') showMessage('login-message', 'Set up the Discord and MongoDB environment variables in Netlify first.', true);
else if (error === 'discord-signin') showMessage('login-message', 'Discord sign-in could not be completed. Please try again.', true);
else if (error === 'not-authorized') showMessage('login-message', 'This Discord account is not on the site administrator allowlist.', true);
else if (error === 'server-members-only') showMessage('login-message', 'Join the configured Discord server (and required role) before signing in.', true);

api('/api/session')
  .then(session => { if (session.authenticated) showAccount(session); })
  .catch(() => showMessage('login-message', 'The database is not configured yet. Add MONGODB_URI in Netlify site environment variables.', true));
