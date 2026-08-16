# bare-git-writer.lib

- **Tipo:** biblioteca (`.lib`)
- **Namespace:** `@/bare-git-writer.lib`
- **Localização:** `Main.Module/Libraries.layer/bare-git-writer.lib` (EcosystemCoreRepo)

## Propósito

Escrever commit em repositório **bare**, sem árvore de trabalho e sem checkout.

Um bare não tem arquivo para editar nem `git commit` para dar: o commit é
montado por plumbing — `hash-object` grava o conteúdo, `update-index
--index-info` monta a árvore num índice temporário, `write-tree` a materializa,
`commit-tree` amarra ao pai e `update-ref` publica com **compare-and-swap**.

É a peça que faltava para um editor de pacotes servir de tela sobre um
repositório hospedado: até aqui, conteúdo só entrava num bare por `git push` ou
por importação de repositório vazio.

Complementa a `git-status.lib`, que faz o lado da **leitura**.

## Por que não um worktree temporário

O caminho óbvio seria `git worktree add` num diretório temporário, escrever,
`git commit`, apagar. Perde em três pontos:

| | plumbing | worktree temporário |
|---|---|---|
| Custo por commit | proporcional ao que mudou | checkout do repositório **inteiro** |
| Concorrência | `update-ref <novo> <antigo>` é CAS atômico | `git commit` não tem CAS: dois commitantes divergem |
| Crash no meio | índice num diretório temporário + objetos soltos que o `gc` varre | worktree órfã e lock que **bloqueia a tentativa seguinte** |
| Identidade do autor | por variável de ambiente, a cada requisição | `user.name` gravado no repositório, global entre usuários |

O worktree só venceria se fosse preciso merge de três vias, que esta lib não faz.

## O que esta lib NÃO faz

Não sabe o que é usuário, dono, permissão ou banco de dados. Recebe o caminho de
um git-dir e um change set. Quem chama decide se aquela pessoa podia pedir
aquilo — e é por isso que autorização não pode ser "esquecida aqui": nunca
esteve aqui.

## Exports (`src/`)

| Módulo | Responsabilidade |
|---|---|
| `CreateBareGitWriter.ts` | Fábrica do escritor: recebe `scratchRootPath` e devolve as operações. |
| `NormalizeChangeSet.ts` | Valida e normaliza o change set — puro, sem git, sem disco. Roda **antes** de qualquer `hash-object`. |
| `RunGit.ts` | Runner de `git` sem shell, com `env` explícito e stderr preservado; e a variante que alimenta o git por stdin. |
| `Errors.ts` | Recusas que dependem do estado do git, cada uma com `code` e `statusCode`. |

## API

```ts
const CreateBareGitWriter = bareGitWriterLib.require("CreateBareGitWriter")

const writer = CreateBareGitWriter({ scratchRootPath: "/volume/dados/.git-write-scratch" })
```

### `WriteCommit({ gitDirPath, branch, message, changes, expectedHeadOid, author, ... })`

```ts
const result = await writer.WriteCommit({
    gitDirPath      : "/volume/dados/git/<id>.git",
    branch          : "main",
    message         : "feat(hello): primeira versão",
    expectedHeadOid : "9f3c…",           // obrigatório quando o branch tem história
    author          : { name: "Kaio Cezar", email: "kaio@exemplo.local" },
    changes         : [
        { op: "put",    path: "src/Hello.js", contentBase64: "…", mode: "100644", expectedOid: "abc…" },
        { op: "delete", path: "docs",         recursive: true },
        { op: "move",   path: "src/Old.js",   newPath: "src/New.js" }
    ]
})
// → { commit: {oid, shortOid, authorName, authoredAt, subject}, ref, branch,
//     previousHeadOid, treeOid, applied, rebased }
```

Conteúdo em `contentBase64` (uma codificação só, que trata texto e binário sem
caso especial) ou em `content` (texto UTF-8, conveniência para chamada de dentro
do Node). Base64 inválido é **recusado**, não decodificado pela metade.

Semântica de `expectedOid` por mudança: string = "o arquivo tem que estar
exatamente assim"; `null` = "estou criando, ele não deve existir"; ausente =
sem verificação.

`onStale` decide o que fazer quando a ponta avançou entre a leitura e a
publicação:

- `"retryIfDisjoint"` (padrão) — se ninguém tocou nos arquivos deste change set,
  reaplica sobre a ponta nova (é o rebase que o plumbing torna barato). Se
  tocou, recusa com `STALE_HEAD` e a lista dos caminhos em conflito.
- `"reject"` — recusa qualquer avanço da ponta.

### Demais operações

| Operação | O que faz |
|---|---|
| `ResolveBranchTip({ gitDirPath, branch })` | Oid da ponta, ou `undefined`. |
| `ListBranches({ gitDirPath })` | `[{ name, oid }]`. |
| `CreateBranch({ gitDirPath, name, fromRef })` | Cria por CAS: recusa se já existe. |
| `DeleteBranch({ gitDirPath, name, expectedOid })` | Apaga por CAS: recusa se a ponta mudou. |
| `DiffPaths({ gitDirPath, fromOid, toOid })` | Caminhos que mudaram entre dois commits. |
| `CollectGarbage({ gitDirPath })` | `gc --auto`. Nunca lança. |

**Chame `CollectGarbage` depois de commitar** (e ignore o resultado). Escrita por
plumbing não passa por `receive-pack`, que é quem normalmente dispara o `gc` —
sem isso, os objetos de commits abortados acumulam para sempre.

## Erros

| `code` | `statusCode` | Quando |
|---|---|---|
| `INVALID_CHANGE` e variantes (`INVALID_PATH`, `FORBIDDEN_PATH`, `UNSUPPORTED_MODE`, `DUPLICATE_PATH`, `OVERLAPPING_PATHS`, `FILE_TOO_LARGE`, `INVALID_CONTENT_ENCODING`, `SOURCE_NOT_FOUND`, `RECURSIVE_REQUIRED`, …) | 400 | Pedido que não pode nem ser tentado. |
| `HEAD_ASSERTION_REQUIRED` | 400 | Branch com história e nenhum `expectedHeadOid`. |
| `STALE_HEAD` | 409 | A ponta avançou; traz `currentHeadOid` e `conflictingPaths`. |
| `FILE_CHANGED` | 409 | Um arquivo do change set não está no estado lido; traz `conflicts`. |
| `EMPTY_COMMIT` | 409 | A árvore resultante é idêntica à atual. |
| `GIT_RUNTIME_ERROR` | 503 | O `git` não pôde ser executado. |

## Garantias, e onde elas moram

- **`.git` em qualquer nível é recusado**, sem distinção de caixa — um commit
  trazendo `.git/hooks/post-checkout` viraria execução de código na máquina de
  quem clonasse.
- **Symlink (`120000`) e submódulo (`160000`) são recusados**: nenhum dos dois é
  editável por um editor de texto, e um link pode apontar para fora da árvore no
  checkout de terceiros.
- **Nada de shell** — `execFile`/`spawn` com argumentos em array.
- **Mensagem de commit por arquivo** (`-F`), nunca por argumento: acento, aspas,
  quebra de linha e `-` inicial são normais numa mensagem.
- **`--no-filters` no `hash-object`**: o que foi lido é byte a byte o que fica
  gravado, sem conversão de fim de linha por `.gitattributes`.
- **Bit de executável preservado** ao editar, salvo `mode` explícito.
- **O scratch some sempre** (`finally`), inclusive na recusa.

## Testes

```
npm test        # node --test test/*.test.js
```

Os testes usam repositórios bare **de verdade** em diretório temporário, e a
corrida de CAS é produzida por um `git push` real de um clone. Dublê de
`execFile` provaria apenas que os argumentos que escrevemos são os que
escrevemos — e é a leitura que o `git` faz deles que surpreende. O exemplo que
só apareceu assim: `update-index` com lista de caminhos **recusa rodar em bare**
(`fatal: this operation must be run in a work tree`), porque pathspec pressupõe
árvore de trabalho — foi o que levou ao `--index-info`, que de quebra faz o lote
inteiro num processo só.
