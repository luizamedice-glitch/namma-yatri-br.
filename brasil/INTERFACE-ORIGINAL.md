# Recuperação das interfaces originais

A adaptação visual está incompleta. O cliente Java brasileiro anterior não reproduz os aplicativos indianos; os testes dele não certificam fidelidade. Nenhum template novo foi criado nesta revisão.

## Fontes recuperados e verificados

Os arquivos históricos continuam em seus diretórios, sem alteração. O inventário `original-ui-manifest.json` registra tamanho e SHA-256 de 21 fontes/recursos selecionados. Execute `node brasil/scripts/audit-original-ui.mjs --verify` na raiz para conferir sua integridade.

| Parte | Fonte principal |
| --- | --- |
| Principal passageiro e seus estados | `Frontend/ui-customer/src/Screens/RideBookingFlow/HomeScreen/` |
| Pesquisa e edição de endereços | `Frontend/ui-customer/src/Screens/SearchLocationFlow/SearchLocationScreen/` |
| Seleção de corrida | `Frontend/ui-customer/src/Screens/CustomerUtils/RideSelectionScreen/` |
| Principal motorista | `Frontend/ui-driver/src/Screens/HomeScreen/` |
| Cartões e ações motorista | `Frontend/ui-driver/src/Components/{RideActionModal,RideAllocationModal,RideRequestCard}/` |
| Botão original | `Frontend/ui-common/src/Components/PrimaryButton/` |
| Tipografia | `Frontend/ui-common/src/Font/`, `Frontend/android-native/app/src/main/assets/fonts/` |
| Bundles históricos | `Frontend/android-native/app/src/{user/nammaYatri,driver/nammaYatriPartner}/assets/juspay/index_bundle.js` |

O build brasileiro agora copia os arquivos originais `PlusJakartaSans-Regular.ttf` e `PlusJakartaSans-SemiBold.ttf`, sem duplicá-los ou alterá-los no Git. O cliente os usa no texto e nos botões. A licença OFL acompanha os assets do APK. Isso é reutilização de tipografia, não recuperação completa das telas.

## Dependências de execução

As Views estão em PureScript/PrestoDOM; não são layouts Android XML. O passageiro referencia os estados originais de pesquisa, confirmação, busca, aceite e viagem dentro de `HomeScreen/View.purs` (5.586 linhas); a View principal do motorista tem 3.781 linhas. O botão de destino original tem altura 60, raio 8, margens horizontais 16 e ícone `ny_ic_bent_right_arrow`, conforme `whereToButtonConfig`.

`Frontend/packages.dhall` aponta PureScript 0.15.4 e forks de presto, presto-dom, halogen-vdom, foreign-generic e tracker. As branches `nammayatri` dos forks públicos de `presto-ui` e `purescript-presto-dom` foram consultadas com sucesso. A disponibilidade deles não comprova um build independente.

Os bundles encontrados têm 14.177.108 bytes (passageiro) e 12.099.751 bytes (motorista). Eles não foram executados no cliente brasileiro: o entrypoint histórico utiliza `JOS`, `JBridge`, `Android`, `DUI_READY`, configuração de aplicação e callbacks do HyperSDK. Copiá-los para uma WebView não resolve essa ponte. O renderer independente, o despacho dos Actions originais e a ligação dos estados originais aos eventos brasileiros permanecem por implementar.

Não foram adicionados HyperSDK, Firebase, analytics, KYC ou dependências de pagamentos ao cliente brasileiro. O backend original Haskell permanece preservado; o fluxo brasileiro continua em Node/PostgreSQL, evitando Kafka/Redis/Beckn/serviços indianos como pré-requisitos do teste.

## Comparação limitada com a Play Store — 21/10/2026

Foram consultadas as páginas oficiais indicadas pelo usuário e examinadas capturas promocionais das duas lojas:

- Passageiro: `Namma Yatri: Auto, Cab & Metro`, pacote `in.juspay.nammayatri`. A imagem inicial mostra seleção em sheet com categorias Auto, Auto Priority, AC Mini, Sedan, XL Cab e XL Premium; outra mostra mapa e cartão do motorista com placa, veículo e ações circulares.
- Motorista: `Namma Yatri Driver Partner`, pacote `in.juspay.nammayatripartner`. A imagem de aceite mostra cartões de oferta, distâncias até embarque/destino, duração, preço e aceite por gesto/voz.

São imagens promocionais, não capturas produzidas por esta execução dos APKs oficiais. Sem instalar as versões publicadas, não é possível afirmar equivalência de todas as telas, animações e configurações por cidade. O código histórico possui variantes de tela e configurações comerciais; a configuração padrão do passageiro usa `#2C2F3A` / `#FCC32C`. Isso não permite presumir que a versão atualmente publicada use exatamente a mesma composição. A interface Java brasileira continua divergente dessas referências.

As imagens baixadas para conferência são evidência local, separada das capturas dos aplicativos brasileiros; não foram usadas para fingir telas implementadas.
