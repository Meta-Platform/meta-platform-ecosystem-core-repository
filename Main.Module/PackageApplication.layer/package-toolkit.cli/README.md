# Package Toolkit

O Package Toolkit é uma ferramenta de linha de comando para criar diferentes tipos de pacotes no ecossistema Meta Platform.

## Comandos Disponíveis

### Criar Pacotes
```bash
# Sintaxe base para criar pacotes
mypkg create <tipo> [packageName]
```
### Tipos de Pacotes Disponíveis:
```bash
# Biblioteca
# Cria uma nova biblioteca que pode ser utilizada por outros pacotes. O parâmetro packageName define o namespace do pacote.
mypkg create library [packageName]

# Linha de Comando
# Cria um novo pacote executável via linha de comando. O parâmetro packageName define o namespace do pacote.

mypkg create commandline [packageName]

# Serviços
# Cria um novo pacote de serviços que pode ser executado como um servidor. O parâmetro packageName define o namespace do pacote.
mypkg create services [packageName]

```

### Tipos de Pacotes Disponíveis:
```bash
# Criar uma biblioteca chamada "xptop-utils"
mypkg create library xtop-utils

# Criar um pacote de linha de comando chamado "bar-cli-tool.cli"
mypkg create commandline bar-cli-tool

# Criar um pacote de serviços chamado "price-api-server.service"
mypkg create services price-api-server

```