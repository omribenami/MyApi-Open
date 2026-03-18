import React, { useState, useEffect } from 'react';
import apiClient from '../utils/apiClient';
import './DeviceManagement.css';

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

  useEffect(() => {
    loadDeviceData();
  }, [activeTab]);

  const loadDeviceData = async () => {
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
    <div className="device-management">
      <div className="device-management-header">
        <h1>Device Management</h1>
        <p>Manage which devices can access your MyApi tokens</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {approvalMessage && (
        <div className={`alert alert-${approvalMessage.type}`}>
          {approvalMessage.text}
        </div>
      )}

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'approved' ? 'active' : ''}`}
          onClick={() => setActiveTab('approved')}
        >
          Approved Devices ({approvedDevices.length})
        </button>
        <button
          className={`tab ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          Pending Approvals ({pendingApprovals.length})
        </button>
        <button
          className={`tab ${activeTab === 'activity' ? 'active' : ''}`}
          onClick={() => setActiveTab('activity')}
        >
          Activity Log
        </button>
      </div>

      <div className="tab-content">
        {loading ? (
          <div className="loading">Loading...</div>
        ) : activeTab === 'approved' ? (
          <div className="approved-devices">
            {approvedDevices.length === 0 ? (
              <p className="empty-state">No approved devices yet</p>
            ) : (
              <div className="device-list">
                {approvedDevices.map((device) => (
                  <div key={device.id} className="device-card">
                    <div className="device-card-header">
                      {renameMode === device.id ? (
                        <div className="rename-input">
                          <input
                            type="text"
                            value={newDeviceName}
                            onChange={(e) => setNewDeviceName(e.target.value)}
                            placeholder="Enter new device name"
                            autoFocus
                          />
                          <button onClick={() => handleRenameDevice(device.id)}>
                            Save
                          </button>
                          <button onClick={() => { setRenameMode(null); setNewDeviceName(''); }}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <h3>{device.name}</h3>
                          <button
                            className="rename-btn"
                            onClick={() => {
                              setRenameMode(device.id);
                              setNewDeviceName(device.name);
                            }}
                          >
                            Rename
                          </button>
                        </>
                      )}
                    </div>
                    <div className="device-card-details">
                      <div className="detail">
                        <span className="label">Operating System:</span>
                        <span className="value">{device.info?.os || 'Unknown'}</span>
                      </div>
                      <div className="detail">
                        <span className="label">Browser:</span>
                        <span className="value">{device.info?.browser || 'Unknown'}</span>
                      </div>
                      <div className="detail">
                        <span className="label">IP Address:</span>
                        <span className="value">{device.ip}</span>
                      </div>
                      <div className="detail">
                        <span className="label">Approved:</span>
                        <span className="value">{formatDate(device.approvedAt)}</span>
                      </div>
                      <div className="detail">
                        <span className="label">Last Used:</span>
                        <span className="value">
                          {device.lastUsedAt ? formatRelativeTime(device.lastUsedAt) : 'Never'}
                        </span>
                      </div>
                    </div>
                    <div className="device-card-actions">
                      <button
                        className="btn btn-danger"
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
