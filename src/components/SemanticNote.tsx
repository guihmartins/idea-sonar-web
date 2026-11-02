import { Failure } from './Feedback';
import {
  formatScore,
  isSemanticUnavailable,
  unavailableText,
} from './semantic';

// Nota quieta no lugar da falha: a busca por significado está desligada, o que
// não é um erro da tela nem tem "tentar novamente".
export function SemanticNote() {
  return (
    <p className="semantic-note" role="status">
      {unavailableText}
    </p>
  );
}

// 503 `SEMANTIC_UNAVAILABLE` vira a nota; qualquer outro erro segue o `Failure`.
export function SemanticFailure({
  error,
  retry,
}: {
  error: unknown;
  retry?: (() => void) | undefined;
}) {
  return isSemanticUnavailable(error) ? (
    <SemanticNote />
  ) : (
    <Failure error={error} retry={retry} />
  );
}

// "semelhança 0,87": um número pequeno que dá a ordem, sem % nem "confiança".
export function Score({ value }: { value: number }) {
  return <span className="score">semelhança {formatScore(value)}</span>;
}
