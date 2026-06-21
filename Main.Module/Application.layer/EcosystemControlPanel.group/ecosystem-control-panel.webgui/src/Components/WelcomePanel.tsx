import * as React from "react"
import { Header, Icon, Segment } from "semantic-ui-react"

// Tela de boas-vindas (home padrão do painel). Substitui o antigo overview de
// cards como conteúdo principal: saudação + atalhos para cada seção.
const SECTIONS = [
    { panel: "instance supervisor", icon: "server",   title: "Instances",              desc: "Sockets de supervisão e tasks das instâncias em execução." },
    { panel: "executables",         icon: "terminal", title: "Executables",            desc: "Executáveis instalados — applications, daemons e CLIs." },
    { panel: "environments",        icon: "sitemap",  title: "Environments",           desc: "Ambientes de execução (pacote + hash do caminho)." },
    { panel: "repositories",        icon: "cubes",    title: "Repositories & Packages", desc: "Repositórios, fontes e pacotes instalados." },
    { panel: "config files",        icon: "cogs",     title: "Config Files",           desc: "Parâmetros padrão do ecossistema." }
]

const WelcomePanel = ({ onNavigate, ecosystemdataPath }:any) =>
    <Segment style={{ margin: "15px" }}>
        <div style={{ textAlign: "center", padding: "26px 12px 10px" }}>
            <Icon name="cube" size="huge" style={{ color: "#3a4047" }}/>
            <Header as="h1" style={{ marginTop: "12px" }}>
                Ecosystem Panel
                <Header.Subheader>Bem-vindo ao painel de controle do Meta Platform. Escolha uma seção para começar.</Header.Subheader>
            </Header>
            { ecosystemdataPath && <div style={{ marginTop: "6px" }}><code style={{ color: "#8a9099" }}>{ecosystemdataPath}</code></div> }
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: "12px", marginTop: "20px" }}>
            {
                SECTIONS.map((s:any, k:number) =>
                    <div key={k}
                        onClick={() => onNavigate({ panel: s.panel })}
                        style={{ cursor: "pointer", border: "1px solid #e3e6ea", borderRadius: "8px", padding: "16px 18px", background: "#fff" }}>
                        <div style={{ fontWeight: 700, fontSize: "1.05em", color: "#2d333a", display: "flex", alignItems: "center", gap: "8px" }}>
                            <Icon name={s.icon} style={{ color: "#3a6ea5", margin: 0 }}/> {s.title}
                            <Icon name="arrow right" style={{ marginLeft: "auto", color: "#c0c4c9" }}/>
                        </div>
                        <div style={{ color: "#777", fontSize: ".9em", marginTop: "8px", lineHeight: 1.4 }}>{s.desc}</div>
                    </div>)
            }
        </div>
    </Segment>

export default WelcomePanel
