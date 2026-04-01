const PLAN_LIMITS = {
  free: {
    id: 'free',
    name: 'Free',
    limits: {
      monthlyApiCalls: 1000,
      activeServices: 3,
      installs: 50,
      ratings: 20,
    },
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    limits: {
      monthlyApiCalls: 100000,
      activeServices: Number.POSITIVE_INFINITY,
      installs: Number.POSITIVE_INFINITY,
      ratings: Number.POSITIVE_INFINITY,
    },
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    limits: {
      monthlyApiCalls: Number.POSITIVE_INFINITY,
      activeServices: Number.POSITIVE_INFINITY,
      installs: Number.POSITIVE_INFINITY,
      ratings: Number.POSITIVE_INFINITY,
    },
  },
};

function normalizePlanId(planId) {
  const key = String(planId || '').toLowerCase();
  return PLAN_LIMITS[key] ? key : 'free';
}

function resolveWorkspaceCurrentPlan(subscriptionRow) {
  if (!subscriptionRow) return PLAN_LIMITS.free;
  const activeStatuses = ['active', 'trialing'];
  if (!activeStatuses.includes(subscriptionRow.status)) return PLAN_LIMITS.free;
  return PLAN_LIMITS[normalizePlanId(subscriptionRow.plan_id)] || PLAN_LIMITS.free;
}

function computeUsageVsLimits(plan, usageTotals = {}) {
  const normalizedPlan = PLAN_LIMITS[normalizePlanId(plan?.id || plan)];
  const limits = normalizedPlan.limits;
  const usage = {
    monthlyApiCalls: Number(usageTotals.monthlyApiCalls || 0),
    activeServices: Number(usageTotals.activeServices || 0),
    installs: Number(usageTotals.installs || 0),
    ratings: Number(usageTotals.ratings || 0),
  };

  const makeMetric = (used, limit) => {
    const unlimited = !Number.isFinite(limit);
    const ratio = unlimited ? 0 : Math.min(1, limit > 0 ? used / limit : 0);
    return {
      used,
      limit: unlimited ? null : limit,
      unlimited,
      ratio,
      remaining: unlimited ? null : Math.max(0, limit - used),
      exceeded: unlimited ? false : used > limit,
    };
  };

  return {
    plan: normalizedPlan,
    metrics: {
      monthlyApiCalls: makeMetric(usage.monthlyApiCalls, limits.monthlyApiCalls),
      activeServices: makeMetric(usage.activeServices, limits.activeServices),
      installs: makeMetric(usage.installs, limits.installs),
      ratings: makeMetric(usage.ratings, limits.ratings),
    },
  };
}

function getRangeDays(rangeParam) {
  return String(rangeParam || '').toLowerCase() === '30d' ? 30 : 7;
}

module.exports = {
  PLAN_LIMITS,
  normalizePlanId,
  resolveWorkspaceCurrentPlan,
  computeUsageVsLimits,
  getRangeDays,
};
