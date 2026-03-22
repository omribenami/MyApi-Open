/**
 * TeamMembers Component
 * Phase 1: Teams & Multi-Tenancy
 * Displays and manages workspace members
 */

import React, { useState } from 'react';
import './TeamMembers.css';

const TeamMembers = ({
  members,
  currentUserId,
  isOwner,
  canManage,
  workspaceId,
  masterToken,
  onMemberRemoved,
  onMemberRoleChanged
}) => {
  const [editingMemberId, setEditingMemberId] = useState(null);
  const [editingRole, setEditingRole] = useState(null);

  const handleRoleChange = async (memberId, newRole) => {
    if (newRole === editingRole) {
      setEditingMemberId(null);
      return;
    }

    try {
      const member = members.find(m => m.id === memberId);
      const headers = {
        'Content-Type': 'application/json',
        'X-Workspace-ID': workspaceId,
        ...(masterToken ? { Authorization: `Bearer ${masterToken}` } : {})
      };
      const response = await fetch(
        `/api/v1/workspaces/${workspaceId}/members/${member.user_id}`,
        {
          method: 'PUT',
          headers,
          credentials: 'include',
          body: JSON.stringify({ role: newRole })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update member role');
      }

      onMemberRoleChanged(memberId, newRole);
      setEditingMemberId(null);
    } catch (error) {
      console.error('Error updating member role:', error);
      alert('Failed to update member role');
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!window.confirm('Are you sure you want to remove this member?')) {
      return;
    }

    try {
      const member = members.find(m => m.id === memberId);
      const headers = {
        'X-Workspace-ID': workspaceId,
        ...(masterToken ? { Authorization: `Bearer ${masterToken}` } : {})
      };
      const response = await fetch(
        `/api/v1/workspaces/${workspaceId}/members/${member.user_id}`,
        {
          method: 'DELETE',
          headers,
          credentials: 'include'
        }
      );

      if (!response.ok) {
        throw new Error('Failed to remove member');
      }

      onMemberRemoved(memberId);
    } catch (error) {
      console.error('Error removing member:', error);
      alert('Failed to remove member');
    }
  };

  if (members.length === 0) {
    return <p className="empty-state">No members in this workspace</p>;
  }

  const roles = ['viewer', 'member', 'admin', 'owner'];

  return (
    <div className="team-members">
      <table className="members-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Joined</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {members.map(member => (
            <tr key={member.id} className={`member-row ${member.user_id === currentUserId ? 'current' : ''}`}>
              <td className="member-name">
                <span className="avatar">{member.display_name?.[0] || member.username?.[0] || 'U'}</span>
                <span>{member.display_name || member.username || 'Unknown'}</span>
                {member.user_id === currentUserId && <span className="badge">You</span>}
              </td>
              <td className="member-email">{member.email || '-'}</td>
              <td className="member-role">
                {editingMemberId === member.id && member.role !== 'owner' ? (
                  <select
                    value={editingRole || member.role}
                    onChange={(e) => setEditingRole(e.target.value)}
                    onBlur={() => handleRoleChange(member.id, editingRole || member.role)}
                    autoFocus
                  >
                    {roles.filter(r => r !== 'owner').map(role => (
                      <option key={role} value={role}>
                        {role.charAt(0).toUpperCase() + role.slice(1)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className={`role-badge ${member.role}`}>
                    {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                  </span>
                )}
              </td>
              <td className="member-joined">
                {new Date(member.joined_at).toLocaleDateString()}
              </td>
              <td className="member-actions">
                {canManage && member.role !== 'owner' && (
                  <>
                    {editingMemberId === member.id ? (
                      <button
                        className="action-button save"
                        onClick={() => handleRoleChange(member.id, editingRole)}
                      >
                        Save
                      </button>
                    ) : (
                      <button
                        className="action-button edit"
                        onClick={() => {
                          setEditingMemberId(member.id);
                          setEditingRole(member.role);
                        }}
                      >
                        Edit
                      </button>
                    )}
                    <button
                      className="action-button delete"
                      onClick={() => handleRemoveMember(member.id)}
                    >
                      Remove
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TeamMembers;
