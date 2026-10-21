# Atribuições e escopo

Este trabalho faz parte da adaptação brasileira do Namma Yatri. O código histórico,
seus avisos de copyright, atribuições e a licença AGPL na raiz do repositório
permanecem preservados. O Android original contém avisos de copyright de
Juspay India Pvt Ltd (2022–23); estes avisos não foram removidos nem substituídos.

Os módulos novos em `brasil/` são fornecidos sob AGPL-3.0-or-later, em continuidade
com a licença do projeto. Google Maps SDK e serviços Google continuam sujeitos
às respectivas condições de uso; suas credenciais e serviços não fazem parte da
licença AGPL. `pg` e suas dependências mantêm suas licenças próprias.

A implementação de mapas HTTP preexistente está preservada em
`backend/legacy/maps-server.mjs` exclusivamente como referência. Não execute esse
arquivo como servidor de operação: ele não contém o controle de sessões do novo
servidor.

Não se afirma reutilização dos componentes visuais de motorista acoplados ao
HyperSDK. Foram investigados e preservados para extração posterior. Os clientes
nativos brasileiros compartilham uma implementação Java nova, com perfis
separados e identificadores de aplicação distintos.

## Tipografia original reutilizada

Os builds Yatri Brasil recuperam Plus Jakarta Sans Regular e SemiBold diretamente de `Frontend/android-native/app/src/main/assets/fonts/`. Copyright 2020 The Plus Jakarta Sans Project Authors; SIL Open Font License 1.1 em `android/attribution/PlusJakartaSans-OFL.txt`, também incluída nos assets dos APKs. As Views PureScript e os bundles históricos permanecem preservados; isso não significa que já executem no cliente brasileiro.
