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
        setMessage('success:SSO configuration saved successfully');
      } else {
        setMessage(`error:${data.error || 'Failed to save configuration'}`);
      }
    } catch (err) {
      setMessage(`error:Error: ${err.message}`);
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
      <div className="ui-page">
        <div className="flex flex-col sm:flex-row items-start gap-4 mb-2">
          <div className="flex-1 min-w-0">
            <div className="micro mb-2">WORKSPACE · ENTERPRISE</div>
            <h1 className="font-serif text-[22px] sm:text-[34px] leading-[1.05] tracking-tight ink font-medium">Enterprise Settings</h1>
            <p className="mt-2 text-[15px] ink-2 max-w-[60ch]">This section is available on the Enterprise plan.</p>
          </div>
        </div>
        <div
          style={{
            padding: '16px',
            borderRadius: '6px',
            border: '1px solid var(--amber)',
            backgroundColor: 'rgba(210,153,34,0.1)',
            color: 'var(--amber)',
          }}
        >
          <p style={{ fontWeight: 500, margin: 0 }}>Your current plan: {effectivePlan}</p>
          <p style={{ fontSize: '13px', marginTop: '4px', marginBottom: 0 }}>
            Upgrade to Enterprise to access SSO (SAML/OIDC) and advanced RBAC controls.
          </p>
        </div>
      </div>
    );
  }

  const isSuccess = message.startsWith('success:');
  const messageText = message.replace(/^(success|error):/, '');

  return (
    <div className="ui-page">
      <div className="flex flex-col sm:flex-row items-start gap-4 mb-2">
        <div className="flex-1 min-w-0">
          <div className="micro mb-2">WORKSPACE · ENTERPRISE</div>
          <h1 className="font-serif text-[22px] sm:text-[34px] leading-[1.05] tracking-tight ink font-medium">Enterprise Settings</h1>
          <p className="mt-2 text-[15px] ink-2 max-w-[60ch]">Configure SSO, RBAC, and advanced security for your organization.</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid var(--line)' }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '8px 16px',
              fontWeight: 500,
              fontSize: '14px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
              color: activeTab === tab.id ? 'var(--accent)' : 'var(--ink-2)',
              cursor: 'pointer',
              transition: 'color 0.15s',
              marginBottom: '-1px',
            }}
            onMouseEnter={(e) => {
              if (activeTab !== tab.id) e.currentTarget.style.color = 'var(--ink)';
            }}
            onMouseLeave={(e) => {
              if (activeTab !== tab.id) e.currentTarget.style.color = 'var(--ink-2)';
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* SSO Configuration */}
      {activeTab === 'sso' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="ui-card" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ink)', margin: '0 0 8px 0' }}>
              Single Sign-On (SSO)
            </h2>
            <p className="ink-2" style={{ fontSize: '13.5px', marginBottom: '24px' }}>
              Enable enterprise SSO to manage user access with SAML 2.0 or OIDC. Users in your enterprise can authenticate using your identity provider.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Enable SSO */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={ssoConfig.enabled}
                    onChange={(e) =>
                      setSsoConfig({ ...ssoConfig, enabled: e.target.checked })
                    }
                    style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '3px',
                      accentColor: 'var(--accent)',
                      cursor: 'pointer',
                    }}
                  />
                  <span style={{ color: 'var(--ink)', fontWeight: 500, fontSize: '14px' }}>
                    Enable SSO for this workspace
                  </span>
                </label>
              </div>

              {ssoConfig.enabled && (
                <>
                  {/* Provider Selection */}
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--ink)', marginBottom: '6px' }}>
                      SSO Provider
                    </label>
                    <select
                      value={ssoConfig.provider}
                      onChange={(e) =>
                        setSsoConfig({ ...ssoConfig, provider: e.target.value })
                      }
                      className="ui-input"
                      style={{ width: '100%' }}
                    >
                      <option value="saml">SAML 2.0</option>
                      <option value="oidc">OIDC (OpenID Connect)</option>
                    </select>
                  </div>

                  {/* SAML Configuration */}
                  {ssoConfig.provider === 'saml' && (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px',
                        backgroundColor: 'var(--bg-sunk)',
                        padding: '16px',
                        borderRadius: '6px',
                        border: '1px solid var(--line)',
                      }}
                    >
                      <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)', margin: 0 }}>
                        SAML 2.0 Configuration
                      </h3>

                      <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--ink)', marginBottom: '6px' }}>
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
                          className="ui-input"
                          style={{ width: '100%' }}
                        />
                        <p style={{ fontSize: '12px', color: 'var(--ink-3)', marginTop: '4px', marginBottom: 0 }}>
                          Your identity provider's unique identifier
                        </p>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--ink)', marginBottom: '6px' }}>
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
                          className="ui-input"
                          style={{ width: '100%' }}
                        />
                        <p style={{ fontSize: '12px', color: 'var(--ink-3)', marginTop: '4px', marginBottom: 0 }}>
                          URL where users are redirected to authenticate
                        </p>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--ink)', marginBottom: '6px' }}>
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
                          className="ui-input mono"
                          style={{ width: '100%', fontSize: '12px', resize: 'vertical' }}
                        />
                        <p style={{ fontSize: '12px', color: 'var(--ink-3)', marginTop: '4px', marginBottom: 0 }}>
                          Public certificate for verifying SAML responses
                        </p>
                      </div>

                      <div
                        style={{
                          backgroundColor: 'var(--accent-bg)',
                          border: '1px solid var(--accent-2)',
                          borderRadius: '6px',
                          padding: '12px',
                        }}
                      >
                        <p style={{ fontSize: '12px', color: 'var(--accent)', margin: 0 }}>
                          <strong>Assertion Consumer Service (ACS) URL:</strong><br />
                          <code
                            className="mono"
                            style={{
                              backgroundColor: 'var(--bg-sunk)',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '11px',
                            }}
                          >
                            https://www.myapiai.com/api/v1/oauth/callback/saml
                          </code>
                        </p>
                      </div>
                    </div>
                  )}

                  {/* OIDC Configuration */}
                  {ssoConfig.provider === 'oidc' && (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px',
                        backgroundColor: 'var(--bg-sunk)',
                        padding: '16px',
                        borderRadius: '6px',
                        border: '1px solid var(--line)',
                      }}
                    >
                      <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)', margin: 0 }}>
                        OIDC Configuration
                      </h3>

                      <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--ink)', marginBottom: '6px' }}>
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
                          className="ui-input"
                          style={{ width: '100%' }}
                        />
                        <p style={{ fontSize: '12px', color: 'var(--ink-3)', marginTop: '4px', marginBottom: 0 }}>
                          OpenID discovery endpoint (usually ends with /.well-known/openid-configuration)
                        </p>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--ink)', marginBottom: '6px' }}>
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
                          className="ui-input"
                          style={{ width: '100%' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--ink)', marginBottom: '6px' }}>
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
                          className="ui-input"
                          style={{ width: '100%' }}
                        />
                      </div>

                      <div
                        style={{
                          backgroundColor: 'var(--accent-bg)',
                          border: '1px solid var(--accent-2)',
                          borderRadius: '6px',
                          padding: '12px',
                        }}
                      >
                        <p style={{ fontSize: '12px', color: 'var(--accent)', margin: 0 }}>
                          <strong>Redirect URI:</strong><br />
                          <code
                            className="mono"
                            style={{
                              backgroundColor: 'var(--bg-sunk)',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '11px',
                            }}
                          >
                            https://www.myapiai.com/api/v1/oauth/callback/oidc
                          </code>
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Save Button */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <button
                  onClick={handleSsoSave}
                  disabled={saving}
                  className="ui-button-primary"
                  style={{ minHeight: '36px', opacity: saving ? 0.6 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}
                >
                  {saving ? 'Saving...' : 'Save SSO Configuration'}
                </button>
                {message && (
                  <div
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '6px',
                      fontSize: '13px',
                      backgroundColor: isSuccess ? 'var(--green-bg)' : 'var(--red-bg)',
                      color: isSuccess ? 'var(--green)' : 'var(--red)',
                      border: `1px solid ${isSuccess ? 'var(--green)' : 'var(--red)'}`,
                      borderOpacity: 0.3,
                    }}
                  >
                    {isSuccess ? '\u2713' : '\u2717'} {messageText}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RBAC Configuration */}
      {activeTab === 'rbac' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="ui-card" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ink)', margin: '0 0 8px 0' }}>
              Roles & Permissions
            </h2>
            <p className="ink-2" style={{ fontSize: '13.5px', marginBottom: '24px' }}>
              Define roles and permissions for workspace members. Control granular access to APIs, skills, and data.
            </p>

            {/* Role List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {rbacRoles.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--ink-3)', padding: '32px 0' }}>
                  <p style={{ margin: '0 0 8px 0' }}>No custom roles defined yet.</p>
                  <p style={{ fontSize: '13px', margin: 0 }}>Default roles: Owner, Admin, Member, Viewer</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {rbacRoles.map((role) => (
                    <div
                      key={role.id}
                      style={{
                        backgroundColor: 'var(--bg-hover)',
                        border: '1px solid var(--line)',
                        borderRadius: '6px',
                        padding: '16px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)', margin: '0 0 4px 0' }}>
                            {role.name}
                          </h3>
                          <p style={{ fontSize: '13px', color: 'var(--ink-2)', margin: '0 0 12px 0' }}>
                            {role.description}
                          </p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {(role.permissions || []).map((perm) => (
                              <span
                                key={perm}
                                className="micro"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  backgroundColor: 'var(--bg-sunk)',
                                  color: 'var(--ink-2)',
                                  border: '1px solid var(--line)',
                                }}
                              >
                                {perm}
                              </span>
                            ))}
                          </div>
                        </div>
                        <button
                          className="btn-ghost"
                          style={{ color: 'var(--ink-3)', padding: '4px 8px', fontSize: '14px' }}
                        >
                          &#9998;
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Create Role Button */}
              <button
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  border: '2px dashed var(--line)',
                  borderRadius: '6px',
                  background: 'none',
                  color: 'var(--ink-2)',
                  fontWeight: 500,
                  fontSize: '14px',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s, color 0.15s',
                  marginTop: '8px',
                  minHeight: '44px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--ink-3)';
                  e.currentTarget.style.color = 'var(--ink)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--line)';
                  e.currentTarget.style.color = 'var(--ink-2)';
                }}
              >
                + Create Custom Role
              </button>
            </div>

            {/* Default Roles Info */}
            <div
              style={{
                marginTop: '32px',
                paddingTop: '24px',
                borderTop: '1px solid var(--line)',
              }}
            >
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)', margin: '0 0 16px 0' }}>
                Default Workspace Roles
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[
                  { label: 'Owner', desc: 'Full access. Can manage members, billing, and settings.' },
                  { label: 'Admin', desc: 'Can manage members, create resources, and configure workspace.' },
                  { label: 'Member', desc: 'Can create and manage own resources. Limited workspace access.' },
                  { label: 'Viewer', desc: 'Read-only access. Can view resources but cannot make changes.' },
                ].map(({ label, desc }) => (
                  <div key={label}>
                    <p style={{ fontWeight: 500, color: 'var(--ink)', margin: '0 0 2px 0', fontSize: '14px' }}>
                      {label}
                    </p>
                    <p style={{ fontSize: '13px', color: 'var(--ink-2)', margin: 0 }}>{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EnterpriseSettings;
