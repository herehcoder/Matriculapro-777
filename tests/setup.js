// Setup global para testes Jest

// Mock as variáveis de ambiente para testes
process.env.NODE_ENV = 'test';

// Mock das variáveis de ambiente comuns usadas pelo sistema
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.ENCRYPTION_KEY = 'test-encryption-key-for-tests-only';

// Silence console durante os testes para deixar a saída mais limpa
global.console = {
  ...console,
  // Manter logs de erro mas suprimir outros logs durante os testes
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  // Manter erro e falhas para facilitar o debug
  error: console.error,
};

// Aumentar o timeout para testes que podem ser mais lentos
jest.setTimeout(10000);

// Limpar todos os mocks após cada teste
afterEach(() => {
  jest.clearAllMocks();
});