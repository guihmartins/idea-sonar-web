import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ListFilters } from '../../src/api/adapter';
import { RecordSearch } from '../../src/pages/RecordSearch';

// O formulário edita um rascunho e a URL é a verdade: a URL da própria busca
// chega depois do envio (a navegação renderiza em seguida) e não pode apagar o
// que o usuário já digitou; a URL que muda por fora (voltar/avançar) pode.
function setup(initial: ListFilters = {}) {
  const onSearch = vi.fn();
  const view = (filters: ListFilters) => (
    <RecordSearch type="nodes" filters={filters} onSearch={onSearch} />
  );
  const { rerender } = render(view(initial));
  return {
    onSearch,
    arrive: (filters: ListFilters) => rerender(view(filters)),
    user: userEvent.setup(),
  };
}
const box = () => screen.getByRole('searchbox', { name: 'Buscar' });
const search = () => screen.getByRole('button', { name: 'Buscar' });

describe('RecordSearch — rascunho e URL', () => {
  it('o que se digita entre o envio e a URL chegar não é apagado', async () => {
    const { onSearch, arrive, user } = setup();
    await user.type(box(), 'jung');
    await user.click(search());
    expect(onSearch).toHaveBeenCalledWith({ q: 'jung' });
    await user.type(box(), ' e mais');
    arrive({ q: 'jung' });
    expect(box()).toHaveValue('jung e mais');
  });

  it('a URL de outra busca (voltar/avançar) substitui o rascunho', async () => {
    const { arrive, user } = setup({ q: 'jung' });
    await user.type(box(), ' rascunho');
    arrive({ q: 'gnose', match: 'exact' });
    expect(box()).toHaveValue('gnose');
    expect(
      screen.getByRole('checkbox', { name: 'Nome ou identificador exato' }),
    ).toBeChecked();
  });

  it('se outra URL toma o lugar da pedida, o rascunho acompanha a que chegou', async () => {
    const { arrive, user } = setup();
    await user.type(box(), 'x');
    await user.click(search());
    arrive({ q: 'y' });
    expect(box()).toHaveValue('y');
    // O pedido antigo ("x") não vale mais: chegar com ele depois é mudança por fora.
    await user.type(box(), 'zzz');
    arrive({ q: 'x' });
    expect(box()).toHaveValue('x');
  });

  it('refazer a busca que já está na URL não deixa um pedido pendente', async () => {
    const { arrive, user } = setup({ q: 'a' });
    await user.click(search());
    arrive({ q: 'b' });
    await user.type(box(), 'zzz');
    arrive({ q: 'a' });
    expect(box()).toHaveValue('a');
  });

  it('"Limpar" com a URL já limpa só zera o rascunho', async () => {
    const { onSearch, user } = setup();
    await user.type(box(), 'rascunho');
    await user.click(screen.getByRole('button', { name: 'Limpar' }));
    expect(box()).toHaveValue('');
    expect(onSearch).toHaveBeenCalledWith({});
  });

  it('o erro de ano some quando a URL muda por fora, não quando a própria chega', async () => {
    const { arrive, user } = setup();
    await user.type(
      screen.getByRole('spinbutton', { name: 'Ano inicial' }),
      '0',
    );
    await user.click(search());
    expect(await screen.findByRole('alert')).toBeVisible();
    arrive({ q: 'outra' });
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
