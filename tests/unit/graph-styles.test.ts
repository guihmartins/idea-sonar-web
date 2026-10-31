import { describe, expect, it } from 'vitest';
import { graphStyle } from '../../src/graph/styles';
import type { Css } from 'cytoscape';

function rule(selector: string): { style: Record<string, unknown> } {
  const found = graphStyle.find((r) => r.selector === selector);
  if (!found) throw new Error(`regra ${selector} não encontrada`);
  return found as unknown as { style: Record<string, unknown> };
}
function fakeElement(data: Record<string, unknown>) {
  return { data: (key: string) => data[key] };
}

describe('graphStyle', () => {
  it('resolve o formato do nó a partir dos dados do elemento', () => {
    const style = rule('node').style as unknown as {
      shape: (ele: unknown) => Css.NodeShape;
    };
    expect(style.shape(fakeElement({ shape: 'hexagon' }))).toBe('hexagon');
  });

  it('resolve estilo e seta da aresta a partir dos dados do elemento', () => {
    const style = rule('edge').style as unknown as {
      'line-style': (ele: unknown) => string;
      'target-arrow-shape': (ele: unknown) => string;
    };
    expect(style['line-style'](fakeElement({ line: 'dashed' }))).toBe(
      'dashed',
    );
    expect(
      style['target-arrow-shape'](fakeElement({ arrow: 'triangle' })),
    ).toBe('triangle');
  });

  it('define regras de seleção, vizinhança e contestação', () => {
    expect(rule(':selected').style['border-width']).toBe(3);
    expect(rule('.neighbor').style['border-width']).toBe(1);
    expect(rule('edge[?contested]').style['line-color']).toBeDefined();
  });
});
