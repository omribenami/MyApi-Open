
// ============================================================================
// SECURITY FIX: Path Traversal Prevention
// CVSS: 7.5 (High)
// Files affected: ssl-manager.js, backup.js, afp-file-ops.js, vault.js
// ============================================================================

const path = require('path');

/**
 * Safely resolve and validate a file path is within an allowed directory
 * Prevents directory traversal attacks (../, ../../, absolute paths, etc.)
 */
function validatePathWithinBase(basePath, userPath) {
  if (!basePath || !userPath) {
    throw new Error('Both basePath and userPath are required');
  }
  
  // Get absolute, normalized paths
  const baseAbsolute = path.resolve(basePath);
  const targetAbsolute = path.resolve(path.join(basePath, userPath));
  
  // Verify target is within base directory
  if (!targetAbsolute.startsWith(baseAbsolute + path.sep) && targetAbsolute !== baseAbsolute) {
    throw new Error(`Path traversal attempt detected: ${userPath}`);
  }
  
  return targetAbsolute;
}

/**
 * SSL Certificate Path Generation - Safe version
 * CVSS 7.5 vulnerability: Unsafe path generation allowed directory traversal
 */
function generateCertPath(domain, certType = 'cert') {
  if (!domain || typeof domain !== 'string') {
    throw new Error('Invalid domain');
  }
  
  // Whitelist allowed characters in domain name
  if (!/^[a-zA-Z0-9.-]+$/.test(domain)) {
    throw new Error('Invalid domain format');
  }
  
  // Prevent path traversal characters
  if (domain.includes('..') || domain.includes('/') || domain.includes('\\')) {
    throw new Error('Path traversal attempt in domain');
  }
  
  const baseDir = process.env.CERT_DIR || '/etc/ssl/certs';
  const filename = `${domain}.${certType}`;
  
  // Use validatePathWithinBase to ensure safety
  return validatePathWithinBase(baseDir, filename);
}

/**
 * Backup File Operations - Safe restoration
 * CVSS 7.5 vulnerability: Unsafe file path in restore operations
 */
function restoreFromBackup(backupFile, targetDir) {
  // Validate backup file is within backup directory
  const backupBase = process.env.BACKUP_DIR || '/var/backups';
  const safePath = validatePathWithinBase(backupBase, backupFile);
  
  // Validate target directory
  const targetBase = process.env.DATA_DIR || '/var/data';
  const safeTarget = validatePathWithinBase(targetBase, targetDir);
  
  // Now safe to proceed with backup restoration
  return { source: safePath, target: safeTarget };
}

/**
 * AFP File Operations - Safe file handling
 * CVSS 7.2 vulnerability: Unsafe file path handling in AFP connector
 */
function safeAFPFileOp(operation, filename, baseDir) {
  const allowedOps = ['read', 'write', 'delete', 'stat', 'list'];
  
  if (!allowedOps.includes(operation)) {
    throw new Error(`Invalid operation: ${operation}`);
  }
  
  // Validate file path within allowed directory
  const safePath = validatePathWithinBase(baseDir, filename);
  
  // Additional checks for dangerous filenames
  const basename = path.basename(safePath);
  if (basename.startsWith('.') || basename === 'passwd' || basename === 'shadow') {
    throw new Error(`Access denied to file: ${basename}`);
  }
  
  return safePath;
}

module.exports = {
  validatePathWithinBase,
  generateCertPath,
  restoreFromBackup,
  safeAFPFileOp
};
