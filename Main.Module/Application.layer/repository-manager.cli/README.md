# Repository Manager Command-line

O Repository Manager Command-line é um conjunto robusto de ferramentas de linha de comando projetado para simplificar a instalação e configuração dos diretórios

## Instalação

Para começar a usar as ferramentas de administração do Ecosistema Meta Platform no seu sistema, siga os passos abaixo:

1. Abra o terminal.
2. Execute os comandos a seguir para instalar a ferramenta e configurar os links simbólicos necessários:

```bash
npm install
npm link
```

Após a instalação, você será capaz de acessar os comandos de administração dos repositórios da Meta Platform de qualquer lugar no seu sistema.

## Comandos Disponíveis

A ferramenta oferece uma série de comandos para gerenciar diversos aspectos do ecossistema Meta Platform. Abaixo, você encontrará uma descrição detalhada de cada comando e exemplos de uso.

### Gerenciamento de Repositórios

**Registrar um Novo Repositório**
  ```bash
  myrepo register [REPO_NAMESPACE] [REPO_PATH]
  # Exemplo:
  myrepo register Miscellaneous ~/Workspaces/my-platform-reference-distro/repos/Miscellaneous
  ```

### Listagem de Componentes

**Listar Repositórios Registrados**
  ```bash
  myrepo repositories
  ```

**Listar Módulos**
  ```bash
  myrepo modules
  ```

**Listar Camadas**
  ```bash
  myrepo layers
  ```

**Listar Pacotes**
  ```bash
  myrepo packages
  ```