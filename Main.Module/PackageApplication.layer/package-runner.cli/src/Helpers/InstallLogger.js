const { join, basename } = require("path")

/*
 * Instala o `globalThis.Log` a partir da `logger.lib` do EssentialRepo
 * instalado.
 *
 * Usa o mesmo caminho do `taskloader-registry.lib`: require() direto pelo
 * `installationPath` do repositório, e não pelo handler de pacote — o
 * `handler.require` faz `require.main.require` e mexe no NODE_PATH, o que aqui
 * traria o mesmo desalinhamento de carregamento.
 *
 * Falhar não pode impedir a execução: uma instalação anterior à `logger.lib`
 * simplesmente segue sem `globalThis.Log`.
 */
const InstallLogger = ({
    repositoriesData,
    ecosystemDefaults,
    installDataDirPath,
    packagePath
}) => {

    try {

        const essentialRepo = repositoriesData && repositoriesData.EssentialRepo

        if (!essentialRepo) {
            return null
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

    } catch (error) {
        return null
    }
}

module.exports = InstallLogger
