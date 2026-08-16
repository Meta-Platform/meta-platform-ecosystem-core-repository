import type { ExecutableDefinition } from "../Types"

const { resolve } = require("path") as typeof import("path")

const WriteObjectToFile = require("../Utils/WriteObjectToFile") as (filepath: string, objectContent: unknown) => Promise<void>

const CreateCliBootMetadataFile = async ({
    metadataDirPath,
    executablesDefinition
}: {
    metadataDirPath: string
    executablesDefinition: ExecutableDefinition[]
}) => {
    const filename = "boot.json"
    const content = {
        "executables":executablesDefinition
            .map(({executableName}) => {
                return {
                    "dependency": "@//command-group",
                    executableName
                }
            })
    }
    const filePath = resolve(metadataDirPath, filename)
    await WriteObjectToFile(filePath, content)
}

module.exports = CreateCliBootMetadataFile