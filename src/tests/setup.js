/**
 * Jest Setup File (runs after environment is initialized)
 * Mocks console output during tests
 */

const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleLog = console.log;

beforeAll(() => {
  // Mock console methods to reduce noise during tests
  console.error = jest.fn((message) => {
    if (!message || message.toString().includes('test')) {
      return;
    }
    originalConsoleError(message);
  });
  console.log = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  // Restore console
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
  console.log = originalConsoleLog;
});
