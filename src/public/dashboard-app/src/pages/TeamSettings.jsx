/**
 * Team Settings Page
 * Phase 1: Teams & Multi-Tenancy
 * Manage workspace members, invitations, and roles
 */

import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import TeamMembers from '../components/TeamMembers';
import InviteModal from '../components/InviteModal';
import './TeamSettings.css';

const TeamSettings = () => {
  const { user, masterToken } = useAuthStore();
  const [, setWorkspaces] = useState([]);
  const [currentWorkspace, setCurrentWorkspace] = useState(null);
  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [activeTab, setActiveTab] = useState('members');
  const [editingName, setEditingName] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [updatingName, setUpdatingName] = useState(false);
  const currentContextWorkspace = useAuthStore((state) => state.currentWorkspace);

  useEffect(() => {
    fetchWorkspaces();
  }, [masterToken]);

  // When workspace context switches, refresh data
  useEffect(() => {
    if (currentContextWorkspace?.id && currentWorkspace?.id !== currentContextWorkspace.id) {
      setCurrentWorkspace(currentContextWorkspace);
      fetchMembers(currentContextWorkspace.id);
      fetchInvitations(currentContextWorkspace.id);
    }
  }, [currentContextWorkspace?.id]);

  const fetchWorkspaces = async () => {
    try {
      setLoading(true);
      const headers = masterToken ? { 'Authorization': `Bearer ${masterToken}` } : {};
      const response = await fetch('/api/v1/workspaces', {
        headers,
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch workspaces');
      const data = await response.json();
      const workspaceList = data.data || data.workspaces || [];
      setWorkspaces(workspaceList);
      
      if (workspaceList.length > 0) {
        setCurrentWorkspace(workspaceList[0]);
        fetchMembers(workspaceList[0].id);
        fetchInvitations(workspaceList[0].id);
      }
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const fetchMembers = async (workspaceId) => {
    try {
      const headers = masterToken ? { 'Authorization': `Bearer ${masterToken}` } : {};
      const response = await fetch(`/api/v1/workspaces/${workspaceId}/members`, {
        headers,
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch members');
      const data = await response.json();
      setMembers(data.data || data.members || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchInvitations = async (workspaceId) => {
    try {
      const headers = masterToken ? { 'Authorization': `Bearer ${masterToken}` } : {};
      const response = await fetch(`/api/v1/workspaces/${workspaceId}/invitations`, {
        headers,
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch invitations');
      const data = await response.json();
      setInvitations(data.data || data.invitations || []);
    } catch (err) {
      console.error('Error fetching invitations:', err);
    }
  };

  const handleMemberRemoved = (memberId) => {
    setMembers(members.filter(m => m.id !== memberId));
  };

  const handleMemberRoleChanged = (memberId, newRole) => {
    setMembers(
      members.map(m =>
        m.id === memberId ? { ...m, role: newRole } : m
      )
    );
  };

  const handleInvitationSent = () => {
    if (currentWorkspace?.id) fetchInvitations(currentWorkspace.id);
    setShowInviteModal(false);
  };

  const handleInvitationRemoved = (invitationId) => {
    setInvitations(invitations.filter(inv => inv.id !== invitationId));
  };

  const handleUpdateWorkspaceName = async () => {
    if (!newWorkspaceName.trim() || newWorkspaceName === currentWorkspace.name) {
      setEditingName(false);
      return;
    }

    setUpdatingName(true);
    try {
      const headers = masterToken ? { 'Authorization': `Bearer ${masterToken}` } : {};
      const response = await fetch(`/api/v1/workspaces/${currentWorkspace.id}`, {
        method: 'PUT',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ name: newWorkspaceName })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to update workspace name');
      }

      const data = await response.json();
      setCurrentWorkspace(data.workspace);
      setEditingName(false);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingName(false);
    }
  };

  const isOwner = currentWorkspace?.ownerId === user?.id;
  const canManageMembers = isOwner || members.some(
    m => m.user_id === user?.id && (m.role === 'admin' || m.role === 'owner')
  );

  if (!currentWorkspace) {
    return (
      <div className="team-settings empty">
        <p>No workspace selected. Please select a workspace to manage team settings.</p>
      </div>
    );
  }

  return (
    <div className="team-settings">
      <div className="team-settings-header">
        <h1>Team Settings</h1>
        <p className="workspace-context">Workspace: <strong>{currentWorkspace.name}</strong></p>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="team-settings-tabs">
        <button
          className={`tab-button ${activeTab === 'members' ? 'active' : ''}`}
          onClick={() => setActiveTab('members')}
        >
          Members ({members.length})
        </button>
        <button
          className={`tab-button ${activeTab === 'invitations' ? 'active' : ''}`}
          onClick={() => setActiveTab('invitations')}
        >
          Pending Invitations ({invitations.length})
        </button>
        {isOwner && (
          <button
            className={`tab-button ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            ⚙️ Workspace Settings
          </button>
        )}
      </div>

      {loading ? (
        <div className="loading">Loading team members...</div>
      ) : (
        <>
          {activeTab === 'members' && (
            <div className="tab-content">
              {canManageMembers && (
                <button
                  className="invite-button primary"
                  onClick={() => setShowInviteModal(true)}
                >
                  + Invite Member
                </button>
              )}

              <TeamMembers
                members={members}
                currentUserId={user?.id}
                isOwner={isOwner}
                canManage={canManageMembers}
                workspaceId={currentWorkspace.id}
                masterToken={masterToken}
                onMemberRemoved={handleMemberRemoved}
                onMemberRoleChanged={handleMemberRoleChanged}
              />
            </div>
          )}

          {activeTab === 'invitations' && (
            <div className="tab-content">
              {invitations.length === 0 ? (
                <p className="empty-state">No pending invitations</p>
              ) : (
                <div className="invitations-list">
                  {invitations.map(invitation => (
                    <div key={invitation.id} className="invitation-item">
                      <div className="invitation-info">
                        <p className="invitation-email">{invitation.email}</p>
                        <p className="invitation-role">Role: {invitation.role}</p>
                        <p className="invitation-expires">
                          Expires: {new Date(invitation.expiresAt).toLocaleDateString()}
                        </p>
                      </div>
                      {canManageMembers && (
                        <button
                          className="delete-button"
                          onClick={async () => {
                            try {
                              const headers = {
                                'X-Workspace-ID': currentWorkspace.id,
                                ...(masterToken ? { Authorization: `Bearer ${masterToken}` } : {})
                              };
                              // Include email as query param to allow revocation without login
                              // (for email-based revocation flow)
                              const revokeUrl = `/api/v1/invitations/${invitation.id}?email=${encodeURIComponent(invitation.email)}`;
                              const response = await fetch(
                                revokeUrl,
                                {
                                  method: 'DELETE',
                                  headers,
                                  credentials: 'include'
                                }
                              );
                              if (response.ok) {
                                handleInvitationRemoved(invitation.id);
                              } else {
                                const error = await response.json();
                                console.error('Error removing invitation:', error);
                              }
                            } catch (err) {
                              console.error('Error removing invitation:', err);
                            }
                          }}
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'settings' && isOwner && (
            <div className="tab-content workspace-settings-tab">
              <div className="settings-section">
                <h3>Workspace Name</h3>
                <p className="section-description">Give your workspace a memorable name that describes your team or project.</p>
                
                {editingName ? (
                  <div className="edit-name-form">
                    <input
                      type="text"
                      value={newWorkspaceName}
                      onChange={(e) => setNewWorkspaceName(e.target.value)}
                      placeholder="Enter workspace name"
                      className="name-input"
                      autoFocus
                    />
                    <div className="button-group">
                      <button
                        className="btn-save"
                        onClick={handleUpdateWorkspaceName}
                        disabled={updatingName}
                      >
                        {updatingName ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        className="btn-cancel"
                        onClick={() => setEditingName(false)}
                        disabled={updatingName}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="name-display">
                    <p className="current-name">{currentWorkspace.name}</p>
                    <button
                      className="btn-edit"
                      onClick={() => {
                        setNewWorkspaceName(currentWorkspace.name);
                        setEditingName(true);
                      }}
                    >
                      Edit Name
                    </button>
                  </div>
                )}
              </div>

              <div className="settings-section">
                <h3>Workspace ID</h3>
                <p className="section-description">Used for API requests and workspace switching.</p>
                <div className="workspace-id-display">
                  <code>{currentWorkspace.id}</code>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {showInviteModal && canManageMembers && (
        <InviteModal
          workspaceId={currentWorkspace.id}
          onInvitationSent={handleInvitationSent}
          onClose={() => setShowInviteModal(false)}
        />
      )}
    </div>
  );
};

export default TeamSettings;
