
import * as React    from "react"
import { Container } from "semantic-ui-react"

import GlobalStyle from "../Styles/Global.style"

import MainMenu from "./MainMenu"

const PageDefault = ({children}:any) =>
    <Container fluid={true}>
        <GlobalStyle />
        <div>
            <MainMenu/>
            {children}
        </div>
    </Container>

export default PageDefault