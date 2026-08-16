/**
 * As definições que o toolkit recebe para gerar um pacote novo.
 *
 * São o que a interface do Package Developer coleta antes de escrever
 * qualquer arquivo — descritas aqui uma vez, e não reinventadas em cada
 * helper que as recebe de passagem.
 */

export type CommandDefinition = {
    namespace: string
    command: string
    description?: string
}

export type ExecutableDefinition = {
    executableName: string
    commands: CommandDefinition[]
}

export type ServiceDefinition = {
    namespace: string
    params: string[]
    boundParams: string[]
}
