# Gerenciamento de Repositórios — Ecosystem Core

Como o ecossistema **conhece e gerencia** os repositórios instalados em runtime.

## Peças

- **repository-manager.service** (`RepositoryManagerService`) — serviço que lê o
  registro de repositórios e a hierarquia de pacotes, servindo de fonte de
  informação para as aplicações e painéis. Depende de `repositoryUtilitiesLib` e
  `dependencyGraphBuilderLib` (do
  [essential-repository](https://github.com/Meta-Platform/meta-platform-essential-repository)).
- **repository-explorer.cli** (`explorer`) — CLI para explorar repositórios e
  pacotes instalados.
- **CLI `repo`** (`repository-manager.cli`, do **essential**) — registra fontes,
  instala e atualiza repositórios (não confundir com o **serviço** acima).

## Onde ficam os dados

No [EcosystemData](https://github.com/Meta-Platform/.github/blob/main/docs/ecosystemdata.md):

- `EcosystemData/repos/` — os repositórios instalados.
- `sources.json` — fontes registradas (de onde instalar/atualizar).
- `repositories.json` — registro dos repositórios instalados e suas aplicações.

Formato e fontes: [Repository Metadata Standard](https://github.com/Meta-Platform/meta-platform-open-standard/blob/main/specifications/repository-metadata-standard.md).

## Fluxo típico

```bash
repo sources              # fontes agregadas disponíveis
repo list installed       # repositórios instalados
repo install EssentialRepo GITHUB_RELEASE
explorer                  # explorar pacotes instalados
```

> O `repository-manager.service` é consumido pelo `ecosystem-manager.service` ao
> localizar o package a executar (ver [services.md](./services.md)).
