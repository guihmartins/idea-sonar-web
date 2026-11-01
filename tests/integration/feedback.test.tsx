import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Failure, SafeLink } from '../../src/components/Feedback';
import { ApiError } from '../../src/api/client';
import { ServicesProvider } from '../../src/app/services';
import { createFixtureServices } from '../../src/dev/fixtures';

function renderWithServices(children: React.ReactNode) {
  const services = createFixtureServices();
  render(<ServicesProvider services={services}>{children}</ServicesProvider>);
  return services;
}

describe('Failure', () => {
  it('mostra mensagem genérica para erros que não são Error', () => {
    renderWithServices(<Failure error="algo deu errado" />);
    expect(
      screen.getByText('Não foi possível carregar os dados.'),
    ).toBeInTheDocument();
  });

  it('mostra identificador da requisição e detalhes retornados pela API', () => {
    const error = new ApiError(
      500,
      'Falha interna',
      { field: 'invalid' },
      'req-123',
    );
    renderWithServices(<Failure error={error} />);
    expect(screen.getByText('Identificador: req-123')).toBeInTheDocument();
    expect(
      screen.getByText('Detalhes retornados pela API'),
    ).toBeInTheDocument();
    expect(screen.getByText(/"field": "invalid"/)).toBeInTheDocument();
  });

  it('lista o caminho e a mensagem de cada campo que a API apontou', () => {
    const error = new ApiError(400, 'Dados inválidos', {
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos',
      details: [
        { path: 'relations.0.claim', message: 'Obrigatório' },
        { path: '', message: 'clientRef deve ser único no lote' },
        { path: 7, message: 'ignorado: caminho que não é texto' },
        { path: 'sem-mensagem' },
        null,
      ],
      requestId: 'req-9',
    });
    renderWithServices(<Failure error={error} />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('relations.0.claim Obrigatório');
    expect(items[0]?.querySelector('code')).toHaveTextContent(
      'relations.0.claim',
    );
    expect(items[1]).toHaveTextContent('clientRef deve ser único no lote');
    expect(items[1]?.querySelector('code')).toBeNull();
  });

  it('não cria lista quando details não é uma lista de campos', () => {
    renderWithServices(
      <Failure
        error={new ApiError(400, 'Dados inválidos', { details: 'texto' })}
      />,
    );
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
    renderWithServices(
      <Failure error={new ApiError(400, 'Dados inválidos', { details: [] })} />,
    );
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
    renderWithServices(
      <Failure error={new ApiError(400, 'Dados inválidos', null)} />,
    );
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });

  it('não mostra detalhes quando o objeto é vazio', () => {
    const error = new ApiError(500, 'Falha interna', {});
    renderWithServices(<Failure error={error} />);
    expect(
      screen.queryByText('Detalhes retornados pela API'),
    ).not.toBeInTheDocument();
  });

  it('oferece reentrar quando o erro é 401 e há sessão', async () => {
    const error = new ApiError(401, 'Sessão expirou');
    const services = createFixtureServices();
    const login = vi.spyOn(services.session, 'login');
    render(
      <ServicesProvider services={services}>
        <Failure error={error} />
      </ServicesProvider>,
    );
    const button = screen.getByRole('button', { name: 'Entrar novamente' });
    await userEvent.setup().click(button);
    expect(login).toHaveBeenCalled();
  });

  it('não mostra botão de tentar novamente sem retry informado', () => {
    renderWithServices(<Failure error={new Error('falha')} />);
    expect(
      screen.queryByRole('button', { name: 'Tentar novamente' }),
    ).not.toBeInTheDocument();
  });
});

describe('SafeLink', () => {
  it('renderiza link para URLs http(s)', () => {
    render(<SafeLink url="https://example.com">Texto</SafeLink>);
    expect(screen.getByRole('link', { name: /Texto/ })).toHaveAttribute(
      'href',
      'https://example.com',
    );
  });

  it('mostra aviso de link indisponível para esquemas não http(s)', () => {
    render(<SafeLink url="javascript:alert(1)">Texto</SafeLink>);
    expect(screen.getByText(/Texto \(link indisponível\)/)).toBeInTheDocument();
  });

  it('mostra aviso de link indisponível para URL inválida', () => {
    render(<SafeLink url="não é uma url">Texto</SafeLink>);
    expect(screen.getByText(/Texto \(link indisponível\)/)).toBeInTheDocument();
  });
});
