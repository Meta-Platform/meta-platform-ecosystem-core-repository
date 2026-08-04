# git-status.lib

- **Tipo:** biblioteca (`.lib`)
- **Namespace:** `@/git-status.lib`
- **Localização:** `Main.Module/Libraries.layer/git-status.lib` (EcosystemCoreRepo)

## Propósito

Leitura de git compartilhável entre apps do Meta Platform — o **estado atual**
(o que está sujo agora) e o **histórico** (o que foi feito).

Lê o estado não commitado de repositórios (branch + arquivos sujos) e o propaga
para os diretórios ancestrais, de modo que qualquer nível de uma hierarquia
(pacote, group, layer, module, repositório) possa ser marcado quando contém
alterações. Um watcher de filesystem por repositório (com debounce) mantém o
status atualizado por eventos — sem polling.

## Exports (`src/`)

| Módulo | Responsabilidade |
|---|---|
| `InitializeGitStatusManager.js` | Cria o gerenciador: observa o repositório e emite mudanças de status. |
| `GetRepositoryGitStatus.js` | Lê o status git de um repositório. |
| `GetRepositoryGitLog.js` | Lê o histórico: commits por texto literal, autor e janela de tempo. |
| `GetCommitDetail.js` | Detalhe de um commit: autor, mensagem e os arquivos, com linhas somadas e removidas. |
| `RunGit.js` | Runner de `git` compartilhado pelos três leitores (buffer grande + timeout). |
| `BuildAncestorStatusMap.js` | Propaga o status dos arquivos para os diretórios ancestrais, para pintar a árvore. |
| `Services/GitStatusManager.service.js` | Expõe o gerenciador como serviço do ecossistema. |

## API

```js
const GetRepositoryGitStatus   = require("git-status.lib/src/GetRepositoryGitStatus")
const BuildAncestorStatusMap   = require("git-status.lib/src/BuildAncestorStatusMap")
const InitializeGitStatusManager = require("git-status.lib/src/InitializeGitStatusManager")
```

### `GetRepositoryGitStatus(repositoryPath) -> Promise<{isRepo, branch, files}>`
Nunca lança. `files` é a lista de arquivos não commitados
(`modified` / `staged` / `untracked` / `conflicted`).

### `GetRepositoryGitLog({repositoryPath, grep, since, until, author, paths, maxCount}) -> Promise<Array>`
Nunca lança (repositório inexistente ou intervalo vazio resolvem `[]`). `grep`
casa por texto **literal**, não regex: é o que permite procurar a chave de um
item (`"MPMR-5"`) sem que um prefixo com pontuação vire padrão. Cada commit sai
como `{hash, shortHash, authorName, authorEmail, authorDate, subject, body}`.

```js
// Todo commit que cita a chave de um item, desde que ele foi reivindicado:
const commits = await GetRepositoryGitLog({
    repositoryPath: "/caminho/do/repo",
    grep: "MPMR-5",
    since: reivindicadoEm
})
```

### `GetCommitDetail({repositoryPath, hash}) -> Promise<Detalhe|null>`
Acrescenta ao commit a lista de arquivos com `{path, status, added, deleted,
fromPath}` e os totais `insertions`/`deletions`. Arquivo binário vem com
`added: null, deleted: null` — "não dá para medir" é diferente de "não mudou".
Hash inexistente resolve `null`.

### `BuildAncestorStatusMap(repositoryPath, files) -> { [absPath]: {dirty, count, states, files} }`
Propaga cada arquivo sujo para todos os seus diretórios ancestrais até a raiz.

### `InitializeGitStatusManager() -> { Subscribe(repoList, onChange) }`
`repoList` é `[{ name, path }]`. `Subscribe` devolve
`{ GetStatus(): Promise, dispose() }`. O watcher de cada repositório vive
enquanto houver assinatura ativa (refcount). `GetStatus` sempre devolve o estado
completo (não deltas):

```js
{
  statusByPath: { [absPath]: { dirty, count, states, files } },
  repositories: { [name]: { path, isRepo, branch, dirty, count } }
}
```

## Serviços expostos (`metadata/services.json`)

| Namespace | Path | Dependências (bound-params) |
|---|---|---|
| `GitStatusManager` | `Services/GitStatusManager.service` | — |
