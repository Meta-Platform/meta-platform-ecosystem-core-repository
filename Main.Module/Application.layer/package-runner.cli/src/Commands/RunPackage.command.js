const { resolve } = require("path")

const RunPackageCommand = async ({ args, startupParams, params }) => {
    const { packagePath } = args
    const absolutePackagePath = resolve(process.cwd(), packagePath)
    console.log("Running package at path:")
    console.log(absolutePackagePath)
}

module.exports = RunPackageCommand
