import * as React from "react"

import {
	EmptyState,
	ObjectCard,
	SkeletonCards
} from "@i-components"

import PackageIcon from "../../Components/PackageIcon"

// O ícone do pacote é IMAGEM (icon.svg), então entra por `iconNode` — o slot
// `icon` do kit só aceita nome de ícone.
const PackageDataGrid = ({ packageList, serverManagerInformation }) =>
	<div className="ecp-apps-grid">
		{packageList.map((packageInformation) => (
			<ObjectCard
				key={`${packageInformation.packageName}.${packageInformation.ext}`}
				iconNode={<PackageIcon packageData={packageInformation} serverManagerInformation={serverManagerInformation} size={24}/>}
				title={`${packageInformation.packageName}.${packageInformation.ext}`}
				meta={`${packageInformation.moduleName}.${packageInformation.layerName}${packageInformation.parentGroup ? `.${packageInformation.parentGroup}` : ""}`}/>
		))}
	</div>

const GroupByNamespaceRepo = (packageList) => packageList
	.reduce((acc, packageInformation) => {
		if(!acc[packageInformation.namespaceRepo])
			acc[packageInformation.namespaceRepo] = []

		acc[packageInformation.namespaceRepo].push(packageInformation)
		return acc
	}, {})

const PackageList = ({ isLoading, packageList, serverManagerInformation }) =>{

	if(isLoading) return <SkeletonCards cards={8}/>

	const groupedPackageInformation = GroupByNamespaceRepo(packageList)
	const namespaceRepoList = Object.keys(groupedPackageInformation)

	if(namespaceRepoList.length === 0)
		return <EmptyState
					icon="cubes"
					title="No package"
					message="No package installed in this ecosystem."/>

	return <>
		{
			namespaceRepoList
			.map(namespaceRepo => <div key={namespaceRepo}>
				<div className="ecp-apps-group-head">
					<span className="mp-panel__title">{namespaceRepo}</span>
					<span className="ecp-apps-group-head__count">
						{groupedPackageInformation[namespaceRepo].length}
					</span>
				</div>
				<PackageDataGrid
					packageList={groupedPackageInformation[namespaceRepo]}
					serverManagerInformation={serverManagerInformation}/>
			</div>)
		}
	</>
}


export default PackageList
