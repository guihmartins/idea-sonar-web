import { describe, expect, it } from 'vitest';
import { ApiError } from '../../src/api/client';
import {
  formatScore,
  isSemanticUnavailable,
  leadText,
  panelLeadText,
  unavailableText,
  warningText,
} from '../../src/components/semantic';

const unavailable = (status = 503, code = 'SEMANTIC_UNAVAILABLE') =>
  new ApiError(status, 'mensagem', { code, message: 'mensagem' });

describe('formatScore', () => {
  it('sempre duas casas, com vírgula, sem percentual', () => {
    expect(formatScore(0.87)).toBe('0,87');
    expect(formatScore(0.9)).toBe('0,90');
    expect(formatScore(1)).toBe('1,00');
    expect(formatScore(0)).toBe('0,00');
    expect(formatScore(0.934)).toBe('0,93');
    expect(formatScore(0.936)).toBe('0,94');
    expect(formatScore(0.875)).toBe('0,88');
    expect(formatScore(0.07)).toBe('0,07');
    expect(formatScore(0.87)).not.toMatch(/%|\./);
  });
});

describe('isSemanticUnavailable', () => {
  it('só o 503 com o código SEMANTIC_UNAVAILABLE conta', () => {
    expect(isSemanticUnavailable(unavailable())).toBe(true);
    expect(isSemanticUnavailable(unavailable(503, 'OUTRO'))).toBe(false);
    expect(isSemanticUnavailable(unavailable(500))).toBe(false);
    expect(isSemanticUnavailable(unavailable(502))).toBe(false);
    expect(isSemanticUnavailable(new ApiError(503, 'sem código'))).toBe(false);
    expect(isSemanticUnavailable(new Error('SEMANTIC_UNAVAILABLE'))).toBe(
      false,
    );
    expect(isSemanticUnavailable(null)).toBe(false);
    expect(isSemanticUnavailable(undefined)).toBe(false);
    expect(isSemanticUnavailable('SEMANTIC_UNAVAILABLE')).toBe(false);
  });
});

describe('textos da busca por significado', () => {
  it('dizem que semelhança é pista, não identidade nem relação', () => {
    expect(unavailableText).toBe(
      'Busca por significado indisponível: o modelo da API não está ativo.',
    );
    expect(leadText).toBe(
      'Ordem por sentido do texto. Semelhança não é identidade: confira antes de reutilizar.',
    );
    expect(panelLeadText).toBe(
      'Pistas pelo sentido do texto; não indicam relação.',
    );
    expect(warningText).toBe(
      'Aviso, não desfecho: confira se não é o mesmo ponto.',
    );
  });
});
