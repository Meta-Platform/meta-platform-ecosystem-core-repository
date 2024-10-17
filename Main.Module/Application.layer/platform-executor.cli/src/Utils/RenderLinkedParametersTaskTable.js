const SmartRequire = require("./SmartRequire")

const colors = SmartRequire("colors")
const CreateAttributeTable = require("./CreateAttributeTable")

const RenderLinkedParametersTaskTable = async (linkedParameters) => {
    
    const table = CreateAttributeTable({
        colWidths: [45, 80]
    })
    table.push([{ colSpan: 2, hAlign: 'center', content: colors.bold('Linked Parameters') }])
    const paramNameList = Object.keys(linkedParameters)
    paramNameList
    .forEach((paramName) => {
        table
        .push([{ vAlign:"center", hAlign: 'right', content: colors.bold.blue(paramName) }, colors.yellow(JSON.stringify(linkedParameters[paramName], null, 4))])
    })
    console.log(table.toString())
}
module.exports = RenderLinkedParametersTaskTable