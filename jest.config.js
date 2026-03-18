module.exports = {
  testEnvironment: 'node',
  testPathIgnorePatterns: ['/node_modules/', '/frontend/', '/src/public/'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/public/**',
    '!node_modules/**',
  ],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },
  testTimeout: 10000,
  setupFiles: ['<rootDir>/src/tests/setup-env.js'],
  setupFilesAfterEnv: ['<rootDir>/src/tests/setup.js'],
};
