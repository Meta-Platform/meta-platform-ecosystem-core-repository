import * as React from "react"

/*
 * Símbolos do sistema de ícones do kit — Meta System Retro-Brutalist UI.
 * ---------------------------------------------------------------------
 * Desenho: grade 24×24 (`viewBox="0 0 24 24"`), traço de 2, ponta e junta
 * quadradas, geometria de régua e compasso (linha, retângulo, círculo,
 * polígono). Sem gradiente, sem sombra, sem cor literal: quem pinta é o
 * `currentColor` — por isso o ícone acompanha os tokens `--mp-*` de quem o
 * contém. Preenchimento só onde a forma É maciça (caret, play, stop).
 *
 * Estrutura:
 *   SYMBOLS   nome canônico -> desenho
 *   ALIASES   nome pedido pelo aplicativo -> nome canônico
 *
 * Regra dos ALIASES: o inventário (APPUI-113) levantou 238 nomes em uso, todos
 * herdados do conjunto Semantic/Font Awesome. Muitos são a MESMA forma com
 * outro rótulo (`close`/`times`), ou o par cheio/vazado de um sistema de
 * ícones sólidos (`folder outline`/`folder`) — distinção que num sistema de
 * traço não existe. Em vez de duplicar desenho, o nome vira alias. Nenhuma
 * chamada existente quebra e ninguém precisa saber disso no call site.
 *
 * Nome sem símbolo NÃO some: o Icon desenha um quadrado cortado e diz qual
 * nome foi pedido (ver Icon.tsx). "Ícone some em silêncio" já custou uma
 * investigação nesta plataforma.
 */

const FILL = { fill: "currentColor", stroke: "none" } as const

export const SYMBOLS: { [name: string]: React.ReactNode } = {

    /* ---------------------------------------------------------------- */
    /* Marcas e estado                                                  */
    /* ---------------------------------------------------------------- */

    "plus": <>
        <line x1="12" y1="4" x2="12" y2="20"/>
        <line x1="4" y1="12" x2="20" y2="12"/>
    </>,
    "minus": <line x1="4" y1="12" x2="20" y2="12"/>,
    "times": <>
        <line x1="5" y1="5" x2="19" y2="19"/>
        <line x1="19" y1="5" x2="5" y2="19"/>
    </>,
    "check": <polyline points="4,13 9,18 20,6"/>,
    "ban": <>
        <circle cx="12" cy="12" r="9"/>
        <line x1="5.6" y1="5.6" x2="18.4" y2="18.4"/>
    </>,
    "circle": <circle cx="12" cy="12" r="9"/>,
    "circle notch": <path d="M12 3a9 9 0 1 0 9 9"/>,
    "dot circle": <>
        <circle cx="12" cy="12" r="9"/>
        <circle cx="12" cy="12" r="3.5" {...FILL}/>
    </>,
    "square": <rect x="4" y="4" width="16" height="16"/>,
    "check circle": <>
        <circle cx="12" cy="12" r="9"/>
        <polyline points="7.5,12 10.8,15.3 16.5,8.7"/>
    </>,
    "times circle": <>
        <circle cx="12" cy="12" r="9"/>
        <line x1="8.6" y1="8.6" x2="15.4" y2="15.4"/>
        <line x1="15.4" y1="8.6" x2="8.6" y2="15.4"/>
    </>,
    "plus circle": <>
        <circle cx="12" cy="12" r="9"/>
        <line x1="12" y1="7.5" x2="12" y2="16.5"/>
        <line x1="7.5" y1="12" x2="16.5" y2="12"/>
    </>,
    "check square": <>
        <rect x="4" y="4" width="16" height="16"/>
        <polyline points="8,12 11,15 16,9"/>
    </>,
    "plus square": <>
        <rect x="4" y="4" width="16" height="16"/>
        <line x1="12" y1="8" x2="12" y2="16"/>
        <line x1="8" y1="12" x2="16" y2="12"/>
    </>,
    "info circle": <>
        <circle cx="12" cy="12" r="9"/>
        <line x1="12" y1="11" x2="12" y2="16.5"/>
        <line x1="12" y1="7.4" x2="12" y2="8.4"/>
    </>,
    "info": <>
        <line x1="12" y1="10" x2="12" y2="20"/>
        <line x1="12" y1="4" x2="12" y2="6"/>
    </>,
    "question": <>
        <path d="M8.5 9a3.5 3.5 0 1 1 3.5 3.5V15.5"/>
        <line x1="12" y1="18.5" x2="12" y2="20"/>
    </>,
    "question circle": <>
        <circle cx="12" cy="12" r="9"/>
        <path d="M9.6 10a2.4 2.4 0 1 1 2.4 2.4V14"/>
        <line x1="12" y1="16.4" x2="12" y2="17.4"/>
    </>,
    "warning sign": <>
        <polygon points="12,3 22,20 2,20"/>
        <line x1="12" y1="9.5" x2="12" y2="14.5"/>
        <line x1="12" y1="16.6" x2="12" y2="17.6"/>
    </>,
    "warning circle": <>
        <circle cx="12" cy="12" r="9"/>
        <line x1="12" y1="7" x2="12" y2="13"/>
        <line x1="12" y1="15.4" x2="12" y2="16.4"/>
    </>,
    "adjust": <>
        <circle cx="12" cy="12" r="9"/>
        <path d="M12 3a9 9 0 0 1 0 18z" {...FILL}/>
    </>,

    /* ---------------------------------------------------------------- */
    /* Setas, carets e navegação                                        */
    /* ---------------------------------------------------------------- */

    "caret down": <polygon points="6,9 18,9 12,17" {...FILL}/>,
    "caret up": <polygon points="6,15 18,15 12,7" {...FILL}/>,
    "caret right": <polygon points="9,6 17,12 9,18" {...FILL}/>,
    "caret left": <polygon points="15,6 7,12 15,18" {...FILL}/>,
    "chevron down": <polyline points="5,9 12,16 19,9"/>,
    "chevron up": <polyline points="5,15 12,8 19,15"/>,
    "chevron left": <polyline points="15,4 8,12 15,20"/>,
    "chevron right": <polyline points="9,4 16,12 9,20"/>,
    "arrow left": <>
        <line x1="21" y1="12" x2="4" y2="12"/>
        <polyline points="10,5 3,12 10,19"/>
    </>,
    "arrow right": <>
        <line x1="3" y1="12" x2="20" y2="12"/>
        <polyline points="14,5 21,12 14,19"/>
    </>,
    "arrow up": <>
        <line x1="12" y1="21" x2="12" y2="4"/>
        <polyline points="5,10 12,3 19,10"/>
    </>,
    "arrow down": <>
        <line x1="12" y1="3" x2="12" y2="20"/>
        <polyline points="5,14 12,21 19,14"/>
    </>,
    "arrow circle up": <>
        <circle cx="12" cy="12" r="9"/>
        <line x1="12" y1="17" x2="12" y2="7.5"/>
        <polyline points="8,11.5 12,7.5 16,11.5"/>
    </>,
    "arrows alternate": <>
        <line x1="12" y1="3" x2="12" y2="21"/>
        <line x1="3" y1="12" x2="21" y2="12"/>
        <polyline points="9,6 12,3 15,6"/>
        <polyline points="9,18 12,21 15,18"/>
        <polyline points="6,9 3,12 6,15"/>
        <polyline points="18,9 21,12 18,15"/>
    </>,
    "arrows alternate horizontal": <>
        <line x1="3" y1="12" x2="21" y2="12"/>
        <polyline points="6,8 2,12 6,16"/>
        <polyline points="18,8 22,12 18,16"/>
    </>,
    "level up alternate": <>
        <polyline points="4,20 4,7 20,7"/>
        <polyline points="16,3 20,7 16,11"/>
    </>,
    "level down alternate": <>
        <polyline points="4,4 4,17 20,17"/>
        <polyline points="16,13 20,17 16,21"/>
    </>,
    "exchange": <>
        <line x1="3" y1="8.5" x2="20" y2="8.5"/>
        <polyline points="17,5 21,8.5 17,12"/>
        <line x1="21" y1="15.5" x2="4" y2="15.5"/>
        <polyline points="7,12 3,15.5 7,19"/>
    </>,
    "refresh": <>
        <path d="M12 4a8 8 0 1 1-8 8"/>
        <polyline points="9,1 12,4 9,7"/>
    </>,
    "redo": <>
        <path d="M20 9H9.5a5 5 0 0 0 0 10H13"/>
        <polyline points="16,5 20,9 16,13"/>
    </>,
    "undo": <>
        <path d="M4 9h10.5a5 5 0 0 1 0 10H11"/>
        <polyline points="8,5 4,9 8,13"/>
    </>,
    "history": <>
        <circle cx="12.5" cy="13" r="7.5"/>
        <polyline points="12.5,8.5 12.5,13 16,15"/>
        <polyline points="7,3 3.5,6 7,9"/>
    </>,
    "step forward": <>
        <polygon points="6,5 16,12 6,19" {...FILL}/>
        <rect x="17" y="5" width="3" height="14" {...FILL}/>
    </>,
    "sign-in": <>
        <polyline points="13,4 20,4 20,20 13,20"/>
        <line x1="3" y1="12" x2="15" y2="12"/>
        <polyline points="11,8 15,12 11,16"/>
    </>,
    "sign-out": <>
        <polyline points="11,4 4,4 4,20 11,20"/>
        <line x1="9" y1="12" x2="21" y2="12"/>
        <polyline points="17,8 21,12 17,16"/>
    </>,
    "upload": <>
        <polyline points="6,9 12,3 18,9"/>
        <line x1="12" y1="3" x2="12" y2="15"/>
        <polyline points="4,14 4,21 20,21 20,14"/>
    </>,
    "download": <>
        <polyline points="6,11 12,17 18,11"/>
        <line x1="12" y1="3" x2="12" y2="17"/>
        <polyline points="4,14 4,21 20,21 20,14"/>
    </>,
    "external": <>
        <polyline points="14,3 21,3 21,10"/>
        <line x1="21" y1="3" x2="11" y2="13"/>
        <polyline points="17,13 17,21 3,21 3,7 11,7"/>
    </>,
    "external square": <>
        <rect x="3" y="3" width="18" height="18"/>
        <polyline points="10,7 17,7 17,14"/>
        <line x1="17" y1="7" x2="8" y2="16"/>
    </>,
    "power off": <>
        <path d="M6.8 6.8a7.5 7.5 0 1 0 10.4 0"/>
        <line x1="12" y1="3" x2="12" y2="11"/>
    </>,

    /* ---------------------------------------------------------------- */
    /* Reprodução                                                       */
    /* ---------------------------------------------------------------- */

    "play": <polygon points="7,4 20,12 7,20" {...FILL}/>,
    "play circle": <>
        <circle cx="12" cy="12" r="9"/>
        <polygon points="10,8 16.5,12 10,16" {...FILL}/>
    </>,
    "pause": <>
        <rect x="6.5" y="4" width="4" height="16" {...FILL}/>
        <rect x="13.5" y="4" width="4" height="16" {...FILL}/>
    </>,
    "pause circle": <>
        <circle cx="12" cy="12" r="9"/>
        <rect x="9" y="8" width="2.2" height="8" {...FILL}/>
        <rect x="12.8" y="8" width="2.2" height="8" {...FILL}/>
    </>,
    "stop": <rect x="5" y="5" width="14" height="14" {...FILL}/>,
    "stop circle": <>
        <circle cx="12" cy="12" r="9"/>
        <rect x="8.5" y="8.5" width="7" height="7" {...FILL}/>
    </>,

    /* ---------------------------------------------------------------- */
    /* Busca, filtro e visão                                            */
    /* ---------------------------------------------------------------- */

    "search": <>
        <circle cx="10.5" cy="10.5" r="6.5"/>
        <line x1="15.2" y1="15.2" x2="21" y2="21"/>
    </>,
    "filter": <polygon points="3,4 21,4 14,13 14,21 10,18 10,13"/>,
    "eye": <>
        <path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6z"/>
        <circle cx="12" cy="12" r="3"/>
    </>,
    "eye slash": <>
        <path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6z"/>
        <circle cx="12" cy="12" r="3"/>
        <line x1="4" y1="20" x2="20" y2="4"/>
    </>,
    "expand": <>
        <polyline points="4,9 4,4 9,4"/>
        <polyline points="15,4 20,4 20,9"/>
        <polyline points="20,15 20,20 15,20"/>
        <polyline points="9,20 4,20 4,15"/>
    </>,
    "compress": <>
        <polyline points="4,9 9,9 9,4"/>
        <polyline points="20,9 15,9 15,4"/>
        <polyline points="15,20 15,15 20,15"/>
        <polyline points="9,20 9,15 4,15"/>
    </>,
    "crosshairs": <>
        <circle cx="12" cy="12" r="7"/>
        <line x1="12" y1="2" x2="12" y2="6"/>
        <line x1="12" y1="18" x2="12" y2="22"/>
        <line x1="2" y1="12" x2="6" y2="12"/>
        <line x1="18" y1="12" x2="22" y2="12"/>
    </>,

    /* ---------------------------------------------------------------- */
    /* Janela e layout                                                  */
    /* ---------------------------------------------------------------- */

    "window maximize": <>
        <rect x="3" y="4" width="18" height="16"/>
        <line x1="3" y1="8.5" x2="21" y2="8.5"/>
    </>,
    "window minimize": <>
        <rect x="3" y="4" width="18" height="16"/>
        <line x1="7" y1="16" x2="17" y2="16"/>
    </>,
    "window restore": <>
        <rect x="3" y="8" width="13" height="13"/>
        <polyline points="7,8 7,3 21,3 21,17 16,17"/>
    </>,
    "window close": <>
        <rect x="3" y="4" width="18" height="16"/>
        <line x1="9" y1="10" x2="15" y2="16"/>
        <line x1="15" y1="10" x2="9" y2="16"/>
    </>,
    "th": <>
        <rect x="3" y="3" width="18" height="18"/>
        <line x1="9" y1="3" x2="9" y2="21"/>
        <line x1="15" y1="3" x2="15" y2="21"/>
        <line x1="3" y1="9" x2="21" y2="9"/>
        <line x1="3" y1="15" x2="21" y2="15"/>
    </>,
    "th large": <>
        <rect x="3" y="3" width="8" height="8"/>
        <rect x="13" y="3" width="8" height="8"/>
        <rect x="3" y="13" width="8" height="8"/>
        <rect x="13" y="13" width="8" height="8"/>
    </>,
    "list": <>
        <line x1="3" y1="6" x2="4.6" y2="6"/>
        <line x1="3" y1="12" x2="4.6" y2="12"/>
        <line x1="3" y1="18" x2="4.6" y2="18"/>
        <line x1="8" y1="6" x2="21" y2="6"/>
        <line x1="8" y1="12" x2="21" y2="12"/>
        <line x1="8" y1="18" x2="21" y2="18"/>
    </>,
    "bars": <>
        <line x1="3" y1="6" x2="21" y2="6"/>
        <line x1="3" y1="12" x2="21" y2="12"/>
        <line x1="3" y1="18" x2="21" y2="18"/>
    </>,
    "align left": <>
        <line x1="3" y1="5" x2="21" y2="5"/>
        <line x1="3" y1="10" x2="14" y2="10"/>
        <line x1="3" y1="15" x2="21" y2="15"/>
        <line x1="3" y1="20" x2="14" y2="20"/>
    </>,
    "align justify": <>
        <line x1="3" y1="5" x2="21" y2="5"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
        <line x1="3" y1="15" x2="21" y2="15"/>
        <line x1="3" y1="20" x2="21" y2="20"/>
    </>,
    "indent": <>
        <polyline points="3,9 6,12 3,15"/>
        <line x1="10" y1="5" x2="21" y2="5"/>
        <line x1="10" y1="12" x2="21" y2="12"/>
        <line x1="10" y1="19" x2="21" y2="19"/>
    </>,
    "outdent": <>
        <polyline points="6,9 3,12 6,15"/>
        <line x1="10" y1="5" x2="21" y2="5"/>
        <line x1="10" y1="12" x2="21" y2="12"/>
        <line x1="10" y1="19" x2="21" y2="19"/>
    </>,
    "header": <>
        <line x1="6" y1="4" x2="6" y2="20"/>
        <line x1="17" y1="4" x2="17" y2="20"/>
        <line x1="6" y1="12" x2="17" y2="12"/>
    </>,
    "quote left": <>
        <polygon points="3,6 10,6 10,13 6.5,19 3,19 6,13 3,13" {...FILL}/>
        <polygon points="13,6 20,6 20,13 16.5,19 13,19 16,13 13,13" {...FILL}/>
    </>,
    "columns": <>
        <rect x="3" y="4" width="18" height="16"/>
        <line x1="9" y1="4" x2="9" y2="20"/>
        <line x1="15" y1="4" x2="15" y2="20"/>
    </>,
    "table": <>
        <rect x="3" y="4" width="18" height="16"/>
        <line x1="3" y1="9" x2="21" y2="9"/>
        <line x1="3" y1="14.5" x2="21" y2="14.5"/>
        <line x1="11" y1="9" x2="11" y2="20"/>
    </>,
    "sliders horizontal": <>
        <line x1="3" y1="6" x2="21" y2="6"/>
        <line x1="3" y1="12" x2="21" y2="12"/>
        <line x1="3" y1="18" x2="21" y2="18"/>
        <rect x="6" y="3.5" width="3" height="5" {...FILL}/>
        <rect x="14" y="9.5" width="3" height="5" {...FILL}/>
        <rect x="9" y="15.5" width="3" height="5" {...FILL}/>
    </>,
    "tasks": <>
        <polyline points="3,7 5,9 8.5,4.5"/>
        <polyline points="3,17 5,19 8.5,14.5"/>
        <line x1="12" y1="7" x2="21" y2="7"/>
        <line x1="12" y1="17" x2="21" y2="17"/>
    </>,
    "dashboard": <>
        <path d="M3 18a9 9 0 1 1 18 0"/>
        <line x1="3" y1="18" x2="21" y2="18"/>
        <line x1="12" y1="18" x2="16.5" y2="10.5"/>
    </>,
    "ellipsis horizontal": <>
        <circle cx="5" cy="12" r="1.8" {...FILL}/>
        <circle cx="12" cy="12" r="1.8" {...FILL}/>
        <circle cx="19" cy="12" r="1.8" {...FILL}/>
    </>,
    "i cursor": <>
        <line x1="12" y1="4" x2="12" y2="20"/>
        <line x1="8" y1="4" x2="16" y2="4"/>
        <line x1="8" y1="20" x2="16" y2="20"/>
    </>,
    "mouse pointer": <polygon points="6,3 6,19 10.2,15 12.8,21 15.8,19.6 13.2,13.8 19,13"/>,
    "thumbtack": <>
        <polygon points="8,3 16,3 15,10 18,13.5 6,13.5 9,10"/>
        <line x1="12" y1="13.5" x2="12" y2="21"/>
    </>,
    "hashtag": <>
        <line x1="9.5" y1="3.5" x2="7.5" y2="20.5"/>
        <line x1="16.5" y1="3.5" x2="14.5" y2="20.5"/>
        <line x1="4" y1="9" x2="20" y2="9"/>
        <line x1="3.5" y1="15" x2="19.5" y2="15"/>
    </>,
    "sort down": <>
        <line x1="3" y1="6" x2="13" y2="6"/>
        <line x1="3" y1="12" x2="10" y2="12"/>
        <line x1="3" y1="18" x2="7" y2="18"/>
        <line x1="18" y1="4" x2="18" y2="18"/>
        <polyline points="15,15 18,18.5 21,15"/>
    </>,

    /* ---------------------------------------------------------------- */
    /* Gráficos                                                         */
    /* ---------------------------------------------------------------- */

    "chart line": <>
        <polyline points="3,3 3,21 21,21"/>
        <polyline points="6,17 10,11 14,14 20,5"/>
    </>,
    "chart bar": <>
        <polyline points="3,3 3,21 21,21"/>
        <rect x="6" y="12" width="3.5" height="9"/>
        <rect x="11.5" y="7" width="3.5" height="14"/>
        <rect x="17" y="15" width="3.5" height="6"/>
    </>,
    "chart area": <>
        <polyline points="3,3 3,21 21,21"/>
        <polygon points="3,16 8,10 13,14 21,5 21,21 3,21"/>
    </>,
    "chart pie": <>
        <circle cx="12" cy="12" r="9"/>
        <line x1="12" y1="12" x2="12" y2="3"/>
        <line x1="12" y1="12" x2="19.8" y2="16.5"/>
    </>,

    /* ---------------------------------------------------------------- */
    /* Arquivos e pastas                                                */
    /* ---------------------------------------------------------------- */

    "folder": <polygon points="3,20 3,4 9,4 11.5,7.5 21,7.5 21,20"/>,
    "folder open": <>
        <polyline points="3,20 3,4 9,4 11.5,7.5 19,7.5 19,11"/>
        <polygon points="3,20 6.5,11 22,11 18.5,20"/>
    </>,
    "file": <>
        <polygon points="5,2.5 14,2.5 19,7.5 19,21.5 5,21.5"/>
        <polyline points="14,2.5 14,7.5 19,7.5"/>
    </>,
    "file alternate": <>
        <polygon points="5,2.5 14,2.5 19,7.5 19,21.5 5,21.5"/>
        <polyline points="14,2.5 14,7.5 19,7.5"/>
        <line x1="8" y1="12" x2="16" y2="12"/>
        <line x1="8" y1="16" x2="16" y2="16"/>
    </>,
    "file code": <>
        <polygon points="5,2.5 14,2.5 19,7.5 19,21.5 5,21.5"/>
        <polyline points="14,2.5 14,7.5 19,7.5"/>
        <polyline points="10,12.5 8,15.5 10,18.5"/>
        <polyline points="14,12.5 16,15.5 14,18.5"/>
    </>,
    "file archive": <>
        <polygon points="5,2.5 14,2.5 19,7.5 19,21.5 5,21.5"/>
        <polyline points="14,2.5 14,7.5 19,7.5"/>
        <line x1="10.5" y1="11" x2="13.5" y2="11"/>
        <line x1="10.5" y1="14" x2="13.5" y2="14"/>
        <rect x="10.5" y="16.5" width="3" height="3.5"/>
    </>,
    "file pdf": <>
        <polygon points="5,2.5 14,2.5 19,7.5 19,21.5 5,21.5"/>
        <polyline points="14,2.5 14,7.5 19,7.5"/>
        <polyline points="9,19 9,12 12,12"/>
        <path d="M12 12a2.2 2.2 0 0 1 0 4.4H9"/>
    </>,
    "sticky note": <>
        <polygon points="4,3 20,3 20,15 14,21 4,21"/>
        <polyline points="20,15 14,15 14,21"/>
    </>,
    "clipboard": <>
        <polyline points="9,4 5,4 5,21 19,21 19,4 15,4"/>
        <rect x="8.5" y="2" width="7" height="4"/>
    </>,
    "clipboard list": <>
        <polyline points="9,4 5,4 5,21 19,21 19,4 15,4"/>
        <rect x="8.5" y="2" width="7" height="4"/>
        <line x1="8.5" y1="11" x2="15.5" y2="11"/>
        <line x1="8.5" y1="15" x2="15.5" y2="15"/>
    </>,
    "book": <>
        <line x1="12" y1="6" x2="12" y2="21"/>
        <path d="M12 6C10 4 6.5 3.5 3 4v14c3.5-.5 7 0 9 2 2-2 5.5-2.5 9-2V4c-3.5-.5-7 0-9 2z"/>
    </>,
    "bookmark": <polygon points="6,3 18,3 18,21 12,16 6,21"/>,
    "flag": <>
        <line x1="5" y1="3" x2="5" y2="21"/>
        <polygon points="5,4 19,4 16,9 19,14 5,14"/>
    </>,
    "tag": <>
        <polygon points="3,3 11,3 21,13 13,21 3,11"/>
        <circle cx="7" cy="7" r="1.6" {...FILL}/>
    </>,
    "tags": <>
        <polygon points="2,4 9,4 17,12 10,19 2,11"/>
        <circle cx="5.6" cy="7.6" r="1.4" {...FILL}/>
        <polyline points="12,4 14,4 22,12 17.5,16.5"/>
    </>,
    "archive": <>
        <rect x="3" y="3.5" width="18" height="5"/>
        <polyline points="5,8.5 5,20.5 19,20.5 19,8.5"/>
        <line x1="9.5" y1="13" x2="14.5" y2="13"/>
    </>,
    "inbox": <>
        <rect x="3" y="4" width="18" height="16"/>
        <polyline points="3,13 8,13 10,16 14,16 16,13 21,13"/>
    </>,
    "image": <>
        <rect x="3" y="4" width="18" height="16"/>
        <circle cx="8.5" cy="9.5" r="1.8"/>
        <polyline points="4,18 10,12 13.5,15.5 17,12 20,15"/>
    </>,

    /* ---------------------------------------------------------------- */
    /* Edição                                                           */
    /* ---------------------------------------------------------------- */

    "pencil": <>
        <polygon points="3,21 4.5,16.2 16,4.7 19.3,8 7.8,19.5"/>
        <line x1="13.6" y1="7.1" x2="16.9" y2="10.4"/>
    </>,
    "edit": <>
        <polyline points="20,12 20,20 4,20 4,4 12,4"/>
        <polygon points="10,14 10.7,11.4 18.5,3.6 21,6.1 13.2,13.9"/>
    </>,
    "save": <>
        <polygon points="3,3 17,3 21,7 21,21 3,21"/>
        <rect x="7" y="3" width="8" height="6"/>
        <rect x="7" y="13" width="10" height="8"/>
    </>,
    "copy": <>
        <rect x="8" y="8" width="13" height="13"/>
        <polyline points="5,16 3,16 3,3 16,3 16,5"/>
    </>,
    "clone": <>
        <rect x="3" y="3" width="13" height="13"/>
        <rect x="8" y="8" width="13" height="13"/>
    </>,
    "trash": <>
        <line x1="3" y1="6" x2="21" y2="6"/>
        <polyline points="6,6 7,21 17,21 18,6"/>
        <polyline points="9,6 9,3 15,3 15,6"/>
        <line x1="10" y1="10" x2="10" y2="17"/>
        <line x1="14" y1="10" x2="14" y2="17"/>
    </>,
    "eraser": <>
        <polygon points="9,20.5 2.5,14 13,3.5 19.5,10"/>
        <line x1="9" y1="20.5" x2="21" y2="20.5"/>
    </>,

    /* ---------------------------------------------------------------- */
    /* Ferramentas                                                      */
    /* ---------------------------------------------------------------- */

    "cog": <>
        <circle cx="12" cy="12" r="7.5"/>
        <circle cx="12" cy="12" r="3"/>
        <line x1="12" y1="1.5" x2="12" y2="4.5"/>
        <line x1="12" y1="19.5" x2="12" y2="22.5"/>
        <line x1="1.5" y1="12" x2="4.5" y2="12"/>
        <line x1="19.5" y1="12" x2="22.5" y2="12"/>
        <line x1="4.6" y1="4.6" x2="6.7" y2="6.7"/>
        <line x1="17.3" y1="17.3" x2="19.4" y2="19.4"/>
        <line x1="19.4" y1="4.6" x2="17.3" y2="6.7"/>
        <line x1="6.7" y1="17.3" x2="4.6" y2="19.4"/>
    </>,
    "cogs": <>
        <circle cx="9" cy="9" r="5.5"/>
        <circle cx="9" cy="9" r="2"/>
        <line x1="9" y1="1.5" x2="9" y2="3.5"/>
        <line x1="1.5" y1="9" x2="3.5" y2="9"/>
        <line x1="14.5" y1="9" x2="16.5" y2="9"/>
        <circle cx="17" cy="17" r="4"/>
        <circle cx="17" cy="17" r="1.4"/>
        <line x1="17" y1="21" x2="17" y2="22.5"/>
        <line x1="21" y1="17" x2="22.5" y2="17"/>
    </>,
    "wrench": <>
        <circle cx="16.5" cy="7.5" r="4.5"/>
        <line x1="16.5" y1="3" x2="16.5" y2="7.5"/>
        <line x1="13.3" y1="10.7" x2="3.5" y2="20.5"/>
    </>,
    "hammer": <>
        <polygon points="12,2.5 21.5,7.5 18.5,12 9,7"/>
        <line x1="12.8" y1="9.7" x2="4.5" y2="21"/>
    </>,
    "broom": <>
        <line x1="20.5" y1="3.5" x2="12" y2="12"/>
        <polygon points="12,11 16,15 8.5,21 4.5,17"/>
        <line x1="10.2" y1="12.8" x2="14.2" y2="16.8"/>
    </>,
    "paint brush": <>
        <polygon points="17.5,2 22,6.5 12.5,16 8,11.5"/>
        <polygon points="8,11.5 12.5,16 8.5,21 3,21 3,15.5"/>
    </>,
    "tint": <path d="M12 2.5s6.5 7.5 6.5 11.5a6.5 6.5 0 0 1-13 0C5.5 10 12 2.5 12 2.5z"/>,
    "flask": <>
        <line x1="8" y1="2.5" x2="16" y2="2.5"/>
        <path d="M9.5 2.5v6.5L4 20.5h16L14.5 9V2.5"/>
        <line x1="6.5" y1="15.5" x2="17.5" y2="15.5"/>
    </>,
    "key": <>
        <circle cx="8" cy="8.5" r="4.5"/>
        <line x1="11.2" y1="11.7" x2="20.5" y2="21"/>
        <line x1="17" y1="17.5" x2="19.5" y2="15"/>
    </>,
    "lock": <>
        <rect x="4" y="10" width="16" height="11"/>
        <path d="M8 10V7a4 4 0 0 1 8 0v3"/>
    </>,
    "linkify": <>
        <path d="M10.5 14.5a4.5 4.5 0 0 0 6.4 0l2.5-2.5a4.5 4.5 0 0 0-6.4-6.4l-1.4 1.4"/>
        <path d="M13.5 9.5a4.5 4.5 0 0 0-6.4 0l-2.5 2.5a4.5 4.5 0 0 0 6.4 6.4l1.4-1.4"/>
    </>,
    "unlink": <>
        <path d="M14 10l2.9-2.9a4.5 4.5 0 0 0-6.4-6.4"/>
        <path d="M10 14l-2.9 2.9a4.5 4.5 0 0 0 6.4 6.4"/>
        <line x1="3" y1="3" x2="21" y2="21"/>
    </>,
    "paperclip": <path d="M18.5 10.5l-7.6 7.6a4.2 4.2 0 0 1-6-6l8.6-8.6a2.8 2.8 0 0 1 4 4l-8.6 8.6a1.4 1.4 0 0 1-2-2l7.6-7.6"/>,
    "puzzle piece": <path d="M3 4h6.2a2.4 2.4 0 1 1 4.8 0H21v6.2a2.4 2.4 0 1 0 0 4.8V21h-6.2a2.4 2.4 0 1 0-4.8 0H3v-6.2a2.4 2.4 0 1 0 0-4.8z"/>,

    /* ---------------------------------------------------------------- */
    /* Sistema, execução e infraestrutura                               */
    /* ---------------------------------------------------------------- */

    "cube": <>
        <polygon points="12,2.5 21,7.5 21,16.5 12,21.5 3,16.5 3,7.5"/>
        <polyline points="3,7.5 12,12.5 21,7.5"/>
        <line x1="12" y1="12.5" x2="12" y2="21.5"/>
    </>,
    "cubes": <>
        <polygon points="7,2.5 11,5 11,10 7,12.5 3,10 3,5"/>
        <polygon points="17,2.5 21,5 21,10 17,12.5 13,10 13,5"/>
        <polygon points="12,11 16,13.5 16,18.5 12,21 8,18.5 8,13.5"/>
    </>,
    "box": <>
        <rect x="3" y="6.5" width="18" height="14.5"/>
        <line x1="3" y1="11.5" x2="21" y2="11.5"/>
        <rect x="9.5" y="6.5" width="5" height="5"/>
    </>,
    "boxes": <>
        <rect x="2" y="4" width="9" height="8"/>
        <rect x="13" y="4" width="9" height="8"/>
        <rect x="7.5" y="13.5" width="9" height="8"/>
    </>,
    "group": <>
        <rect x="2.5" y="2.5" width="8" height="8"/>
        <rect x="13.5" y="2.5" width="8" height="8"/>
        <rect x="8" y="13.5" width="8" height="8"/>
    </>,
    "database": <>
        <ellipse cx="12" cy="6" rx="8" ry="3"/>
        <path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6"/>
        <path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>
    </>,
    "server": <>
        <rect x="3" y="3.5" width="18" height="7"/>
        <rect x="3" y="13.5" width="18" height="7"/>
        <line x1="6.5" y1="7" x2="8.5" y2="7"/>
        <line x1="6.5" y1="17" x2="8.5" y2="17"/>
        <line x1="16" y1="7" x2="18" y2="7"/>
        <line x1="16" y1="17" x2="18" y2="17"/>
    </>,
    "hdd": <>
        <rect x="2" y="6.5" width="20" height="11"/>
        <line x1="2" y1="12.5" x2="22" y2="12.5"/>
        <circle cx="18" cy="15" r="1.2" {...FILL}/>
    </>,
    "desktop": <>
        <rect x="2.5" y="3.5" width="19" height="13"/>
        <line x1="12" y1="16.5" x2="12" y2="20.5"/>
        <line x1="7" y1="20.5" x2="17" y2="20.5"/>
    </>,
    "keyboard": <>
        <rect x="2" y="6" width="20" height="12"/>
        <line x1="5.5" y1="10" x2="8.5" y2="10"/>
        <line x1="11" y1="10" x2="13" y2="10"/>
        <line x1="15.5" y1="10" x2="18.5" y2="10"/>
        <line x1="8" y1="14.5" x2="16" y2="14.5"/>
    </>,
    "microchip": <>
        <rect x="6" y="6" width="12" height="12"/>
        <rect x="9.5" y="9.5" width="5" height="5"/>
        <line x1="9" y1="2.5" x2="9" y2="6"/>
        <line x1="15" y1="2.5" x2="15" y2="6"/>
        <line x1="9" y1="18" x2="9" y2="21.5"/>
        <line x1="15" y1="18" x2="15" y2="21.5"/>
        <line x1="2.5" y1="9" x2="6" y2="9"/>
        <line x1="2.5" y1="15" x2="6" y2="15"/>
        <line x1="18" y1="9" x2="21.5" y2="9"/>
        <line x1="18" y1="15" x2="21.5" y2="15"/>
    </>,
    "plug": <>
        <line x1="9" y1="2" x2="9" y2="7"/>
        <line x1="15" y1="2" x2="15" y2="7"/>
        <path d="M5.5 7h13v3.5a6.5 6.5 0 0 1-13 0z"/>
        <line x1="12" y1="17" x2="12" y2="22"/>
    </>,
    "bolt": <polygon points="13,2 4.5,13 11,13 10,22 19.5,10 13,10"/>,
    "terminal": <>
        <rect x="2" y="4" width="20" height="16"/>
        <polyline points="6,9 9.5,12 6,15"/>
        <line x1="12" y1="16" x2="18" y2="16"/>
    </>,
    "code": <>
        <polyline points="8,6.5 2.5,12 8,17.5"/>
        <polyline points="16,6.5 21.5,12 16,17.5"/>
        <line x1="13.8" y1="3.5" x2="10.2" y2="20.5"/>
    </>,
    "code branch": <>
        <circle cx="7" cy="5" r="2.5"/>
        <circle cx="7" cy="19" r="2.5"/>
        <circle cx="17" cy="8" r="2.5"/>
        <line x1="7" y1="7.5" x2="7" y2="16.5"/>
        <path d="M17 10.5v1.5a4 4 0 0 1-4 4H9.5"/>
    </>,
    "sitemap": <>
        <rect x="9" y="2" width="6" height="5"/>
        <rect x="1.5" y="17" width="6" height="5"/>
        <rect x="16.5" y="17" width="6" height="5"/>
        <line x1="12" y1="7" x2="12" y2="12"/>
        <polyline points="4.5,17 4.5,12 19.5,12 19.5,17"/>
    </>,
    "docker": <>
        <rect x="3" y="11" width="17" height="6"/>
        <rect x="5.5" y="7.5" width="3.5" height="3.5"/>
        <rect x="10.2" y="7.5" width="3.5" height="3.5"/>
        <rect x="14.9" y="7.5" width="3.5" height="3.5"/>
        <rect x="10.2" y="4" width="3.5" height="3.5"/>
        <line x1="2" y1="20" x2="22" y2="20"/>
    </>,
    "github": <>
        <circle cx="12" cy="12" r="9"/>
        <circle cx="9" cy="10.5" r="1.3" {...FILL}/>
        <circle cx="15" cy="10.5" r="1.3" {...FILL}/>
        <path d="M8 15.5h8v4H8z"/>
    </>,
    "google drive": <>
        <polygon points="12,2.5 22,20 2,20"/>
        <line x1="12" y1="2.5" x2="7" y2="20"/>
        <line x1="12" y1="2.5" x2="17" y2="20"/>
    </>,
    "rocket": <>
        <path d="M12 2c4 3.2 6 7 6 11.5L15 17H9l-3-3.5C6 9 8 5.2 12 2z"/>
        <circle cx="12" cy="10" r="2"/>
        <polyline points="9,17 6,21.5 9.5,20.5"/>
        <polyline points="15,17 18,21.5 14.5,20.5"/>
    </>,
    "shield": <polygon points="12,2.5 20.5,5.5 20.5,12 12,21.5 3.5,12 3.5,5.5"/>,
    "bug": <>
        <rect x="7" y="8" width="10" height="13"/>
        <line x1="2.5" y1="11" x2="7" y2="11"/>
        <line x1="17" y1="11" x2="21.5" y2="11"/>
        <line x1="2.5" y1="17" x2="7" y2="17"/>
        <line x1="17" y1="17" x2="21.5" y2="17"/>
        <line x1="8.5" y1="4" x2="10.5" y2="8"/>
        <line x1="15.5" y1="4" x2="13.5" y2="8"/>
    </>,
    "star": <polygon points="12,2.5 14.8,9 21.8,9.6 16.5,14.2 18.1,21 12,17.4 5.9,21 7.5,14.2 2.2,9.6 9.2,9"/>,
    "fire": <path d="M12 2c1 4-3 5-3 9a3 3 0 0 0 6 0c0-1.2-.4-2.2-1.2-3 3.2 1.2 5.2 4 5.2 7a7 7 0 0 1-14 0C5 9 12 7 12 2z"/>,
    "globe": <>
        <circle cx="12" cy="12" r="9"/>
        <line x1="3" y1="12" x2="21" y2="12"/>
        <ellipse cx="12" cy="12" rx="4" ry="9"/>
    </>,
    "compass": <>
        <circle cx="12" cy="12" r="9"/>
        <polygon points="16.5,7.5 13.5,13.5 7.5,16.5 10.5,10.5"/>
    </>,
    "road": <>
        <polygon points="3,21 7.5,3 16.5,3 21,21"/>
        <line x1="12" y1="6" x2="12" y2="10"/>
        <line x1="12" y1="13" x2="12" y2="17"/>
    </>,
    "map signs": <>
        <line x1="12" y1="2.5" x2="12" y2="21.5"/>
        <polygon points="12,4.5 19,4.5 21.5,8 19,11.5 12,11.5"/>
        <polygon points="12,13 5,13 2.5,16.5 5,20 12,20"/>
    </>,
    "shipping fast": <>
        <rect x="1.5" y="6" width="11" height="10"/>
        <polygon points="12.5,9 17,9 20.5,12.5 20.5,16 12.5,16"/>
        <circle cx="6.5" cy="18.5" r="2.2"/>
        <circle cx="16.5" cy="18.5" r="2.2"/>
    </>,
    "balance scale": <>
        <line x1="12" y1="4" x2="12" y2="20.5"/>
        <line x1="6" y1="20.5" x2="18" y2="20.5"/>
        <line x1="3" y1="7" x2="21" y2="7"/>
        <polyline points="1.5,14 4.5,7.5 7.5,14"/>
        <polyline points="16.5,14 19.5,7.5 22.5,14"/>
    </>,
    "bullhorn": <>
        <polygon points="2.5,9.5 8,9.5 18,4 18,20 8,14.5 2.5,14.5"/>
        <path d="M6.5 14.5v4a2 2 0 0 0 4 0v-2"/>
    </>,
    "recycle": <>
        <polygon points="12,3 20.5,18.5 3.5,18.5"/>
        <polyline points="9,12 12,7.5 15,12"/>
    </>,
    "moon": <path d="M20.5 14.5A9 9 0 1 1 9.5 3.5a7 7 0 0 0 11 11z"/>,
    "sun": <>
        <circle cx="12" cy="12" r="5"/>
        <line x1="12" y1="1.5" x2="12" y2="4"/>
        <line x1="12" y1="20" x2="12" y2="22.5"/>
        <line x1="1.5" y1="12" x2="4" y2="12"/>
        <line x1="20" y1="12" x2="22.5" y2="12"/>
        <line x1="4.4" y1="4.4" x2="6.2" y2="6.2"/>
        <line x1="17.8" y1="17.8" x2="19.6" y2="19.6"/>
        <line x1="19.6" y1="4.4" x2="17.8" y2="6.2"/>
        <line x1="6.2" y1="17.8" x2="4.4" y2="19.6"/>
    </>,
    "lightbulb": <>
        <path d="M12 2.5a6.5 6.5 0 0 0-3.8 11.8V17h7.6v-2.7A6.5 6.5 0 0 0 12 2.5z"/>
        <line x1="9.5" y1="19.5" x2="14.5" y2="19.5"/>
        <line x1="10.5" y1="22" x2="13.5" y2="22"/>
    </>,
    "home": <>
        <polyline points="2.5,11.5 12,3 21.5,11.5"/>
        <polyline points="5,9.5 5,21 19,21 19,9.5"/>
        <rect x="9.5" y="14" width="5" height="7"/>
    </>,

    /* ---------------------------------------------------------------- */
    /* Pessoas e comunicação                                            */
    /* ---------------------------------------------------------------- */

    "user": <>
        <circle cx="12" cy="7.5" r="4"/>
        <path d="M4 21v-1.5A5.5 5.5 0 0 1 9.5 14h5a5.5 5.5 0 0 1 5.5 5.5V21"/>
    </>,
    "users": <>
        <circle cx="9" cy="7.5" r="3.5"/>
        <path d="M2 21v-1.5A5 5 0 0 1 7 14.5h4a5 5 0 0 1 5 5V21"/>
        <path d="M16 4.5a3.5 3.5 0 0 1 0 7"/>
        <path d="M17.5 14.5h.5a4 4 0 0 1 4 4V21"/>
    </>,
    "id badge": <>
        <rect x="5" y="2" width="14" height="20"/>
        <line x1="9.5" y1="2" x2="14.5" y2="2"/>
        <circle cx="12" cy="10" r="2.5"/>
        <path d="M8 17.5a4 4 0 0 1 8 0"/>
    </>,
    "id card": <>
        <rect x="2" y="5" width="20" height="14"/>
        <circle cx="8" cy="10.5" r="2.5"/>
        <path d="M4.5 16.5a3.5 3.5 0 0 1 7 0"/>
        <line x1="14" y1="10" x2="20" y2="10"/>
        <line x1="14" y1="14" x2="20" y2="14"/>
    </>,
    "hand paper": <>
        <rect x="6.5" y="9" width="11" height="12"/>
        <line x1="9" y1="9" x2="9" y2="4"/>
        <line x1="12" y1="9" x2="12" y2="2.5"/>
        <line x1="15" y1="9" x2="15" y2="4"/>
        <line x1="17.5" y1="12" x2="21" y2="10"/>
    </>,
    "hand point right": <>
        <rect x="2" y="9.5" width="8" height="5"/>
        <path d="M10 7.5h6.5a2.2 2.2 0 0 1 0 4.4h1.5a2.2 2.2 0 0 1 0 4.4H10z"/>
    </>,
    "hand point left": <>
        <rect x="14" y="9.5" width="8" height="5"/>
        <path d="M14 7.5H7.5a2.2 2.2 0 0 0 0 4.4H6a2.2 2.2 0 0 0 0 4.4H14z"/>
    </>,
    "comment": <polygon points="2.5,4 21.5,4 21.5,16 9,16 3.5,20.5 3.5,16 2.5,16"/>,
    "comments": <>
        <polygon points="1.5,3 15,3 15,12 6,12 2.5,15 2.5,12 1.5,12"/>
        <polygon points="9,14 22.5,14 22.5,20 20,20 17,22.5 17,20 9,20"/>
    </>,
    "paper plane": <>
        <polygon points="22,2.5 1.5,10.5 9,13.5 12,21.5"/>
        <line x1="9" y1="13.5" x2="22" y2="2.5"/>
    </>,
    "bell": <>
        <path d="M6 17v-6a6 6 0 0 1 12 0v6l2 3H4z"/>
        <path d="M9.8 20a2.2 2.2 0 0 0 4.4 0"/>
    </>,
    "bell slash": <>
        <path d="M6 17v-6a6 6 0 0 1 12 0v6l2 3H4z"/>
        <path d="M9.8 20a2.2 2.2 0 0 0 4.4 0"/>
        <line x1="3.5" y1="3.5" x2="20.5" y2="20.5"/>
    </>,
    "feed": <>
        <circle cx="5.5" cy="18.5" r="2" {...FILL}/>
        <path d="M3.5 11.5a9 9 0 0 1 9 9"/>
        <path d="M3.5 5a15.5 15.5 0 0 1 15.5 15.5"/>
    </>,
    "bullseye": <>
        <circle cx="12" cy="12" r="9"/>
        <circle cx="12" cy="12" r="5"/>
        <circle cx="12" cy="12" r="1.6" {...FILL}/>
    </>,

    /* ---------------------------------------------------------------- */
    /* Tempo                                                            */
    /* ---------------------------------------------------------------- */

    "clock": <>
        <circle cx="12" cy="12" r="9"/>
        <polyline points="12,6.5 12,12 16.5,14.5"/>
    </>,
    "calendar": <>
        <rect x="3" y="5" width="18" height="16"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
        <line x1="8" y1="2.5" x2="8" y2="7"/>
        <line x1="16" y1="2.5" x2="16" y2="7"/>
    </>,
    "hourglass half": <>
        <line x1="6" y1="2.5" x2="18" y2="2.5"/>
        <line x1="6" y1="21.5" x2="18" y2="21.5"/>
        <path d="M7.5 2.5v3.5L12 12l-4.5 6v3.5"/>
        <path d="M16.5 2.5v3.5L12 12l4.5 6v3.5"/>
        <polygon points="8.5,19.5 15.5,19.5 12,14.5" {...FILL}/>
    </>,
    "hourglass end": <>
        <line x1="6" y1="2.5" x2="18" y2="2.5"/>
        <line x1="6" y1="21.5" x2="18" y2="21.5"/>
        <path d="M7.5 2.5v3.5L12 12l-4.5 6v3.5"/>
        <path d="M16.5 2.5v3.5L12 12l4.5 6v3.5"/>
        <polygon points="7.5,20.5 16.5,20.5 12,13" {...FILL}/>
    </>
}

/*
 * Nome pedido -> nome canônico. Três motivos entram aqui:
 *   1. sinônimo puro do Semantic  (close = times, add = plus, dont = ban);
 *   2. par cheio/vazado que num sistema de traço é a MESMA forma
 *      (folder outline = folder, check circle outline = check circle);
 *   3. variante que não muda a leitura do símbolo
 *      (long arrow alternate right = arrow right, help circle = question circle).
 */
export const ALIASES: { [alias: string]: string } = {
    /* sinônimos */
    "add": "plus",
    "close": "times",
    "remove": "times",
    "dont": "ban",
    "dropdown": "caret down",
    "warning": "warning sign",
    "exclamation triangle": "warning sign",
    "help circle": "question circle",
    "spinner": "circle notch",
    "wait": "clock",
    "rss": "feed",
    "send": "paper plane",
    "git": "code branch",
    "sync": "refresh",
    "grid layout": "th",
    "list layout": "list",
    "list ol": "list",
    "list alternate": "list",
    "package": "cube",
    "erase": "eraser",

    /* ângulos: mesma forma do chevron */
    "angle down": "chevron down",
    "angle up": "chevron up",
    "angle left": "chevron left",
    "angle right": "chevron right",
    "right angle": "chevron right",

    /* setas equivalentes */
    "long arrow alternate right": "arrow right",
    "long arrow alternate left": "arrow left",
    "expand arrows alternate": "arrows alternate",
    "arrows alternate vertical": "arrows alternate",

    /* pares cheio/vazado */
    "circle outline": "circle",
    "square outline": "square",
    "dot circle outline": "dot circle",
    "check circle outline": "check circle",
    "check square outline": "check square",
    "times circle outline": "times circle",
    "plus circle outline": "plus circle",
    "plus square outline": "plus square",
    "minus square outline": "plus square",
    "pause circle outline": "pause circle",
    "play circle outline": "play circle",
    "stop circle outline": "stop circle",
    "folder outline": "folder",
    "folder open outline": "folder open",
    "file outline": "file",
    "file alternate outline": "file alternate",
    "file code outline": "file code",
    "file archive outline": "file archive",
    "file pdf outline": "file pdf",
    "sticky note outline": "sticky note",
    "clipboard outline": "clipboard",
    "bookmark outline": "bookmark",
    "flag outline": "flag",
    "star outline": "star",
    "lightbulb outline": "lightbulb",
    "eye slash outline": "eye slash",
    "bell outline": "bell",
    "bell slash outline": "bell slash",
    "user outline": "user",
    "id badge outline": "id badge",
    "id card outline": "id card",
    "image outline": "image",
    "clone outline": "clone",
    "copy outline": "copy",
    "edit outline": "edit",
    "trash alternate": "trash",
    "trash alternate outline": "trash",
    "comment outline": "comment",
    "comment alternate": "comment",
    "comment alternate outline": "comment",
    "comments outline": "comments",
    "calendar outline": "calendar",
    "calendar alternate": "calendar",
    "calendar alternate outline": "calendar",
    "clock outline": "clock",
    "hdd outline": "hdd",
    "hand paper outline": "hand paper",
    "hand point right outline": "hand point right",
    "hand point left outline": "hand point left",
    "list alternate outline": "list",
    "window maximize outline": "window maximize",
    "window minimize outline": "window minimize",
    "window restore outline": "window restore",
    "window close outline": "window close",
    "external square alternate": "external square",
    "external alternate": "external",

    /* ordenação: a seta manda, o alfabeto/número não muda o desenho */
    "sort alphabet down": "sort down",
    "sort numeric down": "sort down",
    "sort content descending": "sort down",

    /* aproximações declaradas */
    "th list": "list",
    "th large outline": "th large"
}

// Nome pedido -> nome do símbolo que será desenhado. Devolve null quando
// não existe símbolo — quem chama decide o que fazer (o Icon põe placeholder).
export const ResolveSymbolName = (name: string): string | null => {
    if (!name) return null
    const key = String(name).trim().toLowerCase().replace(/\s+/g, " ")
    if (SYMBOLS[key]) return key
    const alias = ALIASES[key]
    if (alias && SYMBOLS[alias]) return alias
    return null
}

// Nomes com desenho próprio, em ordem — a grade do catálogo lê daqui.
export const SYMBOL_NAMES: string[] = Object.keys(SYMBOLS).sort()

// Todo nome aceito (desenho próprio + apelido).
export const ICON_NAMES: string[] = SYMBOL_NAMES.concat(Object.keys(ALIASES)).sort()

// Apelidos agrupados pelo símbolo que desenham — o catálogo mostra isso para
// que ninguém ache que um nome "sumiu" do kit.
export const ALIASES_BY_SYMBOL: { [symbol: string]: string[] } = Object.keys(ALIASES)
    .sort()
    .reduce((accumulator: { [symbol: string]: string[] }, alias) => {
        const target = ALIASES[alias]
        accumulator[target] = (accumulator[target] || []).concat(alias)
        return accumulator
    }, {})
