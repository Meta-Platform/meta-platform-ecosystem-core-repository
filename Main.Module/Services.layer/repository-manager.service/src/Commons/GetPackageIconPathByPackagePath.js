
const { promisify } = require("util")
const fs = require("fs")
const path = require("path")
const access = promisify(fs.access)

const PACKAGE_ICON_FILENAMES = ["icon.svg", "icon.png", "icon.jpg", "icon.jpeg", "icon.webp"]

GetPackageIconPathByPackagePath = (packagePath) => 
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
