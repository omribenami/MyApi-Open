import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import apiClient from '../utils/apiClient';

const DeviceManagement = () => {
  const currentWorkspace = useAuthStore((state) => state.currentWorkspace);
  const [activeTab, setActiveTab] = useState('approved');
  const [approvedDevices, setApprovedDevices] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [activityLog, setActivityLog] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  // Inline rename state
  const [renameMode, setRenameMode] = useState(null);
  const [newDeviceName, setNewDeviceName] = useState('');

  // Pending approval name input (keyed by approval id)
  const [approvalNames, setApprovalNames] = useState({});

  // Scope update in flight
  const [updatingScope, setUpdatingScope] = useState(null);

  useEffect(() => { loadAllDeviceData(); }, [currentWorkspace?.id]);
  useEffect(() => { loadCurrentTabData(); }, [activeTab, currentWorkspace?.id]);

  const showToast = (text, type = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadAllDeviceData = async () => {
    try {
      const [approvedRes, pendingRes, activityRes] = await Promise.all([
        apiClient.get('/devices/approved').catch(() => ({ data: { devices: [] } })),
        apiClient.get('/devices/approvals/pending').catch(() => ({ data: { approvals: [] } })),
        apiClient.get('/devices/activity/log').catch(() => ({ data: { activity: [] } })),
      ]);
      setApprovedDevices(approvedRes.data.devices || []);
      setPendingApprovals(pendingRes.data.approvals || []);
      setActivityLog(activityRes.data.activity || []);
    } catch (err) {
      console.error('Error loading device data:', err);
    }
  };

  const loadCurrentTabData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === 'approved') {
        const res = await apiClient.get('/devices/approved');
        setApprovedDevices(res.data.devices || []);
      } else if (activeTab === 'pending') {
        const res = await apiClient.get('/devices/approvals/pending');
        setPendingApprovals(res.data.approvals || []);
      } else if (activeTab === 'activity') {
        const res = await apiClient.get('/devices/activity/log');
        setActivityLog(res.data.activity || []);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load device data');
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeDevice = async (deviceId) => {
    if (!window.confirm('Revoke this device? It will need to be re-approved.')) return;
    try {
      await apiClient.post(`/devices/${deviceId}/revoke`);
      showToast('Device revoked');
      loadAllDeviceData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to revoke device');
    }
  };

  const handleRenameDevice = async (deviceId) => {
    if (!newDeviceName.trim()) return;
    try {
      await apiClient.post(`/devices/${deviceId}/rename`, { name: newDeviceName });
      showToast('Device renamed');
      setRenameMode(null);
      setNewDeviceName('');
      loadAllDeviceData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to rename device');
    }
  };

  const handleScopeChange = async (deviceId, newScope) => {
    setUpdatingScope(deviceId);
    try {
      await apiClient.patch(`/devices/${deviceId}/scope`, { scope: newScope });
      setApprovedDevices((prev) =>
        prev.map((d) => d.id === deviceId ? { ...d, scope: newScope } : d)
      );
      showToast(`Scope updated to ${newScope}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update scope');
    } finally {
      setUpdatingScope(null);
    }
  };

  const handleApproveDevice = async (approvalId) => {
    const name = approvalNames[approvalId] || 'Approved Device';
    try {
      await apiClient.post(`/devices/approve/${approvalId}`, { device_name: name });
      showToast('Device approved');
      setApprovalNames((prev) => { const n = { ...prev }; delete n[approvalId]; return n; });
      loadAllDeviceData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to approve device');
    }
  };

  const handleDenyDevice = async (approvalId) => {
    try {
      await apiClient.post(`/devices/deny/${approvalId}`, { reason: 'Denied by user' });
      showToast('Device denied', 'error');
      loadAllDeviceData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to deny device');
    }
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
  const fmtRelative = (d) => {
    if (!d) return 'Never';
    const s = Math.floor((Date.now() - new Date(d)) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
    return fmtDate(d);
  };

  const maskFingerprint = (fp) => {
    if (!fp) return '—';
    const tail = fp.slice(-8);
    return `••••••••••••••••••••••••${tail}`;
  };

  const tabs = [
    { id: 'approved', label: 'Approved Devices', count: approvedDevices.length },
    { id: 'pending', label: 'Pending', count: pendingApprovals.length, badge: pendingApprovals.length > 0 },
    { id: 'activity', label: 'Activity Log' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="micro mb-2">DEVICES · MANAGEMENT</div>
        <h1 className="font-serif text-[20px] sm:text-[28px] font-medium tracking-tight ink">Device Management.</h1>
        <p className="ink-3 text-sm mt-1">Control which devices and agents can access your MyApi tokens</p>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className="fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded shadow-xl text-sm font-medium"
          style={{
            background: toast.type === 'error' ? 'var(--red-bg)' : 'var(--green-bg)',
            border: `1px solid ${toast.type === 'error' ? 'var(--red)' : 'var(--green)'}`,
            color: toast.type === 'error' ? 'var(--red)' : 'var(--green)',
          }}
        >
          <span
            className="w-1.5 h-1.5 flex-shrink-0"
            style={{ background: toast.type === 'error' ? 'var(--red)' : 'var(--green)', borderRadius: '2px' }}
          />
          {toast.text}
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          className="flex items-center justify-between gap-4 px-4 py-3 rounded text-sm"
          style={{ background: 'var(--red-bg)', border: '1px solid var(--red)', color: 'var(--red)' }}
        >
          <span>{error}</span>
          <button onClick={() => setError(null)} className="flex-shrink-0 opacity-70 hover:opacity-100">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-0" style={{ borderBottom: '1px solid var(--line)' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-[color:var(--ink)] ink'
                : 'border-transparent ink-3 hover:ink-2'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className="ml-2 px-1.5 py-0.5 text-xs mono"
                style={{
                  borderRadius: '3px',
                  background: tab.badge ? 'var(--amber-bg, rgba(210,153,34,0.15))' : 'var(--bg-sunk)',
                  color: tab.badge ? 'var(--amber)' : 'var(--ink-4)',
                  border: tab.badge ? '1px solid var(--amber)' : '1px solid var(--line)',
                }}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-5 h-5 border-2 border-t-[color:var(--accent)] rounded-full animate-spin" style={{ borderColor: 'var(--line)', borderTopColor: 'var(--accent)' }} />
        </div>
      ) : activeTab === 'approved' ? (
        <div>
          {approvedDevices.length === 0 ? (
            <div className="text-center py-16 ink-4 text-sm">No approved devices yet</div>
          ) : (
            <div className="rounded overflow-hidden" style={{ border: '1px solid var(--line)' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-sunk" style={{ borderBottom: '1px solid var(--line)' }}>
                    <th className="px-4 py-3 text-left micro">Device</th>
                    <th className="px-4 py-3 text-left micro hidden md:table-cell">Fingerprint / ID</th>
                    <th className="px-4 py-3 text-left micro hidden lg:table-cell">IP Address</th>
                    <th className="px-4 py-3 text-left micro hidden lg:table-cell">Approved</th>
                    <th className="px-4 py-3 text-left micro hidden sm:table-cell">Last Used</th>
                    <th className="px-4 py-3 text-left micro">Scope</th>
                    <th className="px-4 py-3 text-right micro">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {approvedDevices.map((device) => {
                    const isASC = device.info?.type === 'asc';
                    const fp = device.info?.key_fingerprint || device.fingerprint || '';
                    return (
                      <tr key={device.id} className="row row-cell">
                        {/* Device name */}
                        <td className="px-4 py-3.5">
                          {renameMode === device.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                autoFocus
                                type="text"
                                value={newDeviceName}
                                onChange={(e) => setNewDeviceName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleRenameDevice(device.id);
                                  if (e.key === 'Escape') { setRenameMode(null); setNewDeviceName(''); }
                                }}
                                className="ui-input w-36 text-xs"
                              />
                              <button onClick={() => handleRenameDevice(device.id)} className="text-xs font-medium accent">Save</button>
                              <button onClick={() => { setRenameMode(null); setNewDeviceName(''); }} className="text-xs ink-4">Cancel</button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2.5">
                              {/* Device icon */}
                              <div
                                className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0"
                                style={{
                                  background: isASC ? 'var(--accent-bg)' : 'var(--bg-sunk)',
                                  border: '1px solid var(--line)',
                                }}
                              >
                                {isASC ? (
                                  <svg className="w-4 h-4 accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"/>
                                  </svg>
                                ) : (
                                  <svg className="w-4 h-4 ink-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                                  </svg>
                                )}
                              </div>
                              <div>
                                <div className="ink font-medium leading-tight">{device.name}</div>
                                <div className="text-xs ink-4 mt-0.5">
                                  {isASC ? 'Ed25519 · ASC' : `${device.info?.os || ''}${device.info?.browser ? ` · ${device.info.browser}` : ''}`}
                                </div>
                              </div>
                            </div>
                          )}
                        </td>

                        {/* Fingerprint */}
                        <td className="px-4 py-3.5 hidden md:table-cell">
                          <code
                            className="text-xs mono px-2 py-1 rounded ink-3"
                            style={{ background: 'var(--bg-sunk)' }}
                          >
                            {fp ? maskFingerprint(fp) : <span className="ink-4">—</span>}
                          </code>
                        </td>

                        {/* IP */}
                        <td className="px-4 py-3.5 hidden lg:table-cell">
                          <code className="text-xs mono ink-2">{device.ip || '—'}</code>
                        </td>

                        {/* Approved */}
                        <td className="px-4 py-3.5 hidden lg:table-cell">
                          <span className="text-xs ink-3">{fmtDate(device.approvedAt)}</span>
                        </td>

                        {/* Last used */}
                        <td className="px-4 py-3.5 hidden sm:table-cell">
                          <span className="text-xs ink-3">{fmtRelative(device.lastUsedAt)}</span>
                        </td>

                        {/* Scope selector */}
                        <td className="px-4 py-3.5">
                          <div className="relative inline-flex">
                            <select
                              value={device.scope || 'full'}
                              onChange={(e) => handleScopeChange(device.id, e.target.value)}
                              disabled={updatingScope === device.id}
                              className="appearance-none text-xs font-medium pl-2 pr-6 py-1 rounded cursor-pointer transition-colors focus:outline-none disabled:opacity-50"
                              style={{
                                background: 'var(--bg-raised)',
                                border: '1px solid var(--line)',
                                color: (device.scope || 'full') === 'read' ? 'var(--ink-3)' : 'var(--accent)',
                              }}
                            >
                              <option value="full">Full</option>
                              <option value="read">Read</option>
                            </select>
                            <div className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2">
                              {updatingScope === device.id ? (
                                <div className="w-3 h-3 border border-t-[color:var(--accent)] rounded-full animate-spin" style={{ borderColor: 'var(--line)', borderTopColor: 'var(--accent)' }} />
                              ) : (
                                <svg className="w-3 h-3 ink-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                                </svg>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => { setRenameMode(device.id); setNewDeviceName(device.name); }}
                              className="ui-button px-2.5 py-1.5 text-xs"
                            >
                              Rename
                            </button>
                            <button
                              onClick={() => handleRevokeDevice(device.id)}
                              className="ui-button-danger px-2.5 py-1.5 text-xs"
                            >
                              Revoke
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
        </div>
      ) : activeTab === 'pending' ? (
        <div>
          {pendingApprovals.length === 0 ? (
            <div className="text-center py-16 ink-4 text-sm">No pending approvals</div>
          ) : (
            <div className="rounded overflow-hidden" style={{ border: '1px solid var(--line)' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-sunk" style={{ borderBottom: '1px solid var(--line)' }}>
                    <th className="px-4 py-3 text-left micro">Request</th>
                    <th className="px-4 py-3 text-left micro hidden md:table-cell">Fingerprint</th>
                    <th className="px-4 py-3 text-left micro hidden sm:table-cell">IP</th>
                    <th className="px-4 py-3 text-left micro hidden lg:table-cell">Expires</th>
                    <th className="px-4 py-3 text-left micro">Name</th>
                    <th className="px-4 py-3 text-right micro">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingApprovals.map((approval) => {
                    const isASC = approval.deviceInfo?.type === 'asc';
                    const fp = approval.deviceInfo?.key_fingerprint || '';
                    const expired = approval.expiresAt && new Date(approval.expiresAt) < new Date();
                    return (
                      <tr key={approval.id} className="row row-cell" style={{ background: 'var(--amber-bg, rgba(210,153,34,0.06))' }}>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <span
                              className="w-2 h-2 flex-shrink-0"
                              style={{
                                borderRadius: '2px',
                                background: expired ? 'var(--red)' : 'var(--amber)',
                                animation: expired ? 'none' : 'pulse 2s infinite',
                              }}
                            />
                            <div>
                              <div className="ink font-medium leading-tight">
                                {isASC ? (approval.deviceInfo?.name || 'ASC Key') : 'New Device'}
                              </div>
                              <div className="text-xs ink-4 mt-0.5">
                                {isASC ? 'Ed25519 · ASC' : `${approval.deviceInfo?.os || 'Unknown'} · ${approval.deviceInfo?.browser || 'Unknown'}`}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 hidden md:table-cell">
                          <code
                            className="text-xs mono px-2 py-1 rounded ink-3"
                            style={{ background: 'var(--bg-sunk)' }}
                          >
                            {fp ? maskFingerprint(fp) : <span className="ink-4">—</span>}
                          </code>
                        </td>
                        <td className="px-4 py-3.5 hidden sm:table-cell">
                          <code className="text-xs mono ink-2">{approval.ip || '—'}</code>
                        </td>
                        <td className="px-4 py-3.5 hidden lg:table-cell">
                          <span className="text-xs" style={{ color: expired ? 'var(--red)' : 'var(--ink-3)' }}>
                            {expired ? 'Expired' : fmtRelative(approval.expiresAt)}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <input
                            type="text"
                            placeholder={isASC ? 'Agent name…' : 'Device name…'}
                            value={approvalNames[approval.id] || ''}
                            onChange={(e) => setApprovalNames((prev) => ({ ...prev, [approval.id]: e.target.value }))}
                            className="ui-input w-36 text-xs"
                          />
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleApproveDevice(approval.id)}
                              disabled={expired}
                              className="px-2.5 py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                              style={{ color: 'var(--green)', background: 'var(--green-bg)', border: '1px solid var(--green)' }}
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleDenyDevice(approval.id)}
                              className="ui-button-danger px-2.5 py-1.5 text-xs"
                            >
                              Deny
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
        </div>
      ) : (
        /* Activity Log */
        <div>
          {activityLog.length === 0 ? (
            <div className="text-center py-16 ink-4 text-sm">No device activity yet</div>
          ) : (
            <div className="rounded overflow-hidden" style={{ border: '1px solid var(--line)' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-sunk" style={{ borderBottom: '1px solid var(--line)' }}>
                    <th className="px-4 py-3 text-left micro">Event</th>
                    <th className="px-4 py-3 text-left micro hidden sm:table-cell">Device</th>
                    <th className="px-4 py-3 text-left micro hidden md:table-cell">IP</th>
                    <th className="px-4 py-3 text-left micro">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {activityLog.map((event) => {
                    const approved = event.action === 'approval' || event.action === 'approved';
                    return (
                      <tr key={event.id} className="row row-cell">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <span
                              className="inline-flex items-center justify-center w-5 h-5 rounded text-xs flex-shrink-0 font-medium"
                              style={{
                                background: approved ? 'var(--green-bg)' : 'var(--red-bg)',
                                color: approved ? 'var(--green)' : 'var(--red)',
                              }}
                            >
                              {approved ? '✓' : '✕'}
                            </span>
                            <span className="ink-2 font-medium capitalize">{event.action}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 hidden sm:table-cell">
                          <span className="ink-2">{event.deviceName || '—'}</span>
                        </td>
                        <td className="px-4 py-3.5 hidden md:table-cell">
                          <code className="text-xs mono ink-3">{event.ip || '—'}</code>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="text-xs ink-4">{fmtRelative(event.timestamp)}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DeviceManagement;
