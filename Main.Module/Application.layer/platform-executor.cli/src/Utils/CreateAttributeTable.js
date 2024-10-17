const SmartRequire = require("./SmartRequire")

const Table = SmartRequire("cli-table3")

const CreateAttributeTable = ({colWidths, wordWrap}) => 
    new Table({
        colWidths,
        wordWrap
    })

module.exports = CreateAttributeTable