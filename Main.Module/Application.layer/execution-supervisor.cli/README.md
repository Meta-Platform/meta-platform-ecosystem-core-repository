# Execution Supervisor

Ferramenta para monitoramento e supervisão de uma instancia sendo executa pelo package-executor, acessando a instancia atraves do arquivo .sock especificado na hora da execução do package executor.

## Instalação

Para começar a usar o Daemon Management Command-line do Meta Platform no seu sistema, siga os passos abaixo:

1. Abra o terminal.
2. Execute os comandos a seguir para instalar a ferramenta e configurar os links simbólicos necessários:

```bash
npm install
npm link
```

Após a instalação, você será capaz de acessar os comandos do Daemon Management do Meta Platform de qualquer lugar no seu sistema.

## Comandos Disponíveis

A ferramenta oferece uma série de comandos para gerenciar diversos aspectos do Daemon. Abaixo, você encontrará uma descrição detalhada de cada comando e exemplos de uso.


### Gerenciamento de um instancia do package-executor

```bash

# Mostrar status do execução do pacote
mysup status

# Visualiza o log do daemon
mysup log

# Reiniciar o Daemon do Ecossistema
mysup restart -> vai para o ecosystem-instance-manager

# Interromper o Daemon do Ecossistema
mysup kill -> vai para o ecosystem-instance-manager

# Listar Tarefas no Task Executor do Daemon**
mysup tasks

# Obter Informações sobre uma Tarefa Específica do Daemon  
mysup show task [TASK_ID]
```