
const { promisify } = require("util") as typeof import("util")
const fs = require("fs") as typeof import("fs")
const path = require("path") as typeof import("path")
const access = promisify(fs.access)

const PACKAGE_ICON_FILENAMES = ["icon.svg", "icon.png", "icon.jpg", "icon.jpeg", "icon.webp"]

// Faltava o `const`: sem ele a função era atribuída ao objeto global. Num
// módulo TypeScript isso nem compila — e a declaração local não muda nada para
// quem a consome, que sempre veio pelo module.exports abaixo.
const GetPackageIconPathByPackagePath = (packagePath: string): Promise<string> =>
    new Promise(async (resolve, reject) => {
        for(const iconFilename of PACKAGE_ICON_FILENAMES){
            const iconPath = path.resolve(packagePath, iconFilename)
            try{
                await access(iconPath, fs.constants.F_OK)
                resolve(iconPath)
                return
            }catch(e){}
        }

        reject("icon not found!")
    })
        
module.exports = GetPackageIconPathByPackagePath
