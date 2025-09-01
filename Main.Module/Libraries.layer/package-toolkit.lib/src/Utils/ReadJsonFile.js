const fs = require("fs")

const ReadJsonFile = (path) => {
    try {
        const jsonString = fs.readFileSync(path, {encoding:'utf8'})
        return JSON.parse(jsonString)
      } catch (err) {
        console.log(err)
        return undefined
      }
}

module.exports = ReadJsonFile