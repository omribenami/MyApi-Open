/**
 * Pending Invitations Component
 * Shows invitations that the current user has received and can accept/decline
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import './PendingInvitations.css';

function PendingInvitations() {
  const navigate = useNavigate();
  const { user, masterToken, fetchWorkspaces, setCurrentWorkspace } = useAuthStore();
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  useEffect(() => {
    if (masterToken) {
      fetchPendingInvitations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [masterToken]);

  const fetchPendingInvitations = async () => {
    try {
      setLoading(true);
      setError(null);
      const headers = masterToken ? { 'Authorization': `Bearer ${masterToken}` } : {};
      
      // Mobile fallback: Send user email as header in case session cookie is lost
      // This is common on mobile browsers after OAuth redirects
      if (user?.email) {
        headers['X-User-Email'] = user.email;
      }
      
      const response = await fetch('/api/v1/invitations', {
        headers,
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch pending invitations');
      }
      
      const data = await response.json();
      setInvitations(data.invitations || []);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching pending invitations:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptInvitation = async (invitationId) => {
    try {
      setError(null);
      const headers = masterToken ? { 'Authorization': `Bearer ${masterToken}` } : {};
      
      // Mobile fallback: Send user email as header
      if (user?.email) {
        headers['X-User-Email'] = user.email;
      }
      
      const response = await fetch(`/api/v1/invitations/${invitationId}/accept`, {
        method: 'POST',
        headers,
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to accept invitation');
      }

      const data = await response.json();
      const joinedWorkspace = data.workspace;

      if (joinedWorkspace) {
        setCurrentWorkspace(joinedWorkspace);
      }

      await fetchWorkspaces();

      setSuccessMessage(
        joinedWorkspace?.name
          ? `Joined "${joinedWorkspace.name}" as ${joinedWorkspace.role || 'member'}. Switched workspace context.`
          : 'Invitation accepted! Workspace access granted.'
      );
      setInvitations(prev => prev.filter(inv => inv.id !== invitationId));

      // Keep momentum: route user to Team Settings in the newly joined context
      setTimeout(() => {
        navigate('/settings/team');
      }, 900);
    } catch (err) {
      setError(err.message);
      console.error('Error accepting invitation:', err);
    }
  };

  const handleDeclineInvitation = async (invitationId) => {
    try {
      setError(null);
      const headers = masterToken ? { 'Authorization': `Bearer ${masterToken}` } : {};
      
      // Mobile fallback: Send user email as header
      if (user?.email) {
        headers['X-User-Email'] = user.email;
      }
      
      const response = await fetch(`/api/v1/invitations/${invitationId}`, {
        method: 'DELETE',
        headers,
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to decline invitation');
      }

      setSuccessMessage('Invitation declined');
      setInvitations(prev => prev.filter(inv => inv.id !== invitationId));
    } catch (err) {
      setError(err.message);
      console.error('Error declining invitation:', err);
    }
  };

  if (!invitations || invitations.length === 0) {
    return null;
  }

  return (
    <div className="pending-invitations-container">
      <div className="pending-invitations-card">
        <div className="pending-invitations-header">
          <h3>✉️ Pending Workspace Invitations</h3>
          <span className="invitation-badge">{invitations.length}</span>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="success-message">
            {successMessage}
          </div>
        )}

        <div className="invitations-list">
          {invitations.map((invitation) => (
            <div key={invitation.id} className="invitation-item">
              <div className="invitation-info">
                <p className="invitation-role">
                  📧 You've been invited as a <strong>{invitation.role}</strong>
                </p>
                <p className="invitation-expires">
                  Expires: {new Date(invitation.expiresAt).toLocaleDateString()}
                </p>
              </div>
              <div className="invitation-actions">
                <button
                  className="accept-button"
                  onClick={() => handleAcceptInvitation(invitation.id)}
                  disabled={loading}
                >
                  Accept
                </button>
                <button
                  className="decline-button"
                  onClick={() => handleDeclineInvitation(invitation.id)}
                  disabled={loading}
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default PendingInvitations;
