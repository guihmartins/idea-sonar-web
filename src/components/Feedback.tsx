import { ApiError } from '../api/client';
import { useServices } from '../app/services';
export function Failure({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  const { session } = useServices();
  return (
    <div role="alert" className="error">
      <p>
        {error instanceof Error
          ? error.message
          : 'Não foi possível carregar os dados.'}
      </p>
      {error instanceof ApiError &&
        error.details !== null &&
        typeof error.details === 'object' &&
        Object.keys(error.details).length > 0 && (
          <details>
            <summary>Detalhes retornados pela API</summary>
            <pre className="error-details">
              {JSON.stringify(error.details, null, 2)}
            </pre>
          </details>
        )}
      {error instanceof ApiError && error.requestId && (
        <p>Identificador: {error.requestId}</p>
      )}
      {error instanceof ApiError && error.status === 401 && session ? (
        <button onClick={() => void session.login()}>Entrar novamente</button>
      ) : (
        retry && <button onClick={retry}>Tentar novamente</button>
      )}
    </div>
  );
}
export function SafeLink({
  url,
  children,
}: {
  url: string;
  children: React.ReactNode;
}) {
  let safe = false;
  try {
    safe = ['https:', 'http:'].includes(new URL(url).protocol);
  } catch {
    /* URL inválida não vira link. */
  }
  return safe ? (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      referrerPolicy="no-referrer"
    >
      {children} ↗
    </a>
  ) : (
    <span>{children} (link indisponível)</span>
  );
}

export const editorialLabels = {
  active: 'Ativo',
  pending: 'Pendente',
  archived: 'Arquivado',
};
