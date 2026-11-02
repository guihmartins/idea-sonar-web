import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../src/api/client';
import { ServicesProvider } from '../../src/app/services';
import { createFixtureServices } from '../../src/dev/fixtures';
import {
  Score,
  SemanticFailure,
  SemanticNote,
} from '../../src/components/SemanticNote';

function show(node: React.ReactNode) {
  render(
    <MemoryRouter>
      <ServicesProvider services={createFixtureServices()}>
        {node}
      </ServicesProvider>
    </MemoryRouter>,
  );
}
const unavailable = new ApiError(503, 'Modelo fora do ar.', {
  code: 'SEMANTIC_UNAVAILABLE',
});

describe('SemanticNote e SemanticFailure', () => {
  it('a nota é uma linha de apoio, não um alerta', () => {
    show(<SemanticNote />);
    const note = screen.getByRole('status');
    expect(note).toHaveTextContent(
      'Busca por significado indisponível: o modelo da API não está ativo.',
    );
    expect(note).toHaveClass('semantic-note');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('503 SEMANTIC_UNAVAILABLE vira a nota, mesmo com "tentar novamente" disponível', () => {
    const retry = vi.fn();
    show(<SemanticFailure error={unavailable} retry={retry} />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Busca por significado indisponível',
    );
    expect(screen.queryByText('Modelo fora do ar.')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(retry).not.toHaveBeenCalled();
  });

  it('qualquer outro erro mantém o Failure, com a nova tentativa', async () => {
    const retry = vi.fn();
    show(
      <SemanticFailure
        error={new ApiError(500, 'Falha interna.', { code: 'INTERNAL' })}
        retry={retry}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Falha interna.');
    await userEvent.click(
      screen.getByRole('button', { name: 'Tentar novamente' }),
    );
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('sem retry, o Failure não oferece o botão', () => {
    show(<SemanticFailure error={new Error('Quebrou.')} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Quebrou.');
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('Score', () => {
  it('"semelhança" e o número com vírgula, nada mais', () => {
    show(<Score value={0.93} />);
    expect(screen.getByText('semelhança 0,93')).toHaveClass('score');
  });
});
