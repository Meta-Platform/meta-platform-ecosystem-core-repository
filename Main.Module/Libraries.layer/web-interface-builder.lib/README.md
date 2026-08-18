# web-interface-builder.lib

- **Tipo:** biblioteca (`.lib`)
- **Namespace:** `@/web-interface-builder.lib`
- **Localização:** `Main.Module/Libraries.layer/web-interface-builder.lib` (EcosystemCoreRepo)

## Propósito

Constrói e empacota a interface web de um pacote `.webgui`. É esta lib que faz um
`.webgui` deixar de ser código-fonte e virar um bundle servido em runtime — por
isso nenhum `.webgui` roda sozinho.

Quem compila é um **motor** selecionável. O webpack é o padrão e continua sendo o
único implementado, mas deixou de ser a única estratégia possível: ver
[Motores de build](#motores-de-build).

Vive no `ecosystem-core` porque é ali que mora a capacidade web da plataforma, e
é injetada nos *task loaders* pelo registry: `endpoint-instance` (core) a usa
para servir a GUI por HTTP, e `desktop-window-instance` (applications) a usa no
modo **GUI-host**, em que o Electron hospeda a interface sem subir webservice.

O export é uma **fábrica**: `(SmartRequire) => WebInterfaceBuilder`. Receber o
`SmartRequire` do chamador é o que permite resolver as dependências npm do
pacote-alvo, e não as desta lib.

## Exports (`src/`)

| Módulo | Responsabilidade |
|---|---|
| `WebInterfaceBuilder.ts` | Fábrica do builder. Resolve o perfil, consulta o cache, decide entre compilar aqui ou num processo filho, e garante que nada fique aberto ao final. |
| `BuildProfiles.ts` | Os perfis (`release`, `debug`, `debug-watch`) e a ordem de precedência entre eles. |
| `CreateWebpackConfig.ts` | Monta a configuração do webpack a partir dos parâmetros e do perfil. **Função pura** — não instancia compilador nem toca no disco, então dá para testá-la sem ter o webpack instalado. |
| `BuildCache.ts` | Assinatura das entradas do build, manifesto e faxina de assets órfãos. |
| `OutputDirectory.ts` | Nome PORTÁVEL do diretório de saída e onde ele é montado. |
| `CreateBuildWorkerClient.ts` | Lança e conversa com o processo filho que compila. |
| `BuildWorkerEntry.ts` | O processo filho. Compila e morre. |
| `PrebuildWebInterface.ts` | Caminho de entrada para construir a webgui de um pacote FORA do ciclo de vida do serviço — ver [Pré-build](#pré-build-fora-do-ciclo-de-vida-do-serviço). |
| `ResolveBuildEngine.ts` | Registro dos motores. Escolhe qual compila, com a mesma precedência do perfil. |
| `BuildEngines/WebpackEngine.ts` | O motor webpack: carrega o bundler, monta o compilador e resume o resultado. |

## Motores de build

Até pouco tempo o webpack não era uma escolha: a configuração e o ciclo de vida
do compilador estavam espalhados pelo builder **e duplicados** no worker. Trocar
de estratégia significaria mexer nos dois lugares, e o `stats` do webpack vazava
para o resto do código.

Hoje há um contrato. Um motor é uma fábrica `(SmartRequire) => motor`, e o motor
oferece:

| Membro | Contrato |
|---|---|
| `name` | O nome pelo qual o motor é escolhido. Entra na assinatura do cache. |
| `CreateSession({ params, profile })` | Devolve a sessão de um build concreto. |

E a sessão:

| Membro | Contrato |
|---|---|
| `RunOnce()` | Compila uma vez. Resolve com o **resumo**. Rejeita SÓ em falha de infraestrutura — código que não compila volta como `summary.ok === false`, porque quem decide o que fazer com isso é o chamador. |
| `StartWatch({ onCycle })` | Observa. Resolve no primeiro ciclo, com ou sem erro de compilação. `onCycle` recebe todo ciclo, como `{ summary }` ou `{ error }`. |
| `Close()` | Libera tudo. Idempotente. |

O contrato é deliberadamente de **alto nível** — "compile isto e me diga como
foi". Um contrato em torno do objeto `compiler` admitiria só bundlers com a API
do webpack e fecharia a porta para estratégias de outra forma.

O **resumo** é `structuredClone`-able de propósito: é o mesmo formato que
atravessa o IPC quando o build roda em processo separado. Nenhum objeto do
bundler cruza essa fronteira — o `stats` do webpack referencia a `Compilation`
inteira, e devolvê-lo ao chamador ancoraria o build todo no heap.

### Como escolher

Precedência, igual à do perfil:

1. `META_WEBGUI_BUILD_ENGINE` (variável de ambiente) — para forçar numa
   instalação inteira sem reprovisionar todo mundo.
2. `webguiBuildEngine` no metadado do pacote, ou `RT_WEBGUI_BUILD_ENGINE` do
   `ecosystem-defaults`.
3. O padrão: `webpack`.

Nome desconhecido **falha**, e falha cedo. Cair no padrão em silêncio faria um
erro de digitação virar "o motor novo não mudou nada", e a investigação começaria
no lugar errado.

O nome escolhido entra na assinatura do `BuildCache` **e** no nome do diretório
de assets. Sem isso, trocar de motor serviria o artefato do motor anterior como
se estivesse atualizado — e o build novo pareceria não ter efeito nenhum.

### Como acrescentar um motor

Um módulo em `BuildEngines/` que cumpra o contrato acima, mais uma linha em
`ENGINE_FILES` no `ResolveBuildEngine.ts`. Nada mais: o builder, o worker e o
cache já falam com o motor pelo contrato.

Dois candidatos previstos, e por que nesta ordem:

- **rspack** — webpack reescrito em Rust, com API e configuração compatíveis. É a
  troca de maior retorno com menor risco: mantém a semântica dos webguis
  existentes e tira o trabalho de dentro do heap do V8.
- **esbuild** — para interfaces que não dependem de loaders específicos. A API
  Node dele já executa o compilador como processo filho, então o build nunca
  infla o heap do serviço. Em troca **não faz checagem de tipos** e **não emite
  ES5**, o que exige subir o `target` dos `tsconfig.json` das webguis. É mudança
  de comportamento — precisa ser decidida, não descoberta.

## Como usar

```js
const builder = await WebInterfaceBuilder({
    context, entrypoint, htmlTemplate, output, nodeModulesPath,
    serverAppName, url, componentLibraries,

    buildProfile:     "release",   // ou "debug", "debug-watch"
    environmentPath, generatedDirName,
    isolateBuild:     true,        // compila fora deste processo
    onChangeProgress: (pct) => {}
})

const { output, fromCache, summary } = await builder.Build()
await builder.Close()
```

`Build()` escolhe entre `Run()` (uma vez) e `Watch()` (observando) conforme o
perfil. Em watch, ele só resolve **depois do primeiro bundle ficar pronto**, e
devolve um `Close` — quem registra um diretório estático precisa saber que há o
que servir, e quem sobe um watcher precisa poder derrubá-lo.

## Perfis de build

| | `release` (padrão) | `debug` | `debug-watch` |
|---|---|---|---|
| `mode` | production | development | development |
| mapa de código | nenhum | `eval-cheap-module-source-map` | idem |
| minificação | sim | não | não |
| typecheck (`ts-loader`) | sim | não (`transpileOnly`) | não |
| `source-map-loader` | não aplica | só fora do `node_modules` | idem |
| cache do webpack | não | filesystem | filesystem |
| observa alterações | não | não | sim |

**Precedência:** `META_WEBGUI_BUILD_PROFILE` (ambiente) → `webguiBuildProfile`
(parâmetro do pacote) → `RT_WEBGUI_BUILD_PROFILE` (ecosystem-defaults) →
`isWatch` legado → `release`.

Um nome desconhecido **nunca lança**: cai no padrão e avisa. Um ecossistema
instalado só recebe as chaves novas depois de um `ecosystem update`, e a
diferença entre "o parâmetro não pegou" e "nenhuma interface sobe" é grande
demais para depender disso.

### Por que `release` custa tão menos

Antes a configuração era única e embutida, no pior par possível: sem `mode` (o
webpack 5 assume `production`, com Terser) **mais** `devtool: "source-map"` — o
mapa de código completo, o modo mais caro em heap — e o `source-map-loader`
aplicado a todo `/\.js$/` **sem exclude**, o que fazia o build ler e reparsear os
mapas de dentro do `node_modules` inteiro.

Medido no `instance-executor-control-panel.webapp`:

| | configuração antiga | `release` |
|---|---|---|
| pico de memória no build | 1441 MB | **122 MB** |
| `bundle.js` | 3,13 MB | 1,66 MB |
| assets totais | 12,02 MB | 3,32 MB |

## Armadilha: parâmetro booleano não desliga

`GetPopulatedParameters` (no `execution-params-generator.lib`) resolve assim:

```js
TryGetValue(value, params) || (IsHandlebar(value) && ApplyParamsByString(value, params)) || value
```

Com `false`, `0` ou `""` a expressão cai no `|| value` e devolve a **string do
nome do parâmetro**, que é truthy. Ou seja: **um parâmetro booleano só consegue
ser ligado, nunca desligado.** É por isso que `"isWatch": false` nunca desligou o
watch de webgui nenhum.

Todo parâmetro desta lib é string por causa disso: `"release"`, `"on"`, `"off"`.
Se você acrescentar um, siga a mesma regra.

## Build em processo filho

Soltar as referências de um build **não devolve memória ao sistema**: o V8
mantém o heap que já reservou, então o processo continua ocupando o pico que
atingiu mesmo com tudo coletado. Quem devolve página ao SO é o processo ao
terminar.

Por isso, quando `isolateBuild` está ligado, o build acontece num filho que
morre ao concluir. Em watch, o filho fica vivo como dono do watcher — e leva
junto todo o custo dele — até o pai pedir para fechar.

Medido abrindo o `ui-catalog.desktopapp`:

| tempo | Electron main | worker |
|---|---|---|
| 3 s | 157 MB | 335 MB |
| 6 s | 157 MB | 493 MB |
| 9 s | 162 MB | encerrado |

Detalhes que importam:

- **`spawn`, nunca `fork`.** `fork` herda o `execArgv` do pai (um `--inspect`
  viraria conflito de porta no filho), assume que `execPath` é node — falso sob
  binário empacotado — e não deixa injetar `--max-old-space-size` antes do script.
- **Nenhum objeto do webpack atravessa o canal.** Volta só um resumo com
  contadores e mensagens de texto; mandar o `stats` faria o pai reconstruir, no
  `JSON.parse`, boa parte do que se queria deixar para trás.
- **Sem runtime disponível, compila localmente** e avisa. Não compilar nunca é
  uma opção.

Hoje só o caminho Electron isola. O binário empacotado do daemon reconhece
`PKG_INVOKE_NODEJS`, mas essa variável propaga para os netos (é o motivo do
`unset PKG_EXECPATH` nos wrappers) e a detecção depende da versão instalada; o
ponto de extensão está marcado em `ResolveWorkerRuntime`.

## Cache de build

A assinatura cobre a fonte do webgui, as bibliotecas de componentes, o
`node_modules`, o perfil, o entrypoint e o template. O diretório de saída fica
de fora — por isso a assinatura calculada **antes** do build continua válida
para gravar depois dele.

| entrada | como entra | por quê |
|---|---|---|
| fonte do webgui | conteúdo | pequena, e é o que muda de verdade |
| bibliotecas de componentes | conteúdo | idem |
| `node_modules` | caminho + **tamanho** | centenas de MB: ler tudo a cada abertura trocaria um problema de memória por um de I/O |

**A data de arquivo não entra em nada.** A primeira versão usava
tamanho + `mtime` no `node_modules` e o cache nunca acertava: o ambiente de
execução refaz o `.dependencies` a cada subida, copiando os mesmos arquivos com
`mtime` novo. Com a data na conta, a assinatura mudava sempre — indistinguível
de não ter cache. O tamanho sobrevive à recriação e continua mudando quando a
dependência muda de versão de verdade.

Quando o cache **não** acerta, o log diz qual assinatura divergiu. Sem isso, um
cache que erra sempre e um cache que não existe produzem exatamente o mesmo
sintoma.

`PurgeStaleWebInterfaceAssets` remove diretórios de assets abandonados — o nome
do diretório deriva de um hash da configuração, então mudar o app, a entrada, o
template, o perfil ou o motor abandona o anterior. A faxina é conservadora: só
mexe no que tem manifesto nosso, nunca no que está em uso, nunca no que foi
tocado recentemente, e nunca durante um watch.

## Nome do diretório de saída é PORTÁVEL

`OutputDirectory.ComputeOutputDirName` — usada tanto pelo `endpoint-instance.taskLoader`
quanto por `PrebuildWebInterface.ts` — depende só de `serverAppName`,
`entrypoint`, `htmlTemplate`, o perfil e o motor. **Nunca** de `context`,
`environmentPath` ou `nodeModulesPath`: são caminhos ABSOLUTOS do host, e um
hash que os incluísse nomearia o mesmo pacote de um jeito diferente em cada
máquina — um artefato construído numa imagem nunca seria achado pelo container
que a roda.

Efeito colateral aceito: um build feito ANTES desta portabilidade, sob o hash
antigo, fica órfão (a faxina acima eventualmente o remove) e recompila uma
vez. Dali em diante o mesmo pacote, em qualquer máquina, aponta para o mesmo
diretório.

`url` (a rota HTTP) e `serverEndpointStatus` (o endereço do server-manager,
baked no bundle) também ficam de fora — não por amarrarem a máquina, mas
porque nunca entraram no FINGERPRINT do `BuildCache`, só no nome antigo do
diretório. Isso é uma lacuna pré-existente, não introduzida aqui: um pacote que
muda só de porta ou de rota reaproveita o diretório anterior, e o cache o
considera fresco mesmo com o endereço errado embutido no bundle. A correção
certa é acrescentar `serverEndpointStatus` à assinatura do `BuildCache`.

## Servir sem compilar: `trustPrebuiltAssets`

Antes de instanciar o builder, o `endpoint-instance.taskLoader` confere se o
diretório de saída já tem um artefato válido (`BuildCache.HasPrebuiltWebInterfaceArtifacts`
ou, revalidando, `IsWebInterfaceFresh`) e, se tiver, serve direto — sem
carregar o builder nem resolver o motor.

Dois modos:

| | `trustPrebuiltAssets` **desligado** (padrão) | `trustPrebuiltAssets: "on"` (ou `META_WEBGUI_TRUST_PREBUILT=on`) |
|---|---|---|
| confere | manifesto + `index.html` + `bundle.js` + FINGERPRINT batendo | só manifesto + `index.html` + `bundle.js` |
| custo | varre `node_modules` inteiro por `stat` para calcular o fingerprint | nenhuma varredura |
| onde é o certo | desenvolvimento — a árvore muda a cada `git checkout` | imagem imutável — o artefato já foi validado quando foi construído, e nada na imagem muda depois |

Mesma armadilha de todo parâmetro booleano desta lib (ver acima): declare
`"on"`/`"off"`, nunca `true`/`false`.

## Pré-build fora do ciclo de vida do serviço

`PrebuildWebInterface.ts` constrói a webgui de um pacote sem subir nenhum
endpoint — para uma etapa de build de imagem, ou para outro módulo que
pré-constrói vários painéis de uma vez. Não é o `BuildWorkerEntry.ts` (aquele é
o processo filho do build ISOLADO, uma via de medição); é uma interface pensada
para receber os mesmos dados que o `endpoint-instance.taskLoader` monta.

```bash
node PrebuildWebInterface.ts config.json
```

O `config.json` só tem entradas com nome/formato reconhecíveis a partir de
`loaderParams`. Obrigatórias: `context`, `entrypoint`, `htmlTemplate`,
`nodeModulesPath`, `serverName`, `environmentPath`, `generatedDirName`,
`smartRequirePath` (caminho do `SmartRequire` do essential — só existe dentro
de um ecossistema instalado, por isso é argumento, nunca um padrão inventado).
Opcionais: `url`, `serverEndpointStatus`, `buildProfile`, `buildEngine`,
`componentLibraries`, `wasmModules`, `installTypeScriptResolutionPath`,
`installGlobalLoggerPath`. Recusa perfil de watch — um pré-build produz UM
artefato e para.

O diretório de saída é calculado pela MESMA `OutputDirectory.ComputeOutputDirName`
que o taskLoader usa em runtime — é o que garante que o artefato construído
aqui seja achado lá, sem precisar coordenar caminho nenhum entre os dois.

## Diagnóstico

```bash
# perfil efetivo de cada webgui do ecossistema
node scripts/verify-webgui-build-profiles.js --ecosystem ~/EcosystemData

# quanto de memória o build está custando
node scripts/webgui-build-rss-probe.js --survey
node scripts/webgui-build-rss-probe.js --pid <pid-do-processo> --seconds 120
```

Ambos ficam no `maintenance-toolkit.cli`.

## Testes

```bash
NODE_PATH=~/EcosystemData/npm-dependencies/node_modules npm test
```

Os testes de ciclo de vida e de configuração usam um dublê de webpack e não
precisam de nada instalado. Os do worker compilam de verdade num processo filho,
e por isso exigem o `NODE_PATH` acima.

> Veja o [README do repositório](../../../README.md).
