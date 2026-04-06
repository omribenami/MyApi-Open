// AFP (API File Protocol) — shared runtime state
// Both src/routes/afp.js and the WS handler in src/index.js require this module.
// Node's module cache guarantees they share the same Map instances.

const pendingRequests = new Map(); // requestId → { resolve, reject, timer }
const afpConnections  = new Map(); // deviceId  → WebSocket

module.exports = { pendingRequests, afpConnections };
