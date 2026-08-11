import * as React from "react"
import { useState, useEffect } from "react"

import {
    Badge,
    Icon,
    ListRow,
    LoadingOverlay,
    SearchInput,
    Surface,
    TreeRow
} from "@i-components"

import PackageIcon from "../../Components/PackageIcon"

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

export const PackageKey = (pkg:any) =>
    `${pkg.namespaceRepo}/${pkg.moduleName}/${pkg.layerName}/${pkg.parentGroup || ""}/${pkg.packageName}.${pkg.ext}`

// O recuo é o mesmo do TreeRow do kit (8 + depth * 14), para que a folha
// montada à mão fique alinhada com a linha de pasta.
const RowIndent = (depth:number) => 8 + depth * 14

// Folha da árvore. O ícone é a IMAGEM do pacote (icon.svg), e TreeRow só
// desenha ícone por nome — por isso a linha é montada aqui.
const PackageLeaf = ({ pkg, depth = 0, selectedKey, onSelectPackage, serverManagerInformation }:any) => {
    const selectable = !!onSelectPackage
    const isSelected = selectable && selectedKey === PackageKey(pkg)
    return <button
        type="button"
        onClick={selectable ? () => onSelectPackage(pkg) : undefined}
        role={selectable ? "option" : undefined}
        aria-selected={selectable ? isSelected : undefined}
        className={[
            "ecp-pkg-leaf",
            selectable ? "is-clickable" : "",
            isSelected ? "is-selected" : ""
        ].filter(Boolean).join(" ")}
        style={{ paddingLeft: RowIndent(depth) + 14 }}>
        <PackageIcon packageData={pkg} serverManagerInformation={serverManagerInformation} size={16}/>
        <span className="ecp-pkg-leaf__name">{pkg.packageName}</span>
        <span className="mp-type-chip">{pkg.ext}</span>
    </button>
}

const TreeNode = ({ name, node, defaultOpen, depth = 0, selectedKey, onSelectPackage, serverManagerInformation }:any) => {
    const [ open, setOpen ] = useState<boolean>(defaultOpen)

    const childNames = Object.keys(node.__children).sort()
    const packages = (node.__packages || []).sort((a:any, b:any) => a.packageName.localeCompare(b.packageName))
    const totalDescendants = packages.length + childNames.length

    return <div>
        <TreeRow
            label={name}
            icon={open ? "folder open" : "folder"}
            depth={depth}
            expanded={open}
            hasChildren={totalDescendants > 0}
            meta={<Badge>{totalDescendants}</Badge>}
            onToggle={() => setOpen(!open)}
            onSelect={() => setOpen(!open)}/>
        {
            open && <>
                { childNames.map((childName:string) =>
                    <TreeNode
                        key={childName}
                        name={childName}
                        node={node.__children[childName]}
                        defaultOpen={false}
                        depth={depth + 1}
                        selectedKey={selectedKey}
                        onSelectPackage={onSelectPackage}
                        serverManagerInformation={serverManagerInformation}/>) }
                { packages.map((pkg:any, key:number) =>
                    <PackageLeaf
                        key={key}
                        pkg={pkg}
                        depth={depth + 1}
                        selectedKey={selectedKey}
                        onSelectPackage={onSelectPackage}
                        serverManagerInformation={serverManagerInformation}/>) }
            </>
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
const PackageTree = ({ packageList, isLoading, serverManagerInformation }:any) => {

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

    return <Surface className="ecp-pkgtree">
        { isLoading && <LoadingOverlay message="loading packages"/> }

        <div className="ecp-pkgtree__side">
            <div className="mp-panel__title"><Icon name="cubes"/> Repositories</div>
            {
                repoNames.map((repoName:string, key:number) =>
                    <ListRow
                        key={key}
                        icon="cubes"
                        title={repoName}
                        right={<Badge>{repoCounts[repoName]}</Badge>}
                        selected={repoSelected === repoName}
                        onClick={() => setRepoSelected(repoName)}/>)
            }
        </div>

        <div className="ecp-pkgtree__main">
            <div className="ecp-pkgtree__head">
                <span className="mp-panel__title">{repoSelected || "—"}</span>
                <SearchInput
                    className="ecp-pkgtree__search"
                    value={filterValue}
                    placeholder="filter in this repo..."
                    onValueChange={setFilterValue}/>
            </div>
            <div className="ecp-pkgtree__scroll">
                {
                    repoNode
                    ? Object.keys(repoNode.__children).sort().map((moduleName:string) =>
                        <TreeNode
                            key={moduleName}
                            name={moduleName}
                            node={repoNode.__children[moduleName]}
                            defaultOpen={true}
                            serverManagerInformation={serverManagerInformation}/>)
                    : <div className="ecp-pkgtree__empty">select a repository</div>
                }
            </div>
        </div>
    </Surface>
}

export { BuildPackageTree, TreeNode }
export default PackageTree
