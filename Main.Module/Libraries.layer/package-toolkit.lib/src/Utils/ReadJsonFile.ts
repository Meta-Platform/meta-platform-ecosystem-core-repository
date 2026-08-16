const fs = require("fs") as typeof import("fs")

const ReadJsonFile = (path: string): any => {
    try {
        const jsonString = fs.readFileSync(path, {encoding:'utf8'})
        return JSON.parse(jsonString)
      } catch (err) {
        return undefined
      }
}

module.exports = ReadJsonFile