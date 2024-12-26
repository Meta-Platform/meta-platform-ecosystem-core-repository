const CopyArray = (array) => [...array]

const AreArraysEqual = (array1, array2) => {

    if (array1.length !== array2.length) 
        return false

    const sortedArray1 = CopyArray(array1).sort()
    const sortedArray2 = CopyArray(array2).sort()

    for (let i = 0; i < sortedArray1.length; i++) 
        if (sortedArray1[i] !== sortedArray2[i]) 
            return false
        
    return true

}

module.exports = AreArraysEqual