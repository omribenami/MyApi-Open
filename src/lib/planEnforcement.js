/**
 * Shared plan enforcement logic.
 * Used by index.js (OAuth callback) and workspace routes to enforce per-plan resource limits.
 */

const { getUserById, getWorkspaces, getBillingSubscriptionByWorkspace } = require('../database');
const { PLAN_LIMITS: BILLING_PLAN_LIMITS, resolveWorkspaceCurrentPlan } = require('./billing');

const PLAN_ENFORCEMENT_ENABLED = process.env.NODE_ENV === 'test'
  ? false
  : process.env.ENFORCE_PLAN_LIMITS !== 'false';

const PLAN_LIMITS = {
  free:       { personas: 1,  serviceConnections: 3,        knowledgeBytes: 10 * 1024 * 1024,  vaultTokens: 5,        skillsPerPersona: 4,        monthlyApiCalls: 1000,     teamMembers: 2        },
  pro:        { personas: 5,  serviceConnections: Infinity, knowledgeBytes: 50 * 1024 * 1024,  vaultTokens: Infinity, skillsPerPersona: Infinity, monthlyApiCalls: 100000,   teamMembers: 10       },
  enterprise: { personas: 20, serviceConnections: Infinity, knowledgeBytes: 200 * 1024 * 1024, vaultTokens: Infinity, skillsPerPersona: Infinity, monthlyApiCalls: Infinity, teamMembers: Infinity },
};

function getRequestWorkspaceId(req) {
  if (req?.workspaceId) return req.workspaceId;
  if (req?.session?.currentWorkspace) return req.session.currentWorkspace;
  const explicit = req?.body?.workspace_id || req?.query?.workspace || req?.headers?.['x-workspace-id'];
  if (explicit) return String(explicit);
  const userId = req?.user?.id || req?.session?.user?.id;
  if (userId) {
    const workspaces = getWorkspaces(String(userId));
    if (workspaces?.length) return workspaces[0].id;
  }
  return null;
}

function resolveRequesterPlan(req) {
  try {
    if (req?.user?.id) {
      const user = getUserById(req.user.id);
      if (user?.plan && BILLING_PLAN_LIMITS[String(user.plan).toLowerCase()]) return String(user.plan).toLowerCase();
    }
    const ownerId = req?.tokenMeta?.ownerId;
    if (ownerId && ownerId !== 'owner') {
      const owner = getUserById(ownerId);
      if (owner?.plan && BILLING_PLAN_LIMITS[String(owner.plan).toLowerCase()]) return String(owner.plan).toLowerCase();
    }
    const workspaceId = getRequestWorkspaceId(req);
    if (workspaceId) {
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
  if ((currentValue + increment) > limit) {
    return planLimitError(plan, key, limit);
  }
  return null;
}

module.exports = { PLAN_LIMITS, resolveRequesterPlan, planLimitError, enforcePlanLimit };
