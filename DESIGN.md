---
name: Idea Sonar
description: Papel claro, tinta verde-oliva, um laranja de destaque e um mapa desenhado a traço na mesma folha.
colors:
  paper: '#f7f7f2'
  surface: '#fdfdfa'
  plate: '#e9ebe1'
  ink: '#252920'
  ink-2: '#434939'
  muted: '#646959'
  line: '#dcded4'
  line-strong: '#bfc3b6'
  hover: '#eceee5'
  accent: '#e76732'
  accent-strong: '#bb431d'
  accent-deep: '#9e3818'
  selection: '#f5c5ad'
  success: '#3f6b2a'
  success-line: '#c9d6b8'
  error: '#a3321a'
  error-bg: '#fbece6'
  error-line: '#e3b5a6'
  warning: '#8a5a00'
  warning-bg: '#f8f0d9'
  warning-line: '#dcc588'
  atlas-marfim: '#f5f2e9'
  atlas-marfim-2: '#efebdf'
  atlas-tinta: '#172034'
  atlas-tinta-2: '#5c6274'
  atlas-ultra: '#2145d8'
  atlas-fio: '#d9d3c2'
  atlas-fio-forte: '#c3bca6'
typography:
  atlas-serif:
    fontFamily: "'Source Serif 4', Georgia, 'Iowan Old Style', serif"
    fontSize: '1.8rem'
    fontWeight: 400
    lineHeight: 1.15
  display:
    fontFamily: 'DM Sans Variable, system-ui, sans-serif'
    fontSize: 'clamp(26px, 2.2vw, 32px)'
    fontWeight: 550
    lineHeight: 1.2
    letterSpacing: '-0.03em'
  body:
    fontFamily: 'DM Sans Variable, system-ui, sans-serif'
    fontSize: '16px'
    fontWeight: 400
    lineHeight: 1.6
  meta:
    fontFamily: 'IBM Plex Mono, ui-monospace, monospace'
    fontSize: '12px'
    fontWeight: 400
    lineHeight: 1.6
  small:
    fontFamily: 'DM Sans Variable, system-ui, sans-serif'
    fontSize: '14px'
    fontWeight: 400
    lineHeight: 1.6
  title:
    fontFamily: 'DM Sans Variable, system-ui, sans-serif'
    fontSize: '18px'
    fontWeight: 600
    lineHeight: 1.4
  label:
    fontFamily: 'IBM Plex Mono, ui-monospace, monospace'
    fontSize: '11px'
    fontWeight: 500
    letterSpacing: '0.145em'
rounded:
  control: '0'
  plate: '0'
spacing:
  sm: '8px'
  md: '16px'
  lg: '32px'
components:
  button-primary:
    backgroundColor: '{colors.accent-strong}'
    textColor: '#ffffff'
    rounded: '{rounded.control}'
    padding: '8px 14px'
  button-primary-hover:
    backgroundColor: '{colors.accent-deep}'
  button-secondary:
    backgroundColor: 'transparent'
    textColor: '{colors.ink}'
    borderColor: '{colors.line-strong}'
    rounded: '{rounded.control}'
    padding: '8px 14px'
  button-secondary-hover:
    backgroundColor: '{colors.hover}'
    borderColor: '{colors.ink-2}'
  plate:
    backgroundColor: '{colors.plate}'
    textColor: '{colors.ink}'
    borderColor: '{colors.line-strong}'
    rounded: '{rounded.plate}'
---

# Design System: Idea Sonar

Os tokens vivem em `:root` de `src/app/styles.css`; as cores do grafo vivem em
`src/graph/styles/palette.ts` e a forma das marcas em `src/graph/styles/index.ts`.
Este arquivo é a fonte da verdade: mude aqui e nos outros lugares juntos.
Tema claro apenas.

> **Rodada 1 do experimento visual** segue vigente para o resto do app (listas,
> formulários, editor, histórico): papel claro, tinta oliva, um único laranja,
> desenho a traço. **Rodada 2 (Atlas)**, descrita na seção abaixo, troca só a
> *experiência do mapa* (`/map`) por uma composição editorial própria — marfim,
> ultramarino e serifa — escolhida pelo usuário entre duas direções testadas em
> protótipo isolado. Nenhuma das duas rodadas está encerrada: ambas seguem em
> avaliação, e o resto do app usa a rodada 1 até uma decisão final.

## Atlas do mapa (rodada 2, escopo: `/map`)

A tela de mapa deixou de usar o cabeçalho e a navegação lateral genéricos do
app: `App.tsx` omite ambos quando a rota é `/map`, e `MapPage.tsx` desenha sua
própria composição, inteira dentro de `.map-page`. Decisão do usuário após
comparar dois protótipos (Atlas e Observatório) com dados ilustrativos; o
Atlas venceu por ser "publicação, atlas, apparatus" em vez de "instrumento de
pesquisa, esquema técnico". Tokens, estilos e lógica ficam só nesta seção e em
`src/app/styles.css` (bloco `/* ===== Atlas (rodada 2) ===== */`),
`src/graph/styles/palette.ts` e `src/graph/styles/index.ts` — não vazam para o
resto do app.

- **Cores** (todas definidas como custom properties em `.map-page`, não em
  `:root`): marfim `#f5f2e9` (fundo), marfim-2 `#efebdf` (hover/realce),
  tinta `#172034` (texto, ≥14,5:1 no marfim), tinta-2 `#5c6274` (metadado,
  5,4:1), ultramarino `#2145d8` (link, CTA primário, foco, seleção do grafo e
  fluxo; 6,4:1 em texto sobre marfim, 6,4:1 em texto marfim sobre ultramarino),
  fio `#d9d3c2`/fio-forte `#c3bca6` (divisores e bordas de controle, não têm
  função de identificar sozinhos um componente interativo). As cores do grafo
  (contexto, neutro, aresta, contestada) continuam as da rodada 1 — já medem
  ≥3,5:1 sobre o marfim, então a paleta semântica do grafo não mudou, só o
  fundo em que ela se apoia.
- **Tipografia**: Source Serif 4 (self-hosted via `@fontsource/source-serif-4`,
  pesos 400/400-itálico/600) para identidade (marca "Idea Sonar"), o h1 de
  página (estilizado como subtítulo itálico pequeno — "Explorar mapa" continua
  sendo o heading real da página, só não grita), o título e o corpo de leitura
  do painel de evidências (descrição, afirmação, justificativa, excertos).
  DM Sans continua para toda UI (botões, rótulos, rótulos do trilho, barra de
  busca); mono continua para dado/medida (contagens, badges ATR/DOC/INF, selo
  de demonstração). Nunca usar serifa em botão, rótulo de campo ou navegação.
- **Composição**: cabeçalho único (`.map-top`) funde marca + h1-subtítulo +
  busca compacta com dropdown de resultados + filtros em popover + "Novo
  ponto" + selo de demonstração — sem empilhar o cabeçalho genérico do app por
  cima. Corpo em três colunas no desktop (`.map-body`, ≥861px): trilho de 56px
  (`.map-rail`, ícones desenhados de 19px, tooltip no hover/foco, mesmos
  rótulos acessíveis da navegação lateral que substitui) · mapa (`.map-stage`,
  barra de ferramentas + canvas + rodapé com legenda) · painel editorial de
  330px (`.details-panel`). Abaixo de 861px o trilho vira linha horizontal
  rolável no topo e o painel editorial vira bottom sheet fixo e recolhível
  (`position: fixed`, até 64vh, pico quando fechado); o conteúdo acima dele
  ganha `padding-bottom` equivalente para que nada fique permanentemente
  inacessível atrás do sheet aberto. Busca e filtros são overlays posicionados
  (`position: absolute`) sobre o mapa, não blocos que empurram o canvas — o
  mapa ocupa a altura disponível da janela desde a primeira tela no desktop.
- **Nós do grafo**: etiquetas retangulares de canto reto com símbolo de tipo e texto dentro da caixa. Selecionado vira bloco ultramarino; vizinhos usam contorno neutro. A caixa inteira é alvo de clique e arraste. O layout inicial evita colisões estimando as etiquetas e preserva posições já fixadas ou restauradas.
- **Curvas e fluxo**: relações seguem curvas suaves calculadas a partir dos nós e suas caixas; paralelas mantêm separação. O fluxo opcional percorre o traçado real do Cytoscape por comprimento de arco, sem mover ou reconstruir o grafo por quadro. Sua fase persiste ao mudar zoom ou geometria; pausa, aba oculta e movimento reduzido continuam respeitados. Relações simétricas não recebem direção artificial.
- **Contextos no mapa**: anotações usam os contextos carregados e posições efetivas dos nós; acompanham arraste, pan e zoom, sem interceptar interações.
- **Painel editorial**: título grande em serifa, metadado em mono maiúsculo,
  corpo de leitura em serifa, seções com etiqueta mono precedida de fio (igual
  à rodada 1). As fontes exibem índice e título antes do excerto, seguidos de autoria, data e metadados. Ações (expandir/recolher/centralizar, salvar view) continuam em DM Sans. No desktop fica sempre visível (o botão "Recolher painel" só
  aparece <861px); no mobile é o peek/expand do bottom sheet.

- **Mobile (<861px)**: topo compacto, ≈210px de chrome antes do canvas em
  390×844 — indicação de demonstração em uma linha,
  marca + Filtros + Novo ponto na mesma linha, busca logo abaixo, trilho em UMA
  linha com rolagem horizontal (nunca quebra), rodapé de controles e contagens em uma linha com rolagem interna e legenda recolhível. O h1 "Explorar mapa" continua sendo o heading da página, só
  que fora da vista; o selo "Demonstração" some (o banner já avisa). O popover
  de filtros ancora na barra inteira e fica 100% dentro da viewport. O painel
  editorial recolhido no mobile reaparece ao ampliar para desktop.
- **Painel de relação**: a direção mostra os nomes reais dos nós (ledger; se
  ausentes, consulta ao ponto; fallback "ponto não disponível"), nunca UUIDs.
- O placeholder `.empty` do canvas é escopado a `.map-surface > .empty`; o
  estado vazio das listas de registros continua no fluxo normal.

Limite conhecido e não resolvido nesta rodada: o layout anti-colisão de
rótulos foi testado até dezenas de nós (ver registro de validação); grafos
muito densos (dezenas a centenas de pontos) ainda não têm agrupamento/colapso
visual, só o limite de 500 pontos já existente.

## Overview

Papel claro e tinta oliva, com um único laranja. Mono apenas para dado e medida
(IDs, contagens, períodos, datas, a barra do mapa, etiquetas de seção);
DM Sans para tudo que se lê. Modo Operate: fios de 1px, canto reto, nenhuma
sombra, bastante respiro. O mapa não é mais uma janela separada: é uma prancha
de tom um pouco mais fundo que o papel, desenhada a traço.

## Colors

- **Papel (#f7f7f2) e tinta (#252920)** formam a base. `ink-2` (#434939) é o texto
  de apoio e os rótulos de campo (8,7:1 no papel); `muted` (#646959) é o metadado
  (5,3:1 no papel, 4,7:1 na prancha).
- **Prancha do mapa (#e9ebe1)**: 1,12:1 contra o papel — separa pelo tom, não por
  moldura pesada. Sem textura de fundo: grades de 1px por `background-image` não
  pintam de forma confiável no runtime testado, e textura invisível é peso morto.
- **Laranja `accent` (#e76732)** só para o que não é texto: marcadores quadrados
  de 6–7px (marca da barra, item ativo da navegação, título do mapa).
- **`accent-strong` (#bb431d)** é o fundo do botão primário (branco 5,3:1), a cor
  de link, o anel de foco (4,97:1 no papel, 4,4:1 na prancha) e o traço de
  seleção no grafo; hover `accent-deep` (#9e3818).
- **Estados**: sucesso verde, erro ferrugem, aviso âmbar, cada um com texto AA.
  Só o erro e a confirmação continuam sendo caixas; sucesso virou linha com
  marcador.
- **Grafo sobre a prancha** (todos ≥3:1): contextos #4c6b35, #9a5a2b, #3c5f7d,
  #6b4a7a; neutro #767c6b; arestas #7e8372 (3,2:1); contestada #9d2b4e;
  seleção #bb431d; rótulos em tinta #252920 com halo da prancha.

## Typography

DM Sans Variável, pesos 400 a 650. Escala em custom properties: `--text-label`
11px (mono maiúsculo), `--text-xs` 12px (mono/meta), `--text-sm` 14px (UI e
controles), 16px (corpo), `--text-lg` 18px (h2 e título de painel), mais o
`clamp` do h1. `h1` 550 com `clamp(26px,2.2vw,32px)` e tracking -0,03em — títulos
de tela de app não gritam. Rótulos de formulário em DM Sans 14px/500 `ink-2`
(mono é reservado a dado, não a decoração "técnica"). Corpo com medida máxima de
72ch. Fontes servidas pelo bundle (`@fontsource*`), nunca por CDN.

## Layout

Cabeçalho claro com fio inferior; faixa de sessão em mono; navegação lateral de
216px (item ativo em tinta, peso 650 e marcador quadrado laranja, sem bloco de
fundo); conteúdo até 1200px. Título de página com fio inferior separando-o do
conteúdo. Abaixo de 680px a navegação vira linha que quebra, as linhas de duas
colunas empilham e não há rolagem horizontal a 375px. Essa descrição vale para
todas as páginas exceto `/map`, que tem cabeçalho, navegação e grade próprios
— ver "Atlas do mapa" acima.

## Elevation & Depth

Nenhuma. Sem sombra, sem gradiente, sem raio: a hierarquia vem de fios de 1px,
de tom de superfície e de tipografia. A regra de ouro desta rodada: se um
elemento parece ter volume, está errado.

## Shapes

Canto reto em tudo — controles, campos, prancha, selos. Marcadores são
quadrados; a legenda de contexto usa quadrados contornados iguais aos nós; as
formas dos tipos (círculo, hexágono, losango, retângulo) aparecem na legenda em
SVG desenhado, com o mesmo traço do mapa, não com glifos unicode.

## Components

- **Botão primário**: fundo `accent-strong`, texto branco, canto reto. Um único
  por tela — no mapa é "Buscar"; em registros é "Cadastrar".
- **Botão secundário**: contorno `line-strong`, texto 14px/500, hover `hover`
  com borda `ink-2`. Padrão de todo `button`.
- **Campos**: fundo transparente, contorno `line-strong`, canto reto. `select` e
  `checkbox`/`radio` com `appearance: none` e cromo próprio (chevron desenhado,
  caixa de 16px) — o controle nativo do macOS é a única coisa com relevo na tela.
- **Segmentado (barra do mapa)**: mono maiúsculo 12px, bordas compartilhadas,
  `aria-pressed="true"` em inversão chapada (fundo tinta, texto papel).
- **Linhas de registro**: fio separando itens, título à esquerda, ação alinhada à
  direita, última linha do registro em mono como metadado. Sem cartões.
- **Resultados de busca**: linhas com o ID em mono à direita, não cartões.
- **Prancha do mapa**: barra de título em mono (ponto raiz e "N/500 pontos ·
  M relações"), barra de controles, superfície de desenho, painel de detalhes
  separado por fio, rodapé em mono com legenda de contextos e "Como ler o mapa".
- **Painel de detalhes**: título, uma linha de metadado em mono (tipo · estado ·
  conexões) e seções com etiqueta em mono precedida de fio. Nunca kicker acima do
  título.
- **Marcas do grafo**: preenchimento da cor do contexto a 16% + contorno de
  1,5px na mesma cor; tamanho de 27 a 38px derivado do grau (a escala mora no
  stylesheet, o adapter continua entregando o dado cru). Arestas em fio de
  0,7–2,0px; setas em escala 0,75. Selecionado: contorno 2px `accent-strong`,
  rótulo em 600; vizinhos com contorno de 2px na cor do contexto; **todo o resto
  recua para 32% de opacidade**. Zoom limitado a 1,4 para o rótulo não virar
  cartaz.

## Do's and Don'ts

- Faça: usar `accent` só em não-texto; checar contraste AA de todo texto novo e
  3:1 de toda marca do grafo sobre a prancha.
- Faça: mono para dado e medida; DM Sans para leitura.
- Não faça: sombra, gradiente, raio de canto, superfície escura, cartão (e nunca
  cartão dentro de cartão), borda lateral colorida, kicker acima de título,
  glifo unicode no lugar de ícone desenhado, mono como fantasia de "técnico".
- Não faça: carregar fontes de CDN; mais de um botão primário por tela.
