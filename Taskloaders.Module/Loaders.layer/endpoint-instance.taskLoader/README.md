# endpoint-instance.taskLoader

- **Tipo:** *task loader* (`.taskLoader`)
- **Namespace:** `@/endpoint-instance.taskLoader`
- **Localização:** `Taskloaders.Module/Loaders.layer/endpoint-instance.taskLoader` (EcosystemCoreRepo)

## Propósito

*Object loader* do tipo **`endpoint-instance`**: instancia um endpoint HTTP
(controller ou interface web) associado a um serviço de servidor, durante a
execução de um plano.

## Exports (`src/`)

| Módulo | Responsabilidade |
|--------|------------------|
| `EndpointInstance.taskLoader.ts` | Carrega/instancia o `endpoint-instance`. |
| `StartControllerService.ts` | Sobe um endpoint do tipo *controller*. |
| `StartWebGraphicUserInterfaceService.ts` | Resolve o perfil de build, monta o diretório de saída e sobe a interface web. |

O construtor de bundles vive no
[`web-interface-builder.lib`](../../../Main.Module/Libraries.layer/web-interface-builder.lib/README.md)
e chega aqui por injeção do registry — este loader não o alcança por caminho
relativo.

## Ciclo de vida da interface web

O `Start` guarda o handle devolvido pelo builder e o `Stop` o **fecha**. Isso não
é detalhe: em watch existe um compilador webpack vivo enquanto a interface está
no ar, e sem esse fechamento ele sobrevivia ao fim da task — o processo ficava
carregando o build para sempre.

O mesmo vale para os caminhos de falha: se a task é parada durante o build, ou
se o build falha, o compilador é encerrado antes de a task mudar de estado.

## Perfil de build

O diretório de saída inclui o perfil no seu hash: assets de `release` e de
`debug` são artefatos diferentes e não podem se sobrescrever.

O perfil vem, nesta ordem, de `webguiBuildProfile` (declarado pelo pacote) ou
`RT_WEBGUI_BUILD_PROFILE` (herdado do ecosystem-defaults, injetado em todo
endpoint). O `isWatch` legado ainda funciona — mapeia para `debug-watch` com
aviso de obsolescência —, mas **perde** para os dois acima. Ver a tabela de
perfis e a armadilha do parâmetro booleano no README do builder.

## Registro (`metadata/taskloaders.json` do repositório)

| Campo | Valor |
|---|---|
| `objectLoaderType` | `endpoint-instance` |
| `entry` | `src/EndpointInstance.taskLoader` |
| `npmDependencies` | `webpack`, `html-webpack-plugin`, `colors` |

> Parâmetros e exemplo no `execution-params`: ver
> [Tipos de Object Loader → `endpoint-instance`](https://github.com/Meta-Platform/meta-platform-open-standard/blob/main/concepts/tipos-de-object-loader.md#endpoint-instance).
> Para criar o seu próprio loader, veja o
> [Guia: como criar e usar um Object Loader](https://github.com/Meta-Platform/meta-platform-essential-repository/blob/main/Runtime.Module/Executor.layer/task-executor.lib/docs/guia-criar-object-loader.md).
> [README do repositório](../../../README.md)
