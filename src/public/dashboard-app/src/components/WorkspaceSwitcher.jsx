import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../stores/authStore';

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

  const displayName = currentWorkspace?.name || 'Workspace';
  const displayWorkspaces = workspaces || [];

  if (variant === 'menu') {
    if (displayWorkspaces.length <= 1) return null;

    return (
      <div ref={dropdownRef} style={{ position: 'relative' }}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          title="Switch workspace"
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 8px',
            background: isOpen ? 'var(--bg-hover)' : 'transparent',
            border: '1px solid',
            borderColor: isOpen ? 'var(--line)' : 'transparent',
            borderRadius: '5px',
            cursor: 'pointer',
            color: 'var(--ink-2)',
            fontSize: '12px',
            textAlign: 'left',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { if (!isOpen) { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.borderColor = 'var(--line)'; } }}
          onMouseLeave={e => { if (!isOpen) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; } }}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, color: 'var(--ink-3)' }}>
            <rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.5"/>
            <rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor"/>
            <rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor"/>
            <rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.5"/>
          </svg>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'JetBrains Mono, monospace', fontSize: '11px' }}>
            {displayName}
          </span>
          <svg
            width="10" height="10" viewBox="0 0 10 10" fill="none"
            style={{ flexShrink: 0, transition: 'transform 0.15s', transform: isOpen ? 'rotate(180deg)' : 'none', color: 'var(--ink-4)' }}
          >
            <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {isOpen && (
          <div style={{
            position: 'fixed',
            zIndex: 9999,
            top: (() => {
              if (!dropdownRef.current) return 0;
              const r = dropdownRef.current.getBoundingClientRect();
              return r.bottom + 4;
            })(),
            left: (() => {
              if (!dropdownRef.current) return 0;
              const r = dropdownRef.current.getBoundingClientRect();
              return r.left;
            })(),
            width: '220px',
            background: 'var(--bg-raised)',
            border: '1px solid var(--line)',
            borderRadius: '6px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            overflow: 'hidden',
          }}>
            <div style={{ padding: '8px 12px 6px', borderBottom: '1px solid var(--line-2)' }}>
              <span className="micro" style={{ color: 'var(--ink-4)' }}>Workspaces</span>
            </div>
            {displayWorkspaces.map((workspace) => {
              const active = workspace.id === currentWorkspace?.id;
              return (
                <button
                  key={workspace.id}
                  onClick={() => handleSwitchWorkspace(workspace.id)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    padding: '8px 12px',
                    background: active ? 'var(--bg-hover)' : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: active ? 'var(--ink)' : 'var(--ink-2)',
                    fontSize: '13px',
                    textAlign: 'left',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{workspace.name}</span>
                  {active && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, color: 'var(--accent)' }}>
                      <path d="M1.5 6l3 3 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </button>
              );
            })}
            <div style={{ borderTop: '1px solid var(--line-2)', padding: '6px 8px' }}>
              <a
                href="/dashboard/settings/team"
                style={{ display: 'block', padding: '5px 4px', fontSize: '12px', color: 'var(--ink-3)', textDecoration: 'none', borderRadius: '4px' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--ink-2)'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--ink-3)'; e.currentTarget.style.background = 'transparent'; }}
              >
                Team Settings →
              </a>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
};

export default WorkspaceSwitcher;
