#!/usr/bin/env node

/**
 * Master Test Runner - MyApi
 * Executes all test suites and generates comprehensive report
 */

const fs = require('fs');
const path = require('path');

// Import test suites
const { runAllTests: runSecurityTests } = require('./security-tests');
const { runAllTests: runUITests } = require('./ui-tests');
const { runAllTests: runIntegrationTests } = require('./integration-tests');

const allResults = {
  timestamp: new Date().toISOString(),
  suites: {},
  summary: { total: 0, passed: 0, failed: 0, critical: [] },
  recommendations: []
};

async function runAllSuites() {
  console.log('\n' + '='.repeat(70));
  console.log('🚀 MyApi Comprehensive QA Test Suite');
  console.log('='.repeat(70) + '\n');

  // Run Security Tests
  console.log('Running Security Tests...\n');
  const securityResults = await runSecurityTests().catch(err => {
    console.error('Security tests error:', err);
    return { passed: 0, failed: 1, critical: [{ test: 'Suite Error', error: err.message }] };
  });

  allResults.suites.security = securityResults;
  allResults.summary.passed += securityResults.passed;
  allResults.summary.failed += securityResults.failed;
  if (securityResults.critical) {
    allResults.summary.critical.push(...securityResults.critical);
  }

  console.log('\n' + '-'.repeat(70) + '\n');

  // Run UI Tests
  console.log('Running UI/UX Tests...\n');
  const uiResults = await runUITests().catch(err => {
    console.error('UI tests error:', err);
    return { passed: 0, failed: 1, warnings: [] };
  });

  allResults.suites.ui = uiResults;
  allResults.summary.passed += uiResults.passed;
  allResults.summary.failed += uiResults.failed;

  console.log('\n' + '-'.repeat(70) + '\n');

  // Run Integration Tests
  console.log('Running Integration Tests...\n');
  const integrationResults = await runIntegrationTests().catch(err => {
    console.error('Integration tests error:', err);
    return { passed: 0, failed: 1, warnings: [] };
  });

  allResults.suites.integration = integrationResults;
  allResults.summary.passed += integrationResults.passed;
  allResults.summary.failed += integrationResults.failed;

  allResults.summary.total = allResults.summary.passed + allResults.summary.failed;

  // Generate recommendations
  generateRecommendations();

  // Save report
  saveReport();

  // Print summary
  printSummary();
}

function generateRecommendations() {
  if (allResults.summary.failed > 0) {
    allResults.recommendations.push('🔴 CRITICAL: Fix failed tests before production deployment');
  }

  if (allResults.summary.critical.length > 0) {
    allResults.recommendations.push('🔴 SECURITY: Address critical security findings immediately');
  }

  if (allResults.suites.ui?.warnings?.length > 0) {
    allResults.recommendations.push('🟡 UI: Review and address UI warnings');
  }

  if (allResults.summary.passed / allResults.summary.total < 0.95) {
    allResults.recommendations.push('🟡 COVERAGE: Test pass rate below 95% - investigate');
  }

  allResults.recommendations.push('✅ Once all critical issues resolved, ready for staging deployment');
}

function saveReport() {
  const reportPath = path.join(__dirname, '../QA_REPORT.md');
  
  let markdown = `# MyApi QA Test Report\n\n`;
  markdown += `**Generated:** ${allResults.timestamp}\n\n`;

  markdown += `## Summary\n\n`;
  markdown += `- **Total Tests:** ${allResults.summary.total}\n`;
  markdown += `- **Passed:** ✅ ${allResults.summary.passed}\n`;
  markdown += `- **Failed:** ❌ ${allResults.summary.failed}\n`;
  markdown += `- **Pass Rate:** ${((allResults.summary.passed / allResults.summary.total) * 100).toFixed(1)}%\n\n`;

  markdown += `## Test Suites\n\n`;

  markdown += `### Security Tests\n`;
  markdown += `- Passed: ${allResults.suites.security?.passed || 0}\n`;
  markdown += `- Failed: ${allResults.suites.security?.failed || 0}\n`;
  if (allResults.suites.security?.critical?.length > 0) {
    markdown += `- **Critical Issues:**\n`;
    allResults.suites.security.critical.forEach(c => {
      markdown += `  - ${c.test}: ${c.error}\n`;
    });
  }
  markdown += `\n`;

  markdown += `### UI/UX Tests\n`;
  markdown += `- Passed: ${allResults.suites.ui?.passed || 0}\n`;
  markdown += `- Failed: ${allResults.suites.ui?.failed || 0}\n`;
  if (allResults.suites.ui?.warnings?.length > 0) {
    markdown += `- **Warnings:**\n`;
    allResults.suites.ui.warnings.forEach(w => {
      markdown += `  - ${w}\n`;
    });
  }
  markdown += `\n`;

  markdown += `### Integration Tests\n`;
  markdown += `- Passed: ${allResults.suites.integration?.passed || 0}\n`;
  markdown += `- Failed: ${allResults.suites.integration?.failed || 0}\n`;
  if (allResults.suites.integration?.warnings?.length > 0) {
    markdown += `- **Warnings:**\n`;
    allResults.suites.integration.warnings.forEach(w => {
      markdown += `  - ${w}\n`;
    });
  }
  markdown += `\n`;

  markdown += `## Recommendations\n\n`;
  allResults.recommendations.forEach(rec => {
    markdown += `- ${rec}\n`;
  });
  markdown += `\n`;

  markdown += `## Next Steps\n\n`;
  markdown += `1. Review all failing tests\n`;
  markdown += `2. Address security issues with highest priority\n`;
  markdown += `3. Fix UI/UX issues preventing dashboard access\n`;
  markdown += `4. Run integration tests again after fixes\n`;
  markdown += `5. Re-run full suite before deployment\n`;

  fs.writeFileSync(reportPath, markdown);
  console.log(`\n📄 Report saved to: ${reportPath}`);
}

function printSummary() {
  console.log('\n' + '='.repeat(70));
  console.log('📊 Test Summary');
  console.log('='.repeat(70));

  console.log(`\n✅ Passed:  ${allResults.summary.passed}`);
  console.log(`❌ Failed:  ${allResults.summary.failed}`);
  console.log(`📈 Rate:    ${((allResults.summary.passed / allResults.summary.total) * 100).toFixed(1)}%\n`);

  if (allResults.summary.critical.length > 0) {
    console.log('🚨 CRITICAL ISSUES:');
    allResults.summary.critical.forEach(c => {
      console.log(`   - ${c.test}: ${c.error}`);
    });
    console.log();
  }

  console.log('📋 Recommendations:');
  allResults.recommendations.forEach(rec => {
    console.log(`   ${rec}`);
  });

  console.log('\n' + '='.repeat(70) + '\n');

  // Exit with error code if tests failed
  process.exit(allResults.summary.failed > 0 ? 1 : 0);
}

// Run tests
runAllSuites().catch(err => {
  console.error('Fatal error running tests:', err);
  process.exit(1);
});
