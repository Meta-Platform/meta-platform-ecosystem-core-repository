import * as React from "react"

// Skeleton de carregamento no estilo Meta System Retro-Brutalist (blocos
// retangulares com shimmer em tons de papel) — melhor que spinner solto para
// listas, tabelas e grades. §11.2 do guia.
//
// variant:
//   "list"  (default) — N linhas: ícone + barra + chip
//   "cards"           — grade de cards com ícone + duas barras
const WIDTHS = ["md", "sm", "md", "grow", "sm", "md", "grow", "sm"]

export const ListSkeleton = ({ lines = 6, variant = "list" }:any) => {
    if(variant === "cards")
        return <div className="mp-skeleton-cards" aria-hidden="true">
            {
                Array.from({ length: lines }).map((_, i) =>
                    <div key={i} className="mp-skeleton-card">
                        <span className="mp-skeleton mp-skeleton--icon"/>
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
                            <span className="mp-skeleton mp-skeleton--md"/>
                            <span className="mp-skeleton mp-skeleton--sm"/>
                        </div>
                    </div>)
            }
        </div>

    return <div className="mp-skeleton-list" role="status" aria-label="loading" aria-live="polite">
        {
            Array.from({ length: lines }).map((_, i) =>
                <div key={i} className="mp-skeleton-row">
                    <span className="mp-skeleton mp-skeleton--icon"/>
                    <span className={`mp-skeleton mp-skeleton--grow mp-skeleton--${WIDTHS[i % WIDTHS.length]}`}/>
                    <span className="mp-skeleton mp-skeleton--chip"/>
                </div>)
        }
    </div>
}

export default ListSkeleton
