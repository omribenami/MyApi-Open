import React, { useState, useEffect } from 'react';
import apiClient from '../utils/apiClient';

const DeviceManagement = () => {
  const [activeTab, setActiveTab] = useState('approved');
  const [approvedDevices, setApprovedDevices] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [activityLog, setActivityLog] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [renameMode, setRenameMode] = useState(null);
  const [renamingDeviceId, setRenamingDeviceId] = useState(null);
  const [newDeviceName, setNewDeviceName] = useState('');
  const [approvalMessage, setApprovalMessage] = useState('');

  // Load ALL device data on mount AND when tab changes
  useEffect(() => {
    loadAllDeviceData();
  }, []);

  // Reload current tab data when tab changes
  useEffect(() => {
    loadCurrentTabData();
  }, [activeTab]);

  // Load all data on component mount (shows counts in tab labels)
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

  // Reload data for current tab (when tab is clicked)
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
      console.error('Error loading device data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeDevice = async (deviceId) => {
    if (!window.confirm('Are you sure you want to revoke this device? It will need to be re-approved to use MyApi.')) {
      return;
    }

    try {
      await apiClient.post(`/devices/${deviceId}/revoke`);
      setApprovalMessage({ type: 'success', text: 'Device revoked successfully' });
      loadDeviceData();
      setTimeout(() => setApprovalMessage(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to revoke device');
    }
  };

  const handleRenameDevice = async (deviceId) => {
    if (!newDeviceName.trim()) {
      return;
    }

    try {
      await apiClient.post(`/devices/${deviceId}/rename`, {
        name: newDeviceName,
      });
      setApprovalMessage({ type: 'success', text: 'Device renamed successfully' });
      setRenameMode(null);
      setRenamingDeviceId(null);
      setNewDeviceName('');
      loadDeviceData();
      setTimeout(() => setApprovalMessage(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to rename device');
    }
  };

  const handleApproveDevice = async (approvalId) => {
    try {
      await apiClient.post(`/devices/approve/${approvalId}`, {
        device_name: newDeviceName || 'Approved Device',
      });
      setApprovalMessage({ type: 'success', text: 'Device approved successfully' });
      setNewDeviceName('');
      loadDeviceData();
      setTimeout(() => setApprovalMessage(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to approve device');
    }
  };

  const handleDenyDevice = async (approvalId) => {
    try {
      await apiClient.post(`/devices/deny/${approvalId}`, {
        reason: 'Device approval denied by user',
      });
      setApprovalMessage({ type: 'success', text: 'Device approval denied' });
      loadDeviceData();
      setTimeout(() => setApprovalMessage(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to deny device');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const formatRelativeTime = (dateString) => {
    const now = new Date();
    const then = new Date(dateString);
    const seconds = Math.floor((now - then) / 1000);
    
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    
    return formatDate(dateString);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-white">Device Management</h1>
          <p className="text-slate-400 mt-2">Manage which devices can access your MyApi tokens</p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-700 bg-red-900/30 text-red-200 p-3 text-sm flex items-center justify-between gap-4">
          <span>{error}</span>
          <button type="button" onClick={() => {} } className="text-red-300 hover:text-red-100">✕</button>
        </div>
      )}
      {approvalMessage && (
        <div className={`rounded-lg border p-3 text-sm flex items-center justify-between gap-4 ${
          approvalMessage.type === 'success'
            ? 'border-emerald-700 bg-emerald-900/30 text-emerald-200'
            : 'border-red-700 bg-red-900/30 text-red-200'
        }`}>
          <span>{approvalMessage.text}</span>
          <button type="button" onClick={() => setApprovalMessage('')} className="hover:opacity-80">✕</button>
        </div>
      )}

      <div className="flex gap-2 border-b border-slate-700">
        <button
          className={`px-4 py-2 border-b-2 transition-colors ${
            activeTab === 'approved'
              ? 'border-blue-600 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-300'
          }`}
          onClick={() => setActiveTab('approved')}
        >
          Approved Devices ({approvedDevices.length})
        </button>
        <button
          className={`px-4 py-2 border-b-2 transition-colors ${
            activeTab === 'pending'
              ? 'border-blue-600 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-300'
          }`}
          onClick={() => setActiveTab('pending')}
        >
          Pending Approvals ({pendingApprovals.length})
        </button>
        <button
          className={`px-4 py-2 border-b-2 transition-colors ${
            activeTab === 'activity'
              ? 'border-blue-600 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-300'
          }`}
          onClick={() => setActiveTab('activity')}
        >
          Activity Log
        </button>
      </div>

      <div>
        {loading ? (
          <div className="p-6 text-slate-400">Loading...</div>
        ) : activeTab === 'approved' ? (
          <div>
            {approvedDevices.length === 0 ? (
              <p className="p-6 text-slate-400">No approved devices yet</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {approvedDevices.map((device) => (
                  <div key={device.id} className="bg-slate-900 border border-slate-700/50 rounded-lg overflow-hidden hover:border-slate-600 transition-colors">
                    <div className="p-4 border-b border-slate-700">
                      {renameMode === device.id ? (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newDeviceName}
                            onChange={(e) => setNewDeviceName(e.target.value)}
                            placeholder="Enter new device name"
                            autoFocus
                            className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-100"
                          />
                          <button 
                            onClick={() => handleRenameDevice(device.id)}
                            className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
                          >
                            Save
                          </button>
                          <button 
                            onClick={() => { setRenameMode(null); setNewDeviceName(''); }}
                            className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded text-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex justify-between items-center">
                          <h3 className="text-lg font-semibold text-slate-100">{device.name}</h3>
                          <button
                            className="text-blue-400 hover:text-blue-300 text-sm font-medium"
                            onClick={() => {
                              setRenameMode(device.id);
                              setNewDeviceName(device.name);
                            }}
                          >
                            Rename
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">OS:</span>
                        <span className="text-slate-100 font-mono">{device.info?.os || 'Unknown'}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Browser:</span>
                        <span className="text-slate-100 font-mono">{device.info?.browser || 'Unknown'}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">IP Address:</span>
                        <span className="text-slate-100 font-mono">{device.ip}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Approved:</span>
                        <span className="text-slate-100">{formatDate(device.approvedAt)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Last Used:</span>
                        <span className="text-slate-100">
                          {device.lastUsedAt ? formatRelativeTime(device.lastUsedAt) : 'Never'}
                        </span>
                      </div>
                    </div>
                    <div className="p-4 border-t border-slate-700">
                      <button
                        className="w-full px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded text-sm font-medium"
                        onClick={() => handleRevokeDevice(device.id)}
                      >
                        Revoke Access
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : activeTab === 'pending' ? (
          <div className="pending-approvals">
            {pendingApprovals.length === 0 ? (
              <p className="empty-state">No pending device approvals</p>
            ) : (
              <div className="approval-list">
                {pendingApprovals.map((approval) => (
                  <div key={approval.id} className="approval-card">
                    <div className="approval-card-header">
                      <h3>New Device Request</h3>
                      <span className="expiry">
                        Expires: {formatDate(approval.expiresAt)}
                      </span>
                    </div>
                    <div className="approval-details">
                      <div className="detail">
                        <span className="label">Operating System:</span>
                        <span className="value">{approval.deviceInfo?.os || 'Unknown'}</span>
                      </div>
                      <div className="detail">
                        <span className="label">Browser:</span>
                        <span className="value">{approval.deviceInfo?.browser || 'Unknown'}</span>
                      </div>
                      <div className="detail">
                        <span className="label">IP Address:</span>
                        <span className="value">{approval.ip}</span>
                      </div>
                      <div className="detail">
                        <span className="label">Requested:</span>
                        <span className="value">{formatRelativeTime(approval.createdAt)}</span>
                      </div>
                    </div>
                    <div className="approval-input">
                      <input
                        type="text"
                        placeholder="Device name (e.g., 'Work Laptop')"
                        value={newDeviceName}
                        onChange={(e) => setNewDeviceName(e.target.value)}
                      />
                    </div>
                    <div className="approval-actions">
                      <button
                        className="btn btn-success"
                        onClick={() => handleApproveDevice(approval.id)}
                      >
                        Approve
                      </button>
                      <button
                        className="btn btn-danger"
                        onClick={() => handleDenyDevice(approval.id)}
                      >
                        Deny
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="activity-log">
            {activityLog.length === 0 ? (
              <p className="empty-state">No device activity yet</p>
            ) : (
              <div className="timeline">
                {activityLog.map((event) => (
                  <div key={event.id} className={`timeline-item ${event.action}`}>
                    <div className="timeline-icon">
                      {event.action === 'approval' && '✓'}
                      {event.action === 'revocation' && '✗'}
                      {event.action === 'approved' && '✓'}
                      {event.action === 'denied' && '✗'}
                    </div>
                    <div className="timeline-content">
                      <h4>{event.deviceName}</h4>
                      <p>
                        <strong>{event.action.charAt(0).toUpperCase() + event.action.slice(1)}</strong>
                        {' '} at {event.ip}
                      </p>
                      <span className="timestamp">{formatRelativeTime(event.timestamp)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DeviceManagement;
