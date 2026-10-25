import type { Api } from '../api/adapter';
import { viewSchema } from '../api/domain';
import type { Filters } from '../api/domain';
import type { Ledger } from './visibility/ledger';
import { reduceLedger, visible } from './visibility/ledger';
interface RestoreState {
  ledger: Ledger;
}
async function restorePages(
  api: Api,
  state: RestoreState,
  id: string,
  filters: Filters,
  signal: AbortSignal,
) {
  let cursor: string | null = null;
  const seen = new Set<string>();
  do {
    const page = await api.neighbors(id, filters, cursor, signal);
    const candidate = reduceLedger(state.ledger, {
      type: 'page',
      id,
      page,
      generation: state.ledger.generation,
    });
    if (candidate === state.ledger) return true;
    state.ledger = candidate;
    cursor = page.nextCursor;
    if (cursor && seen.has(cursor)) throw new Error('Cursor repetido.');
    if (cursor) seen.add(cursor);
  } while (cursor);
  return false;
}
async function restoreExpansions(
  api: Api,
  state: Ledger,
  expandedNodes: string[],
  filters: Filters,
  signal: AbortSignal,
) {
  const current: RestoreState = { ledger: state };
  const remaining = new Set(expandedNodes);
  const missing: string[] = [];
  let changed = true;
  while (changed && remaining.size) {
    changed = false;
    for (const id of [...remaining]) {
      if (!visible(current.ledger).nodes.some((node) => node.id === id))
        continue;
      remaining.delete(id);
      changed = true;
      try {
        const limited = await restorePages(api, current, id, filters, signal);
        if (limited) missing.push('limite de 500 pontos');
      } catch (error) {
        if (signal.aborted) throw error;
        missing.push(id);
      }
    }
  }
  return {
    ledger: current.ledger,
    partial: missing.length > 0 || remaining.size > 0,
  };
}
export async function restoreView(
  api: Api,
  id: string,
  signal: AbortSignal,
  generation: () => number,
) {
  const view = viewSchema.parse(await api.detail('views', id, signal));
  const root = await api.node(view.root, signal);
  if (root.status === 'archived')
    throw new Error(
      'A raiz desta view foi arquivada. Escolha outro ponto para iniciar um recorte.',
    );
  const state: Ledger = {
    roots: [root],
    expansions: {},
    generation: generation() + 1,
  };
  const restored = await restoreExpansions(
    api,
    state,
    view.expandedNodes,
    view.filters,
    signal,
  );
  signal.throwIfAborted();
  return { view, root, ...restored };
}
