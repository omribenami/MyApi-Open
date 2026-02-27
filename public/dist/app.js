// MyApi Dashboard - Full UI app (vanilla JS) that communicates with the MVP backend.
// This replaces the placeholder UI with a real admin dashboard wired to vault tokens, users, and handshakes.

let TOKEN = null;
let API_BASE = '';

function $(id){ return document.getElementById(id); }

function api(path, options = {}) {
  const url = (path.startsWith('http') ? path : API_BASE + path);
  const headers = options.headers ? Object.assign({}, options.headers) : {};
  if (TOKEN) headers['Authorization'] = 'Bearer ' + TOKEN;
  if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
  return fetch(url, Object.assign({ method: options.method || 'GET', body: options.body ? JSON.stringify(options.body) : undefined, headers }, options));
}

function loginUI(){
  // simple login flow; in MVP we use a master token
  const token = localStorage.getItem('myapi_token');
  if(token){ TOKEN = token; showMain(); loadAll(); }
}

function showMain(){
  $('#loginCard').style.display = 'none';
  $('#mainCard').style.display = 'block';
}

function showLogin(){
  $('#loginCard').style.display = 'block';
  $('#mainCard').style.display = 'none';
}

function logout(){
  TOKEN = null;
  localStorage.removeItem('myapi_token');
  showLogin();
}

$('#loginBtn').addEventListener('click', async ()=>{
  const t = $('#masterToken').value.trim();
  if(!t){ alert('Please enter master token'); return; }
  TOKEN = t;
  try {
    const r = await fetch('/health');
    if (!r.ok) throw new Error('Server not reachable');
    // verify by calling a protected endpoint requiring auth
    const v = await api('/api/v1/tokens', { method: 'GET' });
    if (!v.ok){ throw new Error('Invalid token'); }
    localStorage.setItem('myapi_token', TOKEN);
    showMain();
    loadAll();
  } catch(e){ alert('Login failed: ' + e.message); TOKEN = null; }
});

$('#logoutBtn').addEventListener('click', ()=>{ logout(); });

function loadAll(){
  loadUsers();
  loadVaultTokens();
  loadHandshakes();
}

// Users
async function loadUsers(){
  const r = await api('/api/v1/users');
  if(!r.ok){ console.error('Failed to load users'); return; }
  const data = await r.json();
  const tbody = $('#usersTable').querySelector('tbody');
  tbody.innerHTML = '';
  (data.data || data).forEach(u => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${u.id || ''}</td><td>${u.username || ''}</td><td>${u.displayName||''}</td><td>${u.email || ''}</td><td>${u.timezone || ''}</td><td>${u.createdAt || ''}</td>`;
    tbody.appendChild(tr);
  });
}

$('#userAdd').addEventListener('click', async ()=>{
  const username = $('#uUsername').value.trim();
  const password = $('#uPassword').value; // allow spaces? keep simple
  const displayName = $('#uDisplay').value.trim();
  const email = $('#uEmail').value.trim();
  const timezone = $('#uTZ').value.trim();
  if(!username || !password){ alert('Username and password required'); return; }
  const payload = { username, password, displayName, email, timezone };
  const r = await api('/api/v1/users', { method:'POST', body: payload });
  if(r.ok){ alert('User created'); $('#uUsername').value=''; $('#uPassword').value=''; $('#uDisplay').value=''; $('#uEmail').value=''; $('#uTZ').value=''; loadUsers(); } else { const err = await r.json().catch(()=>({error:'Unknown'})); alert('Error: ' + (err.error || err.message)); }
});

// Vault Tokens
async function loadVaultTokens(){
  const r = await api('/api/v1/vault/tokens');
  const table = $('#vaultTable').querySelector('tbody'); table.innerHTML = '';
  if(!r.ok) return;
  const data = await r.json();
  (data.data || data).forEach(t => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${t.id}</td><td>${t.label}</td><td>${t.scope}</td><td>${t.createdAt}</td><td>${t.tokenPreview || ''}</td><td><button onclick="deleteVaultToken('${t.id}')">Delete</button></td>`;
    table.appendChild(tr);
  });
}

$('#vtAdd').addEventListener('click', async ()=>{
  const label = $('#vtLabel').value.trim();
  const description = $('#vtDesc').value.trim();
  const tokenVal = $('#vtToken').value.trim();
  const scope = $('#vtScope').value;
  if(!label || !tokenVal){ alert('Label and token required'); return; }
  const r = await api('/api/v1/vault/tokens', { method:'POST', body:{ label, description, token: tokenVal, scope } });
  if(r.ok){ $('#vtLabel').value=''; $('#vtDesc').value=''; $('#vtToken').value=''; loadVaultTokens(); } else { alert('Error adding vault token'); }
});

window.deleteVaultToken = async function(id){ if(!confirm('Delete vault token?')) return; await api('/api/v1/vault/tokens/'+id, { method:'DELETE' }); loadVaultTokens(); }

// Handshakes
async function loadHandshakes(){
  const r = await api('/api/v1/handshakes');
  const tbody = $('#handshakeTable').querySelector('tbody'); tbody.innerHTML = '';
  if(!r.ok) return;
  const data = await r.json();
  (data.data || data).forEach(h => {
    const tr = document.createElement('tr');
    const actions = h.status === 'pending' ? `<button onclick="approveHS('${h.id}')">Approve</button> <button onclick="denyHS('${h.id}')">Deny</button>` : h.status;
    tr.innerHTML = `<td>${h.id}</td><td>${h.userId}</td><td>${h.agentId}</td><td>${(h.requestedScopes||[]).join(', ')}</td><td>${h.message||''}</td><td>${h.status}</td><td>${actions}</td>`;
    tbody.appendChild(tr);
  });
}

$('#refreshHandshakes').addEventListener('click', loadHandshakes);

window.approveHS = async function(id){ const r = await api('/api/v1/handshakes/'+id+'/approve', { method:'POST' }); const data = await r.json(); alert('Approved. Token: ' + (data.data?.token||'N/A')); loadHandshakes(); loadAll(); }
window.denyHS = async function(id){ await api('/api/v1/handshakes/'+id+'/deny', { method:'POST' }); loadHandshakes(); }
window.revokeHS = async function(id){ await api('/api/v1/handshakes/'+id+'/revoke', { method:'POST' }); loadHandshakes(); }

// Init
document.addEventListener('DOMContentLoaded', loginUI);
// Kick off auto-load if token exists
if(localStorage.getItem('myapi_token')){ loadAll(); }
