const SmartRequire = require("./SmartRequire")

const colors = SmartRequire("colors")
const CreateAttributeTable = require("./CreateAttributeTable")

const RenderActivationRulesTaskTable = async (activationRules) => {
    
    const table = CreateAttributeTable({
        colWidths: [50]
    })
    table.push([{ hAlign: 'center', content: colors.bold('Activation Rules') }])
    const boolOperators = Object.keys(activationRules)
    const _RenderRuleRow = (rule) => {
        const operator = Object.keys(rule).filter((ruleField) => ruleField !== "property")[0]
        const content = `${ colors.cyan(rule.property)} ${ colors.bold.magenta(operator)} ${ colors.gray(rule[operator])}`
        const ruleColumn = { hAlign: 'center', content }
        table.push([ruleColumn])
    }
    boolOperators
    .forEach((operator) => {
        const rules = activationRules[operator]
        rules.forEach((rule, ruleIndex) => {
            _RenderRuleRow(rule)
            if(ruleIndex < rules.length - 1){
                table.push([{ hAlign: 'center', content: colors.bold.magenta(operator) }])
            }
        })
    })
    console.log(table.toString())
}

module.exports = RenderActivationRulesTaskTable