import type { Node } from '../api/domain';
import { SafeLink } from './Feedback';
import { identifierUrl } from './identifiers';
import { identifierSchemeLabels } from './labels';

// Identificadores como dado em mono: link para o registro quando o esquema tem
// página (abre em outra aba, sem referrer); ISBN fica em texto.
export function NodeIdentifiers({
  identifiers,
}: {
  identifiers: Node['identifiers'];
}) {
  if (identifiers.length === 0) return null;
  return (
    <ul className="identifiers" aria-label="Identificadores">
      {identifiers.map((identifier) => {
        const url = identifierUrl(identifier);
        const label = `${identifierSchemeLabels[identifier.scheme]}: ${identifier.value}`;
        return (
          <li key={`${identifier.scheme}-${identifier.value}`}>
            {url ? <SafeLink url={url}>{label}</SafeLink> : label}
          </li>
        );
      })}
    </ul>
  );
}
