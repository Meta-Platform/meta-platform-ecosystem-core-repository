const CopyArray = <Item>(array: Item[]): Item[] => [...array]

const AreArraysEqual = <Item>(array1: Item[], array2: Item[]): boolean => {

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