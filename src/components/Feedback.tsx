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
      {error instanceof ApiError && <FieldIssues details={error.details} />}
      {error instanceof ApiError && <ErrorDetails details={error.details} />}
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

// A API aponta o campo que falhou em `error.details: [{ path, message }]`
// (ex.: `relations.0.claim`); a lista aparece antes do JSON bruto.
function issuesOf(details: unknown): { path: string; message: string }[] {
  const list =
    details && typeof details === 'object' && 'details' in details
      ? details.details
      : undefined;
  if (!Array.isArray(list)) return [];
  return list.flatMap((item: unknown) =>
    item &&
    typeof item === 'object' &&
    'path' in item &&
    'message' in item &&
    typeof item.path === 'string' &&
    typeof item.message === 'string'
      ? [{ path: item.path, message: item.message }]
      : [],
  );
}
function FieldIssues({ details }: { details: unknown }) {
  const issues = issuesOf(details);
  if (issues.length === 0) return null;
  return (
    <ul className="field-issues">
      {issues.map((issue, index) => (
        <li key={`${issue.path}-${index}`}>
          {issue.path && <code>{issue.path}</code>} {issue.message}
        </li>
      ))}
    </ul>
  );
}
function ErrorDetails({ details }: { details: unknown }) {
  if (
    details === null ||
    typeof details !== 'object' ||
    Object.keys(details).length === 0
  )
    return null;
  return (
    <details>
      <summary>Detalhes retornados pela API</summary>
      <pre className="error-details">{JSON.stringify(details, null, 2)}</pre>
    </details>
  );
}
