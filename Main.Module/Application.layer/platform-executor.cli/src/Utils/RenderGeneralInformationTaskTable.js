const SmartRequire = require("./SmartRequire")

const colors = SmartRequire("colors")
const CreateAttributeTable = require("./CreateAttributeTable")
const GetColorLogByStatus = require("./GetColorLogByStatus")

const RenderGeneralInformationTaskTable = async (taskData) => {
    
    const table = CreateAttributeTable({
        colWidths: [25, 40]
    })
    table.push([{ colSpan: 2, hAlign: 'center', content: colors.bold('General Information') }])
    const propertiesMap = [
        {
            label: "Task ID",
            property: "taskId"
        },
        ...taskData.pTaskId 
            ? [
                {
                    label: "Parent Task ID",
                    property: "pTaskId"
                }
            ] 
            : [],
        {
            label: "Status",
            property: "status",
            formatter: (status) => colors[GetColorLogByStatus(status)](status)
        },
        {
            label: "Object Loader Type",
            property: "objectLoaderType"
        },
        {
            label: "has child tasks",
            property: "hasChildTasks"
        }
    ]
    propertiesMap
    .forEach(({label, property, formatter}) => {
        table
        .push([
            { hAlign: 'right', content: colors.bold.red(label) }, 
            formatter ? formatter(taskData[property]) : colors.yellow(taskData[property])
        ])
    })
    console.log(table.toString())
}

module.exports = RenderGeneralInformationTaskTable