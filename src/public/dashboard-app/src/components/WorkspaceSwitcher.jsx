/**
 * WorkspaceSwitcher Component
 * Phase 1: Teams & Multi-Tenancy
 * Allows users to switch between workspaces
 */

import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../stores/authStore';
import './WorkspaceSwitcher.css';

const WorkspaceSwitcher = ({ variant = 'menu' }) => {
  const currentWorkspace = useAuthStore((state) => state.currentWorkspace);
  const workspaces = useAuthStore((state) => state.workspaces);
  const switchWorkspace = useAuthStore((state) => state.switchWorkspace);
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

  // Show switcher even if only one workspace, for testing & visibility
  const displayName = currentWorkspace?.name || 'Workspace';
  const displayWorkspaces = workspaces || [];

  // Menu variant: simple text item in a dropdown menu
  if (variant === 'menu') {
    const hasMultiple = displayWorkspaces.length > 1;

    if (!hasMultiple) return null;

    return (
      <div className="relative" ref={dropdownRef}>
        <button
          className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-all flex items-center justify-between"
          onClick={() => setIsOpen(!isOpen)}
          title="Switch workspace"
        >
          <span>🏢 {displayName}</span>
          <svg className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <div className="absolute left-0 top-full w-56 mt-1 rounded-lg border border-slate-700 bg-slate-900 shadow-xl py-1 z-50">
            <div className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Workspaces</div>
            {displayWorkspaces.map((workspace) => (
              <button
                key={workspace.id}
                className={`w-full text-left px-4 py-2 text-sm transition-all flex items-center justify-between ${
                  workspace.id === currentWorkspace?.id
                    ? 'text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.8)] bg-slate-800/50'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
                onClick={() => handleSwitchWorkspace(workspace.id)}
              >
                <span>{workspace.name}</span>
                {workspace.id === currentWorkspace?.id && (
                  <span className="text-blue-400">✓</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Navbar variant: fancy button (unused now but keeping for legacy)
  return (
    <div className="workspace-switcher" ref={dropdownRef}>
      <button
        className="workspace-switcher-btn"
        onClick={() => setIsOpen(!isOpen)}
        title="Switch workspace"
      >
        <span className="workspace-icon">🏢</span>
        <span className="workspace-name">{displayName}</span>
        {displayWorkspaces.length > 1 && (
          <span className={`dropdown-arrow ${isOpen ? 'open' : ''}`}>▼</span>
        )}
      </button>

      {isOpen && displayWorkspaces.length > 0 && (
        <div className="workspace-dropdown">
          <div className="workspace-dropdown-header">
            <h4>Workspaces ({displayWorkspaces.length})</h4>
          </div>
          
          <ul className="workspace-list">
            {displayWorkspaces.map((workspace) => (
              <li key={workspace.id}>
                <button
                  className={`workspace-option ${
                    workspace.id === currentWorkspace?.id ? 'active' : ''
                  }`}
                  onClick={() => handleSwitchWorkspace(workspace.id)}
                >
                  <span className="workspace-icon">🏢</span>
                  <span className="workspace-info">
                    <span className="workspace-option-name">{workspace.name}</span>
                    <span className="workspace-option-slug">{workspace.slug}</span>
                  </span>
                  {workspace.id === currentWorkspace?.id && (
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
