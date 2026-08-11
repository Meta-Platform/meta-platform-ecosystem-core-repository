import * as React from "react"
import { useState, useEffect } from "react"

import {
    Button,
    ButtonGroup,
    Dialog,
    EmptyState,
    Icon,
    IconButton,
    PageMasthead,
    SearchInput,
    SkeletonList,
    SystemBanner,
    TextInput
} from "@i-components"

import GetAPI from "../../Utils/GetAPI"
import CopyValue from "../../Components/CopyValue"
import { toastSuccess, toastError, errorMessage } from "../../Utils/toast"

const IsScalar = (value:any) =>
    value === null || ["string", "number", "boolean"].includes(typeof value)

// Prefixo de domínio da variável (ex.: REPOS_CONF_... -> "REPOS").
const GetPrefix = (key:string) => {
    const i = key.indexOf("_")
    return i > 0 ? key.slice(0, i) : "OUTROS"
}

// Tipagem visual do valor (path/file/bool/number/list/string).
const GetValueType = (value:any) => {
    if(typeof value === "boolean") return "bool"
    if(typeof value === "number")  return "number"
    if(Array.isArray(value))       return "list"
    if(value && typeof value === "object") return "object"
    const s = String(value)
    if(s.includes("|")) return "list"
    if(/\.[a-z0-9]+$/i.test(s) && !s.includes(" ") && !s.includes("/")) return "file"
    if(s.startsWith("/") || s.startsWith("~") || s.includes("/")) return "path"
    return "string"
}

// A cor por tipo saiu do `color` do Label e virou classe de produto
// (.ecp-vtype--*), pintada só com tokens --mp-*.
const ValueTypeBadge = ({ value }:any) => {
    const t = GetValueType(value)
    return <span className={`ecp-vtype ecp-vtype--${t}`}>{t}</span>
}

const RenderReadValue = (value:any) => {
    if(value === null || value === undefined)
        return <i className="ecp-cfg-null">—</i>
    if(typeof value === "object")
        return <code className="ecp-cfg-value ecp-cfg-value--block">{JSON.stringify(value, null, 2)}</code>
    return <code className="ecp-cfg-value">{String(value)}</code>
}

// Títulos amigáveis por arquivo de configuração.
const GetConfigTitle = (configFileName?:string) => {
    if(!configFileName) return "Ecosystem Parameter Default"
    if(configFileName === "ecosystem-defaults.json") return "Ecosystem Parameter Default"
    return configFileName
}

const ConfirmSaveModal = ({ configFileName, paramName, newValue, onCancel, onConfirm, isSaving }:any) =>
    <Dialog
        open={true}
        size="sm"
        icon="warning sign"
        title="Confirm change"
        onClose={onCancel}
        actions={<>
            <Button onClick={onCancel} disabled={isSaving}>cancel</Button>
            <Button variant="primary" icon="save" loading={isSaving} onClick={onConfirm}>save variable</Button>
        </>}>
        <p>
            Change <strong>{paramName}</strong> in <strong>{configFileName}</strong> to
            <code className="ecp-cfg-value ecp-cfg-value--inline">{String(newValue)}</code>?
        </p>
        <p className="ecp-cfg-warn">
            <Icon name="warning sign"/>
            Config changes can <strong>impact or break the ecosystem</strong> and affect running instances.
        </p>
    </Dialog>

const RegistryShell = ({ children }:any) =>
    <div className="ecp-cfg-shell">{children}</div>

// Faixa enxuta: sem o bloco de título grande (o nome da seção já está no header
// superior). Mantém só um ícone, o nome do arquivo pequeno e o badge de estado.
const RegistryHeader = ({ title, subtitle, canEdit }:any) =>
    <div className="ecp-cfg-filehead">
        <Icon
            name={canEdit ? "edit" : "file alternate outline"}
            tone={canEdit ? "success" : "muted"}/>
        <div className="ecp-cfg-filehead__names">
            <strong className="ecp-cfg-filehead__title">{title}</strong>
            <span className="ecp-cfg-filehead__subtitle">{subtitle}</span>
        </div>
        <span className={`ecp-flag ${canEdit ? "ecp-flag--ok" : ""}`.trim()}>
            {canEdit ? "editable" : "read-only"}
        </span>
    </div>

const RegistryToolbar = ({ children }:any) =>
    <div className="ecp-cfg-toolbar">{children}</div>

// Grupo colapsável: o kit não tem Accordion; o padrão do guia é botão subtle +
// bloco condicional (o CSS do grupo é de produto, .ecp-cfg-group*).
const RegistryGroupHeader = ({ name, count, isClosed, onToggle }:any) =>
    <button
        type="button"
        className="mp-button mp-button--subtle mp-button--sm ecp-cfg-group__head"
        aria-expanded={!isClosed}
        onClick={onToggle}>
        <Icon name={isClosed ? "caret right" : "caret down"} tone="muted"/>
        <Icon name="folder open outline"/>
        <strong className="ecp-cfg-group__name">{name}</strong>
        <span className="ecp-count">{count}</span>
    </button>

const RegistrySubGroupHeader = ({ label, count, isClosed, onToggle }:any) =>
    <button
        type="button"
        className="mp-button mp-button--subtle mp-button--sm ecp-cfg-group__head ecp-cfg-group__head--sub"
        aria-expanded={!isClosed}
        onClick={onToggle}>
        <Icon name={isClosed ? "caret right" : "caret down"} tone="muted"/>
        <span className="ecp-cfg-subgroup__tag">subkey</span>
        <strong className="ecp-cfg-subgroup__name">{label}</strong>
        <span className="ecp-count">{count}</span>
    </button>

const RegistryTable = ({ children }:any) =>
    <div className="mp-table-wrap ecp-cfg-tablewrap">
        <table className="mp-table is-dense">
            <tbody>{children}</tbody>
        </table>
    </div>

const ConfigFilesContainer = ({ serverManagerInformation, configFileName }:any) => {

    const [ ecosystemDefaults, setEcosystemDefaults ] = useState<any>()
    const [ configFileContent, setConfigFileContent ] = useState<any>()
    const [ isLoading, setIsLoading ]                 = useState(true)

    // Edição por variável: apenas uma chave por vez.
    const [ editingKey, setEditingKey ]   = useState<string | undefined>()
    const [ draftValue, setDraftValue ]   = useState<string>("")
    const [ pendingSave, setPendingSave ] = useState<any>()
    const [ isSaving, setIsSaving ]       = useState(false)

    const [ filterValue, setFilterValue ] = useState<string>("")
    const [ closedGroups, setClosedGroups ] = useState<any>({})

    const _GetConfigurationsAPI = () =>
        GetAPI({ apiName: "Configurations", serverManagerInformation })

    useEffect(() => {
        setIsLoading(true)
        setEditingKey(undefined)
        if(configFileName)
            fetchConfigFile()
        else
            fetchEcosystemDefaults()
    }, [configFileName])

    const fetchEcosystemDefaults = async () => {
        try {
            const response = await _GetConfigurationsAPI().GetDefaultEcosystemParameters()
            setEcosystemDefaults(response.data)
        } catch(e) { console.log(e) } finally { setIsLoading(false) }
    }

    const fetchConfigFile = async () => {
        try {
            const response = await _GetConfigurationsAPI().GetConfigFile({ configFileName })
            setConfigFileContent(response.data.content)
        } catch(e) { console.log(e) } finally { setIsLoading(false) }
    }

    const currentContent = (configFileName ? configFileContent : ecosystemDefaults) || {}
    const canEdit = !!configFileName

    const startEdit = (key:string) => {
        setEditingKey(key)
        setDraftValue(currentContent[key] === undefined ? "" : String(currentContent[key]))
    }

    const cancelEdit = () => {
        setEditingKey(undefined)
        setDraftValue("")
    }

    // Mantém o tipo original (number/boolean) ao gravar.
    const _CoerceValue = (raw:string, original:any) => {
        if(typeof original === "number" && raw.trim() !== "" && !isNaN(Number(raw))) return Number(raw)
        if(typeof original === "boolean") return raw === "true"
        return raw
    }

    const requestSave = (key:string) =>
        setPendingSave({ key, value: _CoerceValue(draftValue, currentContent[key]) })

    const confirmSave = async () => {
        try {
            setIsSaving(true)
            const newContent = { ...currentContent, [pendingSave.key]: pendingSave.value }
            await _GetConfigurationsAPI().SaveConfigFile({ configFileName, content: newContent })
            setConfigFileContent(newContent)
            const savedKey = pendingSave.key
            setPendingSave(undefined)
            setEditingKey(undefined)
            toastSuccess(`${savedKey} atualizado`)
        } catch(e) { toastError(errorMessage(e)) } finally { setIsSaving(false) }
    }

    return <div className="ecp-cfg-page">
        <PageMasthead
            icon="cogs"
            title="Config Files"
            subtitle="Edit ecosystem default parameters and configuration files."/>
        <RegistryShell>
            <RegistryHeader
                title={GetConfigTitle(configFileName)}
                subtitle={`config-files / ${configFileName || "ecosystem-defaults.json"}`}
                canEdit={canEdit}/>
            <RegistryToolbar>
                <SystemBanner
                    tone={canEdit ? "info" : "readonly"}
                    icon={canEdit ? "edit" : "lock"}
                    title="parameter editor"
                    className="ecp-cfg-banner">
                    { canEdit
                        ? "Edit one value at a time. Confirmation is required because these keys can change ecosystem behavior."
                        : "This file is read-only. Open another file to edit." }
                </SystemBanner>
                <SearchInput
                    className="ecp-cfg-search"
                    placeholder="filter parameters..."
                    value={filterValue}
                    onValueChange={(value:string) => setFilterValue(value)}/>
            </RegistryToolbar>

        {
            isLoading
            ? <div className="ecp-cfg-loading"><SkeletonList rows={10}/></div>
            : (() => {
                const renderRow = (key:string, stripPrefix?:string) => {
                    const isEditingThis = editingKey === key
                    const editable = canEdit && IsScalar(currentContent[key])
                    const prefix = stripPrefix !== undefined ? stripPrefix : GetPrefix(key)
                    const shortName = (prefix && key.startsWith(prefix + "_")) ? key.slice(prefix.length + 1) : key
                    return <tr key={key} className={isEditingThis ? "is-selected" : undefined}>
                        <td>
                            <span className="ecp-cfg-key">
                                <Icon name="key" tone="muted"/>
                                <span className="ecp-cfg-key__prefix">*_</span>
                                <strong title={key} className="ecp-cfg-key__name">{shortName}</strong>
                            </span>
                        </td>
                        <td className="ecp-cfg-col-type">
                            <ValueTypeBadge value={currentContent[key]}/>
                        </td>
                        <td>
                            {
                                isEditingThis
                                ? <TextInput
                                    className="ecp-cfg-input"
                                    autoFocus
                                    value={draftValue}
                                    onChange={(event:any) => setDraftValue(event.target.value)}/>
                                : <span className="ecp-cfg-readvalue">
                                    {RenderReadValue(currentContent[key])}
                                    { IsScalar(currentContent[key]) && currentContent[key] != null && <CopyValue value={String(currentContent[key])}/> }
                                </span>
                            }
                        </td>
                        {
                            canEdit && <td className="ecp-cfg-col-actions">
                                {
                                    isEditingThis
                                    ? <ButtonGroup>
                                        <IconButton icon="check" label="save variable" variant="primary" size="sm" onClick={() => requestSave(key)}/>
                                        <IconButton icon="close" label="cancel edit" variant="default" size="sm" onClick={cancelEdit}/>
                                    </ButtonGroup>
                                    : editable
                                        ? <IconButton icon="pencil" label={`edit ${key}`} size="sm" onClick={() => startEdit(key)} disabled={!!editingKey}/>
                                        : <Icon name="lock" tone="muted"/>
                                }
                            </td>
                        }
                    </tr>
                }

                const lowerFilter = filterValue.toLowerCase()
                const keys = Object.keys(currentContent)
                    .filter((k) => !filterValue || `${k} ${String(currentContent[k])}`.toLowerCase().includes(lowerFilter))
                const groups = keys.reduce((acc:any, k:string) => {
                    const p = GetPrefix(k)
                    ;(acc[p] = acc[p] || []).push(k)
                    return acc
                }, {})
                const groupNames = Object.keys(groups).sort()

                // Dentro de um grupo, sub-agrupa pelos 2 primeiros tokens do
                // restante (ex.: CONF_DIRNAME, CONF_FILENAME) quando houver >=2
                // chaves; as que não repetem ficam numa lista normal abaixo.
                const buildSubGroups = (groupName:string, groupKeys:string[]) => {
                    const subPrefixOf = (k:string) => {
                        if(!k.startsWith(groupName + "_")) return null
                        const tokens = k.slice(groupName.length + 1).split("_")
                        if(tokens.length <= 2) return null
                        return tokens.slice(0, 2).join("_")
                    }
                    const counts:any = {}
                    groupKeys.forEach((k) => { const sp = subPrefixOf(k); if(sp) counts[sp] = (counts[sp] || 0) + 1 })
                    const subGroups:any[] = []
                    const flat:string[] = []
                    const seen:any = {}
                    groupKeys.forEach((k) => {
                        const sp = subPrefixOf(k)
                        if(sp && counts[sp] >= 2){
                            if(!seen[sp]){ seen[sp] = []; subGroups.push({ subPrefix: sp, keys: seen[sp] }) }
                            seen[sp].push(k)
                        } else flat.push(k)
                    })
                    return { subGroups, flat }
                }

                const renderTable = (rowKeys:string[], stripPrefix:string) =>
                    <RegistryTable>
                        { rowKeys.map((k:string) => renderRow(k, stripPrefix)) }
                    </RegistryTable>

                return <>
                    {
                        groupNames.map((groupName:string) => {
                            const isClosed = closedGroups[groupName]
                            return <div key={groupName} className="ecp-cfg-group">
                                <RegistryGroupHeader
                                    name={groupName}
                                    count={groups[groupName].length}
                                    isClosed={isClosed}
                                    onToggle={() => setClosedGroups({ ...closedGroups, [groupName]: !isClosed })}/>
                                {
                                    !isClosed && (() => {
                                        const { subGroups, flat } = buildSubGroups(groupName, groups[groupName])
                                        return <div className="ecp-cfg-group__body">
                                            {
                                                subGroups.map((sg:any) => {
                                                    const subKey = `${groupName}/${sg.subPrefix}`
                                                    const subClosed = closedGroups[subKey]
                                                    return <div key={subKey} className="ecp-cfg-subgroup">
                                                        <RegistrySubGroupHeader
                                                            label={sg.subPrefix}
                                                            count={sg.keys.length}
                                                            isClosed={subClosed}
                                                            onToggle={() => setClosedGroups({ ...closedGroups, [subKey]: !subClosed })}/>
                                                        { !subClosed && renderTable(sg.keys, `${groupName}_${sg.subPrefix}`) }
                                                    </div>
                                                })
                                            }
                                            { flat.length > 0 && renderTable(flat, groupName) }
                                        </div>
                                    })()
                                }
                            </div>
                        })
                    }
                    { groupNames.length === 0 && <EmptyState icon="filter" message="no parameters match the filter"/> }
                </>
            })()
        }

        {
            pendingSave && <ConfirmSaveModal
                configFileName={configFileName}
                paramName={pendingSave.key}
                newValue={pendingSave.value}
                isSaving={isSaving}
                onCancel={() => setPendingSave(undefined)}
                onConfirm={confirmSave}/>
        }
        </RegistryShell>
    </div>
}

export default ConfigFilesContainer
