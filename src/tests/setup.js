/**
 * Jest Setup File
 * Runs before all test suites
 */

// Suppress console logs during tests
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  // Mock console methods
  console.error = jest.fn((message) => {
    if (!message.includes('test')) {
      originalConsoleError(message);
    }
  });
});

afterAll(() => {
  // Restore console
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Set test environment
process.env.NODE_ENV = 'test';
process.env.DB_PATH = ':memory:';
process.env.PORT = '3001';
