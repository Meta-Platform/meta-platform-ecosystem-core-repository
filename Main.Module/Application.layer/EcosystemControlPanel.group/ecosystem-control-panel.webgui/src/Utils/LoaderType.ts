// Aliases curtos para os tipos de object loader (longos) do Task Executor.
// O tipo completo deve permanecer acessível via tooltip/detalhe.
const LOADER_ALIASES:any = {
    "install-nodejs-package-dependencies": "deps install",
    "nodejs-package"                     : "node pkg",
    "application-instance"               : "app",
    "service-instance"                   : "service",
    "endpoint-instance"                  : "endpoint",
    "command-application"                : "cli app"
}

export const LoaderAlias = (objectLoaderType:string):string =>
    LOADER_ALIASES[objectLoaderType] || objectLoaderType
