/* ================================================================
   Project Zenith — Blog CMS  |  Frontend Script
   ================================================================ */

// ── State ─────────────────────────────────────────────────────────────
let allPosts       = [];          // master list from API
let activeCategory = 'All';       // current filter pill
let deleteTargetId = null;        // id pending deletion confirm

// ── DOM Refs ──────────────────────────────────────────────────────────
const blogGrid      = document.getElementById('blogGrid');
const emptyState    = document.getElementById('emptyState');
const statusBar     = document.getElementById('statusBar');
const searchInput   = document.getElementById('searchInput');
const filterBar     = document.getElementById('filterBar');

const postOverlay   = document.getElementById('postOverlay');
const postContent   = document.getElementById('postContent');
const closePost     = document.getElementById('closePost');

const editorOverlay = document.getElementById('editorOverlay');
const editorTitle   = document.getElementById('editorTitle');
const postForm      = document.getElementById('postForm');
const editId        = document.getElementById('editId');
const fTitle        = document.getElementById('fTitle');
const fCategory     = document.getElementById('fCategory');
const fAuthor       = document.getElementById('fAuthor');
const fContent      = document.getElementById('fContent');
const submitBtn     = document.getElementById('submitBtn');
const closeEditor   = document.getElementById('closeEditor');
const cancelEditor  = document.getElementById('cancelEditor');

const confirmOverlay = document.getElementById('confirmOverlay');
const cancelDelete   = document.getElementById('cancelDelete');
const confirmDelete  = document.getElementById('confirmDelete');

const newPostBtn    = document.getElementById('newPostBtn');
const themeToggle   = document.getElementById('themeToggle');
const themeIcon     = themeToggle.querySelector('.theme-icon');
const toast         = document.getElementById('toast');

// ── Init ──────────────────────────────────────────────────────────────
(async function init() {
  loadTheme();
  await loadPosts();
  attachEventListeners();
})();

// ── API Helpers ───────────────────────────────────────────────────────
async function apiFetch(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

// ── Load & Render Posts ───────────────────────────────────────────────
async function loadPosts() {
  showSkeletons();
  try {
    allPosts = await apiFetch('/api/posts');
    renderPosts();
  } catch (err) {
    blogGrid.innerHTML = '';
    showToast(`Failed to load posts: ${err.message}`, 'error');
  }
}

function renderPosts() {
  const query = searchInput.value.trim().toLowerCase();

  const filtered = allPosts.filter(p => {
    const matchCat = activeCategory === 'All' || p.category === activeCategory;
    const matchQ   = !query ||
      p.title.toLowerCase().includes(query) ||
      (p.content || '').toLowerCase().includes(query) ||
      (p.author || '').toLowerCase().includes(query);
    return matchCat && matchQ;
  });

  updateStatusBar(filtered.length, allPosts.length);

  if (filtered.length === 0) {
    blogGrid.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');

  blogGrid.innerHTML = filtered.map(post => cardHTML(post)).join('');
}

function cardHTML(post) {
  const excerpt = (post.content || '').slice(0, 160).replace(/\n/g, ' ');
  const date    = formatDate(post.date);
  return `
    <article class="post-card" data-id="${post._id}" role="article">
      <span class="card-tag">${esc(post.category || 'General')}</span>
      <h2 class="card-title">${esc(post.title)}</h2>
      <p class="card-excerpt">${esc(excerpt)}${post.content.length > 160 ? '…' : ''}</p>
      <div class="card-meta">
        <span class="card-byline">By ${esc(post.author || 'Anonymous')} · ${date}</span>
        <div class="card-actions">
          <button class="icon-btn edit"   data-id="${post._id}" title="Edit"   aria-label="Edit post">✎</button>
          <button class="icon-btn delete" data-id="${post._id}" title="Delete" aria-label="Delete post">✕</button>
        </div>
      </div>
    </article>
  `;
}

function showSkeletons(count = 6) {
  emptyState.classList.add('hidden');
  blogGrid.innerHTML = Array.from({ length: count }, () => `
    <div class="skeleton">
      <div class="ske-line ske-tag"></div>
      <div class="ske-line ske-h"></div>
      <div class="ske-line ske-p1"></div>
      <div class="ske-line ske-p2"></div>
      <div class="ske-line ske-meta"></div>
    </div>
  `).join('');
}

function updateStatusBar(shown, total) {
  if (total === 0) { statusBar.textContent = ''; return; }
  statusBar.textContent = shown === total
    ? `${total} post${total !== 1 ? 's' : ''}`
    : `Showing ${shown} of ${total} posts`;
}

// ── Single Post View ──────────────────────────────────────────────────
function openPostView(id) {
  const post = allPosts.find(p => p._id === id);
  if (!post) return;

  postContent.innerHTML = `
    <span class="post-tag">${esc(post.category || 'General')}</span>
    <h1>${esc(post.title)}</h1>
    <div class="post-meta">
      <span>✍ ${esc(post.author || 'Anonymous')}</span>
      <span>📅 ${formatDate(post.date)}</span>
      ${post.updatedAt ? `<span>✏ Updated ${formatDate(post.updatedAt)}</span>` : ''}
    </div>
    <div class="post-body">${esc(post.content)}</div>
  `;
  openOverlay(postOverlay);
}

// ── Editor ────────────────────────────────────────────────────────────
function openEditor(id = null) {
  postForm.reset();
  if (id) {
    const post = allPosts.find(p => p._id === id);
    if (!post) return;
    editorTitle.textContent = 'Edit Post';
    submitBtn.textContent   = 'Save Changes';
    editId.value            = id;
    fTitle.value            = post.title || '';
    fCategory.value         = post.category || 'General';
    fAuthor.value           = post.author || '';
    fContent.value          = post.content || '';
  } else {
    editorTitle.textContent = 'New Post';
    submitBtn.textContent   = 'Publish';
    editId.value            = '';
  }
  openOverlay(editorOverlay);
  fTitle.focus();
}

postForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const title   = fTitle.value.trim();
  const content = fContent.value.trim();
  if (!title || !content) {
    showToast('Title and content are required.', 'error');
    return;
  }

  const payload = {
    title,
    category: fCategory.value,
    author:   fAuthor.value.trim() || 'Anonymous',
    content
  };

  submitBtn.disabled    = true;
  submitBtn.textContent = 'Saving…';

  try {
    const id = editId.value;
    if (id) {
      await apiFetch(`/api/posts/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      showToast('Post updated successfully!', 'success');
    } else {
      await apiFetch('/api/posts', { method: 'POST', body: JSON.stringify(payload) });
      showToast('Post published!', 'success');
    }
    closeOverlay(editorOverlay);
    await loadPosts();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    submitBtn.disabled = false;
  }
});

// ── Delete ────────────────────────────────────────────────────────────
function triggerDelete(id) {
  deleteTargetId = id;
  openOverlay(confirmOverlay);
}

confirmDelete.addEventListener('click', async () => {
  if (!deleteTargetId) return;
  confirmDelete.disabled    = true;
  confirmDelete.textContent = 'Deleting…';
  try {
    await apiFetch(`/api/posts/${deleteTargetId}`, { method: 'DELETE' });
    showToast('Post deleted.', 'success');
    closeOverlay(confirmOverlay);
    await loadPosts();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    deleteTargetId         = null;
    confirmDelete.disabled = false;
    confirmDelete.textContent = 'Delete';
  }
});

cancelDelete.addEventListener('click', () => {
  deleteTargetId = null;
  closeOverlay(confirmOverlay);
});

// ── Theme Toggle ──────────────────────────────────────────────────────
function loadTheme() {
  const saved = localStorage.getItem('zenith-theme') || 'dark';
  applyTheme(saved);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  themeIcon.textContent = theme === 'dark' ? '☀' : '☾';
  localStorage.setItem('zenith-theme', theme);
}

themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
});

// ── Overlay Helpers ───────────────────────────────────────────────────
function openOverlay(el)  { el.classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
function closeOverlay(el) { el.classList.add('hidden'); document.body.style.overflow = ''; }

// Close overlays on backdrop click
[postOverlay, editorOverlay, confirmOverlay].forEach(el => {
  el.addEventListener('click', e => { if (e.target === el) closeOverlay(el); });
});
closePost.addEventListener('click',   () => closeOverlay(postOverlay));
closeEditor.addEventListener('click', () => closeOverlay(editorOverlay));
cancelEditor.addEventListener('click',() => closeOverlay(editorOverlay));

// Close on Escape key
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  [postOverlay, editorOverlay, confirmOverlay].forEach(ov => {
    if (!ov.classList.contains('hidden')) closeOverlay(ov);
  });
});

// ── Toast ─────────────────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg, type = 'info') {
  toast.textContent = msg;
  toast.className   = `toast ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.className = 'toast hidden'; }, 3200);
}

// ── Utility ───────────────────────────────────────────────────────────
function esc(str = '') {
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;');
}

function formatDate(raw) {
  if (!raw) return '';
  return new Date(raw).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ── Event Delegation ──────────────────────────────────────────────────
function attachEventListeners() {
  // New post button
  newPostBtn.addEventListener('click', () => openEditor());

  // Search
  searchInput.addEventListener('input', () => renderPosts());

  // Category pills
  filterBar.addEventListener('click', e => {
    const pill = e.target.closest('.pill');
    if (!pill) return;
    filterBar.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    activeCategory = pill.dataset.cat;
    renderPosts();
  });

  // Card interactions (open post / edit / delete)
  blogGrid.addEventListener('click', e => {
    const editBtn   = e.target.closest('.icon-btn.edit');
    const deleteBtn = e.target.closest('.icon-btn.delete');
    const card      = e.target.closest('.post-card');

    if (editBtn)   { e.stopPropagation(); openEditor(editBtn.dataset.id); return; }
    if (deleteBtn) { e.stopPropagation(); triggerDelete(deleteBtn.dataset.id); return; }
    if (card)      { openPostView(card.dataset.id); }
  });
}
