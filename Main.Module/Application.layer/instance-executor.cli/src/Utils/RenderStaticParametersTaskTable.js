const SmartRequire = require("./SmartRequire")

const colors = SmartRequire("colors")
const CreateAttributeTable = require("./CreateAttributeTable")

const RenderStaticParametersTaskTable = async (staticParameters) => {
    
    const table = CreateAttributeTable({
        colWidths: [40, 100],
        wordWrap: true
    })
    table.push([{ colSpan: 2, hAlign: 'center', content: colors.bold('Static Parameters') }])
    const paramNameList = Object.keys(staticParameters)
    paramNameList
    .forEach((paramName) => {
        table
        .push([{ vAlign:"center", hAlign: 'right', content: colors.bold.blue(paramName) }, colors.yellow(JSON.stringify(staticParameters[paramName], null, 4))])
    })
    console.log(table.toString())
}

module.exports = RenderStaticParametersTaskTable