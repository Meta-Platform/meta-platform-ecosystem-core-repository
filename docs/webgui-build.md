# Build de interface web

Como um `.webgui` vira bundle, quanto isso custa e como controlar esse custo.

## O caminho de um `.webgui` até a tela

Um `.webgui` é código-fonte. Alguém precisa compilá-lo antes que exista qualquer
coisa para servir, e há dois caminhos que fazem isso:

```
.webapp (endpoint HTTP)                 .desktopapp (GUI-host)
   │                                       │
   endpoint-instance.taskLoader            desktop-window-instance.taskLoader
   │                                       │  spawn do Electron
   StartWebGraphicUserInterfaceService     electron-main.js
   │                                       │
   └──────────► web-interface-builder.lib ◄┘
                        │
                        ├─ perfil de build  (BuildProfiles)
                        ├─ cache            (BuildCache)
                        └─ webpack, aqui ou num processo filho
```

Os dois compartilham o builder, o cache e os perfis. Isso é deliberado: enquanto
o cache existia só no caminho desktop, o mesmo bundle era considerado atualizado
por um caminho e obsoleto pelo outro.

## Quanto o build custa

Um `.webapp` com interface ocupava cerca de **500 MB** contra **150 MB** de um
`.app` sem interface — 350 MB por instância que nunca voltavam. Com doze
instâncias no ar, 4,2 GB.

Quatro causas, todas resolvidas:

1. **O compilador nunca era fechado.** Sem `compiler.close()`, o webpack 5 retém
   o `CachedInputFileSystem` — o conteúdo de cada arquivo lido durante o build,
   incluindo a árvore de `node_modules`.
2. **O observador era imortal.** O objeto `Watching` devolvido por
   `compiler.watch()` era descartado; não havia handle para fechar, e o watcher
   (com polling de 1 s) sobrevivia ao `Stop` da tarefa.
3. **Uma promessa que nunca assentava.** O `catch` do build não chamava `resolve`
   nem `reject`: a instância parava em `STARTING` para sempre e a closure
   segurava o compilador.
4. **Tarefas encerradas nunca soltavam nada.** Ver
   [Liberação de recursos de tarefas encerradas](https://github.com/Meta-Platform/meta-platform-essential-repository/blob/main/Runtime.Module/Executor.layer/task-executor.lib/README.md).

E a configuração do webpack era única e embutida, no pior par possível: sem
`mode` (o webpack 5 assume `production`, com Terser) **mais**
`devtool: "source-map"` — o mapa de código completo, o modo mais caro em heap — e
o `source-map-loader` aplicado a todo `.js` sem exclusão, o que fazia o build ler
e reparsear os mapas de dentro do `node_modules` inteiro.

## Escolhendo o perfil

| perfil | para quê |
|---|---|
| `release` (padrão) | o build que vai ao usuário: minificado, sem mapa de código, com typecheck, sem observar alterações |
| `debug` | compilar rápido e conseguir depurar: sem minificar, mapa barato, sem typecheck, com cache |
| `debug-watch` | o `debug` recompilando a cada alteração |

Para todo o ecossistema, em `config-files/ecosystem-defaults.json`:

```json
"RT_WEBGUI_BUILD_PROFILE": "release"
```

Para um pacote específico, no `startup-params.json` dele:

```json
"webguiBuildProfile": "debug-watch"
```

Para uma execução só:

```bash
META_WEBGUI_BUILD_PROFILE=debug executor package <caminho>
```

A precedência é: ambiente → pacote → ecosystem-defaults → `isWatch` legado →
`release`.

### Sobre o `isWatch`

Os `.webgui` mais antigos declaram `"isWatch": true`. Ele continua funcionando —
mapeia para `debug-watch` — mas **perde** para o perfil declarado e para o padrão
do ecossistema. Na prática, com `RT_WEBGUI_BUILD_PROFILE` definido, nenhum deles
sobe em watch.

Não adianta trocar para `"isWatch": false`: o pipeline de parâmetros resolve
`TryGetValue(v, params) || … || value`, então `false` cai no último termo e vira
a **string** `"isWatch"`, que é truthy. **Parâmetro booleano só liga, nunca
desliga** — por isso todo parâmetro de build é string.

Para conferir o que cada interface vai fazer de verdade:

```bash
node scripts/verify-webgui-build-profiles.js --ecosystem ~/EcosystemData
```

## Onde o build roda

Soltar as referências de um build não devolve memória ao sistema operacional: o
V8 mantém o heap que reservou. Quem devolve página ao SO é o processo ao
terminar.

Por isso o build de uma **janela desktop** — que fica aberta por horas —
acontece num processo filho que morre ao concluir. O processo da janela nunca
chega a alocar o build.

```
3 s   janela 157 MB   worker 335 MB
6 s   janela 157 MB   worker 493 MB
9 s   janela 162 MB   worker encerrado
```

Desligar, se necessário: `RT_WEBGUI_BUILD_ISOLATED: "off"`.

O caminho HTTP compila no próprio processo do executor. Não isola porque, em
`release`, o build inteiro custa cerca de 4 MB de pico ali — não há o que
economizar.

## Quando o build é reaproveitado

O bundle é reusado se a **assinatura das entradas** bate com a do último build e
os artefatos estão no disco. A assinatura cobre a fonte, as bibliotecas de
componentes, o `node_modules`, o perfil, o entrypoint e o template.

`node_modules` entra por caminho e **tamanho**, sem data. O ambiente de execução
refaz o `.dependencies` a cada subida, copiando os mesmos arquivos com `mtime`
novo — com a data na conta, a assinatura mudava sempre e o cache nunca acertava.

Quando não reaproveita, o log diz qual assinatura divergiu.

Trocar de perfil, de porta ou de URL gera um diretório de assets novo e abandona
o anterior; a faxina remove os órfãos com mais de sete dias
(`RT_WEBGUI_BUILD_ASSETS_RETENTION_DAYS`), nunca o que está em uso.

## Medindo

```bash
# comparativo: quem embute interface contra quem não embute
node scripts/webgui-build-rss-probe.js --survey

# um processo ao longo do tempo (inicial, pico, final, o que não voltou)
node scripts/webgui-build-rss-probe.js --pid <pid> --seconds 120

# um grupo — para desktopapp, que é run + Electron + renderers
node scripts/webgui-build-rss-probe.js --pid <pid> --group
```

Os dois scripts ficam no `maintenance-toolkit.cli` e leem `/proc` pelo mesmo
`process-metrics.lib` que alimenta o painel do Instance Executor.

## Chaves de configuração

| chave | padrão | efeito |
|---|---|---|
| `RT_WEBGUI_BUILD_PROFILE` | `"release"` | perfil de build do ecossistema |
| `RT_WEBGUI_BUILD_ISOLATED` | `"on"` | compila fora do processo hospedeiro (Electron) |
| `RT_WEBGUI_BUILD_MAX_OLD_SPACE_MB` | `2048` | teto de heap do processo de build |
| `RT_WEBGUI_BUILD_ASSETS_RETENTION_DAYS` | `7` | idade a partir da qual assets órfãos são removidos |

Variáveis de ambiente equivalentes, para uma execução: `META_WEBGUI_BUILD_PROFILE`,
`META_WEBGUI_BUILD_ISOLATED`, `META_WEBGUI_BUILD_MAX_OLD_SPACE_MB`,
`META_WEBGUI_BUILD_WATCH_POLL_MS` (religa o polling do watch em volume montado,
NFS ou container, onde o inotify não propaga) e `META_WEBGUI_BUILD_NODE_PATH`
(aponta o executável que roda o processo de build).

## Ver também

- [`web-interface-builder.lib`](../Main.Module/Libraries.layer/web-interface-builder.lib/README.md) — a implementação
- [`webgui-component-libraries.md`](./webgui-component-libraries.md) — como as bibliotecas de componentes entram no bundle
- [`instance-lifecycle.md`](./instance-lifecycle.md) — o ciclo de vida em que o build se encaixa
