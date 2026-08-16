const {
    SCHEMA_VERSION, GetMetadataSchema, GetFileSpec, ResolveFileSpecForPath,
    IsKnownMetadataFile, GetRequiredFiles
} = require("./GetMetadataSchema")
const {
    ValidateMetadataFile, ValidateMetadataCrossFile, ValidateMetadataFiles
} = require("./ValidateMetadataFile")

/*
    Porta única da lib. Consumo por `.require()` (molde da api-authoring.lib):
    não há services.json aqui, porque não há nada para instanciar — é contrato e
    função pura, e um serviço só adicionaria ciclo de vida a quem não tem estado.
*/
module.exports = {
    SCHEMA_VERSION,
    GetMetadataSchema,
    GetFileSpec,
    ResolveFileSpecForPath,
    IsKnownMetadataFile,
    GetRequiredFiles,
    ValidateMetadataFile,
    ValidateMetadataCrossFile,
    ValidateMetadataFiles
}
