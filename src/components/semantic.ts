// Busca por significado: o que as telas dizem e como mostram a pontuação. A
// regra do produto vem da API: semelhança é pista, nunca evidência; não é
// identidade nem prova influência.
import { ApiError } from '../api/client';

export const unavailableText =
  'Busca por significado indisponível: o modelo da API não está ativo.';

// 503 `SEMANTIC_UNAVAILABLE`: a busca está desligada ou o modelo não carregou.
// O resto da API segue de pé, então a tela mostra uma nota, não uma falha.
export function isSemanticUnavailable(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === 503 &&
    error.code === 'SEMANTIC_UNAVAILABLE'
  );
}

// Cosseno de 0 a 1, comprimido (textos sem relação costumam dar 0,80 a 0,89):
// serve para ordenar, nunca como percentual, probabilidade ou confiança. Sempre
// duas casas, com vírgula.
const scoreFormat = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
export const formatScore = (score: number): string => scoreFormat.format(score);

export const leadText =
  'Ordem por sentido do texto. Semelhança não é identidade: confira antes de reutilizar.';
export const panelLeadText =
  'Pistas pelo sentido do texto; não indicam relação.';
export const warningText =
  'Aviso, não desfecho: confira se não é o mesmo ponto.';
