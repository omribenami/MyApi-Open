/**
 * Shared plan enforcement logic.
 * Used by index.js (OAuth callback) and workspace routes to enforce per-plan resource limits.
 */

const { getUserById, getWorkspaces, getBillingSubscriptionByWorkspace } = require('../database');

// Billing is a closed-source module (absent in MyApi Open). Fall back to the
// local PLAN_LIMITS map for plan-id validity checks and to 'free' when a
// workspace subscription can't be resolved.
let BILLING_PLAN_LIMITS = null;
let resolveWorkspaceCurrentPlan = null;
try {
  ({ PLAN_LIMITS: BILLING_PLAN_LIMITS, resolveWorkspaceCurrentPlan } = require('./billing'));
} catch (err) {
  if (err.code !== 'MODULE_NOT_FOUND') throw err;
}

const PLAN_ENFORCEMENT_ENABLED = process.env.NODE_ENV === 'test'
  ? false
  : process.env.ENFORCE_PLAN_LIMITS !== 'false';

// Personal (id 'free'): 5 services, 1k calls. Pro $9: 10k calls + $0.25/1k overage.
// Heavy (id 'enterprise'): unlimited calls. Beta unchanged.
const PLAN_LIMITS = {
  beta:       { personas: Infinity, serviceConnections: Infinity, knowledgeBytes: Infinity,              vaultTokens: Infinity, skillsPerPersona: Infinity, monthlyApiCalls: Infinity, teamMembers: Infinity },
  free:       { personas: 2,        serviceConnections: 5,        knowledgeBytes: 10 * 1024 * 1024,      vaultTokens: 5,        skillsPerPersona: 4,        monthlyApiCalls: 1000,     teamMembers: 2        },
  pro:        { personas: 10,       serviceConnections: Infinity, knowledgeBytes: 50 * 1024 * 1024,      vaultTokens: Infinity, skillsPerPersona: Infinity, monthlyApiCalls: 10000,    teamMembers: 10       },
  enterprise: { personas: 20,       serviceConnections: Infinity, knowledgeBytes: 200 * 1024 * 1024,     vaultTokens: Infinity, skillsPerPersona: Infinity, monthlyApiCalls: Infinity, teamMembers: Infinity },
  // B2B org plans (per member; API calls are pooled org-wide in the quota gate)
  business:       { personas: 20, serviceConnections: Infinity, knowledgeBytes: 200 * 1024 * 1024, vaultTokens: Infinity, skillsPerPersona: Infinity, monthlyApiCalls: 50000,    teamMembers: Infinity },
  enterprise_org: { personas: 50, serviceConnections: Infinity, knowledgeBytes: 1024 * 1024 * 1024, vaultTokens: Infinity, skillsPerPersona: Infinity, monthlyApiCalls: Infinity, teamMembers: Infinity },
};

function getRequestWorkspaceId(req) {
  // Only trust workspace IDs set by server-side middleware (not raw user input).
  // req.workspaceId is set by validateWorkspaceMembership middleware.
  // req.session.currentWorkspace is set server-side on workspace switch.
  // Do NOT trust req.body.workspace_id or req.query.workspace — these are
  // user-controlled and could be used to escalate to a higher-plan workspace.
  if (req?.workspaceId) return req.workspaceId;
  if (req?.session?.currentWorkspace) return req.session.currentWorkspace;
  const userId = req?.user?.id || req?.session?.user?.id;
  if (userId) {
    const workspaces = getWorkspaces(String(userId));
    if (workspaces?.length) return workspaces[0].id;
  }
  return null;
}

/**
 * Single choke point for org-plan supersession: members of an active org get
 * the org's plan, not their personal one. Returns null for non-org users.
 */
function resolveOrgPlan(userId) {
  if (!userId || userId === 'owner') return null;
  try {
    const { getUserOrg } = require('../database');
    const org = getUserOrg(String(userId));
    if (org && org.status === 'active' && (BILLING_PLAN_LIMITS || PLAN_LIMITS)[String(org.plan).toLowerCase()]) {
      return { plan: String(org.plan).toLowerCase(), org };
    }
  } catch { /* fall through to personal plan */ }
  return null;
}

function resolveRequesterPlan(req) {
  try {
    // Org plan supersedes personal plans for org members
    const orgPlan = resolveOrgPlan(req?.user?.id || req?.tokenMeta?.ownerId);
    if (orgPlan) return orgPlan.plan;

    const knownPlans = BILLING_PLAN_LIMITS || PLAN_LIMITS;
    if (req?.user?.id) {
      const user = getUserById(req.user.id);
      if (user?.plan && knownPlans[String(user.plan).toLowerCase()]) return String(user.plan).toLowerCase();
    }
    const ownerId = req?.tokenMeta?.ownerId;
    if (ownerId && ownerId !== 'owner') {
      const owner = getUserById(ownerId);
      if (owner?.plan && knownPlans[String(owner.plan).toLowerCase()]) return String(owner.plan).toLowerCase();
    }
    const workspaceId = getRequestWorkspaceId(req);
    if (workspaceId && resolveWorkspaceCurrentPlan) {
      const sub = getBillingSubscriptionByWorkspace(workspaceId);
      return resolveWorkspaceCurrentPlan(sub).id;
    }
    return 'free';
  } catch {
    return 'free';
  }
}

function planLimitError(plan, key, limit) {
  const labels = {
    personas: 'persona limit',
    serviceConnections: 'service connection limit',
    knowledgeBytes: 'knowledge base storage limit',
    vaultTokens: 'vault token limit',
    skillsPerPersona: 'skills-per-persona limit',
    teamMembers: 'team member limit',
  };
  return {
    error: `Plan limit reached: ${labels[key] || key}`,
    plan,
    limit,
    upgradeHint: 'Upgrade your plan to increase limits',
  };
}

function enforcePlanLimit(req, key, currentValue, increment = 0) {
  if (!PLAN_ENFORCEMENT_ENABLED) return null;
  const plan = resolveRequesterPlan(req);
  const limit = PLAN_LIMITS?.[plan]?.[key];
  if (limit === undefined || limit === null || limit === Infinity) return null;
  // Clamp to safe integer range to prevent overflow bypassing the limit check
  const safeCurrentValue = Number.isFinite(currentValue) ? Math.min(currentValue, Number.MAX_SAFE_INTEGER) : 0;
  const safeIncrement = Number.isFinite(increment) ? Math.min(increment, Number.MAX_SAFE_INTEGER) : 0;
  if ((safeCurrentValue + safeIncrement) > limit) {
    return planLimitError(plan, key, limit);
  }
  return null;
}

module.exports = { PLAN_LIMITS, resolveRequesterPlan, resolveOrgPlan, planLimitError, enforcePlanLimit };
