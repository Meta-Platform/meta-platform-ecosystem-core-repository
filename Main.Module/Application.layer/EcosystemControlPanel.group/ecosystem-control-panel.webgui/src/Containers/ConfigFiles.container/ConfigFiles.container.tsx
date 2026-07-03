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

const RegistryShell = ({ children }:any) =>
    <div style={{
        border: "1px solid #cfd6de",
        borderRadius: "8px",
        overflow: "hidden",
        background: "#f8fafc",
        boxShadow: "0 1px 2px rgba(15, 23, 42, .08)"
    }}>
        {children}
    </div>

// Faixa enxuta: sem o bloco de título grande (o nome da seção já está no header
// superior). Mantém só um ícone, o nome do arquivo pequeno e o badge de estado.
const RegistryHeader = ({ title, subtitle, canEdit }:any) =>
    <div style={{
        padding: "6px 12px",
        background: "#eef2f7",
        borderBottom: "1px solid #cfd6de",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        flexWrap: "wrap"
    }}>
        <Icon name={canEdit ? "edit" : "file alternate outline"} style={{ color: canEdit ? "#1f7a3f" : "#596273", margin: 0, flex: "0 0 auto" }}/>
        <div style={{ minWidth: 0, flex: 1, display: "flex", alignItems: "baseline", gap: "8px", overflow: "hidden" }}>
            <strong style={{ fontSize: ".92rem", color: "#28323f", whiteSpace: "nowrap" }}>{title}</strong>
            <span style={{ color: "#8a9099", fontSize: ".82rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{subtitle}</span>
        </div>
        <Label basic color={canEdit ? "green" : "grey"} size="small" style={{ margin: 0, flex: "0 0 auto" }}>
            {canEdit ? "editável" : "somente leitura"}
        </Label>
    </div>

const RegistryToolbar = ({ children }:any) =>
    <div style={{
        padding: "10px 14px",
        borderBottom: "1px solid #e1e6ec",
        background: "#fafbfc",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        flexWrap: "wrap"
    }}>
        {children}
    </div>

const RegistryGroupHeader = ({ name, count, isClosed, onToggle }:any) =>
    <div
        onClick={onToggle}
        style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "7px 10px",
            cursor: "pointer",
            background: isClosed ? "#f4f6f8" : "#eef3f8",
            border: "1px solid #d7dee6",
            borderRadius: "7px",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,.65)"
        }}>
        <Icon name={isClosed ? "caret right" : "caret down"} style={{ color: "#6c7784", margin: 0 }}/>
        <Icon name="folder open outline" style={{ color: "#516171", margin: 0 }}/>
        <strong style={{ color: "#2b3440", letterSpacing: 0 }}>{name}</strong>
        <Label circular size="mini" style={{ marginLeft: "auto" }}>{count}</Label>
    </div>

const RegistrySubGroupHeader = ({ label, count, isClosed, onToggle }:any) =>
    <div
        onClick={onToggle}
        style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "6px 10px",
            cursor: "pointer",
            background: "#f8fafc",
            border: "1px solid #e0e6ee",
            borderLeft: "3px solid #8ca0b8",
            borderRadius: "6px"
        }}>
        <Icon name={isClosed ? "caret right" : "caret down"} style={{ color: "#7a8592", margin: 0 }}/>
        <span style={{ color: "#71808f", fontFamily: "monospace", fontSize: ".8rem" }}>subkey</span>
        <strong style={{ color: "#33404d", fontFamily: "monospace", fontSize: ".88rem" }}>{label}</strong>
        <Label circular size="mini" style={{ marginLeft: "auto" }}>{count}</Label>
    </div>

const RegistryTable = ({ children }:any) =>
    <Table basic="very" compact unstackable className="eco-registry-table" style={{ marginTop: 0, border: "none" }}>
        {children}
    </Table>

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
        <RegistryShell>
            <RegistryHeader
                title={GetConfigTitle(configFileName)}
                subtitle={`config-files / ${configFileName || "ecosystem-defaults.json"}`}
                canEdit={canEdit}/>
            <RegistryToolbar>
                <Message info icon size="small" style={{ margin: 0, flex: "1 1 420px" }}>
                    <Icon name="lock"/>
                    <Message.Content>
                        <Message.Header>editor de parâmetros</Message.Header>
                        { canEdit
                            ? "Edite um valor por vez. A confirmação é obrigatória porque essas chaves podem alterar o comportamento do ecossistema."
                            : "Este arquivo é de referência. Abra outro arquivo para editar." }
                    </Message.Content>
                </Message>
                <Input
                    icon="search"
                    size="small"
                    placeholder="filtrar parâmetros..."
                    value={filterValue}
                    onChange={(e, { value }) => setFilterValue(value)}
                    style={{ marginLeft: "auto", minWidth: "260px" }}/>
            </RegistryToolbar>

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
                    <RegistryTable>
                        <Table.Body>{ rowKeys.map((k:string) => renderRow(k, stripPrefix)) }</Table.Body>
                    </RegistryTable>

                return <>
                    {
                        groupNames.map((groupName:string) => {
                            const isClosed = closedGroups[groupName]
                            return <div key={groupName} style={{ margin: "12px 14px 0" }}>
                                <RegistryGroupHeader
                                    name={groupName}
                                    count={groups[groupName].length}
                                    isClosed={isClosed}
                                    onToggle={() => setClosedGroups({ ...closedGroups, [groupName]: !isClosed })}/>
                                {
                                    !isClosed && (() => {
                                        const { subGroups, flat } = buildSubGroups(groupName, groups[groupName])
                                        return <div style={{ marginTop: "8px", paddingLeft: "10px", borderLeft: "2px solid #dbe2ea" }}>
                                            {
                                                subGroups.map((sg:any) => {
                                                    const subKey = `${groupName}/${sg.subPrefix}`
                                                    const subClosed = closedGroups[subKey]
                                                    return <div key={subKey} style={{ marginTop: "8px" }}>
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
                    { groupNames.length === 0 && <div style={{ color: "#66707d", padding: "16px 14px 18px" }}>nenhum parâmetro corresponde ao filtro</div> }
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
    </Segment>
}

export default ConfigFilesContainer
