import * as React from "react"
import { useState, useEffect } from "react"

import {
    Button,
    Header,
    Icon,
    Input,
    Label,
    Loader,
    Message,
    Modal,
    Segment,
    Table
} from "semantic-ui-react"

import GetAPI from "../../Utils/GetAPI"
import CopyValue from "../../Components/CopyValue"
import ListSkeleton from "../../Components/Skeleton"
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
const VALUE_TYPE_COLOR:any = { bool: "teal", number: "blue", list: "purple", object: "grey", file: "orange", path: "olive", string: "grey" }
const ValueTypeBadge = ({ value }:any) => {
    const t = GetValueType(value)
    return <Label size="mini" basic color={VALUE_TYPE_COLOR[t]}>{t}</Label>
}

const RenderReadValue = (value:any) => {
    if(value === null || value === undefined)
        return <i style={{ color: "grey" }}>—</i>
    if(typeof value === "object")
        return <code style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(value, null, 2)}</code>
    return <code>{String(value)}</code>
}

// Títulos amigáveis por arquivo de configuração.
const GetConfigTitle = (configFileName?:string) => {
    if(!configFileName) return "Ecosystem Parameter Default"
    if(configFileName === "ecosystem-defaults.json") return "Ecosystem Parameter Default"
    return configFileName
}

const ConfirmSaveModal = ({ configFileName, paramName, newValue, onCancel, onConfirm, isSaving }:any) =>
    <Modal size="small" open={true} onClose={onCancel}>
        <Modal.Header><Icon name="warning sign" color="orange"/> Confirmar alteração</Modal.Header>
        <Modal.Content>
            <p>
                Alterar <strong>{paramName}</strong> em <strong>{configFileName}</strong> para
                <code style={{ marginLeft: "6px" }}>{String(newValue)}</code>?
            </p>
            <p style={{ color: "#9f6000" }}>
                <Icon name="warning sign"/>
                Alterações de configuração podem <strong>impactar ou quebrar o ecossistema</strong> e afetar instâncias em execução.
            </p>
        </Modal.Content>
        <Modal.Actions>
            <Button onClick={onCancel} disabled={isSaving}>cancelar</Button>
            <Button color="orange" loading={isSaving} onClick={onConfirm}>
                <Icon name="save"/> salvar variável
            </Button>
        </Modal.Actions>
    </Modal>

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

    return <Segment style={{ margin: "15px" }}>
        <Header>
            <Icon name="cogs"/>
            <Header.Content>
                { GetConfigTitle(configFileName) }
                <Header.Subheader>config-files / { configFileName || "ecosystem-defaults.json" }</Header.Subheader>
            </Header.Content>
        </Header>

        <Message info icon size="small">
            <Icon name="lock"/>
            <Message.Content>
                <Message.Header>Edição variável a variável</Message.Header>
                { canEdit
                    ? "Edite uma variável por vez (ícone de lápis). Cada alteração pede confirmação — pode impactar/quebrar o ecossistema."
                    : "Selecione um arquivo na árvore para editar." }
            </Message.Content>
        </Message>

        {
            isLoading
            ? <ListSkeleton lines={10}/>
            : (() => {
                const renderRow = (key:string, stripPrefix?:string) => {
                    const isEditingThis = editingKey === key
                    const editable = canEdit && IsScalar(currentContent[key])
                    const prefix = stripPrefix !== undefined ? stripPrefix : GetPrefix(key)
                    const shortName = (prefix && key.startsWith(prefix + "_")) ? key.slice(prefix.length + 1) : key
                    return <Table.Row key={key} active={isEditingThis}>
                        <Table.Cell>
                            <Icon name="key" style={{ color: "#aaa" }}/>
                            <span style={{ color: "#bbb", fontFamily: "monospace", fontSize: ".92em" }}>*_</span>
                            <strong title={key} style={{ fontFamily: "monospace", fontSize: ".92em" }}>{shortName}</strong>
                        </Table.Cell>
                        <Table.Cell width={2}><ValueTypeBadge value={currentContent[key]}/></Table.Cell>
                        <Table.Cell>
                            {
                                isEditingThis
                                ? <Input fluid size="small" autoFocus value={draftValue} onChange={(e, { value }) => setDraftValue(value)}/>
                                : <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                    {RenderReadValue(currentContent[key])}
                                    { IsScalar(currentContent[key]) && currentContent[key] != null && <CopyValue value={String(currentContent[key])}/> }
                                </span>
                            }
                        </Table.Cell>
                        {
                            canEdit && <Table.Cell textAlign="center" width={2}>
                                {
                                    isEditingThis
                                    ? <Button.Group size="mini">
                                        <Button icon color="green" onClick={() => requestSave(key)}><Icon name="check"/></Button>
                                        <Button icon onClick={cancelEdit}><Icon name="close"/></Button>
                                    </Button.Group>
                                    : editable
                                        ? <Button icon size="mini" basic onClick={() => startEdit(key)} disabled={!!editingKey}><Icon name="pencil"/></Button>
                                        : <Icon name="lock" style={{ color: "#ccc" }}/>
                                }
                            </Table.Cell>
                        }
                    </Table.Row>
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
                    <Table basic striped compact unstackable style={{ marginTop: "4px" }}>
                        <Table.Body>{ rowKeys.map((k:string) => renderRow(k, stripPrefix)) }</Table.Body>
                    </Table>

                return <>
                    <Input
                        icon="search"
                        size="small"
                        placeholder="filtrar parâmetros..."
                        value={filterValue}
                        onChange={(e, { value }) => setFilterValue(value)}
                        style={{ marginBottom: "10px", maxWidth: "360px" }}/>
                    {
                        groupNames.map((groupName:string) => {
                            const isClosed = closedGroups[groupName]
                            return <div key={groupName} style={{ marginBottom: "10px" }}>
                                <div
                                    onClick={() => setClosedGroups({ ...closedGroups, [groupName]: !isClosed })}
                                    style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 8px", cursor: "pointer", background: "#f0f2f5", borderRadius: "6px" }}>
                                    <Icon name={isClosed ? "caret right" : "caret down"} style={{ color: "#888" }}/>
                                    <strong>{groupName}</strong>
                                    <Label circular size="mini">{groups[groupName].length}</Label>
                                </div>
                                {
                                    !isClosed && (() => {
                                        const { subGroups, flat } = buildSubGroups(groupName, groups[groupName])
                                        return <div style={{ marginTop: "4px" }}>
                                            {
                                                subGroups.map((sg:any) => {
                                                    const subKey = `${groupName}/${sg.subPrefix}`
                                                    const subClosed = closedGroups[subKey]
                                                    return <div key={subKey} style={{ marginLeft: "16px", marginTop: "6px" }}>
                                                        <div
                                                            onClick={() => setClosedGroups({ ...closedGroups, [subKey]: !subClosed })}
                                                            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "4px 8px", cursor: "pointer", background: "#f6f7f9", borderRadius: "6px" }}>
                                                            <Icon name={subClosed ? "caret right" : "caret down"} style={{ color: "#999" }}/>
                                                            <span style={{ color: "#bbb", fontFamily: "monospace", fontSize: ".82em" }}>*_</span>
                                                            <strong style={{ fontFamily: "monospace", fontSize: ".86em" }}>{sg.subPrefix}</strong>
                                                            <Label circular size="mini">{sg.keys.length}</Label>
                                                        </div>
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
                    { groupNames.length === 0 && <div style={{ color: "#bbb", padding: "16px" }}>nenhum parâmetro corresponde ao filtro</div> }
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
    </Segment>
}

export default ConfigFilesContainer
