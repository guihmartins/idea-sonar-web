# Produto — Idea Sonar (web)

## Registro

- Superfície: app (modo Operate). Precisão e contenção; nada de página de marketing.
- Idioma da interface: PT-BR.

## Propósito

Uma única pessoa curadora mantém um grafo pessoal de conhecimento sobre relações
de influência histórica entre pessoas, tradições, conceitos e obras. Toda relação
precisa de justificativa e, conforme a classificação (documentada, interpretação
atribuída, inferência), de evidência e fonte. O app serve para explorar o mapa,
ler as evidências e cadastrar ou revisar registros, importações e pendências.

## Usuário e cena de uso

- Dono único dos dados, sessões longas de leitura e edição, em notebook ou celular.
- Dados privados: sem CDN, sem rastreamento, `no-referrer`, funciona offline em Docker.
- Tarefas frequentes: buscar um ponto, expandir conexões, abrir uma relação e ler
  a evidência, corrigir um registro, resolver pendências de importação.

## Voz

Técnica e direta, sem entusiasmo promocional. Controles nomeiam a ação; erros
dizem o problema e a saída. Nenhuma afirmação histórica é apresentada como
fato sem a evidência exibida junto.

## Princípios

1. Evidência primeiro: a proveniência de uma relação nunca fica escondida atrás de cor ou ícone.
2. Escaneabilidade: listas em linhas com fios finos, hierarquia clara, poucos pesos.
3. Restrição: uma cor de destaque, sombras quase nulas, sem decoração que não informe.
4. O mapa é um instrumento: janela escura própria; o restante fica no papel claro.

## Acessibilidade

WCAG 2.1 AA verificada por axe nos E2E (desktop e celular). Tudo operável por
teclado, foco visível, nada comunica só por cor, respeita `prefers-reduced-motion`,
sem rolagem horizontal a 375px. Modo lista equivale ao grafo.

## Fora de escopo agora

Tema escuro global, multiusuário, marca ou página pública.
