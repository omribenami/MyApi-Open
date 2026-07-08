import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';

const EMPTY_TOKEN = { name: '', token: '', websiteUrl: '', discoveredApiUrl: '', discoveredAuthScheme: '' };
const EMPTY_CRED = { label: '', username: '', password: '', url: '', notes: '', totpSecret: '', service: '' };

function TokenVault() {
  const masterToken = useAuthStore((state) => state.masterToken);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const currentWorkspace = useAuthStore((state) => state.currentWorkspace);

  const [tokens, setTokens] = useState([]);
  const [credentials, setCredentials] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Modal state
  // modalMode: null | 'token' | 'credential'
  const [modalMode, setModalMode] = useState(null);
  const [tokenForm, setTokenForm] = useState(EMPTY_TOKEN);
  const [credForm, setCredForm] = useState(EMPTY_CRED);
  const [discovering, setDiscovering] = useState(false);
  const [editing, setEditing] = useState(null); // { kind: 'token'|'credential', id }

  // Reveal/copy state — keyed by `${kind}:${id}`
  const [revealed, setRevealed] = useState({}); // for tokens: string; for credentials: { password, notes, totpSecret }
  const [revealingKey, setRevealingKey] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null); // { kind, id, label }

  const services = [
    { id: 'openai', name: 'OpenAI' },
    { id: 'stripe', name: 'Stripe' },
    { id: 'aws', name: 'AWS' },
    { id: 'github', name: 'GitHub' },
    { id: 'slack', name: 'Slack' },
    { id: 'twilio', name: 'Twilio' },
    { id: 'sendgrid', name: 'SendGrid' },
    { id: 'other', name: 'Other' },
  ];

  const authHeaders = () => {
    const h = { 'Content-Type': 'application/json' };
    if (masterToken) h['Authorization'] = `Bearer ${masterToken}`;
    return h;
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchAll();
    }
  }, [isAuthenticated, masterToken, currentWorkspace?.id]);

  const fetchAll = async () => {
    setIsLoading(true);
    try {
      const [tokRes, credRes] = await Promise.all([
        fetch('/api/v1/vault/tokens', { headers: authHeaders(), credentials: 'include' }),
        fetch('/api/v1/vault/credentials', { headers: authHeaders(), credentials: 'include' }),
      ]);
      if (tokRes.ok) {
        const data = await tokRes.json();
        setTokens(data.tokens || data.data || []);
      }
      if (credRes.ok) {
        const data = await credRes.json();
        setCredentials(data.credentials || data.data || []);
      }
    } catch (err) {
      console.error('Error loading vault:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Tokens ────────────────────────────────────────────────────────────────

  const handleDiscoverApi = async () => {
    if (!tokenForm.websiteUrl) {
      setError('Website URL is required before discovery');
      return;
    }
    setDiscovering(true);
    setError('');
    try {
      const response = await fetch('/api/v1/vault/discover-api', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ websiteUrl: tokenForm.websiteUrl }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error || 'Failed to discover API URL');
        return;
      }
      setTokenForm((prev) => ({
        ...prev,
        discoveredApiUrl: payload?.data?.apiBaseUrl || '',
        discoveredAuthScheme: payload?.data?.authScheme || 'unknown',
      }));
    } catch {
      setError('Failed to discover API URL');
    } finally {
      setDiscovering(false);
    }
  };

  const handleSaveToken = async () => {
    if (!tokenForm.name || !tokenForm.token || !tokenForm.websiteUrl) {
      setError('Name, URL, and token are required');
      return;
    }
    setError('');
    const isEdit = editing?.kind === 'token';
    try {
      const response = await fetch(isEdit ? `/api/v1/vault/tokens/${editing.id}` : '/api/v1/vault/tokens', {
        method: isEdit ? 'PUT' : 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          name: tokenForm.name,
          token: tokenForm.token,
          websiteUrl: tokenForm.websiteUrl,
          discoveredApiUrl: tokenForm.discoveredApiUrl,
          discoveredAuthScheme: tokenForm.discoveredAuthScheme,
          discoverApi: !tokenForm.discoveredApiUrl,
        }),
      });
      if (response.ok) {
        closeModal();
        await fetchAll();
      } else {
        const errData = await response.json().catch(() => ({}));
        setError(errData.error || `Failed to ${isEdit ? 'update' : 'add'} token`);
      }
    } catch {
      setError(`Error ${isEdit ? 'updating' : 'adding'} token`);
    }
  };

  // ── Credentials ───────────────────────────────────────────────────────────

  const handleSaveCredential = async () => {
    if (!credForm.label.trim() || !credForm.username.trim() || !credForm.password) {
      setError('Label, username, and password are required');
      return;
    }
    setError('');
    const isEdit = editing?.kind === 'credential';
    const payload = {
      label: credForm.label.trim(),
      username: credForm.username.trim(),
      password: credForm.password,
      url: credForm.url.trim() || null,
      notes: credForm.notes || null,
      totpSecret: credForm.totpSecret || null,
      service: credForm.service.trim() || null,
    };
    try {
      const response = await fetch(isEdit ? `/api/v1/vault/credentials/${editing.id}` : '/api/v1/vault/credentials', {
        method: isEdit ? 'PUT' : 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        if (isEdit) {
          setRevealed((prev) => {
            const next = { ...prev };
            delete next[`credential:${editing.id}`];
            return next;
          });
        }
        closeModal();
        await fetchAll();
      } else {
        const errData = await response.json().catch(() => ({}));
        setError(errData.error || `Failed to ${isEdit ? 'update' : 'add'} credential`);
      }
    } catch {
      setError(`Error ${isEdit ? 'updating' : 'adding'} credential`);
    }
  };

  // ── Common actions ────────────────────────────────────────────────────────

  const openAddToken = () => {
    setEditing(null);
    setTokenForm(EMPTY_TOKEN);
    setError('');
    setModalMode('token');
  };

  const openAddCredential = () => {
    setEditing(null);
    setCredForm(EMPTY_CRED);
    setError('');
    setModalMode('credential');
  };

  const openEditToken = (token) => {
    setEditing({ kind: 'token', id: token.id });
    setTokenForm({
      name: token.name || token.label || '',
      token: '',
      websiteUrl: token.websiteUrl || '',
      discoveredApiUrl: token.discoveredApiUrl || '',
      discoveredAuthScheme: token.discoveredAuthScheme || '',
    });
    setError('');
    setModalMode('token');
  };

  const openEditCredential = async (cred) => {
    setError('');
    try {
      const response = await fetch(`/api/v1/vault/credentials/${cred.id}/reveal`, {
        headers: authHeaders(),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(body.error || 'Failed to load credential');
        return;
      }
      const { data } = await response.json();
      setEditing({ kind: 'credential', id: cred.id });
      setCredForm({
        label: data.label || '',
        username: data.username || '',
        password: data.password || '',
        url: data.url || '',
        notes: data.notes || '',
        totpSecret: data.totpSecret || '',
        service: data.service || '',
      });
      setModalMode('credential');
    } catch (e) {
      setError(e.message || 'Failed to load credential');
    }
  };

  const closeModal = () => {
    setModalMode(null);
    setEditing(null);
    setTokenForm(EMPTY_TOKEN);
    setCredForm(EMPTY_CRED);
    setError('');
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const url = deleteTarget.kind === 'token'
      ? `/api/v1/vault/tokens/${deleteTarget.id}`
      : `/api/v1/vault/credentials/${deleteTarget.id}`;
    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${masterToken}` },
      });
      if (response.ok) {
        setRevealed((prev) => {
          const next = { ...prev };
          delete next[`${deleteTarget.kind}:${deleteTarget.id}`];
          return next;
        });
        setDeleteTarget(null);
        await fetchAll();
      }
    } catch (err) {
      console.error('Error deleting:', err);
    }
  };

  const handleReveal = async (kind, id) => {
    const key = `${kind}:${id}`;
    if (revealed[key] !== undefined) {
      setRevealed((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      return;
    }
    setRevealingKey(key);
    try {
      const url = kind === 'token'
        ? `/api/v1/vault/tokens/${id}/reveal`
        : `/api/v1/vault/credentials/${id}/reveal`;
      const response = await fetch(url, { headers: { 'Authorization': `Bearer ${masterToken}` } });
      if (response.ok) {
        const { data } = await response.json();
        if (kind === 'token') {
          setRevealed((prev) => ({ ...prev, [key]: data.token }));
        } else {
          setRevealed((prev) => ({
            ...prev,
            [key]: {
              password: data.password || '',
              notes: data.notes || '',
              totpSecret: data.totpSecret || '',
            },
          }));
        }
      }
    } catch (err) {
      console.error('Error revealing:', err);
    } finally {
      setRevealingKey(null);
    }
  };

  const copyText = async (text) => {
    if (!text) return false;
    try {
      if (navigator?.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch { /* ignored */ }
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  };

  const handleCopySecret = async (kind, id) => {
    const key = `${kind}:${id}`;
    try {
      let value = null;
      if (kind === 'token') {
        value = revealed[key];
        if (!value) {
          const response = await fetch(`/api/v1/vault/tokens/${id}/reveal`, {
            headers: { 'Authorization': `Bearer ${masterToken}` },
          });
          if (!response.ok) { alert('Failed to retrieve token'); return; }
          const data = await response.json();
          value = data.data.token;
          setRevealed((prev) => ({ ...prev, [key]: value }));
        }
      } else {
        const r = revealed[key];
        if (r) {
          value = r.password;
        } else {
          const response = await fetch(`/api/v1/vault/credentials/${id}/reveal`, {
            headers: { 'Authorization': `Bearer ${masterToken}` },
          });
          if (!response.ok) { alert('Failed to retrieve credential'); return; }
          const { data } = await response.json();
          value = data.password;
          setRevealed((prev) => ({
            ...prev,
            [key]: { password: data.password || '', notes: data.notes || '', totpSecret: data.totpSecret || '' },
          }));
        }
      }
      await copyText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // silently ignore
    }
  };

  const getServiceIcon = (serviceId) => {
    const service = services.find(s => s.id === serviceId);
    return service?.name?.charAt(0)?.toUpperCase() || (serviceId ? serviceId.charAt(0).toUpperCase() : 'K');
  };

  const getServiceName = (serviceId) => {
    const service = services.find(s => s.id === serviceId);
    return service?.name || serviceId || '—';
  };

  // Unified list: tokens first, then credentials, each with a `kind` marker
  const rows = [
    ...tokens.map((t) => ({ kind: 'token', raw: t })),
    ...credentials.map((c) => ({ kind: 'credential', raw: c })),
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="micro mb-2">VAULT · CREDENTIALS</div>
          <h1 className="font-serif text-[20px] sm:text-[28px] font-medium tracking-tight ink">Secrets your agents never touch.</h1>
          <p className="mt-2 ink-3 text-sm">Securely store API keys, usernames, and passwords for external services</p>
        </div>
        <div className="flex flex-wrap gap-2 self-start sm:self-auto" data-tour="vault-actions">
          <button onClick={openAddCredential} className="ui-button">
            + Add Credential
          </button>
          <button onClick={openAddToken} className="ui-button-primary">
            + Add Token
          </button>
        </div>
      </div>

      {error && !modalMode && !deleteTarget && (
        <div className="rounded p-3 text-sm" style={{ background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid var(--red)' }}>
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center items-center py-16">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 mb-4" style={{ borderColor: 'var(--accent)' }}></div>
            <p className="ink-3">Loading vault...</p>
          </div>
        </div>
      ) : rows.length === 0 ? (
        <div className="ui-card border-2 border-dashed p-10 text-center">
          <h3 className="text-lg font-semibold ink mb-2">Vault is empty</h3>
          <p className="ink-3 mb-6">Add an API token, or store a username/password credential</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button onClick={openAddCredential} className="ui-button px-6">Add Credential</button>
            <button onClick={openAddToken} className="ui-button-primary px-6">Add Token</button>
          </div>
        </div>
      ) : (
        <div className="rounded hairline overflow-x-auto" data-tour="vault-list">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-sunk" style={{ borderBottom: '1px solid var(--line)' }}>
                <th className="px-4 py-2.5 text-left micro whitespace-nowrap">Name</th>
                <th className="px-4 py-2.5 text-left micro whitespace-nowrap">Type</th>
                <th className="px-4 py-2.5 text-left micro whitespace-nowrap hidden sm:table-cell">Service</th>
                <th className="px-4 py-2.5 text-left micro whitespace-nowrap">Secret</th>
                <th className="px-4 py-2.5 text-left micro whitespace-nowrap hidden lg:table-cell">Endpoint / URL</th>
                <th className="px-4 py-2.5 text-left micro whitespace-nowrap hidden md:table-cell">Added</th>
                <th className="px-4 py-2.5 text-right micro whitespace-nowrap"></th>
              </tr>
            </thead>
            <tbody style={{ borderTop: 'none' }}>
              {rows.map(({ kind, raw }) => {
                const key = `${kind}:${raw.id}`;
                const isRevealed = revealed[key] !== undefined;

                const label = raw.name || raw.label;
                const service = raw.service;
                const createdAt = raw.createdAt;

                let secretDisplay;
                let endpointDisplay;
                if (kind === 'token') {
                  secretDisplay = isRevealed
                    ? revealed[key]
                    : (raw.tokenPreview ? `${raw.tokenPreview.slice(0, 8)}…` : '••••••••••••');
                  endpointDisplay = raw.discoveredApiUrl
                    ? (
                      <span className="text-xs truncate max-w-[200px] block" style={{ color: 'var(--green)' }} title={raw.discoveredApiUrl}>
                        {raw.discoveredApiUrl.replace(/^https?:\/\//, '')}
                        {raw.discoveredAuthScheme && raw.discoveredAuthScheme !== 'unknown' && (
                          <span className="ml-1 ink-4">({raw.discoveredAuthScheme})</span>
                        )}
                      </span>
                    )
                    : <span className="text-xs ink-4">—</span>;
                } else {
                  const r = revealed[key];
                  secretDisplay = (
                    <span>
                      <span className="ink-2">{raw.username}</span>
                      <span className="ink-4"> · </span>
                      <span>{r ? r.password : '••••••••'}</span>
                    </span>
                  );
                  endpointDisplay = raw.url
                    ? (
                      <a
                        href={raw.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs truncate max-w-[200px] block hover:underline"
                        style={{ color: 'var(--accent)' }}
                        title={raw.url}
                      >
                        {raw.url.replace(/^https?:\/\//, '')}
                      </a>
                    )
                    : <span className="text-xs ink-4">—</span>;
                }

                return (
                  <tr key={key} className="row row-cell group" style={{ borderTop: '1px solid var(--line)' }}>
                    {/* Name */}
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span className="font-medium ink text-sm">{label}</span>
                    </td>
                    {/* Type */}
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span
                        className="inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded hairline"
                        style={kind === 'token'
                          ? { background: 'var(--bg-raised)', color: 'var(--accent)' }
                          : { background: 'var(--bg-raised)', color: 'var(--green)' }}
                      >
                        {kind === 'token' ? 'Token' : 'Login'}
                      </span>
                    </td>
                    {/* Service */}
                    <td className="px-4 py-2.5 whitespace-nowrap hidden sm:table-cell">
                      <span className="inline-flex items-center gap-1.5 text-xs ink-2">
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-raised text-[10px] font-bold ink-2 flex-shrink-0">
                          {getServiceIcon(service)}
                        </span>
                        {getServiceName(service)}
                      </span>
                    </td>
                    {/* Secret */}
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <code className="mono text-[11px] ink-3 bg-sunk px-2 py-0.5 rounded hairline max-w-[200px] truncate">
                          {secretDisplay}
                        </code>
                        <button
                          onClick={() => handleReveal(kind, raw.id)}
                          disabled={revealingKey === key}
                          title={isRevealed ? 'Hide' : 'Reveal'}
                          className="ink-4 hover:ink-2 transition-colors disabled:opacity-30"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            {isRevealed
                              ? <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></>
                              : <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></>
                            }
                          </svg>
                        </button>
                      </div>
                    </td>
                    {/* Endpoint / URL */}
                    <td className="px-4 py-2.5 whitespace-nowrap hidden lg:table-cell">
                      {endpointDisplay}
                    </td>
                    {/* Added */}
                    <td className="px-4 py-2.5 whitespace-nowrap hidden md:table-cell">
                      <span className="text-xs ink-3">
                        {createdAt ? new Date(createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                      </span>
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-2.5 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleCopySecret(kind, raw.id)}
                          title={copiedKey === key ? 'Copied!' : (kind === 'token' ? 'Copy key' : 'Copy password')}
                          className={`p-1.5 rounded transition-colors ${copiedKey === key ? 'accent' : 'ink-4 hover:ink'}`}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                        </button>
                        <button
                          onClick={() => (kind === 'token' ? openEditToken(raw) : openEditCredential(raw))}
                          title="Edit"
                          className="p-1.5 rounded ink-4 hover:ink transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                        </button>
                        <button
                          onClick={() => setDeleteTarget({ kind, id: raw.id, label })}
                          title="Delete"
                          className="p-1.5 rounded ink-4 transition-colors hover:text-[color:var(--red)]"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Token Modal */}
      {modalMode === 'token' && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-raised hairline rounded p-6 max-w-md w-full" style={{ background: 'var(--bg-raised)' }}>
            <h2 className="text-xl font-bold ink mb-4">
              {editing?.kind === 'token' ? 'Edit External Token' : 'Add External Token'}
            </h2>

            {error && (
              <div className="mb-4 p-3 rounded text-sm" style={{ background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid var(--red)' }}>
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm ink-2 mb-2">Token Name</label>
                <input
                  type="text"
                  value={tokenForm.name}
                  onChange={(e) => setTokenForm({ ...tokenForm, name: e.target.value })}
                  placeholder="e.g., My OpenAI API Key"
                  className="ui-input w-full"
                />
              </div>

              <div>
                <label className="block text-sm ink-2 mb-2">Website URL</label>
                <input
                  type="url"
                  value={tokenForm.websiteUrl}
                  onChange={(e) => setTokenForm({ ...tokenForm, websiteUrl: e.target.value })}
                  placeholder="https://example.com"
                  className="ui-input w-full"
                />
              </div>

              <div>
                <label className="block text-sm ink-2 mb-2">API URL (Optional)</label>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <input
                    type="url"
                    value={tokenForm.discoveredApiUrl}
                    onChange={(e) => setTokenForm({ ...tokenForm, discoveredApiUrl: e.target.value })}
                    placeholder="https://api.example.com"
                    className="ui-input flex-1 w-full"
                  />
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <span className="ink-4 text-xs font-semibold uppercase tracking-wider hidden sm:inline">or</span>
                    <button
                      type="button"
                      onClick={handleDiscoverApi}
                      disabled={discovering || !tokenForm.websiteUrl}
                      className="ui-button w-full sm:w-auto whitespace-nowrap disabled:opacity-60"
                      title="Scan Website URL for API endpoint"
                    >
                      {discovering ? 'Scanning...' : 'Scan Website'}
                    </button>
                  </div>
                </div>
                {tokenForm.discoveredAuthScheme && tokenForm.discoveredAuthScheme !== 'unknown' && (
                  <p className="mt-2 text-xs" style={{ color: 'var(--green)' }}>Detected auth: {tokenForm.discoveredAuthScheme}</p>
                )}
              </div>

              <div>
                <label className="block text-sm ink-2 mb-2">Token / API Key</label>
                <textarea
                  value={tokenForm.token}
                  onChange={(e) => setTokenForm({ ...tokenForm, token: e.target.value })}
                  placeholder="Paste your API key here"
                  className="ui-input mono w-full"
                  rows={4}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={closeModal} className="flex-1 ui-button">Cancel</button>
              <button onClick={handleSaveToken} className="flex-1 ui-button-primary">
                {editing?.kind === 'token' ? 'Save Changes' : 'Add Token'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Credential Modal */}
      {modalMode === 'credential' && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-raised hairline rounded p-6 max-w-md w-full max-h-[90vh] overflow-y-auto" style={{ background: 'var(--bg-raised)' }}>
            <h2 className="text-xl font-bold ink mb-4">
              {editing?.kind === 'credential' ? 'Edit Credential' : 'Add Credential'}
            </h2>

            {error && (
              <div className="mb-4 p-3 rounded text-sm" style={{ background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid var(--red)' }}>
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm ink-2 mb-2">Label</label>
                <input
                  type="text"
                  value={credForm.label}
                  onChange={(e) => setCredForm({ ...credForm, label: e.target.value })}
                  placeholder="e.g., AWS Root Account"
                  className="ui-input w-full"
                />
              </div>

              <div>
                <label className="block text-sm ink-2 mb-2">Username / Email</label>
                <input
                  type="text"
                  value={credForm.username}
                  onChange={(e) => setCredForm({ ...credForm, username: e.target.value })}
                  placeholder="user@example.com"
                  autoComplete="off"
                  className="ui-input w-full"
                />
              </div>

              <div>
                <label className="block text-sm ink-2 mb-2">Password</label>
                <input
                  type="password"
                  value={credForm.password}
                  onChange={(e) => setCredForm({ ...credForm, password: e.target.value })}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className="ui-input mono w-full"
                />
              </div>

              <div>
                <label className="block text-sm ink-2 mb-2">URL (Optional)</label>
                <input
                  type="url"
                  value={credForm.url}
                  onChange={(e) => setCredForm({ ...credForm, url: e.target.value })}
                  placeholder="https://example.com/login"
                  className="ui-input w-full"
                />
              </div>

              <div>
                <label className="block text-sm ink-2 mb-2">Service Tag (Optional)</label>
                <input
                  type="text"
                  value={credForm.service}
                  onChange={(e) => setCredForm({ ...credForm, service: e.target.value })}
                  placeholder="e.g., aws, github"
                  className="ui-input w-full"
                />
              </div>

              <div>
                <label className="block text-sm ink-2 mb-2">TOTP Secret (Optional)</label>
                <input
                  type="text"
                  value={credForm.totpSecret}
                  onChange={(e) => setCredForm({ ...credForm, totpSecret: e.target.value })}
                  placeholder="Base32 2FA seed"
                  className="ui-input mono w-full"
                />
              </div>

              <div>
                <label className="block text-sm ink-2 mb-2">Notes (Optional)</label>
                <textarea
                  value={credForm.notes}
                  onChange={(e) => setCredForm({ ...credForm, notes: e.target.value })}
                  placeholder="Recovery codes, security questions, etc."
                  className="ui-input w-full"
                  rows={3}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={closeModal} className="flex-1 ui-button">Cancel</button>
              <button onClick={handleSaveCredential} className="flex-1 ui-button-primary">
                {editing?.kind === 'credential' ? 'Save Changes' : 'Add Credential'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-raised rounded max-w-md w-full p-6" style={{ background: 'var(--bg-raised)', border: '1px solid var(--red)' }}>
            <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--red)' }}>
              Delete {deleteTarget.kind === 'token' ? 'token' : 'credential'}?
            </h3>
            <p className="text-sm ink-2 mb-5">
              Are you sure you want to delete <span className="font-semibold ink">{deleteTarget.label}</span>?
              This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 ui-button">Cancel</button>
              <button onClick={handleDelete} className="flex-1 ui-button-danger">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TokenVault;
