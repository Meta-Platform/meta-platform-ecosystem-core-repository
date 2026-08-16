const { AutoComplete } = require('enquirer')

const PackageChoiceTerminalView = (packageChoices: any) => {    

    const prompt = new AutoComplete({
        name: 'Package',
        message: 'Choose which package will execute',
        choices: packageChoices.map(({namespace}: any) => namespace)
    })

    return prompt.run()
}
module.exports = PackageChoiceTerminalView