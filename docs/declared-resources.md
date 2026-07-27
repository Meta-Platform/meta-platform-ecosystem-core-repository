# Recursos declarados — socket e storage

Um package não escreve mais o caminho do seu socket nem do seu banco: ele
**declara o recurso** e o ecossistema decide onde aquilo mora, cria a pasta e
entrega o caminho pronto nos startup params.

- `metadata/socket-params.json` — sockets Unix
- `metadata/storage-params.json` — arquivos e pastas de dados

O formato e a semântica (dono × referência, namespace, `scope`) estão na
[resource-params-handler.lib](../../essential-repository/Runtime.Module/MetadataHelpers.layer/resource-params-handler.lib/README.md),
no EssentialRepo. Este documento cobre o que é específico do Ecosystem Core:
**quem resolve, quando e onde as coisas caem**.

## Por que existe

O caminho absoluto no `startup-params.json` versionado tinha três problemas de
uma vez: carregava o `$HOME` de quem escreveu, era **copiado** entre packages
(o socket do daemon aparecia em quatro), e não dizia quem era o dono do recurso.
Sem dono, não há inventário — e sem inventário não há como um gerenciador de
storage mostrar o que está mapeado.

## Onde as coisas caem

| Recurso | Caminho |
|---|---|
| socket | `<EcosystemData>/sockets/<filename>` |
| socket de supervisor (`scope: "supervisor"`) | `<EcosystemData>/supervisor-sockets/<filename>` |
| storage | `<EcosystemData>/storage/<namespace>/<filename>` |

Os nomes das pastas vêm do `ecosystem-defaults.json`
(`ECOSYSTEMDATA_CONF_DIRNAME_UNIX_SOCKET_DIR`,
`ECOSYSTEMDATA_CONF_DIRNAME_SUPERVISOR_UNIX_SOCKET_DIR` e
`ECOSYSTEMDATA_CONF_DIRNAME_STORAGE_DIR`). A pasta `storage/` é nova: antes cada
package escolhia um canto do disco por conta própria.

Sockets continuam numa pasta **plana** porque é onde os clientes já conectam;
storage é agrupado por namespace porque é o namespace que dá ao dado um dono
visível.

## Quem resolve

A resolução acontece nos três lançadores, sempre **depois** de montar a
hierarquia de metadados e **antes** de executar qualquer tarefa:

| Lançador | Onde | Cobre |
|---|---|---|
| `pkg-exec` | `ExecutePackage.js` | todo executável global (`executor-manager`, `eco-panel`, `mypkg`, …) |
| daemon `executor-manager` | `ecosystem-manager.service` | apps in-process lançados pelo painel |
| `run package` | `package-runner.cli` | execução manual e apps desktop (que o daemon lança via `run`) |

Depois, e não antes, porque o merge por-nó do `BuildMetadataHierarchy` é
`{ ...injetado pelo ecossistema, ...próprio do package }`: um recurso aplicado
como base perderia para um caminho literal esquecido no `startup-params.json` —
exatamente o que se quer eliminar. Aplicado por último, o recurso declarado é a
fonte da verdade e o literal fica valendo só para quem ainda não declarou.

O valor resolvido chega aos packages referenciados pelo caminho de sempre: o
`{{param}}` do `boot.json`.

## Packages do Ecosystem Core já migrados

| Package | Declara |
|---|---|
| `ecosystem-instance-manager.app` | dono do socket `ecosystem-instance-manager.app.sock` e do banco `ecosystem-instance-store.sqlite` |
| `instance-executor.cli` | referência ao socket do daemon |
| `repository-explorer.cli` | referência ao socket do daemon |
| `instance-manager-daemon.cli` | referência ao socket do daemon e ao socket de supervisor |
| `ecosystem-control-panel.webapp` / `.desktopapp` | estado do painel (namespace `ecosystem-control-panel`) |
| `package-toolkit.cli` | banco de workspaces (namespace `package-developer`, compartilhado com o PackageDeveloper.group) |

## Ordem de atualização

O `pkg-exec` é um binário: ele precisa ser **atualizado antes** dos repositórios.
Um repositório com os packages já migrados, executado por um binário anterior à
`resource-params-handler.lib`, sobe sem o socket e sem o caminho do banco — os
params simplesmente não existirão.

Migrar um storage também **move o dado**: apontar o parâmetro para o novo lugar
sem levar o arquivo junto faz a aplicação abrir uma base vazia.

> [README do repositório](../README.md)
