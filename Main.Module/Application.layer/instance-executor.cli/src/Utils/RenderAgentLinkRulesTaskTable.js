const SmartRequire = require("./SmartRequire")

const colors = SmartRequire("colors")
const CreateAttributeTable = require("./CreateAttributeTable")

const RenderAgentLinkRulesTaskTable = async (agentLinkRules) => {
    
    const table = CreateAttributeTable({
        colWidths: [50, 50]
    })
    table.push([{ colSpan: 2, hAlign: 'center', content: colors.bold('Agent Link Rules') }])
    table.push([
        { hAlign: 'center', content: colors.red('Reference Name') },
        { hAlign: 'center', content: colors.red('Requirement') }
    ])
    agentLinkRules.forEach(({referenceName, requirement}) => {
        const boolOperators = Object.keys(requirement)
        const _RenderRuleRow = ({ 
            totalRules,
            referenceName,
            ruleIndex, 
            rule,
        }) => {
            const operator = Object.keys(rule).filter((ruleField) => ruleField !== "property")[0]
            const content = `${ colors.cyan(rule.property)} ${ colors.bold.magenta(operator)} ${ colors.gray(rule[operator])}`
            const referenceNameColumn = { rowSpan: totalRules+(totalRules>1?1:0), vAlign:'center', hAlign: 'center', content: colors.bold.blue(referenceName) }
            const ruleColumn = { hAlign: 'center', content }
    
            if(ruleIndex === 0){
                table.push([referenceNameColumn, ruleColumn])
            }else {
                table.push([ruleColumn])
            }
        }
        boolOperators
        .forEach((operator) => {
            const rules = requirement[operator]
            rules.forEach((rule, ruleIndex) => {
                _RenderRuleRow({ 
                    totalRules:rules.length,
                    referenceName, 
                    ruleIndex, 
                    rule
                })
                if(ruleIndex < rules.length - 1){
                    table.push([{ hAlign: 'center', content: colors.bold.magenta(operator) }])
                }
            })
        })
    })
   console.log(table.toString())
}

module.exports = RenderAgentLinkRulesTaskTable