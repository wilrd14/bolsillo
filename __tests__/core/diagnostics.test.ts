import { AppError } from '@/core/errors';
import { createLogger } from '@/core/logger';
import { es } from '@/core/strings/es';
import { createUuid } from '@/core/uuid';

it('expone la causa sin incluirla en el JSON del error', () => {
  const cause = { value: 1n };
  const error = new AppError('OFFLINE', 'Network unavailable', cause);
  expect(error).toBeInstanceOf(Error);
  expect(error.name).toBe('AppError');
  expect(error.code).toBe('OFFLINE');
  expect(error.message).toBe('Network unavailable');
  expect(error.cause).toBe(cause);
  expect(JSON.parse(JSON.stringify(error))).toEqual({
    code: 'OFFLINE',
    message: 'Network unavailable',
  });
  expect(es.errors.OFFLINE).toBe('Sin conexión. Tus datos se guardan en el móvil.');
});

describe('logger', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('emite los cuatro niveles en desarrollo', () => {
    process.env.NODE_ENV = 'development';
    const sink = jest.fn();
    const logger = createLogger(sink);
    logger.debug('OFFLINE');
    logger.info('VALIDATION');
    logger.warn('NOT_A_RECEIPT');
    logger.error('QUOTA_EXCEEDED');
    expect(sink.mock.calls).toEqual([
      ['debug', 'OFFLINE'],
      ['info', 'VALIDATION'],
      ['warn', 'NOT_A_RECEIPT'],
      ['error', 'QUOTA_EXCEEDED'],
    ]);
  });

  it('filtra debug, info y valores fuera del catálogo en producción', () => {
    process.env.NODE_ENV = 'production';
    const sink = jest.fn();
    const logger = createLogger(sink);
    logger.debug('OFFLINE');
    logger.info('OFFLINE');
    logger.warn('OFFLINE');
    logger.error('OFFLINE');
    Reflect.apply(logger.error, logger, ['dato sintético']);
    expect(sink.mock.calls).toEqual([
      ['warn', 'OFFLINE'],
      ['error', 'OFFLINE'],
    ]);
  });
});

it('genera un UUID con los bits de versión y variante de UUID v4', () => {
  expect(createUuid((bytes) => bytes.fill(255))).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff');
});

it('compone el aviso de presupuesto con el porcentaje y la categoría', () => {
  expect(es.budgetWarning(80, 'Comida')).toBe(
    'Llevas el 80 % de tu presupuesto de Comida este mes.',
  );
});
