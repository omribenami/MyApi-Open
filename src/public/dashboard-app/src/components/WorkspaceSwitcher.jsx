/**
 * WorkspaceSwitcher Component
 * Phase 1: Teams & Multi-Tenancy
 * Allows users to switch between workspaces
 */

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import './WorkspaceSwitcher.css';

const WorkspaceSwitcher = () => {
  const { currentWorkspace, workspaces, switchWorkspace } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSwitchWorkspace = async (workspaceId) => {
    try {
      await switchWorkspace(workspaceId);
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to switch workspace:', error);
    }
  };

  if (!currentWorkspace || !workspaces || workspaces.length === 0) {
    return null;
  }

  return (
    <div className="workspace-switcher" ref={dropdownRef}>
      <button
        className="workspace-switcher-btn"
        onClick={() => setIsOpen(!isOpen)}
        title="Switch workspace"
      >
        <span className="workspace-icon">🏢</span>
        <span className="workspace-name">{currentWorkspace.name}</span>
        <span className={`dropdown-arrow ${isOpen ? 'open' : ''}`}>▼</span>
      </button>

      {isOpen && (
        <div className="workspace-dropdown">
          <div className="workspace-dropdown-header">
            <h4>Workspaces</h4>
          </div>
          
          <ul className="workspace-list">
            {workspaces.map((workspace) => (
              <li key={workspace.id}>
                <button
                  className={`workspace-option ${
                    workspace.id === currentWorkspace.id ? 'active' : ''
                  }`}
                  onClick={() => handleSwitchWorkspace(workspace.id)}
                >
                  <span className="workspace-icon">🏢</span>
                  <span className="workspace-info">
                    <span className="workspace-option-name">{workspace.name}</span>
                    <span className="workspace-option-slug">{workspace.slug}</span>
                  </span>
                  {workspace.id === currentWorkspace.id && (
                    <span className="checkmark">✓</span>
                  )}
                </button>
              </li>
            ))}
          </ul>

          <div className="workspace-dropdown-footer">
            <a href="/dashboard/settings/team" className="settings-link">
              ⚙️ Team Settings
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkspaceSwitcher;
