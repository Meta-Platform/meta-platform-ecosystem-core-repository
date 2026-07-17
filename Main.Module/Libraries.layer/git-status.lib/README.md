# git-status.lib

Status de git reativo e compartilhável entre apps do Meta Platform.

Lê o estado não commitado de repositórios (branch + arquivos sujos) e o propaga
para os diretórios ancestrais, de modo que qualquer nível de uma hierarquia
(pacote, group, layer, module, repositório) possa ser marcado quando contém
alterações. Um watcher de filesystem por repositório (com debounce) mantém o
status atualizado por eventos — sem polling.

## API

```js
const GetRepositoryGitStatus   = require("git-status.lib/src/GetRepositoryGitStatus")
const BuildAncestorStatusMap   = require("git-status.lib/src/BuildAncestorStatusMap")
const InitializeGitStatusManager = require("git-status.lib/src/InitializeGitStatusManager")
```

### `GetRepositoryGitStatus(repositoryPath) -> Promise<{isRepo, branch, files}>`
Nunca lança. `files` é a lista de arquivos não commitados
(`modified` / `staged` / `untracked` / `conflicted`).

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
