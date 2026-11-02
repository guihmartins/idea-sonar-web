import { describe, expect, it } from 'vitest';
import {
  hasPrefill,
  parallelEditorPath,
  prefillKeys,
  relationPrefill,
} from '../../src/pages/editor/prefill';

const a = '00000000-0000-4000-8000-000000000030';
const b = '00000000-0000-4000-8000-000000000031';
const types = ['influenced', 'parallel_to', 'studied'];
const params = (text: string) => new URLSearchParams(text);

describe('relationPrefill', () => {
  it('aceita os quatro valores quando todos são válidos', () => {
    expect(
      relationPrefill(
        params(
          `type=parallel_to&sourceId=${a}&targetId=${b}&evidenceStatus=inference`,
        ),
        types,
      ),
    ).toEqual({
      type: 'parallel_to',
      sourceId: a,
      targetId: b,
      evidenceStatus: 'inference',
    });
  });

  it('cada valor é conferido sozinho: só o inválido cai', () => {
    expect(
      relationPrefill(
        params(`type=inventado&sourceId=${a}&targetId=${b}`),
        types,
      ),
    ).toEqual({ sourceId: a, targetId: b });
    expect(
      relationPrefill(
        params(`type=studied&sourceId=nao-e-uuid&targetId=${b}`),
        types,
      ),
    ).toEqual({ type: 'studied', targetId: b });
    expect(
      relationPrefill(
        params(`type=studied&sourceId=${a}&targetId=${b}x`),
        types,
      ),
    ).toEqual({ type: 'studied', sourceId: a });
    expect(
      relationPrefill(params(`sourceId=${a}&evidenceStatus=certeza`), types),
    ).toEqual({ sourceId: a });
    expect(relationPrefill(params('evidenceStatus=documented'), types)).toEqual(
      { evidenceStatus: 'documented' },
    );
    expect(
      relationPrefill(
        params('evidenceStatus=attributed_interpretation'),
        types,
      ),
    ).toEqual({ evidenceStatus: 'attributed_interpretation' });
  });

  it('ids em maiúsculas valem; ids truncados, não', () => {
    expect(
      relationPrefill(params(`sourceId=${a.toUpperCase()}`), types),
    ).toEqual({ sourceId: a.toUpperCase() });
    expect(relationPrefill(params(`sourceId=${a.slice(1)}`), types)).toEqual(
      {},
    );
    expect(relationPrefill(params(`sourceId=${a}0`), types)).toEqual({});
    expect(relationPrefill(params(`sourceId= ${a}`), types)).toEqual({});
    expect(relationPrefill(params(`sourceId=${a}\n`), types)).toEqual({});
    expect(relationPrefill(params(`sourceId=x${a}`), types)).toEqual({});
  });

  it('origem e destino iguais: o destino é ignorado', () => {
    expect(
      relationPrefill(params(`sourceId=${a}&targetId=${a}`), types),
    ).toEqual({ sourceId: a });
    expect(
      relationPrefill(
        params(`sourceId=${a}&targetId=${a.toUpperCase()}`),
        types,
      ),
    ).toEqual({ sourceId: a });
    // Sem origem válida, o destino sozinho vale.
    expect(relationPrefill(params(`targetId=${a}`), types)).toEqual({
      targetId: a,
    });
  });

  it('sem catálogo o tipo não pode ser conferido e fica de fora', () => {
    expect(relationPrefill(params('type=parallel_to'), undefined)).toEqual({});
    expect(relationPrefill(params('type=parallel_to'), [])).toEqual({});
    expect(relationPrefill(params('type='), types)).toEqual({});
  });

  it('parâmetros alheios e URL vazia não preenchem nada', () => {
    expect(relationPrefill(params(''), types)).toEqual({});
    expect(
      relationPrefill(params('label=x&claim=y&status=active'), types),
    ).toEqual({});
  });
});

describe('hasPrefill e parallelEditorPath', () => {
  it('reconhece qualquer um dos quatro parâmetros', () => {
    expect(prefillKeys).toEqual([
      'type',
      'sourceId',
      'targetId',
      'evidenceStatus',
    ]);
    for (const key of prefillKeys)
      expect(hasPrefill(params(`${key}=x`))).toBe(true);
    expect(hasPrefill(params(''))).toBe(false);
    expect(hasPrefill(params('q=x&kind=person'))).toBe(false);
  });

  it('"Registrar paralelo" abre paralelo de a para b, como inferência', () => {
    expect(parallelEditorPath(a, b)).toBe(
      `/edit/relations?type=parallel_to&sourceId=${a}&targetId=${b}&evidenceStatus=inference`,
    );
    const path = parallelEditorPath(a, b);
    expect(
      relationPrefill(new URLSearchParams(path.split('?')[1]), types),
    ).toEqual({
      type: 'parallel_to',
      sourceId: a,
      targetId: b,
      evidenceStatus: 'inference',
    });
  });
});
