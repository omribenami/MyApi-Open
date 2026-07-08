// MyApi Open: enterprise SSO/RBAC settings are part of the hosted MyApi Cloud
// edition. This stub keeps the /enterprise route building and rendering a
// clear explanation instead of a broken page.
export default function EnterpriseSettings() {
  return (
    <div style={{ maxWidth: 480, margin: '48px auto', textAlign: 'center', padding: 24 }}>
      <h2 style={{ fontSize: 18, color: 'var(--ink, inherit)', margin: '0 0 8px' }}>Not available in MyApi Open</h2>
      <p style={{ fontSize: 13.5, opacity: 0.75, margin: 0 }}>
        Enterprise settings (SSO configuration, custom RBAC roles) are part of the
        hosted MyApi Cloud edition at{' '}
        <a href="https://www.myapiai.com" target="_blank" rel="noreferrer">myapiai.com</a>.
      </p>
    </div>
  );
}
