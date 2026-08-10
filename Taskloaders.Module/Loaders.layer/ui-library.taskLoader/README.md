# ui-library.taskLoader

Carrega um pacote `.uilib` como biblioteca de interface. O handle resultante
expõe a pasta de fontes, o ambiente npm compartilhado e o manifesto
`metadata/uilib.json` para builders de qualquer tecnologia front-end.

O loader não conhece React, Vue ou outra stack. A tecnologia é declarada no
manifesto e interpretada pelo adaptador registrado no `web-interface-builder`.
