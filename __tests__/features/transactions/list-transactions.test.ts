import type { Database } from '@/db/database';
import { listTransactions } from '@/features/transactions';

const getAllAsync = jest.fn().mockResolvedValue([]);
const db: Database = { getAllAsync, execAsync: jest.fn(), runAsync: jest.fn() };

beforeEach(() => getAllAsync.mockClear());

test('lists active transactions with the requested filters and pagination', async () => {
  await expect(
    listTransactions(db, {
      kind: 'expense',
      from: '2026-01-01',
      to: '2026-01-31',
      limit: 20,
      offset: 40,
    }),
  ).resolves.toEqual([]);

  expect(getAllAsync).toHaveBeenCalledWith(
    expect.stringContaining('WHERE deleted_at IS NULL'),
    'expense',
    '2026-01-01',
    '2026-01-31',
    20,
    40,
  );
});

test.each([
  { limit: 0, offset: 0 },
  { limit: 20, offset: -1 },
  { limit: 20, offset: 0, from: '2026-02-30' },
  { limit: 20, offset: 0, from: '2026-02-01', to: '2026-01-31' },
])('rejects invalid transaction filters (%j)', async (filters) => {
  await expect(listTransactions(db, filters)).rejects.toMatchObject({ code: 'VALIDATION' });
  expect(getAllAsync).not.toHaveBeenCalled();
});
