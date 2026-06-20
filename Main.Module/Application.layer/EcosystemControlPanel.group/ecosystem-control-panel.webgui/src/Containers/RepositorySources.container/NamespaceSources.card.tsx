import * as React from "react"

import {
    Button,
    Card,
    Icon,
    Label,
    Segment
} from "semantic-ui-react"

import SourceParamsTable from "./SourceParams.table"

// Mostra um namespace com todas as suas fontes registradas e as ações de
// escrita disponíveis (paridade com o comando `repo`):
//  - install        -> instala o repositório a partir daquela fonte
//  - set as active  -> troca a fonte do repositório já instalado
//  - remove source  -> remove a fonte do sources.json
//  - update         -> atualiza o repositório instalado
const NamespaceSourcesCard = ({
    repositoryNamespace,
    sources,
    activeSourceType,
    isInstalled,
    busyAction,
    onInstall,
    onChangeSource,
    onRemoveSource,
    onUpdate,
    onRegisterSourceForNamespace
}:any) => {

    const isBusy = (action:string, sourceType?:string) =>
        busyAction && busyAction.namespace === repositoryNamespace
            && busyAction.action === action
            && (sourceType === undefined || busyAction.sourceType === sourceType)

    return <Card style={{ width: "440px" }}>
        <Card.Content>
            <Card.Header>
                <Icon name="cubes"/> {repositoryNamespace}
                {
                    isInstalled
                    ? <Label color="green" size="tiny" style={{ marginLeft: "8px" }}>installed</Label>
                    : <Label size="tiny" style={{ marginLeft: "8px" }}>not installed</Label>
                }
            </Card.Header>
            <Card.Meta>{sources.length} fonte(s) registrada(s)</Card.Meta>
        </Card.Content>

        <Card.Content>
            {
                sources.length === 0
                && <Segment placeholder textAlign="center" style={{ color: "grey" }}>nenhuma fonte registrada</Segment>
            }
            {
                sources.map((source:any, key:number) => {
                    const isActive = isInstalled && source.sourceType === activeSourceType
                    return <Segment key={key} style={{ background: isActive ? "honeydew" : undefined }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <strong>
                                <Icon name={isActive ? "check circle" : "feed"} color={isActive ? "green" : undefined}/>
                                {source.sourceType}
                            </strong>
                            { isActive && <Label color="green" size="tiny">active source</Label> }
                        </div>
                        <SourceParamsTable repositorySourceData={source}/>
                        <Button.Group size="tiny" fluid>
                            <Button
                                primary
                                loading={isBusy("install", source.sourceType)}
                                onClick={() => onInstall(repositoryNamespace, source.sourceType)}>
                                <Icon name="download"/> install
                            </Button>
                            {
                                isInstalled && !isActive &&
                                <Button
                                    loading={isBusy("change", source.sourceType)}
                                    onClick={() => onChangeSource(repositoryNamespace, source.sourceType)}>
                                    <Icon name="exchange"/> set active
                                </Button>
                            }
                            <Button
                                color="red"
                                basic
                                loading={isBusy("removeSource", source.sourceType)}
                                onClick={() => onRemoveSource(repositoryNamespace, source.sourceType)}>
                                <Icon name="trash"/> remove
                            </Button>
                        </Button.Group>
                    </Segment>
                })
            }
        </Card.Content>

        <Card.Content extra>
            <Button.Group fluid size="small">
                <Button
                    onClick={() => onRegisterSourceForNamespace(repositoryNamespace)}>
                    <Icon name="plus"/> add source
                </Button>
                {
                    isInstalled &&
                    <Button
                        color="teal"
                        loading={isBusy("update")}
                        onClick={() => onUpdate(repositoryNamespace)}>
                        <Icon name="refresh"/> update repository
                    </Button>
                }
            </Button.Group>
        </Card.Content>
    </Card>
}

export default NamespaceSourcesCard
