import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';

function EnterpriseSettings() {
  const masterToken = useAuthStore((state) => state.masterToken);
  const user = useAuthStore((state) => state.user);
  const currentWorkspace = useAuthStore((state) => state.currentWorkspace);
  const [activeTab, setActiveTab] = useState('sso');
  const [ssoConfig, setSsoConfig] = useState({
    enabled: false,
    provider: 'saml', // 'saml' or 'oidc'
    saml: {
      entryPoint: '',
      certificate: '',
      issuer: '',
    },
    oidc: {
      discoveryUrl: '',
      clientId: '',
      clientSecret: '',
    },
  });
  const [rbacRoles, setRbacRoles] = useState([]);
  const [, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const effectivePlan = String(user?.plan || 'free').toLowerCase();
  const hasEnterpriseAccess = effectivePlan === 'enterprise';

  useEffect(() => {
    fetchEnterpriseConfig();
  }, [masterToken, currentWorkspace?.id]);

  const fetchEnterpriseConfig = async () => {
    setLoading(true);
    try {
      const headers = masterToken ? { Authorization: `Bearer ${masterToken}` } : {};
      
      const [ssoRes, rbacRes] = await Promise.all([
        fetch('/api/v1/enterprise/sso/config', { headers, credentials: 'include' }).catch(() => ({ ok: false })),
        fetch('/api/v1/enterprise/rbac/roles', { headers, credentials: 'include' }).catch(() => ({ ok: false })),
      ]);

      if (ssoRes.ok) {
        const data = await ssoRes.json();
        setSsoConfig(data.config || ssoConfig);
      }

      if (rbacRes.ok) {
        const data = await rbacRes.json();
        setRbacRoles(data.roles || []);
      }
    } catch (err) {
      console.error('Failed to fetch enterprise config:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSsoSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      const headers = {
        'Content-Type': 'application/json',
        ...(masterToken ? { Authorization: `Bearer ${masterToken}` } : {}),
      };

      const res = await fetch('/api/v1/enterprise/sso/config', {
        method: 'PUT',
        headers,
        credentials: 'include',
        body: JSON.stringify(ssoConfig),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage('✅ SSO configuration saved successfully');
      } else {
        setMessage(`❌ ${data.error || 'Failed to save configuration'}`);
      }
    } catch (err) {
      setMessage(`❌ Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const TABS = [
    { id: 'sso', label: 'Single Sign-On (SSO)' },
    { id: 'rbac', label: 'Roles & Permissions' },
  ];

  if (!hasEnterpriseAccess) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Enterprise Settings</h1>
          <p className="text-slate-400 mt-1">This section is available on the Enterprise plan.</p>
        </div>
        <div className="rounded-lg border border-amber-700 bg-amber-900/20 p-5 text-amber-200">
          <p className="font-medium">Your current plan: {effectivePlan}</p>
          <p className="text-sm mt-1">Upgrade to Enterprise to access SSO (SAML/OIDC) and advanced RBAC controls.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Enterprise Settings</h1>
        <p className="text-slate-400 mt-1">Configure SSO, RBAC, and advanced security for your workspace</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-700">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'text-blue-400 border-blue-500'
                : 'text-slate-400 border-transparent hover:text-slate-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* SSO Configuration */}
      {activeTab === 'sso' && (
        <div className="space-y-6">
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Single Sign-On (SSO)</h2>
            <p className="text-slate-400 mb-6">
              Enable enterprise SSO to manage user access with SAML 2.0 or OIDC. Users in your enterprise can authenticate using your identity provider.
            </p>

            <div className="space-y-6">
              {/* Enable SSO */}
              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ssoConfig.enabled}
                    onChange={(e) =>
                      setSsoConfig({ ...ssoConfig, enabled: e.target.checked })
                    }
                    className="w-4 h-4 rounded bg-slate-700 border border-slate-600"
                  />
                  <span className="text-slate-200 font-medium">Enable SSO for this workspace</span>
                </label>
              </div>

              {ssoConfig.enabled && (
                <>
                  {/* Provider Selection */}
                  <div>
                    <label className="block text-sm font-medium text-slate-200 mb-2">
                      SSO Provider
                    </label>
                    <select
                      value={ssoConfig.provider}
                      onChange={(e) =>
                        setSsoConfig({ ...ssoConfig, provider: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="saml">SAML 2.0</option>
                      <option value="oidc">OIDC (OpenID Connect)</option>
                    </select>
                  </div>

                  {/* SAML Configuration */}
                  {ssoConfig.provider === 'saml' && (
                    <div className="space-y-4 bg-slate-700/30 p-4 rounded-lg border border-slate-600">
                      <h3 className="font-semibold text-slate-200">SAML 2.0 Configuration</h3>

                      <div>
                        <label className="block text-sm font-medium text-slate-200 mb-2">
                          Entity ID (Issuer)
                        </label>
                        <input
                          type="text"
                          value={ssoConfig.saml.issuer}
                          onChange={(e) =>
                            setSsoConfig({
                              ...ssoConfig,
                              saml: { ...ssoConfig.saml, issuer: e.target.value },
                            })
                          }
                          placeholder="https://your-idp.example.com"
                          className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded-md text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-xs text-slate-400 mt-1">Your identity provider's unique identifier</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-200 mb-2">
                          Entry Point (SSO URL)
                        </label>
                        <input
                          type="url"
                          value={ssoConfig.saml.entryPoint}
                          onChange={(e) =>
                            setSsoConfig({
                              ...ssoConfig,
                              saml: { ...ssoConfig.saml, entryPoint: e.target.value },
                            })
                          }
                          placeholder="https://your-idp.example.com/sso"
                          className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded-md text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-xs text-slate-400 mt-1">URL where users are redirected to authenticate</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-200 mb-2">
                          X.509 Certificate
                        </label>
                        <textarea
                          value={ssoConfig.saml.certificate}
                          onChange={(e) =>
                            setSsoConfig({
                              ...ssoConfig,
                              saml: { ...ssoConfig.saml, certificate: e.target.value },
                            })
                          }
                          placeholder="-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"
                          rows={6}
                          className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded-md text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                        />
                        <p className="text-xs text-slate-400 mt-1">Public certificate for verifying SAML responses</p>
                      </div>

                      <div className="bg-blue-900/20 border border-blue-700 rounded p-3">
                        <p className="text-xs text-blue-300">
                          <strong>Assertion Consumer Service (ACS) URL:</strong><br />
                          <code className="bg-slate-900/50 p-1 rounded text-xs">https://www.myapiai.com/api/v1/oauth/callback/saml</code>
                        </p>
                      </div>
                    </div>
                  )}

                  {/* OIDC Configuration */}
                  {ssoConfig.provider === 'oidc' && (
                    <div className="space-y-4 bg-slate-700/30 p-4 rounded-lg border border-slate-600">
                      <h3 className="font-semibold text-slate-200">OIDC Configuration</h3>

                      <div>
                        <label className="block text-sm font-medium text-slate-200 mb-2">
                          Discovery URL
                        </label>
                        <input
                          type="url"
                          value={ssoConfig.oidc.discoveryUrl}
                          onChange={(e) =>
                            setSsoConfig({
                              ...ssoConfig,
                              oidc: { ...ssoConfig.oidc, discoveryUrl: e.target.value },
                            })
                          }
                          placeholder="https://your-idp.example.com/.well-known/openid-configuration"
                          className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded-md text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-xs text-slate-400 mt-1">OpenID discovery endpoint (usually ends with /.well-known/openid-configuration)</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-200 mb-2">
                          Client ID
                        </label>
                        <input
                          type="text"
                          value={ssoConfig.oidc.clientId}
                          onChange={(e) =>
                            setSsoConfig({
                              ...ssoConfig,
                              oidc: { ...ssoConfig.oidc, clientId: e.target.value },
                            })
                          }
                          placeholder="your-client-id"
                          className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded-md text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-200 mb-2">
                          Client Secret
                        </label>
                        <input
                          type="password"
                          value={ssoConfig.oidc.clientSecret}
                          onChange={(e) =>
                            setSsoConfig({
                              ...ssoConfig,
                              oidc: { ...ssoConfig.oidc, clientSecret: e.target.value },
                            })
                          }
                          placeholder="••••••••"
                          className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded-md text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div className="bg-blue-900/20 border border-blue-700 rounded p-3">
                        <p className="text-xs text-blue-300">
                          <strong>Redirect URI:</strong><br />
                          <code className="bg-slate-900/50 p-1 rounded text-xs">https://www.myapiai.com/api/v1/oauth/callback/oidc</code>
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Save Button */}
              <div className="flex gap-3">
                <button
                  onClick={handleSsoSave}
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white font-medium rounded transition-colors"
                >
                  {saving ? 'Saving...' : 'Save SSO Configuration'}
                </button>
                {message && (
                  <div className={`flex-1 px-3 py-2 rounded text-sm ${
                    message.includes('✅')
                      ? 'bg-green-900/30 text-green-300'
                      : 'bg-red-900/30 text-red-300'
                  }`}>
                    {message}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RBAC Configuration */}
      {activeTab === 'rbac' && (
        <div className="space-y-6">
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Roles & Permissions</h2>
            <p className="text-slate-400 mb-6">
              Define roles and permissions for workspace members. Control granular access to APIs, skills, and data.
            </p>

            {/* Role List */}
            <div className="space-y-4">
              {rbacRoles.length === 0 ? (
                <div className="text-center text-slate-400 py-8">
                  <p>No custom roles defined yet.</p>
                  <p className="text-sm mt-2">Default roles: Owner, Admin, Member, Viewer</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {rbacRoles.map((role) => (
                    <div
                      key={role.id}
                      className="bg-slate-700 border border-slate-600 rounded p-4"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold text-slate-100">{role.name}</h3>
                          <p className="text-sm text-slate-400 mt-1">{role.description}</p>
                          <div className="flex flex-wrap gap-2 mt-3">
                            {(role.permissions || []).map((perm) => (
                              <span
                                key={perm}
                                className="inline-flex items-center px-2 py-1 rounded text-xs bg-slate-600 text-slate-300"
                              >
                                {perm}
                              </span>
                            ))}
                          </div>
                        </div>
                        <button className="text-slate-400 hover:text-slate-200">✎</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Create Role Button */}
              <button className="w-full px-4 py-2 border-2 border-dashed border-slate-600 hover:border-slate-500 text-slate-300 hover:text-slate-200 rounded font-medium transition-colors mt-6">
                + Create Custom Role
              </button>
            </div>

            {/* Default Roles Info */}
            <div className="mt-8 pt-6 border-t border-slate-700">
              <h3 className="font-semibold text-slate-100 mb-3">Default Workspace Roles</h3>
              <div className="space-y-3">
                <div>
                  <p className="font-medium text-slate-200">👑 Owner</p>
                  <p className="text-sm text-slate-400">Full access. Can manage members, billing, and settings.</p>
                </div>
                <div>
                  <p className="font-medium text-slate-200">🔐 Admin</p>
                  <p className="text-sm text-slate-400">Can manage members, create resources, and configure workspace.</p>
                </div>
                <div>
                  <p className="font-medium text-slate-200">👤 Member</p>
                  <p className="text-sm text-slate-400">Can create and manage own resources. Limited workspace access.</p>
                </div>
                <div>
                  <p className="font-medium text-slate-200">👁️ Viewer</p>
                  <p className="text-sm text-slate-400">Read-only access. Can view resources but cannot make changes.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EnterpriseSettings;
