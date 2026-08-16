# process-metrics.lib

- **Tipo:** biblioteca (`.lib`)
- **Namespace:** `@/process-metrics.lib`
- **Localização:** `Main.Module/Libraries.layer/process-metrics.lib` (EcosystemCoreRepo)

## Propósito

Medir **uso de CPU, memória, threads e I/O** de processos do ecossistema lendo o
`/proc` do Linux, sem nenhuma dependência externa.

Existe para o daemon [`executor-manager`](../../InstanceManagerApplication.layer/ecosystem-instance-manager.app)
poder responder *"como está indo o que eu coloquei no ar"* — é o que alimenta os
gráficos de desempenho do
[Instance Executor](../../../../applications-repository/Apps.Module/InstanceManager.layer/InstanceExecutorControlPanel.group).
O daemon já sabia **o que** estava rodando (ver [`instance-store.lib`](../instance-store.lib));
passou a saber **como** está rodando.

### Por que ler `/proc` à mão

O daemon é o núcleo da execução do ecossistema e roda empacotado (`pkg`). Toda
dependência nativa nova é um risco de build e de runtime para o componente que
não pode falhar. `/proc` é texto: ler é barato, não tem binding nativo e não
quebra numa atualização de versão.

Em SO sem `/proc`, nada explode — cada campo indisponível volta `undefined` e
quem consome decide o que exibir. `IsSupported()` responde antes de tentar.

## Exports (`src/`)

| Módulo | Responsabilidade |
|---|---|
| `CreateProcessSampler.ts` | Amostra processo, grupo de processos e a máquina. |
| `CreateMetricsHistory.ts` | Buffer circular de amostras por chave, para os gráficos. |

## Duas medidas que costumam ser confundidas

| Medida | Escala | Quem usa |
|---|---|---|
| `SampleProcess`/`SampleProcessGroup` → `cpuPercent` | relativo a **um núcleo** — pode passar de 100% num processo multithread (é o que o `htop` mostra por linha) | por instância |
| `SampleSystem` → `cpuPercent` | 0–100% do **total de núcleos** — "quanto da máquina está ocupada" | barra de status global |

## Processo vs. grupo

Uma instância `desktop` **não é um processo**: o daemon faz `spawn` de
`run package` com `detached: true` (logo `pgid = pid`), e esse `run` sobe o
Electron, que tem processos de GPU e de renderer. Medir só o pid registrado
mostraria ~0% de CPU e alguns MB — pior do que não mostrar nada. `SampleProcessGroup`
soma o grupo inteiro e mede a aplicação de verdade.

> Somar o RSS do grupo conta duas vezes a memória compartilhada entre os
> processos. É a mesma aproximação do Gerenciador de Tarefas do Windows por
> árvore, e o erro é para cima: é o total do grupo, não memória exclusiva.

## O sampler é stateful de propósito

Uso de CPU não é um valor que se lê, é a **derivada** de um contador acumulado.
A primeira amostra de um pid estabelece a linha de base e volta com
`cpuPercent: 0`; da segunda em diante a medição é real. Por isso o sampler deve
ser **criado uma vez** e reutilizado — recriá-lo a cada chamada devolve zero para
sempre.

`Forget(pid)` descarta a linha de base de um processo morto; sem isso o mapa
interno cresceria indefinidamente num daemon que fica meses no ar.

## API

```ts
const CreateProcessSampler  = processMetricsLib.require("CreateProcessSampler")
const CreateMetricsHistory  = processMetricsLib.require("CreateMetricsHistory")

const sampler = CreateProcessSampler()          // uma vez, no start do serviço
sampler.IsSupported()                           // há /proc nesta máquina?

sampler.SampleProcess(pid)                      // { pid, processCount, cpuPercent, rssBytes, threads, uptimeSeconds, ioReadBytes, ioWriteBytes }
sampler.SampleProcessGroup(pgid)                // idem, somando o grupo (processCount > 1)
sampler.SampleSystem()                          // { cpuPercent, cpuCount, totalMemBytes, availableMemBytes, usedMemBytes, loadAverage, uptimeSeconds }
sampler.Forget(pid)                             // descarta a linha de base

const history = CreateMetricsHistory({ capacity: 300 })   // 300 × 2s ≈ 10 min
history.Push(instanceId, { at: Date.now(), ...sample })
history.Get(instanceId, 120)                    // as 120 amostras mais recentes
history.GetLast(instanceId)
history.KeepOnly(instanceIdList)                // esquece instâncias que morreram
```

### Constante `USER_HZ`

O kernel reporta tempo de CPU em *ticks*. Não há `sysconf(_SC_CLK_TCK)` em Node
puro, então o sampler assume **100** — o valor do ABI de userspace de todo Linux
corrente. Pode ser sobrescrito: `CreateProcessSampler({ clockTicks })`.

> Veja o [README do repositório](../../../README.md).
