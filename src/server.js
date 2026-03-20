const { app, bootstrap } = require('./index');

if (process.env.NODE_ENV === 'test') {
  try { bootstrap(); } catch {}
}

module.exports = app;
