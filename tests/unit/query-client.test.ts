import { describe, expect, it } from 'vitest';

describe('cliente de consultas', () => {
  it('desativa retries e refetch implícitos', async () => {
    const { createQueryClient } = await import('../../src/app/queryClient');
    expect(createQueryClient().getDefaultOptions()).toEqual({
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    });
  });
});
