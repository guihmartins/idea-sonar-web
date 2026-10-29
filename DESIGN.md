---
name: Idea Sonar
description: Papel claro, tinta verde-oliva, um laranja de destaque e uma janela escura para o mapa.
colors:
  paper: "#f7f7f2"
  surface: "#fdfdfa"
  ink: "#252920"
  muted: "#646959"
  line: "#dcded4"
  line-strong: "#bfc3b6"
  hover: "#eceee5"
  accent: "#e76732"
  accent-strong: "#bb431d"
  accent-deep: "#9e3818"
  selection: "#f5c5ad"
  success: "#3f6b2a"
  success-bg: "#eaf0e0"
  error: "#a3321a"
  error-bg: "#fbece6"
  warning: "#8a5a00"
  warning-bg: "#f8f0d9"
  dark: "#20271f"
  dark-raised: "#2a3228"
  dark-line: "#323b2f"
  dark-text: "#e9eee4"
  dark-text-2: "#c3cabc"
  dark-muted: "#9aa68f"
  dark-green: "#b9d99b"
  dark-rose: "#f08a9b"
typography:
  display:
    fontFamily: "DM Sans Variable, system-ui, sans-serif"
    fontSize: "clamp(28px, 3vw, 40px)"
    fontWeight: 550
    lineHeight: 1.15
    letterSpacing: "-0.035em"
  body:
    fontFamily: "DM Sans Variable, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "10px"
    fontWeight: 500
    letterSpacing: "0.145em"
rounded:
  control: "3px"
  window: "7px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "32px"
components:
  button-primary:
    backgroundColor: "{colors.accent-strong}"
    textColor: "#ffffff"
    rounded: "{rounded.control}"
    padding: "8px 14px"
  button-primary-hover:
    backgroundColor: "{colors.accent-deep}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "8px 14px"
  button-secondary-hover:
    backgroundColor: "{colors.hover}"
  instrument:
    backgroundColor: "{colors.dark}"
    textColor: "{colors.dark-text}"
    rounded: "{rounded.window}"
---

# Design System: Idea Sonar

Os tokens vivem em `:root` de `src/app/styles.css`; as cores do grafo vivem em
`src/graph/styles/palette.ts`. Este arquivo é a fonte da verdade: mude aqui e
nos dois lugares juntos. Tema claro apenas.

## Overview

Papel claro e tinta oliva, com um único laranja. Mono para metadado (etiquetas,
IDs, contagens, selos, cromo do painel), DM Sans para tudo o mais. Modo Operate:
linhas com fios de 1px, quase sem sombra, bastante respiro. O mapa é a única
superfície escura, tratada como uma janela de instrumento.

## Colors

- **Papel (#f7f7f2) e tinta (#252920)** formam a base; `muted` (#646959) é o texto secundário e passa AA sobre papel e `hover`.
- **Laranja `accent` (#e76732)** só para o que não é texto: marcadores quadrados, anel de foco de 2px, sublinhados, destaques do grafo. Texto branco sobre ele reprova (3,3:1).
- **`accent-strong` (#bb431d)** é o fundo do botão primário (branco 5,3:1) e a cor de link; hover `accent-deep` (#9e3818).
- **Estados** dentro da paleta: sucesso verde, erro ferrugem, aviso âmbar, cada um com fundo claro e texto AA.
- **Painel escuro**: `dark` #20271f, bordas #323b2f, divisórias #ffffff13, texto #e9eee4 / #c3cabc, apoio #9aa68f, verde #b9d99b para links e estado ativo, rosa #f08a9b para contestação.
- **Grafo**: contextos #b9d99b, #f0a074, #8fb8e8, #b8a4e0; neutro #7b8772; arestas #6d7a64; seleção #e76732; contestada #f08a9b. Todos ≥3:1 sobre o painel.

## Typography

DM Sans Variável, pesos 400 a 650. `h1` 550 com `clamp(28px,3vw,40px)` e tracking -0.035em; `h2` 600. Etiquetas em IBM Plex Mono 10px maiúsculas, tracking ~0,145em, com marcador quadrado laranja de 6px. Corpo com medida máxima de 72ch. Fontes servidas pelo bundle (`@fontsource*`), nunca por CDN.

## Layout

Cabeçalho claro com fio inferior; faixa de sessão em mono; navegação lateral de 232px (item ativo em `hover` e peso 650, sem borda lateral colorida); conteúdo até 1200px. Abaixo de 680px a navegação vira linha que quebra, sem rolagem horizontal. O mapa usa grade de duas colunas (canvas + detalhes de 340px) que empilha abaixo de 1050px.

## Elevation & Depth

Sem sombras. Hierarquia por fios de 1px (`line`, `line-strong`) e pelo contraste claro/escuro.

## Shapes

Quadrado ou 3px nos controles; 7px apenas na janela do instrumento. Marcadores são quadrados; pontos de contexto da legenda são círculos.

## Components

- **Botão primário**: fundo `accent-strong`, texto branco, 3px. Usado para a ação principal da tela (`.primary`).
- **Botão secundário**: contorno `line-strong`, hover `hover`. Padrão de todo `button`.
- **Segmentado (barra do mapa)**: mono maiúsculo 11px, bordas compartilhadas, `aria-pressed="true"` em fundo `dark-line` com texto verde.
- **Linhas de registro**: itens separados por fio, sem cartões nem cartões dentro de cartões.
- **Selo**: retângulo mono com fundo de ~10% do destaque.
- **Instrumento do mapa**: janela #20271f com barra de título mono (ponto raiz e "N/500 pontos · M relações"), barra de controles, canvas com grade pontilhada, painel de detalhes com evidências separadas por fios, rodapé mono com legenda de contextos e "Como ler o mapa".
- **Estados**: `.status` sucesso, `.error` erro e `.confirmation` aviso são caixas com contorno fino; sem borda lateral grossa.

## Do's and Don'ts

- Faça: usar `accent` só em não-texto; checar contraste AA de todo texto novo, inclusive no painel escuro.
- Faça: mono para dados e metadado; DM Sans para leitura.
- Não faça: bordas laterais coloridas, cartões aninhados, gradiente em texto, sombras decorativas, rótulos numerados, kicker acima de títulos de página.
- Não faça: carregar fontes de CDN ou adicionar tema escuro global sem atualizar este arquivo.
