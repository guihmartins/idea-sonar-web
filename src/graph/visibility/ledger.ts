import type { NeighborPage, Node, Relation } from '../../api/domain';
export interface Ledger {
  roots: Node[];
  expansions: Record<string, NeighborPage>;
  generation: number;
}
export const emptyLedger: Ledger = { roots: [], expansions: {}, generation: 0 };
// Só expansões alcançáveis a partir das raízes contribuem. Ciclos órfãos não se sustentam.
export function visible(ledger: Ledger): {
  nodes: Node[];
  relations: Relation[];
} {
  const nodes = new Map(ledger.roots.map((n) => [n.id, n]));
  const relations = new Map<string, Relation>();
  const visited = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const [owner, expansion] of Object.entries(ledger.expansions)) {
      if (!nodes.has(owner) || visited.has(owner)) continue;
      visited.add(owner);
      changed = true;
      for (const node of expansion.nodes) nodes.set(node.id, node);
      for (const edge of expansion.relations) relations.set(edge.id, edge);
    }
  }
  return {
    nodes: [...nodes.values()],
    relations: [...relations.values()].filter(
      (e) => nodes.has(e.sourceId) && nodes.has(e.targetId),
    ),
  };
}
export type Action =
  | { type: 'root'; node: Node }
  | { type: 'reset' }
  | { type: 'collapse'; id: string }
  | { type: 'page'; id: string; page: NeighborPage; generation: number };
export function reduceLedger(state: Ledger, action: Action): Ledger {
  if (action.type === 'reset')
    return { ...emptyLedger, generation: state.generation + 1 };
  if (action.type === 'root')
    return {
      roots: [action.node],
      expansions: {},
      generation: state.generation + 1,
    };
  if (action.type === 'collapse') return collapse(state, action.id);

  if (
    action.generation !== state.generation ||
    !visible(state).nodes.some((n) => n.id === action.id)
  )
    return state;
  return mergePage(state, action);
}

function mergePage(
  state: Ledger,
  action: Extract<Action, { type: 'page' }>,
): Ledger {
  const previous = state.expansions[action.id];
  const merge = <T extends { id: string }>(a: T[], b: T[]) => [
    ...new Map([...a, ...b].map((x) => [x.id, x])).values(),
  ];
  const page = {
    ...action.page,
    nodes: merge(previous?.nodes ?? [], action.page.nodes),
    relations: merge(previous?.relations ?? [], action.page.relations),
  };
  const next = {
    ...state,
    expansions: { ...state.expansions, [action.id]: page },
  };
  // A UI verifica o limite antes do dispatch; a lógica também impede ultrapassagem.
  return visible(next).nodes.length > 500 ? state : next;
}
function collapse(state: Ledger, id: string): Ledger {
  const expansions = { ...state.expansions };
  delete expansions[id];
  const provisional = {
    ...state,
    expansions,
    generation: state.generation + 1,
  };
  const retained = new Set(visible(provisional).nodes.map((n) => n.id));
  return {
    ...provisional,
    expansions: Object.fromEntries(
      Object.entries(expansions).filter(([id]) => retained.has(id)),
    ),
  };
}
