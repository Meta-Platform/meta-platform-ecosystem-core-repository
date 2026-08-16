const { join, basename } = require("path")

const EnsureMinimalLogger = require("./EnsureMinimalLogger")

/*
 * Instala o `globalThis.Log` a partir da `logger.lib` do EssentialRepo
 * instalado.
 *
 * Usa o mesmo caminho do `taskloader-registry.lib`: require() direto pelo
 * `installationPath` do repositório, e não pelo handler de pacote — o
 * `handler.require` faz `require.main.require` e mexe no NODE_PATH, o que aqui
 * traria o mesmo desalinhamento de carregamento.
 *
 * Falhar não pode impedir a execução — mas também não pode deixar o processo sem
 * `globalThis.Log` (VDRP-275). O ecossistema chama `Log.<nível>` direto, sem
 * guarda, então "seguir sem o global" transformava qualquer log posterior em
 * `ReferenceError: Log is not defined`; dentro de um `catch`, isso APAGA a causa
 * real da falha. Em 29/07/2026 esse padrão travou o provisionamento do
 * VirtualDesk por quase 24 horas.
 *
 * Por isso todo caminho de saída garante um logger: o canônico quando dá, o
 * mínimo local quando não dá.
 */
const InstallLogger = ({
    repositoriesData,
    ecosystemDefaults,
    installDataDirPath,
    packagePath
}: any) => {

    try {

        const essentialRepo = repositoriesData && repositoriesData.EssentialRepo

        if (!essentialRepo) {
            return EnsureMinimalLogger()
        }

        const InstallGlobalLogger = require(join(
            essentialRepo.installationPath,
            "Commons.Module/Libraries.layer/logger.lib/src/InstallGlobalLogger"))

        const {
            LOG_CONF_DIRNAME_LOGS,
            LOG_CONF_LEVEL,
            LOG_CONF_CONSOLE_LEVEL,
            LOG_CONF_MAX_FILE_SIZE_MB,
            LOG_CONF_RETENTION_DAYS
        } = ecosystemDefaults || {}

        return InstallGlobalLogger({
            origin        : "package-runner",
            package       : packagePath ? basename(packagePath) : null,
            logsDirPath   : join(installDataDirPath, LOG_CONF_DIRNAME_LOGS || "logs", "ecosystem"),
            level         : LOG_CONF_LEVEL,
            consoleLevel  : LOG_CONF_CONSOLE_LEVEL,
            maxFileSizeMb : LOG_CONF_MAX_FILE_SIZE_MB,
            retentionDays : LOG_CONF_RETENTION_DAYS
        })

    } catch(error: any) {
        /* A lib canônica não pôde ser carregada (essential anterior à
           `logger.lib`, caminho que não resolve, instalação a meio caminho).
           O mínimo local mantém o contrato do global de pé. */
        return EnsureMinimalLogger()
    }
}

module.exports = InstallLogger
