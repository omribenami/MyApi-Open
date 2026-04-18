import { useState, useEffect } from 'react';
import { isLogoutInProgress } from '../utils/authRuntime';
import { useAuthStore } from '../stores/authStore';
import { useTokenStore } from '../stores/tokenStore';
import EditTokenModal from '../components/EditTokenModal';
import ServiceScopeSelector from '../components/ServiceScopeSelector';
import RevokeConfirmationModal from '../components/RevokeConfirmationModal';

// ── Icons ─────────────────────────────────────────────────────────────────────
function CopyIcon({ className = 'w-3.5 h-3.5' }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>;
}
function RotateIcon({ className = 'w-3.5 h-3.5' }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>;
}
function TrashIcon({ className = 'w-3.5 h-3.5' }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>;
}
function EditIcon({ className = 'w-3.5 h-3.5' }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>;
}
function EyeIcon({ className = 'w-3.5 h-3.5', off = false }) {
  if (off) return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>;
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>;
}
function ChevronIcon({ open }) {
  return <svg className={`w-4 h-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>;
}

function ActionBtn({ onClick, disabled, title, children, variant = 'default' }) {
  const base = 'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
  const variants = {
    default: 'text-slate-300 hover:text-white hover:bg-slate-700',
    danger:  'text-red-400 hover:text-red-300 hover:bg-red-900/30',
    amber:   'text-amber-400 hover:text-amber-300 hover:bg-amber-900/30',
    blue:    'text-blue-400 hover:text-blue-300 hover:bg-blue-900/30',
    green:   'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-900/30',
    cyan:    'text-cyan-400 hover:text-cyan-300 hover:bg-cyan-900/30',
  };
  return <button onClick={onClick} disabled={disabled} title={title} className={`${base} ${variants[variant]}`}>{children}</button>;
}

function isBundle(token) {
  const sb = token.scopeBundle || token.scope_bundle;
  if (!sb) return false;
  const parsed = typeof sb === 'string' ? (() => { try { return JSON.parse(sb); } catch { return null; } })() : sb;
  if (!parsed?.persona_id) return false;
  const scopes = token.scopes || [];
  return scopes.includes('knowledge') || scopes.includes('skills:read');
}

// ── GitHub-style Scope Row ─────────────────────────────────────────────────────
// A single collapsible category row (Identity / Personas / Knowledge / Skills / Services / Memory)
function ScopeRow({ icon, title, description, summary, summaryColor = 'text-slate-500', active, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`border rounded-lg overflow-hidden transition-colors ${active ? 'border-blue-700/50' : 'border-slate-700'}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-800/50 transition-colors"
      >
        <span className="text-lg flex-shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">{title}</span>
            {active && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0"/>}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5 truncate">{description}</p>
        </div>
        <span className={`text-xs font-medium flex-shrink-0 mr-2 ${summaryColor}`}>{summary}</span>
        <ChevronIcon open={open}/>
      </button>
      {open && (
        <div className="border-t border-slate-700/60 bg-slate-900/30 px-4 py-3">
          {children}
        </div>
      )}
    </div>
  );
}

// Checkbox row for a resource item
function ResourceItem({ label, sublabel, checked, onChange, accent = false }) {
  return (
    <label className={`flex items-center gap-3 px-2 py-2 rounded-lg cursor-pointer transition-colors hover:bg-slate-800/60 ${checked ? (accent ? 'bg-purple-900/10' : 'bg-blue-900/10') : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className={`h-4 w-4 rounded border-slate-600 bg-slate-700 ${accent ? 'text-purple-500' : 'text-blue-500'}`}
      />
      <div className="flex-1 min-w-0">
        <span className="text-sm text-white">{label}</span>
        {sublabel && <span className="ml-2 text-xs text-slate-500 truncate">{sublabel}</span>}
      </div>
    </label>
  );
}

// Loading skeleton
function LoadingSkeleton({ lines = 3 }) {
  return (
    <div className="space-y-2 py-1">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-8 bg-slate-800 rounded-lg animate-pulse" style={{ opacity: 1 - i * 0.2 }}/>
      ))}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
function AccessTokens() {
  const masterToken = useAuthStore((state) => state.masterToken);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const setMasterToken = useAuthStore((state) => state.setMasterToken);
  const {
    tokens, isLoading, isSaving, error, success,
    fetchTokens, createToken, setError, clearError, clearSuccess,
    selectToken, deselectToken, selectedToken,
  } = useTokenStore();

  const [masterRevealed, setMasterRevealed] = useState(false);
  const [masterCopied, setMasterCopied] = useState(false);
  const [masterRegenerating, setMasterRegenerating] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [showServiceScopeModal, setShowServiceScopeModal] = useState(false);
  const [showRevokeModal, setShowRevokeModal] = useState(false);

  // Installed tokens
  const [installedTokens, setInstalledTokens] = useState([]);
  const [vaultLoading, setVaultLoading] = useState(false);
  const [revokingTokenId, setRevokingTokenId] = useState(null);

  // Create form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [form, setForm] = useState({ label: '', description: '', expiresInHours: '168', requiresApproval: false, publishOnCreate: false });

  // ── Scope state (GitHub-style per-category) ─────────────────────────────────
  // Identity: set of 'basic' | 'professional' | 'availability'
  const [identityScopes, setIdentityScopes] = useState(new Set());

  // Personas: Set of persona IDs (empty = all)
  const [personaAccess, setPersonaAccess] = useState('none'); // 'none' | 'all' | 'selected'
  const [selectedPersonaIds, setSelectedPersonaIds] = useState(new Set());
  const [bundlePersonaId, setBundlePersonaId] = useState(null); // ID when bundle mode
  const [bundleKb, setBundleKb] = useState(false);

  // Knowledge: Set of doc IDs (empty set but access='all' = all docs)
  const [kbAccess, setKbAccess] = useState('none'); // 'none' | 'all' | 'selected'
  const [selectedKbIds, setSelectedKbIds] = useState(new Set());

  // Skills: 'none' | 'read' | 'write' (write implies read) + optional selected skill IDs
  const [skillAccess, setSkillAccess] = useState('none');
  const [selectedSkillIds, setSelectedSkillIds] = useState(new Set());
  const [skillSelectionMode, setSkillSelectionMode] = useState('all'); // 'all' | 'selected'

  // Services: 'none' | 'read' | 'write' + optional selected service names
  const [serviceAccess, setServiceAccess] = useState('none');
  const [selectedServiceNames, setSelectedServiceNames] = useState(new Set());
  const [serviceSelectionMode, setServiceSelectionMode] = useState('all');

  // Memory: boolean
  const [memoryAccess, setMemoryAccess] = useState(false);

  // ── Resources from API ──────────────────────────────────────────────────────
  const [personas, setPersonas] = useState([]);
  const [kbDocs, setKbDocs] = useState([]);
  const [skills, setSkills] = useState([]);
  const [connectedServices, setConnectedServices] = useState([]);
  const [resourcesLoading, setResourcesLoading] = useState({});

  const [newlyCreated, setNewlyCreated] = useState(null);
  const [revealedTokens, setRevealedTokens] = useState({});
  const [visibleTokenIds, setVisibleTokenIds] = useState({});
  const [_copiedTokenId, setCopiedTokenId] = useState(null);
  const [regeneratingTokenId, setRegeneratingTokenId] = useState(null);
  const [publishingTokenId, setPublishingTokenId] = useState(null);

  const currentWorkspace = useAuthStore((state) => state.currentWorkspace);

  // ── Effects ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (masterToken) { fetchTokens(masterToken); fetchInstalledTokens(masterToken); }
  }, [masterToken, fetchTokens, currentWorkspace?.id]);

  useEffect(() => {
    if (!isAuthenticated || isLogoutInProgress() || masterToken) return;
    const stored = localStorage.getItem('masterToken');
    if (stored) { setMasterToken(stored); return; }
    fetch('/api/v1/auth/me', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then(async (payload) => {
        let t = payload?.bootstrap?.masterToken;
        if (!t) {
          const boot = await fetch('/api/v1/tokens/master/bootstrap', { method: 'POST', credentials: 'include' })
            .then((r) => (r.ok ? r.json() : null)).catch(() => null);
          t = boot?.data?.token;
        }
        if (t) setMasterToken(t);
      }).catch(() => {});
  }, [masterToken, setMasterToken, isAuthenticated]);

  useEffect(() => { if (success) { const t = setTimeout(() => clearSuccess(), 4000); return () => clearTimeout(t); } }, [success, clearSuccess]);
  useEffect(() => { if (error) { const t = setTimeout(() => clearError(), 6000); return () => clearTimeout(t); } }, [error, clearError]);

  // Load resources when form opens
  useEffect(() => {
    if (!showCreateForm || !masterToken) return;
    const authHdr = { Authorization: `Bearer ${masterToken}` };
    const setLoading = (key, v) => setResourcesLoading((p) => ({ ...p, [key]: v }));

    // Personas
    if (personas.length === 0) {
      setLoading('personas', true);
      fetch('/api/v1/personas', { headers: authHdr })
        .then((r) => r.json()).then((j) => setPersonas(j.data || []))
        .catch(() => {}).finally(() => setLoading('personas', false));
    }
    // KB docs
    if (kbDocs.length === 0) {
      setLoading('kb', true);
      fetch('/api/v1/brain/knowledge-base', { headers: authHdr })
        .then((r) => r.json())
        .then((j) => setKbDocs(Array.isArray(j) ? j : (j.data || j.documents || [])))
        .catch(() => {}).finally(() => setLoading('kb', false));
    }
    // Skills
    if (skills.length === 0) {
      setLoading('skills', true);
      fetch('/api/v1/skills', { headers: authHdr })
        .then((r) => r.json())
        .then((j) => setSkills(Array.isArray(j) ? j : (j.skills || j.data || [])))
        .catch(() => {}).finally(() => setLoading('skills', false));
    }
    // Connected services
    if (connectedServices.length === 0) {
      setLoading('services', true);
      fetch('/api/v1/oauth/status', { headers: authHdr })
        .then((r) => r.json())
        .then((j) => {
          const connected = (j.services || []).filter((s) => s.status === 'connected');
          setConnectedServices(connected);
        })
        .catch(() => {}).finally(() => setLoading('services', false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCreateForm, masterToken]);

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const copyText = async (text) => {
    if (!text) return false;
    try {
      if (navigator?.clipboard?.writeText && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; }
    } catch { /* clipboard API unavailable */ }
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:-1000px';
      document.body.appendChild(ta); ta.focus(); ta.select();
      const ok = document.execCommand('copy'); document.body.removeChild(ta); return ok;
    } catch { return false; }
  };

  const maskToken = (t) => {
    if (!t || t.length <= 6) return '••••••••••••••••••••••••••••••••';
    return `${'•'.repeat(Math.min(t.length - 6, 32))}${t.slice(-6)}`;
  };

  const getExpiry = (expiresAt) => {
    if (!expiresAt) return { label: 'No expiry', urgent: false };
    const days = Math.ceil((new Date(expiresAt) - Date.now()) / 86400000);
    const label = new Date(expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return { label, urgent: days <= 3 };
  };

  // ── Derive scopes + allowed_resources from form state ───────────────────────
  const buildScopesAndResources = () => {
    const scopes = [];
    const allowedResources = {};

    // Identity
    if (identityScopes.size > 0) {
      identityScopes.forEach((s) => scopes.push(s));
    }

    // Personas
    if (personaAccess !== 'none') {
      scopes.push('personas');
      if (personaAccess === 'selected' && selectedPersonaIds.size > 0) {
        allowedResources.personas = [...selectedPersonaIds];
      }
      // Bundle: single persona chosen + KB toggle
      if (bundlePersonaId && bundleKb) {
        if (!scopes.includes('knowledge')) scopes.push('knowledge');
        if (!scopes.includes('skills:read')) scopes.push('skills:read');
        allowedResources.bundle_persona_id = bundlePersonaId;
      }
    }

    // Knowledge
    if (kbAccess !== 'none') {
      scopes.push('knowledge');
      if (kbAccess === 'selected' && selectedKbIds.size > 0) {
        allowedResources.knowledge_docs = [...selectedKbIds];
      }
    }

    // Skills
    if (skillAccess !== 'none') {
      scopes.push('skills:read');
      if (skillAccess === 'write') scopes.push('skills:write');
      if (skillSelectionMode === 'selected' && selectedSkillIds.size > 0) {
        allowedResources.skills = [...selectedSkillIds];
      }
    }

    // Services
    if (serviceAccess !== 'none') {
      scopes.push('services:read');
      if (serviceAccess === 'write') scopes.push('services:write');
      if (serviceSelectionMode === 'selected' && selectedServiceNames.size > 0) {
        allowedResources.services = [...selectedServiceNames];
      }
    }

    // Memory
    if (memoryAccess) scopes.push('memory');

    return { scopes: [...new Set(scopes)], allowedResources: Object.keys(allowedResources).length > 0 ? allowedResources : null };
  };

  const hasServiceScopeInState = () => serviceAccess !== 'none';
  const hasServiceScope = (scopes) => (scopes || []).some((s) => s === 'services:read' || s === 'services:write' || s.startsWith('services:'));
  const totalScopesSelected = () => {
    let n = identityScopes.size;
    if (personaAccess !== 'none') n++;
    if (kbAccess !== 'none') n++;
    if (skillAccess !== 'none') n++;
    if (serviceAccess !== 'none') n++;
    if (memoryAccess) n++;
    return n;
  };

  // ── Summary labels ───────────────────────────────────────────────────────────
  const identitySummary = () => {
    if (identityScopes.size === 0) return { text: 'No access', color: 'text-slate-600' };
    const labels = [];
    if (identityScopes.has('basic')) labels.push('Basic');
    if (identityScopes.has('professional')) labels.push('Professional');
    if (identityScopes.has('availability')) labels.push('Availability');
    return { text: labels.join(', '), color: 'text-blue-400' };
  };

  const personaSummary = () => {
    if (personaAccess === 'none') return { text: 'No access', color: 'text-slate-600' };
    if (personaAccess === 'all') return { text: 'All personas', color: 'text-blue-400' };
    const count = selectedPersonaIds.size;
    return { text: `${count} persona${count !== 1 ? 's' : ''}`, color: 'text-blue-400' };
  };

  const kbSummary = () => {
    if (kbAccess === 'none') return { text: 'No access', color: 'text-slate-600' };
    if (kbAccess === 'all') return { text: 'All documents', color: 'text-blue-400' };
    const count = selectedKbIds.size;
    return { text: `${count} document${count !== 1 ? 's' : ''}`, color: 'text-blue-400' };
  };

  const skillSummary = () => {
    if (skillAccess === 'none') return { text: 'No access', color: 'text-slate-600' };
    const access = skillAccess === 'write' ? 'Read & Write' : 'Read';
    const sel = skillSelectionMode === 'selected' && selectedSkillIds.size > 0 ? ` · ${selectedSkillIds.size} selected` : '';
    return { text: access + sel, color: 'text-blue-400' };
  };

  const serviceSummary = () => {
    if (serviceAccess === 'none') return { text: 'No access', color: 'text-slate-600' };
    const access = serviceAccess === 'write' ? 'Read & Write' : 'Read';
    const sel = serviceSelectionMode === 'selected' && selectedServiceNames.size > 0 ? ` · ${selectedServiceNames.size} selected` : '';
    return { text: access + sel, color: 'text-blue-400' };
  };

  // ── Master token actions ─────────────────────────────────────────────────────
  const handleCopyMaster = async () => {
    if (await copyText(masterToken)) { setMasterCopied(true); setTimeout(() => setMasterCopied(false), 2000); }
  };

  const handleRegenerateMaster = async () => {
    setMasterRegenerating(true); clearError();
    try {
      const res = await fetch('/api/v1/tokens/master/regenerate', {
        method: 'POST', credentials: 'include', headers: { Authorization: `Bearer ${masterToken}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to regenerate');
      const newToken = data?.data?.token;
      if (!newToken) throw new Error('No token returned');
      setMasterToken(newToken); setMasterRevealed(true);
      if (await copyText(newToken)) { setMasterCopied(true); setTimeout(() => setMasterCopied(false), 2000); }
      await fetchTokens(newToken);
    } catch (err) { setError(err.message || 'Failed to regenerate'); }
    finally { setMasterRegenerating(false); }
  };

  // ── Installed tokens ─────────────────────────────────────────────────────────
  const fetchInstalledTokens = async (token) => {
    if (!token) return;
    setVaultLoading(true);
    try {
      const res = await fetch('/api/v1/vault/my-tokens', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const d = await res.json(); setInstalledTokens(d.data?.guestTokens || []); }
    } catch { /* silently ignore */ } finally { setVaultLoading(false); }
  };

  const handleRevokeInstalled = async (tokenId) => {
    setRevokingTokenId(tokenId);
    try {
      const res = await fetch(`/api/v1/vault/${tokenId}/revoke`, { method: 'DELETE', headers: { Authorization: `Bearer ${masterToken}` } });
      if (!res.ok) throw new Error('Failed to revoke');
      setInstalledTokens((p) => p.filter((t) => t.id !== tokenId));
    } catch (err) { setError(err.message || 'Failed to revoke token'); }
    finally { setRevokingTokenId(null); }
  };

  // ── Guest token actions ──────────────────────────────────────────────────────
  const getTokenKey = (t) => t?.id || t?.tokenId;

  const regenerateAndStore = async (token) => {
    const key = getTokenKey(token);
    const res = await fetch(`/api/v1/tokens/${key}/regenerate`, { method: 'POST', headers: { Authorization: `Bearer ${masterToken}` } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to regenerate');
    const raw = data?.data?.token || null;
    if (raw) {
      setRevealedTokens((p) => ({ ...p, [key]: raw }));
      setVisibleTokenIds((p) => ({ ...p, [key]: true }));
    }
    return raw;
  };

  const handleCopyGuestToken = async (token) => {
    const key = getTokenKey(token); clearError();
    let raw = revealedTokens[key];
    if (!raw) { try { raw = await regenerateAndStore(token); } catch (err) { setError(err.message); return; } }
    if (await copyText(raw)) { setCopiedTokenId(key); setTimeout(() => setCopiedTokenId(null), 1800); }
  };

  const handleRegenerateToken = async (token) => {
    const key = getTokenKey(token);
    setRegeneratingTokenId(key); clearError();
    try { await regenerateAndStore(token); await fetchTokens(masterToken); }
    catch (err) { setError(err.message || 'Failed to regenerate'); }
    finally { setRegeneratingTokenId(null); }
  };

  const handlePublishToken = async (token) => {
    const key = getTokenKey(token);
    setPublishingTokenId(key); clearError();
    try {
      const res = await fetch(`/api/v1/tokens/${key}/make-shareable`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${masterToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: token.description }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to publish');
      await fetchTokens(masterToken);
    } catch (err) { setError(err.message || 'Failed to publish'); }
    finally { setPublishingTokenId(null); }
  };

  const handleUnpublishToken = async (token) => {
    const key = getTokenKey(token);
    setPublishingTokenId(key); clearError();
    try {
      const res = await fetch(`/api/v1/tokens/${key}/unpublish`, { method: 'POST', headers: { Authorization: `Bearer ${masterToken}` } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to unpublish');
      await fetchTokens(masterToken);
    } catch (err) { setError(err.message || 'Failed to unpublish'); }
    finally { setPublishingTokenId(null); }
  };

  // ── Create form ──────────────────────────────────────────────────────────────
  const resetForm = () => {
    setForm({ label: '', description: '', expiresInHours: '168', requiresApproval: false, publishOnCreate: false });
    setIdentityScopes(new Set());
    setPersonaAccess('none'); setSelectedPersonaIds(new Set()); setBundlePersonaId(null); setBundleKb(false);
    setKbAccess('none'); setSelectedKbIds(new Set());
    setSkillAccess('none'); setSelectedSkillIds(new Set()); setSkillSelectionMode('all');
    setServiceAccess('none'); setSelectedServiceNames(new Set()); setServiceSelectionMode('all');
    setMemoryAccess(false);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    const { scopes, allowedResources } = buildScopesAndResources();
    if (scopes.length === 0) { setError('Select at least one permission'); return; }

    // Build scope_bundle if persona + KB selected
    let scopeBundle = null;
    if (bundlePersonaId && bundleKb) {
      scopeBundle = { persona_id: bundlePersonaId, include_kb: true };
    } else if (bundlePersonaId) {
      scopeBundle = { persona_id: bundlePersonaId, include_kb: false };
    }

    // Build allowedPersonas from selected persona IDs
    const allowedPersonas = personaAccess === 'selected' && selectedPersonaIds.size > 0
      ? [...selectedPersonaIds]
      : (bundlePersonaId ? [bundlePersonaId] : []);

    const payload = {
      label: form.label,
      description: form.description || undefined,
      scopes,
      expiresInHours: form.expiresInHours ? parseInt(form.expiresInHours) : null,
      requiresApproval: form.requiresApproval,
      scopeBundle,
      allowedPersonas: allowedPersonas.length > 0 ? allowedPersonas : undefined,
      allowedResources,
    };

    const created = await createToken(masterToken, payload);
    if (created) {
      setNewlyCreated(created);
      if (created.id && created.token) {
        setRevealedTokens((p) => ({ ...p, [created.id]: created.token }));
        setVisibleTokenIds((p) => ({ ...p, [created.id]: true }));
      }
      if (form.publishOnCreate && created.id) {
        try {
          await fetch(`/api/v1/tokens/${created.id}/make-shareable`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${masterToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ description: form.description }),
          });
        } catch { /* silently ignore audit log failure */ }
      }
      resetForm();
      setShowCreateForm(false);
      await fetchTokens(masterToken);
    }
  };

  const guestTokens = tokens.filter((t) => !t.isMaster && t.scope !== 'full' && !t.revokedAt);

  // ── Toggle helpers ────────────────────────────────────────────────────────────
  const toggleSet = (set, setFn, id) => {
    setFn((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-white tracking-tight">Access Tokens</h1>
        <p className="mt-1 text-sm text-slate-400">Manage your master token, guest tokens, and marketplace-installed tokens</p>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-lg border border-red-700/60 bg-red-950/40 text-red-300 text-sm">
          <span>{error}</span>
          <button onClick={clearError} className="text-red-400 hover:text-red-200 flex-shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      )}
      {success && (
        <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-lg border border-emerald-700/60 bg-emerald-950/40 text-emerald-300 text-sm">
          <span>{success}</span>
          <button onClick={clearSuccess} className="text-emerald-400 hover:text-emerald-200 flex-shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      )}

      {/* ── Master Token ── */}
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-white">Master Token</h2>
          <p className="text-xs text-slate-400 mt-0.5">Full access · Never expires · Keep it secret</p>
        </div>
        <div className="rounded-lg border border-slate-800 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/80">
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Name</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Status</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Secret Key</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap hidden lg:table-cell">Created</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap hidden sm:table-cell">Expires</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Permissions</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap"></th>
              </tr>
            </thead>
            <tbody>
              <tr className="hover:bg-slate-800/25 transition-colors group">
                <td className="px-4 py-2.5 whitespace-nowrap">
                  <span className="font-medium text-white text-sm">Master Token</span>
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0"/>Active
                  </span>
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <code className="text-[11px] font-mono text-slate-400 bg-slate-800/70 px-2 py-0.5 rounded border border-slate-700/50">
                      {masterRevealed ? masterToken : maskToken(masterToken)}
                    </code>
                    <button onClick={() => setMasterRevealed((v) => !v)} title={masterRevealed ? 'Hide' : 'Reveal'} className="text-slate-600 hover:text-slate-300 transition-colors">
                      <EyeIcon className="w-3.5 h-3.5" off={masterRevealed}/>
                    </button>
                  </div>
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap hidden lg:table-cell">
                  <span className="text-xs text-slate-500">—</span>
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap hidden sm:table-cell">
                  <span className="text-xs text-slate-500">Never</span>
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  <span className="text-xs font-medium text-amber-400">Full access</span>
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap text-right">
                  <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={handleCopyMaster} title={masterCopied ? 'Copied!' : 'Copy'} className="p-1.5 rounded text-slate-500 hover:text-cyan-400 hover:bg-cyan-900/20 transition-colors">
                      <CopyIcon className="w-3.5 h-3.5"/>
                    </button>
                    <button onClick={handleRegenerateMaster} disabled={masterRegenerating} title="Rotate master token" className="p-1.5 rounded text-slate-500 hover:text-amber-400 hover:bg-amber-900/20 transition-colors disabled:opacity-30">
                      <RotateIcon className={`w-3.5 h-3.5 ${masterRegenerating ? 'animate-spin' : ''}`}/>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="flex gap-3 px-4 py-3 rounded-lg border border-amber-700/30 bg-amber-950/20">
          <svg className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/>
          </svg>
          <p className="text-xs text-amber-300/70 leading-relaxed">
            <span className="font-semibold text-amber-300">Not recommended for agents.</span>{' '}
            Use <strong className="text-amber-300">ASC</strong> or <strong className="text-amber-300">OAuth Device Flow</strong> instead — each agent gets its own revocable identity.{' '}
            <a href="/dashboard/connectors#asc" className="underline text-amber-300 hover:text-amber-200 transition-colors">Set up ASC →</a>
          </p>
        </div>
      </section>

      {/* ── Guest Tokens ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">Guest Tokens</h2>
            <p className="text-xs text-slate-400 mt-0.5">Fine-grained scoped tokens for agents or external parties</p>
          </div>
          <button
            onClick={() => { resetForm(); setNewlyCreated(null); setShowCreateForm(true); }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors flex-shrink-0"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            New Token
          </button>
        </div>

        {/* Newly created banner */}
        {newlyCreated && (
          <div className="rounded-lg border border-emerald-700/50 bg-emerald-950/30 p-4">
            <div className="flex items-center gap-2 mb-3">
              <svg className="h-4 w-4 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              <h3 className="text-sm font-semibold text-emerald-300">Token created — copy it now, it won't be shown again</h3>
            </div>
            <div className="flex items-center gap-3 bg-slate-900 rounded-lg px-3 py-2.5 border border-slate-700">
              <code className="flex-1 text-xs text-emerald-300 font-mono break-all">{newlyCreated.token}</code>
              <button onClick={() => copyText(newlyCreated.token)} className="text-blue-400 hover:text-blue-300 flex-shrink-0"><CopyIcon className="w-4 h-4"/></button>
            </div>
            <div className="mt-2 flex gap-4 text-xs text-slate-400">
              <span>Label: <span className="text-slate-300">{newlyCreated.label || newlyCreated.name}</span></span>
              {newlyCreated.expiresAt && <span>Expires: <span className="text-slate-300">{getExpiry(newlyCreated.expiresAt).label}</span></span>}
            </div>
            <button onClick={() => setNewlyCreated(null)} className="mt-2 text-xs text-emerald-500 hover:text-emerald-400 underline">Dismiss</button>
          </div>
        )}

        {/* Token table */}
        {isLoading ? (
          <div className="flex justify-center py-10"><div className="w-5 h-5 border-2 border-slate-600 border-t-blue-500 rounded-full animate-spin"/></div>
        ) : guestTokens.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-slate-800 p-10 text-center">
            <p className="text-sm text-slate-500">No guest tokens yet. Create one to grant scoped access.</p>
          </div>
        ) : (
          <div className="rounded-lg border border-slate-800 overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/80">
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Name</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Status</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Secret Key</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap hidden lg:table-cell">Created</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap hidden sm:table-cell">Expires</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Permissions</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {guestTokens.map((token) => {
                  const key = getTokenKey(token);
                  const rawToken = revealedTokens[key];
                  const isRevealed = rawToken && visibleTokenIds[key];
                  const expiry = getExpiry(token.expiresAt);
                  const isPublished = token.isShareable || token.is_shareable;
                  const svcScope = hasServiceScope(token.scopes);
                  const isRegen = regeneratingTokenId === key;
                  const bundle = isBundle(token);
                  const scopes = token.scopes || [];

                  // Compact permission summary
                  const permLabel = (() => {
                    if (scopes.length === 0) return { text: 'No access', cls: 'text-slate-600' };
                    if (scopes.includes('admin:*')) return { text: 'Full access', cls: 'text-emerald-400' };
                    const cats = new Set();
                    scopes.forEach(s => {
                      if (['basic','professional','availability'].includes(s)) cats.add('Identity');
                      else if (s === 'personas') cats.add('Personas');
                      else if (['knowledge','chat','memory'].includes(s)) cats.add('Knowledge');
                      else if (s.startsWith('skills:')) cats.add('Skills');
                      else if (s.startsWith('services')) cats.add('Services');
                    });
                    const catArr = Array.from(cats);
                    if (catArr.length === 1) return { text: catArr[0], cls: 'text-slate-300' };
                    if (catArr.length <= 2) return { text: catArr.join(' · '), cls: 'text-slate-300' };
                    return { text: `${catArr[0]} +${catArr.length - 1}`, cls: 'text-slate-300' };
                  })();

                  const maskedKey = (() => {
                    const src = rawToken || key || '';
                    if (!src) return '—';
                    const last4 = src.slice(-4);
                    const prefix = src.startsWith('tok_') ? 'tok_' : src.slice(0, 4);
                    return `${prefix}…${last4}`;
                  })();

                  return (
                    <tr key={key} className="hover:bg-slate-800/25 transition-colors group">
                      {/* Name */}
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white text-sm">{token.label || token.name}</span>
                          {bundle && <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-sm bg-purple-900/40 text-purple-300 border border-purple-700/50">Bundle</span>}
                          {isPublished && <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-sm bg-emerald-900/30 text-emerald-300 border border-emerald-700/40">Published</span>}
                        </div>
                      </td>
                      {/* Status */}
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0"/>
                          Active
                        </span>
                      </td>
                      {/* Secret Key */}
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <code className="text-[11px] font-mono text-slate-400 bg-slate-800/70 px-2 py-0.5 rounded border border-slate-700/50">
                            {isRevealed ? (rawToken || maskedKey) : maskedKey}
                          </code>
                          <button
                            onClick={async () => {
                              if (!rawToken) { await handleRegenerateToken(token); return; }
                              setVisibleTokenIds((p) => ({ ...p, [key]: !p[key] }));
                            }}
                            title={rawToken ? (isRevealed ? 'Hide' : 'Reveal') : 'Rotate to reveal'}
                            className="text-slate-600 hover:text-slate-300 transition-colors"
                          >
                            <EyeIcon className="w-3.5 h-3.5" off={isRevealed}/>
                          </button>
                        </div>
                      </td>
                      {/* Created */}
                      <td className="px-4 py-2.5 whitespace-nowrap hidden lg:table-cell">
                        <span className="text-xs text-slate-500">{token.createdAt ? new Date(token.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</span>
                      </td>
                      {/* Expires */}
                      <td className="px-4 py-2.5 whitespace-nowrap hidden sm:table-cell">
                        <span className={`text-xs ${expiry.urgent ? 'text-amber-400' : 'text-slate-500'}`}>{expiry.label}</span>
                      </td>
                      {/* Permissions */}
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className={`text-xs font-medium ${permLabel.cls}`} title={scopes.join(', ')}>{permLabel.text}</span>
                      </td>
                      {/* Actions — icon only */}
                      <td className="px-4 py-2.5 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          {/* Edit */}
                          <button onClick={() => { selectToken(token); setShowEditModal(true); }} title="Edit" className="p-1.5 rounded text-slate-500 hover:text-white hover:bg-slate-700 transition-colors">
                            <EditIcon className="w-3.5 h-3.5"/>
                          </button>
                          {/* Services */}
                          <button
                            onClick={() => { if (!isPublished) { selectToken(token); setShowServiceScopeModal(true); } }}
                            disabled={isPublished}
                            title={isPublished ? 'Unpublish before editing service scopes' : 'Edit service scopes'}
                            className="p-1.5 rounded text-slate-500 hover:text-blue-400 hover:bg-blue-900/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                          </button>
                          {/* Copy */}
                          <button onClick={() => handleCopyGuestToken(token)} title="Copy key" className="p-1.5 rounded text-slate-500 hover:text-cyan-400 hover:bg-cyan-900/20 transition-colors">
                            <CopyIcon className="w-3.5 h-3.5"/>
                          </button>
                          {/* Rotate */}
                          <button onClick={() => handleRegenerateToken(token)} disabled={isRegen} title="Rotate key" className="p-1.5 rounded text-slate-500 hover:text-amber-400 hover:bg-amber-900/20 transition-colors disabled:opacity-30">
                            <RotateIcon className={`w-3.5 h-3.5 ${isRegen ? 'animate-spin' : ''}`}/>
                          </button>
                          {/* Publish / Unpublish */}
                          {isPublished ? (
                            <button onClick={() => handleUnpublishToken(token)} disabled={publishingTokenId === key} title="Unpublish" className="p-1.5 rounded text-emerald-500 hover:text-emerald-300 hover:bg-emerald-900/20 transition-colors disabled:opacity-30">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>
                            </button>
                          ) : (
                            <button
                              onClick={() => !svcScope && handlePublishToken(token)}
                              disabled={publishingTokenId === key || svcScope}
                              title={svcScope ? 'Service scopes block publishing' : 'Publish to marketplace'}
                              className="p-1.5 rounded text-slate-500 hover:text-emerald-400 hover:bg-emerald-900/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
                            </button>
                          )}
                          {/* Revoke */}
                          <button onClick={() => { selectToken(token); setShowRevokeModal(true); }} title="Revoke" className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-900/20 transition-colors">
                            <TrashIcon className="w-3.5 h-3.5"/>
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
      </section>

      {/* ── Installed from Marketplace ── */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-white">Installed from Marketplace</h2>
          <p className="text-xs text-slate-400 mt-0.5">Tokens installed from the marketplace — access to other users' data with their permission</p>
        </div>
        {vaultLoading ? (
          <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-slate-600 border-t-blue-500 rounded-full animate-spin"/></div>
        ) : installedTokens.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-slate-800 p-8 text-center">
            <p className="text-sm text-slate-500">No installed tokens. Browse the marketplace to find and add tokens.</p>
          </div>
        ) : (
          <div className="rounded-lg border border-slate-800 overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/80">
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Name</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Status</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap hidden lg:table-cell">Installed</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap hidden sm:table-cell">Expires</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Permissions</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {installedTokens.map((token) => {
                  const installedExpiry = getExpiry(token.expires_at || token.expiresAt);
                  return (
                    <tr key={token.id} className="hover:bg-slate-800/25 transition-colors group">
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className="font-medium text-white text-sm">{token.label || 'Untitled'}</span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 text-xs text-cyan-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 flex-shrink-0"/>Installed
                        </span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap hidden lg:table-cell">
                        <span className="text-xs text-slate-500">{token.created_at ? new Date(token.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap hidden sm:table-cell">
                        <span className={`text-xs ${installedExpiry.urgent ? 'text-amber-400' : 'text-slate-500'}`}>{installedExpiry.label}</span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className={`text-xs font-medium ${token.readOnly ? 'text-slate-400' : 'text-blue-300'}`}>{token.readOnly ? 'Read only' : 'Read & Write'}</span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleRevokeInstalled(token.id)} disabled={revokingTokenId === token.id} title="Revoke" className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-900/20 transition-colors disabled:opacity-30">
                            <TrashIcon className="w-3.5 h-3.5"/>
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
      </section>

      {/* ── Create Token Modal ── */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-2xl my-8 shadow-2xl">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
              <div>
                <h3 className="text-base font-semibold text-white">Create Guest Token</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {totalScopesSelected() > 0 ? `${totalScopesSelected()} permission categor${totalScopesSelected() !== 1 ? 'ies' : 'y'} selected` : 'Choose permissions for this token'}
                </p>
              </div>
              <button onClick={() => setShowCreateForm(false)} className="text-slate-500 hover:text-slate-300 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="divide-y divide-slate-800">
              {/* Label + Description */}
              <div className="px-6 py-5 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">Label *</label>
                  <input
                    type="text" required value={form.label}
                    onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
                    placeholder="e.g., Claude Agent — Production"
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-700 bg-slate-800 text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">Description <span className="text-slate-600 normal-case font-normal">(optional)</span></label>
                  <input
                    type="text" value={form.description}
                    onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                    placeholder="What is this token used for?"
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-700 bg-slate-800 text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>

              {/* ── Permissions (GitHub-style) ── */}
              <div className="px-6 py-5">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Permissions</label>
                  <span className="text-xs text-slate-600">Click a category to expand</span>
                </div>
                <div className="space-y-2">

                  {/* ── Identity ── */}
                  <ScopeRow
                    icon="🪪"
                    title="Identity"
                    description="Profile information visible to this token"
                    summary={identitySummary().text}
                    summaryColor={identitySummary().color}
                    active={identityScopes.size > 0}
                  >
                    <div className="space-y-1">
                      <ResourceItem
                        label="Basic"
                        sublabel="Name, role, company"
                        checked={identityScopes.has('basic')}
                        onChange={() => {
                          setIdentityScopes((p) => {
                            const next = new Set(p);
                            if (next.has('basic')) next.delete('basic'); else next.add('basic');
                            return next;
                          });
                        }}
                      />
                      <ResourceItem
                        label="Professional"
                        sublabel="Skills, education, work experience"
                        checked={identityScopes.has('professional')}
                        onChange={() => {
                          setIdentityScopes((p) => {
                            const next = new Set(p);
                            if (next.has('professional')) next.delete('professional'); else next.add('professional');
                            return next;
                          });
                        }}
                      />
                      <ResourceItem
                        label="Availability"
                        sublabel="Calendar, timezone, working hours"
                        checked={identityScopes.has('availability')}
                        onChange={() => {
                          setIdentityScopes((p) => {
                            const next = new Set(p);
                            if (next.has('availability')) next.delete('availability'); else next.add('availability');
                            return next;
                          });
                        }}
                      />
                    </div>
                  </ScopeRow>

                  {/* ── Personas ── */}
                  <ScopeRow
                    icon="🎭"
                    title="Personas"
                    description="Persona profiles this token can access"
                    summary={personaSummary().text}
                    summaryColor={personaSummary().color}
                    active={personaAccess !== 'none'}
                  >
                    <div className="space-y-3">
                      {/* Access level selector */}
                      <div className="flex gap-2">
                        {[
                          { value: 'none', label: 'No access' },
                          { value: 'all', label: 'All personas' },
                          { value: 'selected', label: 'Selected personas' },
                        ].map(({ value, label }) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => {
                              setPersonaAccess(value);
                              if (value !== 'selected') { setSelectedPersonaIds(new Set()); setBundlePersonaId(null); setBundleKb(false); }
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                              personaAccess === value
                                ? 'bg-blue-600 border-blue-500 text-white'
                                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>

                      {/* Persona list */}
                      {personaAccess === 'selected' && (
                        <div className="space-y-1">
                          {resourcesLoading.personas ? <LoadingSkeleton lines={2}/> : personas.length === 0 ? (
                            <p className="text-xs text-slate-500 px-2">No personas found.</p>
                          ) : personas.map((p) => (
                            <label key={p.id} className={`flex items-center gap-3 px-2 py-2 rounded-lg cursor-pointer transition-colors hover:bg-slate-800/60 ${selectedPersonaIds.has(p.id) ? 'bg-blue-900/10' : ''}`}>
                              <input
                                type="checkbox"
                                checked={selectedPersonaIds.has(p.id)}
                                onChange={() => {
                                  toggleSet(selectedPersonaIds, setSelectedPersonaIds, p.id);
                                  // Only one persona can be the bundle persona
                                  if (bundlePersonaId === p.id) { setBundlePersonaId(null); setBundleKb(false); }
                                }}
                                className="h-4 w-4 rounded border-slate-600 bg-slate-700 text-blue-500"
                              />
                              <div className="flex-1 min-w-0">
                                <span className="text-sm text-white">{p.name}</span>
                                {p.description && <span className="ml-2 text-xs text-slate-500 truncate">{p.description}</span>}
                              </div>
                              {p.active && <span className="text-xs text-emerald-400 flex-shrink-0">Active</span>}
                              {/* Bundle trigger: radio to "focus" this persona */}
                              {selectedPersonaIds.has(p.id) && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setBundlePersonaId(bundlePersonaId === p.id ? null : p.id);
                                    if (bundlePersonaId === p.id) setBundleKb(false);
                                  }}
                                  className={`ml-1 px-2 py-0.5 rounded text-[10px] font-medium border transition-colors flex-shrink-0 ${bundlePersonaId === p.id ? 'bg-purple-900/40 text-purple-300 border-purple-700/50' : 'bg-slate-700 text-slate-400 border-slate-600 hover:text-white'}`}
                                >
                                  {bundlePersonaId === p.id ? 'Bundle ✓' : 'Bundle?'}
                                </button>
                              )}
                            </label>
                          ))}
                        </div>
                      )}

                      {/* Bundle KB toggle — shown when a bundle persona is chosen */}
                      {bundlePersonaId && (
                        <label className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer border transition-colors ${bundleKb ? 'bg-purple-900/20 border-purple-700/60' : 'bg-slate-800 border-slate-700 hover:border-slate-600'}`}>
                          <input
                            type="checkbox"
                            checked={bundleKb}
                            onChange={(e) => setBundleKb(e.target.checked)}
                            className="mt-0.5 h-4 w-4 rounded text-purple-500 bg-slate-700 border-slate-600"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-white">Include skills &amp; knowledge base</p>
                              {bundleKb && <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-purple-900/40 text-purple-300 border border-purple-700/50">Bundle</span>}
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                              Expose skills and knowledge docs attached to this persona. Auto-adds <code className="text-purple-300">knowledge</code> + <code className="text-purple-300">skills:read</code>.
                            </p>
                          </div>
                        </label>
                      )}
                    </div>
                  </ScopeRow>

                  {/* ── Knowledge Base ── */}
                  <ScopeRow
                    icon="📚"
                    title="Knowledge Base"
                    description="Which knowledge documents this token can read"
                    summary={kbSummary().text}
                    summaryColor={kbSummary().color}
                    active={kbAccess !== 'none'}
                  >
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        {[
                          { value: 'none', label: 'No access' },
                          { value: 'all', label: 'All documents' },
                          { value: 'selected', label: 'Select documents' },
                        ].map(({ value, label }) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => { setKbAccess(value); if (value !== 'selected') setSelectedKbIds(new Set()); }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                              kbAccess === value
                                ? 'bg-blue-600 border-blue-500 text-white'
                                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      {kbAccess === 'selected' && (
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          {resourcesLoading.kb ? <LoadingSkeleton lines={3}/> : kbDocs.length === 0 ? (
                            <p className="text-xs text-slate-500 px-2">No knowledge base documents found.</p>
                          ) : kbDocs.map((doc) => (
                            <ResourceItem
                              key={doc.id}
                              label={doc.title || doc.name || `Document ${doc.id}`}
                              sublabel={doc.source || doc.type || doc.source_type}
                              checked={selectedKbIds.has(doc.id)}
                              onChange={() => toggleSet(selectedKbIds, setSelectedKbIds, doc.id)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </ScopeRow>

                  {/* ── Skills ── */}
                  <ScopeRow
                    icon="⚡"
                    title="Skills"
                    description="AI skills and capabilities this token can use"
                    summary={skillSummary().text}
                    summaryColor={skillSummary().color}
                    active={skillAccess !== 'none'}
                  >
                    <div className="space-y-3">
                      {/* Access level */}
                      <div className="flex gap-2">
                        {[
                          { value: 'none', label: 'No access' },
                          { value: 'read', label: 'Read' },
                          { value: 'write', label: 'Read & Write' },
                        ].map(({ value, label }) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setSkillAccess(value)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                              skillAccess === value
                                ? 'bg-blue-600 border-blue-500 text-white'
                                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      {skillAccess !== 'none' && (
                        <>
                          {/* Scope to specific skills? */}
                          <div className="flex gap-2">
                            {[
                              { value: 'all', label: 'All skills' },
                              { value: 'selected', label: 'Specific skills' },
                            ].map(({ value, label }) => (
                              <button
                                key={value}
                                type="button"
                                onClick={() => { setSkillSelectionMode(value); if (value !== 'selected') setSelectedSkillIds(new Set()); }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                                  skillSelectionMode === value
                                    ? 'bg-slate-600 border-slate-500 text-white'
                                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
                                }`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                          {skillSelectionMode === 'selected' && (
                            <div className="space-y-1 max-h-48 overflow-y-auto">
                              {resourcesLoading.skills ? <LoadingSkeleton lines={3}/> : skills.length === 0 ? (
                                <p className="text-xs text-slate-500 px-2">No skills found.</p>
                              ) : skills.map((skill) => (
                                <ResourceItem
                                  key={skill.id}
                                  label={skill.name}
                                  sublabel={skill.description}
                                  checked={selectedSkillIds.has(skill.id)}
                                  onChange={() => toggleSet(selectedSkillIds, setSelectedSkillIds, skill.id)}
                                />
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </ScopeRow>

                  {/* ── Services ── */}
                  <ScopeRow
                    icon="🔗"
                    title="Connected Services"
                    description="OAuth services this token can proxy requests to"
                    summary={serviceSummary().text}
                    summaryColor={serviceSummary().color}
                    active={serviceAccess !== 'none'}
                  >
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        {[
                          { value: 'none', label: 'No access' },
                          { value: 'read', label: 'Read (GET)' },
                          { value: 'write', label: 'Read & Write' },
                        ].map(({ value, label }) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setServiceAccess(value)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                              serviceAccess === value
                                ? 'bg-blue-600 border-blue-500 text-white'
                                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      {serviceAccess !== 'none' && (
                        <>
                          <div className="flex gap-2">
                            {[
                              { value: 'all', label: 'All connected services' },
                              { value: 'selected', label: 'Specific services' },
                            ].map(({ value, label }) => (
                              <button
                                key={value}
                                type="button"
                                onClick={() => { setServiceSelectionMode(value); if (value !== 'selected') setSelectedServiceNames(new Set()); }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                                  serviceSelectionMode === value
                                    ? 'bg-slate-600 border-slate-500 text-white'
                                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
                                }`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                          {serviceSelectionMode === 'selected' && (
                            <div className="space-y-1">
                              {resourcesLoading.services ? <LoadingSkeleton lines={3}/> : connectedServices.length === 0 ? (
                                <p className="text-xs text-slate-500 px-2">No connected services found. Connect services in the Connectors page.</p>
                              ) : connectedServices.map((svc) => (
                                <ResourceItem
                                  key={svc.name}
                                  label={svc.name.charAt(0).toUpperCase() + svc.name.slice(1)}
                                  sublabel={svc.description}
                                  checked={selectedServiceNames.has(svc.name)}
                                  onChange={() => toggleSet(selectedServiceNames, setSelectedServiceNames, svc.name)}
                                />
                              ))}
                            </div>
                          )}
                          <div className="flex gap-2 items-start pt-1 px-1">
                            <svg className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/></svg>
                            <p className="text-[11px] text-amber-300/60">Tokens with service scopes cannot be published to the marketplace.</p>
                          </div>
                        </>
                      )}
                    </div>
                  </ScopeRow>

                  {/* ── Memory ── */}
                  <ScopeRow
                    icon="🧠"
                    title="Memory"
                    description="Read and write memory entries"
                    summary={memoryAccess ? 'Read & Write' : 'No access'}
                    summaryColor={memoryAccess ? 'text-blue-400' : 'text-slate-600'}
                    active={memoryAccess}
                  >
                    <label className={`flex items-center gap-3 px-2 py-2 rounded-lg cursor-pointer transition-colors hover:bg-slate-800/60 ${memoryAccess ? 'bg-blue-900/10' : ''}`}>
                      <input
                        type="checkbox"
                        checked={memoryAccess}
                        onChange={(e) => setMemoryAccess(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-600 bg-slate-700 text-blue-500"
                      />
                      <div>
                        <span className="text-sm text-white">Enable memory access</span>
                        <p className="text-xs text-slate-500">Token can read and write memory entries</p>
                      </div>
                    </label>
                  </ScopeRow>

                </div>

                {totalScopesSelected() === 0 && (
                  <p className="text-xs text-red-400 mt-2 px-1">Select at least one permission category</p>
                )}
              </div>

              {/* ── Options ── */}
              <div className="px-6 py-5 space-y-3">
                <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Options</label>

                {/* Expiry */}
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Expires In</label>
                  <select
                    value={form.expiresInHours}
                    onChange={(e) => setForm((p) => ({ ...p, expiresInHours: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-800 text-white focus:border-blue-500 focus:outline-none text-sm"
                  >
                    <option value="1">1 hour</option>
                    <option value="24">24 hours</option>
                    <option value="168">7 days</option>
                    <option value="720">30 days</option>
                    <option value="">Never</option>
                  </select>
                </div>

                {/* Requires Approval */}
                <label className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer border transition-colors ${form.requiresApproval ? 'bg-amber-900/20 border-amber-700/50' : 'bg-slate-800 border-transparent hover:border-slate-600'}`}>
                  <input type="checkbox" checked={form.requiresApproval} onChange={(e) => setForm((p) => ({ ...p, requiresApproval: e.target.checked }))} className="mt-0.5 h-4 w-4 rounded text-amber-500 bg-slate-700 border-slate-600"/>
                  <div>
                    <p className="text-sm font-medium text-white">Requires Approval</p>
                    <p className="text-xs text-slate-500">Users must be approved before this token grants access</p>
                  </div>
                </label>

                {/* Publish on create */}
                {!hasServiceScopeInState() ? (
                  <label className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer border transition-colors ${form.publishOnCreate ? 'bg-emerald-900/20 border-emerald-700/50' : 'bg-slate-800 border-transparent hover:border-slate-600'}`}>
                    <input type="checkbox" checked={form.publishOnCreate} onChange={(e) => setForm((p) => ({ ...p, publishOnCreate: e.target.checked }))} className="mt-0.5 h-4 w-4 rounded text-emerald-500 bg-slate-700 border-slate-600"/>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-white">Publish to Marketplace</p>
                        {bundleKb && form.publishOnCreate && <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-purple-900/40 text-purple-300 border border-purple-700/50">Bundle</span>}
                      </div>
                      <p className="text-xs text-slate-500">Make this token available in the marketplace immediately after creation</p>
                    </div>
                  </label>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700 text-xs text-slate-500">
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>
                    Tokens with service scopes cannot be published to the marketplace
                  </div>
                )}
              </div>

              {/* Footer buttons */}
              <div className="flex justify-end gap-3 px-6 py-4">
                <button type="button" onClick={() => setShowCreateForm(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving || totalScopesSelected() === 0}
                  className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isSaving ? 'Creating…' : 'Create Token'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modals */}
      <EditTokenModal
        isOpen={showEditModal} token={selectedToken}
        onClose={() => { setShowEditModal(false); deselectToken(); }}
        onSuccess={() => { setShowEditModal(false); deselectToken(); fetchTokens(masterToken); }}
      />
      <ServiceScopeSelector
        isOpen={showServiceScopeModal} currentToken={selectedToken} masterToken={masterToken}
        onClose={() => { setShowServiceScopeModal(false); deselectToken(); }}
        onSuccess={() => { setShowServiceScopeModal(false); deselectToken(); fetchTokens(masterToken); }}
      />
      <RevokeConfirmationModal
        isOpen={showRevokeModal} token={selectedToken}
        onClose={() => { setShowRevokeModal(false); deselectToken(); }}
        onConfirm={() => { setShowRevokeModal(false); deselectToken(); fetchTokens(masterToken); }}
      />
    </div>
  );
}

export default AccessTokens;
