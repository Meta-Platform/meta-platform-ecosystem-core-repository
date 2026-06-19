// Abrevia um identificador longo preservando início e fim: 437674a…48496
export const ShortId = (id:string, head = 6, tail = 5):string => {
    if(!id) return ""
    if(id.length <= head + tail + 1) return id
    return `${id.slice(0, head)}…${id.slice(-tail)}`
}

// Trunca no meio preservando início e fim, útil para paths/sockets longos.
export const TruncateMiddle = (value:string, max = 42):string => {
    if(!value || value.length <= max) return value
    const head = Math.ceil((max - 1) / 2)
    const tail = Math.floor((max - 1) / 2)
    return `${value.slice(0, head)}…${value.slice(-tail)}`
}
