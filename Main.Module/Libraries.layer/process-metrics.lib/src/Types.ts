/** As formas que a amostragem produz e o histórico guarda. */

/** Uma amostra de um processo — ou de um grupo inteiro, ver `SampleProcessGroup`. */
export type ProcessSample = {
    pid: number
    /** 1 para um processo isolado; o tamanho do grupo, quando é um grupo. */
    processCount: number
    /** Relativo a UM núcleo: um processo multithread passa de 100. */
    cpuPercent: number
    rssBytes?: number
    threads?: number
    uptimeSeconds?: number
    ioReadBytes?: number
    ioWriteBytes?: number
}

/** Estado da máquina. Aqui `cpuPercent` é 0–100 do total de núcleos. */
export type SystemSample = {
    cpuPercent?: number
    cpuCount: number
    totalMemBytes: number
    availableMemBytes: number
    usedMemBytes: number
    loadAverage: number[]
    uptimeSeconds: number
}

/** Os campos do `/proc/<pid>/stat` que interessam. Ver `man 5 proc`. */
export type ProcStat = {
    pid: number
    state: string
    ppid: number
    pgrp: number
    utime: number
    stime: number
    numThreads: number
    starttime: number
    rssPages: number
}
