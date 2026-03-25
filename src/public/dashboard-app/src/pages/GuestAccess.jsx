import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';

function GuestAccess() {
  const token = useAuthStore((state) => state.masterToken);
  const currentWorkspace = useAuthStore((state) => state.currentWorkspace);
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showGenerator, setShowGenerator] = useState(false);
  const [generatorData, setGeneratorData] = useState({
    label: '',
    scopes: [],
    expiresInHours: 24,
  });
  const [generating, setGenerating] = useState(false);
  const [generatedToken, setGeneratedToken] = useState(null);

  const availableScopes = [
    { value: 'read', label: 'Basic Read', description: 'Name, role, company' },
    { value: 'professional', label: 'Professional', description: 'Skills, education, experience' },
    { value: 'availability', label: 'Availability', description: 'Calendar, timezone' },
  ];

  useEffect(() => {
    fetchTokens();
  }, [token, currentWorkspace?.id]);

  const fetchTokens = async () => {
    try {
      const response = await fetch('/api/v1/tokens', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      setTokens(data.data || []);
    } catch (err) {
      console.error('Failed to fetch tokens:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleScopeToggle = (scope) => {
    setGeneratorData(prev => ({
      ...prev,
      scopes: prev.scopes.includes(scope)
        ? prev.scopes.filter(s => s !== scope)
        : [...prev.scopes, scope]
    }));
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    setGenerating(true);

    try {
      const response = await fetch('/api/v1/tokens', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          label: generatorData.label,
          scope: generatorData.scopes[0] || 'read', // Use first selected scope
          expiresInHours: parseInt(generatorData.expiresInHours),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setGeneratedToken(data.data);
        setGeneratorData({ label: '', scopes: [], expiresInHours: 24 });
        await fetchTokens();
      }
    } catch (err) {
      console.error('Failed to generate token:', err);
    } finally {
      setGenerating(false);
    }
  };

  const handleRevoke = async (tokenId) => {
    if (!confirm('Are you sure you want to revoke this token?')) return;

    try {
      const response = await fetch(`/api/v1/tokens/${tokenId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        await fetchTokens();
      }
    } catch (err) {
      console.error('Failed to revoke token:', err);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Token copied to clipboard!');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Guest Access Tokens</h1>
          <p className="mt-2 text-sm text-gray-400">
            Generate limited-access tokens for external parties
          </p>
        </div>
        <button
          onClick={() => {
            setShowGenerator(!showGenerator);
            setGeneratedToken(null);
          }}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          {showGenerator ? 'Cancel' : '+ Generate Token'}
        </button>
      </div>

      {generatedToken && (
        <div className="mb-6 bg-green-900 bg-opacity-20 border border-green-700 rounded-lg p-6">
          <div className="flex items-center mb-4">
            <svg className="h-6 w-6 text-green-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-lg font-medium text-green-200">Token Generated Successfully!</h3>
          </div>
          <div className="bg-gray-900 rounded-md p-4">
            <div className="text-sm text-gray-400 mb-2">Copy this token now - it won't be shown again:</div>
            <div className="flex items-center space-x-2">
              <code className="flex-1 text-sm text-green-300 font-mono bg-gray-800 p-2 rounded">
                {generatedToken.token}
              </code>
              <button
                onClick={() => copyToClipboard(generatedToken.token)}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm"
              >
                Copy
              </button>
            </div>
            <div className="mt-3 text-xs text-gray-500">
              <div>Label: {generatedToken.label}</div>
              <div>Scope: {generatedToken.scope}</div>
              {generatedToken.expiresAt && (
                <div>Expires: {new Date(generatedToken.expiresAt).toLocaleString()}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {showGenerator && !generatedToken && (
        <div className="mb-6 bg-gray-800 shadow rounded-lg border border-gray-700">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-white mb-4">
              Generate Guest Token
            </h3>
            <form onSubmit={handleGenerate} className="space-y-4">
              <div>
                <label htmlFor="label" className="block text-sm font-medium text-gray-300">
                  Token Label *
                </label>
                <input
                  type="text"
                  id="label"
                  required
                  value={generatorData.label}
                  onChange={(e) => setGeneratorData({ ...generatorData, label: e.target.value })}
                  className="mt-1 block w-full border border-gray-700 rounded-md shadow-sm py-2 px-3 bg-gray-900 text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="e.g., Client XYZ - Project Demo"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Access Scopes *
                </label>
                <div className="space-y-2">
                  {availableScopes.map((scope) => (
                    <label
                      key={scope.value}
                      className="flex items-start p-3 bg-gray-900 rounded-md cursor-pointer hover:bg-gray-850"
                    >
                      <input
                        type="checkbox"
                        checked={generatorData.scopes.includes(scope.value)}
                        onChange={() => handleScopeToggle(scope.value)}
                        className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-700 rounded bg-gray-800"
                      />
                      <div className="ml-3">
                        <div className="text-sm font-medium text-white">{scope.label}</div>
                        <div className="text-xs text-gray-400">{scope.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="expires" className="block text-sm font-medium text-gray-300">
                  Expires In (hours)
                </label>
                <select
                  id="expires"
                  value={generatorData.expiresInHours}
                  onChange={(e) => setGeneratorData({ ...generatorData, expiresInHours: e.target.value })}
                  className="mt-1 block w-full border border-gray-700 rounded-md shadow-sm py-2 px-3 bg-gray-900 text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                >
                  <option value="1">1 hour</option>
                  <option value="24">24 hours</option>
                  <option value="168">7 days</option>
                  <option value="720">30 days</option>
                  <option value="">Never</option>
                </select>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowGenerator(false)}
                  className="px-4 py-2 border border-gray-700 rounded-md text-sm font-medium text-gray-300 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={generating || generatorData.scopes.length === 0}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {generating ? 'Generating...' : 'Generate Token'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-gray-800 shadow rounded-lg border border-gray-700">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-white mb-4">
            Active Tokens
          </h3>
          {tokens.filter(t => !t.revokedAt && t.scope !== 'full').length === 0 ? (
            <div className="text-center py-12">
              <svg
                className="mx-auto h-12 w-12 text-gray-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-400">No guest tokens</h3>
              <p className="mt-1 text-sm text-gray-500">
                Generate a token to grant limited access to external parties.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {tokens
                .filter(t => !t.revokedAt && t.scope !== 'full')
                .map((guestToken) => (
                  <div
                    key={guestToken.tokenId}
                    className="flex items-center justify-between p-4 bg-gray-900 rounded-md border border-gray-700"
                  >
                    <div className="flex-1">
                      <div className="flex items-center">
                        <span className="text-lg mr-3">🎟️</span>
                        <div>
                          <div className="text-sm font-medium text-white">
                            {guestToken.label}
                          </div>
                          <div className="flex items-center space-x-3 mt-1">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-900 text-blue-200">
                              {guestToken.scope}
                            </span>
                            <span className="text-xs text-gray-500">
                              Created {new Date(guestToken.createdAt).toLocaleDateString()}
                            </span>
                            {guestToken.expiresAt && (
                              <span className="text-xs text-yellow-500">
                                Expires {new Date(guestToken.expiresAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRevoke(guestToken.tokenId)}
                      className="ml-4 px-3 py-1 text-sm text-red-400 hover:text-red-300 hover:bg-gray-800 rounded"
                    >
                      Revoke
                    </button>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default GuestAccess;
