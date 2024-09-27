const { AutoComplete } = require('enquirer')

const PackageChoiceTerminalView = (packageChoices) => {    

    const prompt = new AutoComplete({
        name: 'Package',
        message: 'Choose which package will execute',
        choices: packageChoices.map(({namespace}) => namespace)
    })

    return prompt.run()
}
module.exports = PackageChoiceTerminalView