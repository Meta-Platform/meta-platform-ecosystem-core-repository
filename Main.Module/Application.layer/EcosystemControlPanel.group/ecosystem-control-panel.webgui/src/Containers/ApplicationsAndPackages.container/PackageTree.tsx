import * as React from "react"
import { useState, useEffect } from "react"

import {
    Dimmer,
    Grid,
    Header,
    Icon,
    Input,
    Label,
    List,
    Loader,
    Segment
} from "semantic-ui-react"

// Cor por tipo de pacote (extensão), como num package explorer de IDE.
const GetExtColor = (ext:string):any => {
    switch(ext){
        case "app"       : return "blue"
        case "cli"       : return "teal"
        case "webapp"    : return "purple"
        case "webgui"    : return "violet"
        case "webservice": return "orange"
        case "service"   : return "olive"
        case "lib"       : return "grey"
        default          : return "grey"
    }
}

// Constroi a árvore hierárquica do Meta Platform a partir da lista plana:
// Repository > Module > Layer > (Group?) > Package.
const BuildPackageTree = (packageList:any[]) => {
    const rootNode:any = { __children: {}, __packages: [] }
    const ensureChild = (node:any, key:string) => {
        if(!node.__children[key]) node.__children[key] = { __children: {}, __packages: [] }
        return node.__children[key]
    }
    packageList.forEach((pkg:any) => {
        const groupSegment = pkg.parentGroup ? [pkg.parentGroup] : []
        const path = [ pkg.namespaceRepo, pkg.moduleName, pkg.layerName, ...groupSegment ]
        let node = rootNode
        path.forEach((segment:string) => { node = ensureChild(node, segment) })
        node.__packages.push(pkg)
    })
    return rootNode.__children
}

// Recuo por aninhamento: cada nível recua o container filho em INDENT px,
// então a tabulação fica sempre correta independente da profundidade.
const INDENT = 16

export const PackageKey = (pkg:any) =>
    `${pkg.namespaceRepo}/${pkg.moduleName}/${pkg.layerName}/${pkg.parentGroup || ""}/${pkg.packageName}.${pkg.ext}`

const PackageLeaf = ({ pkg, selectedKey, onSelectPackage }:any) => {
    const selectable = !!onSelectPackage
    const isSelected = selectable && selectedKey === PackageKey(pkg)
    return <div
        onClick={selectable ? () => onSelectPackage(pkg) : undefined}
        style={{
            padding: "2px 4px", paddingLeft: "20px", display: "flex", alignItems: "center",
            cursor: selectable ? "pointer" : "default", borderRadius: "4px",
            background: isSelected ? "#e8f0fa" : undefined
        }}>
        <Icon name="file code outline" style={{ color: "#888" }}/>
        <span>{pkg.packageName}</span>
        <Label size="mini" color={GetExtColor(pkg.ext)} style={{ marginLeft: "6px" }}>{pkg.ext}</Label>
    </div>
}

const TreeNode = ({ name, node, defaultOpen, selectedKey, onSelectPackage }:any) => {
    const [ open, setOpen ] = useState<boolean>(defaultOpen)

    const childNames = Object.keys(node.__children).sort()
    const packages = (node.__packages || []).sort((a:any, b:any) => a.packageName.localeCompare(b.packageName))
    const totalDescendants = packages.length + childNames.length

    return <div>
        <div
            onClick={() => setOpen(!open)}
            style={{ padding: "3px 4px", cursor: "pointer", display: "flex", alignItems: "center", userSelect: "none" }}>
            <Icon name={open ? "caret down" : "caret right"} style={{ color: "#999", width: "14px", flex: "0 0 auto" }}/>
            <Icon name={open ? "folder open" : "folder"} color="yellow"/>
            <strong style={{ color: "#333" }}>{name}</strong>
            <Label circular size="mini" style={{ marginLeft: "6px" }}>{totalDescendants}</Label>
        </div>
        {
            open && <div style={{ marginLeft: `${INDENT}px`, borderLeft: "1px dashed #e0e0e0" }}>
                { childNames.map((childName:string, key:number) =>
                    <TreeNode
                        key={key}
                        name={childName}
                        node={node.__children[childName]}
                        defaultOpen={false}
                        selectedKey={selectedKey}
                        onSelectPackage={onSelectPackage}/>) }
                { packages.map((pkg:any, key:number) =>
                    <PackageLeaf key={key} pkg={pkg} selectedKey={selectedKey} onSelectPackage={onSelectPackage}/>) }
            </div>
        }
    </div>
}

// Agrupa a contagem de packages por repositório.
const CountByRepo = (packageList:any[]) =>
    packageList.reduce((acc:any, pkg:any) => {
        acc[pkg.namespaceRepo] = (acc[pkg.namespaceRepo] || 0) + 1
        return acc
    }, {})

// Master-detail: lista de repositórios à esquerda; árvore (Module>Layer>Group>
// Package) do repositório selecionado à direita. Navega-se pelo repo escolhido,
// sem despejar tudo de uma vez.
const PackageTree = ({ packageList, isLoading }:any) => {

    const [ filterValue, setFilterValue ]   = useState<string>("")
    const [ repoSelected, setRepoSelected ] = useState<string>()

    const allPackages = packageList || []
    const repoCounts = CountByRepo(allPackages)
    const repoNames = Object.keys(repoCounts).sort()

    useEffect(() => {
        if(!repoSelected && repoNames.length > 0)
            setRepoSelected(repoNames[0])
    }, [packageList])

    const repoPackages = allPackages
        .filter((pkg:any) => pkg.namespaceRepo === repoSelected)
        .filter((pkg:any) =>
            !filterValue ||
            `${pkg.moduleName} ${pkg.layerName} ${pkg.parentGroup || ""} ${pkg.packageName}.${pkg.ext}`
                .toLowerCase().includes(filterValue.toLowerCase()))

    const tree = BuildPackageTree(repoPackages)
    const repoNode = repoSelected && tree[repoSelected]

    return <Segment style={{ minHeight: "120px" }}>
        {
            isLoading && <Dimmer active><Loader/></Dimmer>
        }
        <Grid divided>
            <Grid.Column width={5}>
                <Header as="h5"><Icon name="database"/> Repositories</Header>
                <List selection size="small">
                    {
                        repoNames.map((repoName:string, key:number) =>
                            <List.Item
                                key={key}
                                active={repoSelected === repoName}
                                onClick={() => setRepoSelected(repoName)}>
                                <List.Content floated="right">
                                    <Label circular size="mini">{repoCounts[repoName]}</Label>
                                </List.Content>
                                <List.Icon name="database" color={repoSelected === repoName ? "blue" : "grey"}/>
                                <List.Content>
                                    <List.Header>{repoName}</List.Header>
                                </List.Content>
                            </List.Item>)
                    }
                </List>
            </Grid.Column>
            <Grid.Column width={11}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <Header as="h5" style={{ margin: 0 }}>{repoSelected || "—"}</Header>
                    <Input
                        icon="search"
                        size="small"
                        placeholder="filtrar neste repo..."
                        value={filterValue}
                        onChange={(e, { value }) => setFilterValue(value)}/>
                </div>
                <div style={{ overflow: "auto", maxHeight: "72vh", fontFamily: "system-ui, sans-serif", fontSize: ".95em" }}>
                    {
                        repoNode
                        ? Object.keys(repoNode.__children).sort().map((moduleName:string, k:number) =>
                            <TreeNode
                                key={moduleName}
                                name={moduleName}
                                node={repoNode.__children[moduleName]}
                                defaultOpen={true}/>)
                        : <div style={{ color: "#bbb", padding: "20px" }}>selecione um repositório</div>
                    }
                </div>
            </Grid.Column>
        </Grid>
    </Segment>
}

export { BuildPackageTree, TreeNode }
export default PackageTree
