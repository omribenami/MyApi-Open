/**
 * Team Settings Page
 * Phase 1: Teams & Multi-Tenancy
 * Manage workspace members, invitations, and roles
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import TeamMembers from '../components/TeamMembers';
import InviteModal from '../components/InviteModal';
import './TeamSettings.css';

const TeamSettings = () => {
  const { currentWorkspace, user } = useAuth();
  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [activeTab, setActiveTab] = useState('members');

  useEffect(() => {
    if (!currentWorkspace) {
      setLoading(false);
      return;
    }

    fetchMembers();
    fetchInvitations();
  }, [currentWorkspace]);

  const fetchMembers = async () => {
    try {
      const response = await fetch(
        `/api/v1/workspaces/${currentWorkspace.id}/members`,
        {
          headers: {
            'X-Workspace-ID': currentWorkspace.id
          }
        }
      );
      if (!response.ok) throw new Error('Failed to fetch members');
      const data = await response.json();
      setMembers(data.members || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchInvitations = async () => {
    try {
      const response = await fetch(
        `/api/v1/workspaces/${currentWorkspace.id}/invitations`,
        {
          headers: {
            'X-Workspace-ID': currentWorkspace.id
          }
        }
      );
      if (!response.ok) throw new Error('Failed to fetch invitations');
      const data = await response.json();
      setInvitations(data.invitations || []);
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
    fetchInvitations();
    setShowInviteModal(false);
  };

  const handleInvitationRemoved = (invitationId) => {
    setInvitations(invitations.filter(inv => inv.id !== invitationId));
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
                              const response = await fetch(
                                `/api/v1/invitations/${invitation.id}`,
                                {
                                  method: 'DELETE',
                                  headers: {
                                    'X-Workspace-ID': currentWorkspace.id
                                  }
                                }
                              );
                              if (response.ok) {
                                handleInvitationRemoved(invitation.id);
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
