/**
 * InviteModal Component
 * Phase 1: Teams & Multi-Tenancy
 * Modal for sending workspace invitations
 */

import React, { useState } from 'react';
import './InviteModal.css';

const InviteModal = ({ workspaceId, onInvitationSent, onClose }) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!email.trim()) {
      setError('Please enter an email address');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `/api/v1/workspaces/${workspaceId}/invitations`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Workspace-ID': workspaceId
          },
          credentials: 'include',
          body: JSON.stringify({
            email: email.trim(),
            role
          })
        }
      );

      if (!response.ok) {
        let errorMsg = 'Failed to send invitation';
        try {
          const data = await response.json();
          errorMsg = data.error || errorMsg;
        } catch {
          // If response is not JSON, use status text
          errorMsg = response.statusText || errorMsg;
        }
        throw new Error(errorMsg);
      }

      await response.json();
      setSuccess(true);
      setEmail('');
      setRole('member');

      setTimeout(() => {
        onInvitationSent();
      }, 1000);
    } catch (err) {
      console.error('Invitation error:', err);
      setError(err.message || 'Failed to send invitation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="invite-modal-overlay" onClick={onClose}>
      <div className="invite-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Invite Team Member</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="invite-form">
          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">Invitation sent successfully!</div>}

          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              disabled={loading}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="role">Role</label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              disabled={loading}
            >
              <option value="viewer">Viewer - Read-only access</option>
              <option value="member">Member - Full access</option>
              <option value="admin">Admin - Manage team and settings</option>
            </select>
            <p className="role-description">
              {role === 'viewer' && 'Can view workspace resources but cannot create or modify'}
              {role === 'member' && 'Full access to all workspace resources'}
              {role === 'admin' && 'Can manage team members and workspace settings'}
            </p>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="button secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="button primary"
              disabled={loading}
            >
              {loading ? 'Sending...' : 'Send Invitation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InviteModal;
