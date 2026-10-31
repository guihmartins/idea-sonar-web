import { describe, expect, it } from 'vitest';
import { graphStyle } from '../../src/graph/styles';
import {
  highlightColor,
  labelColor,
  nodeFillColor,
  surfaceColor,
} from '../../src/graph/styles/palette';

function rule(selector: string): { style: Record<string, unknown> } {
  const found = graphStyle.find((r) => r.selector === selector);
  if (!found) throw new Error(`regra ${selector} não encontrada`);
  return found as unknown as { style: Record<string, unknown> };
}
function fakeElement(data: Record<string, unknown>) {
  return { data: (key: string) => data[key] };
}

describe('graphStyle', () => {
  it('constrói os rótulos dos nós com glifo e texto', () => {
    const style = rule('node').style as unknown as {
      label: (ele: unknown) => string;
    };
    expect(style.label(fakeElement({ shape: 'hexagon', label: 'Raiz' }))).toBe(
      '≡ Raiz',
    );
  });

  it('resolve estilo e seta da aresta a partir dos dados do elemento', () => {
    const style = rule('edge').style as unknown as {
      'line-style': (ele: unknown) => string;
      'target-arrow-shape': (ele: unknown) => string;
      width: (ele: unknown) => number;
    };
    expect(style['line-style'](fakeElement({ line: 'dashed' }))).toBe('dashed');
    expect(
      style['target-arrow-shape'](fakeElement({ arrow: 'triangle' })),
    ).toBe('triangle');
    expect(style.width(fakeElement({ width: 2 }))).toBeCloseTo(1.08);
  });

  it('define regras de seleção, vizinhança e esmaecimento', () => {
    expect(rule('node:selected').style).toMatchObject({
      'border-color': highlightColor,
      'background-color': highlightColor,
      color: surfaceColor,
      'z-index': 10,
    });
    expect(rule('.neighbor').style).toEqual({ 'border-width': 1.5 });
    expect(rule('.faded').style).toEqual({ opacity: 0.58 });
    expect(rule('edge.selected-edge').style).toMatchObject({
      'line-color': highlightColor,
      'target-arrow-color': highlightColor,
    });
  });

  it('mantém a escala visual Atlas e as propriedades de desenho', () => {
    expect(graphStyle.map(({ selector }) => selector)).toEqual([
      'node',
      'edge',
      '.neighbor',
      '.faded',
      'node:selected',
      'edge.selected-edge',
    ]);
    expect(rule('node').style).toMatchObject({
      label: expect.any(Function),
      width: 'label',
      height: 'label',
      'background-color': nodeFillColor,
      color: labelColor,
      'font-family': 'DM Sans Variable, DM Sans, system-ui, sans-serif',
      'font-size': 13,
      'text-valign': 'center',
      'text-halign': 'center',
      'text-wrap': 'ellipsis',
      'text-max-width': '180px',
    });
    expect(rule('edge').style).toMatchObject({
      width: expect.any(Function),
      'curve-style': 'unbundled-bezier',
      'line-color': '#8b8f7f',
      'target-arrow-color': '#8b8f7f',
      'arrow-scale': 0.7,
    });
  });
});
