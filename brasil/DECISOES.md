# Decisões de engenharia — 21/10/2026

## Backend

O `Backend/cabal.project` original reúne aplicações de passageiro, motorista,
allocators, schedulers, Beckn, pagamentos, Kafka consumers e vários módulos
compartilhados. Seu README exige serviços como PostgreSQL, Redis, Kafka,
Passetto e OSRM. Preservamos integralmente esse conjunto como referência;
portá-lo inteiro aumenta o trabalho de configuração antes de validar uma única
corrida brasileira.

Escolha inicial: ampliar `brasil/backend/` com Node 22, HTTP nativo e `pg`.
PostgreSQL é obrigatório em execução normal e nos testes de integração. Não há
fallback silencioso para memória, SQLite ou dados de demonstração. Maps e Places
são chamados pelo servidor usando exclusivamente GOOGLE_MAPS_SERVER_KEY.

Viagens possuem `searching → accepted → arrived → in_progress → completed`.
Cancelamento é permitido antes do início, por participante autorizado.
Solicitações sem aceite expiram em 10 minutos. Cotações expiram em 5 minutos;
uma cotação pode produzir somente uma viagem, inclusive em reenvios de rede.
O cliente não define tarifa, distância ou motorista.

Transações de despacho, disponibilidade e viagens usam um advisory lock de
transação PostgreSQL compartilhado entre processos. Índices únicos parciais
garantem no máximo uma corrida ativa por passageiro e por motorista. Isso
simplifica a correção concorrente no piloto; limita throughput e deve ser
substituído por locks por viagem/motorista antes de crescimento relevante.

Busca próxima usa distância geodésica no SQL, raio configurável e posição com
menos de 60 segundos. Aceite revalida raio, oferta, disponibilidade e GPS.
Recusas persistem; o mesmo par motorista/viagem não é oferecido novamente.
Não há otimização de ETA até a origem nem PostGIS nesta fase.

Eventos SSE são persistidos por usuário, com cursor monotônico e reconexão.
O servidor verifica eventos a cada segundo; o despachante verifica a fila a
cada 3 segundos e também após alterações. O Android consulta um snapshot
autorizado ao reconectar e ao receber evento. Não depende de afinidade entre
instâncias nem de barramento externo. Um evento não é confirmação de entrega;
snapshot e histórico são a fonte de recuperação após desconexões.

Cadastro é por convite de ambiente de testes, email e senha. Não representa
verificação de identidade, licença para dirigir ou titularidade de email.
Senhas usam scrypt com sal aleatório. Sessões usam 256 bits de entropia, hash
SHA-256 no banco e validade de 7 dias. O Android cifra o token com Android
Keystore e desativa backup. Não há contas pré-semeadas nem senha de operação
compartilhada no código. Testes criam suas próprias contas em schema descartável.

## Android

`Frontend/android-native/app/build.gradle` exige HyperSDK, HyperQR,
HyperSMSHandler, Firebase, Facebook e CleverTap. A Activity principal instancia
Firebase e remote configs e controla sua inicialização por callbacks HyperSDK.
Apenas desativar plugins Gradle não remove a dependência em runtime.

Escolha inicial: projeto Gradle independente em `brasil/android`, Java 17,
Android mínimo 26, compile/target 35, Google Maps SDK oficial. Dois flavors
produzem aplicativos instaláveis juntos, com perfil fixo passageiro/motorista.
Nenhum source set, manifest ou inicializador do legado é incluído no novo build.
Não foram apagados os projetos originais nem seus recursos.

A chave Android é incorporada no APK conforme funcionamento do SDK; deve ser
restrita por applicationId e SHA-1 do certificado de cada build. A chave do
servidor nunca é incluída nos APKs. Um APK sem chave abre o acesso normalmente,
mas informa a indisponibilidade do mapa, sem simular sua exibição.

SSE e ofertas são acompanhados com a Activity em primeiro plano. O motorista
usa serviço foreground de localização com indicação persistente do Android,
iniciado com o app visível ao ficar disponível ou recuperar uma corrida ativa.
Ele continua reportando GPS durante navegação externa, sem Firebase ou push.
O serviço agenda envios com intervalo após cada tentativa, em vez de acumular
requisições na fila da Activity durante perda de rede. Ele não envia posições
com idade superior a 30 segundos na origem da tentativa. A Activity revalida a
idade do GPS antes do envio inicial para ativar disponibilidade.
Ao ficar indisponível sem
corrida ativa ou sair da conta, o serviço para. A continuidade sob economia de
bateria, revogação de permissão e fabricantes diferentes precisa de validação
em dispositivos reais; não considerar pronta para um turno real de motorista.

## Dependências

| Dependência original | Fluxo brasileiro novo |
| --- | --- |
| Juspay HyperSDK / HyperQR / HyperSMSHandler | Excluídos do build brasileiro; legado preservado |
| Firebase, FCM, Crashlytics, Remote Config, analytics | Excluídos do build brasileiro |
| CleverTap, Facebook SDK, HyperKYC | Excluídos do build brasileiro |
| APIs indianas, Beckn e assets remotos Juspay | Sem chamadas no fluxo novo |
| Pagamentos e SMS | Fora da primeira fase |
| Google Maps | Mantido pelo SDK oficial; obrigatório para mapa real |
| Places (New) e Routes | Integração real no backend; chave separada e sem fallback |
| Haskell / Kafka / Redis / OSRM / Passetto | Preservados no legado, fora da execução brasileira |
| PostgreSQL e pg | Persistência obrigatória do backend brasileiro |

## Limites de operação

API limitada por IP (120 requisições/minuto; autenticação 15/minuto), corpo JSON
até 20 KB e limite de 200 conexões SSE por processo. Não se confia em cabeçalhos
forwarded. Não é uma proteção distribuída nem substitui TLS e perímetro privado.
Convite não substitui um processo de cadastro de produção. Sem reset de senha,
administração, política de retenção/remoção LGPD, auditoria operacional ou suporte
a emergências. Histórico retorna as últimas 100 viagens. Desenho da rota usa
tempo estimado Google da cotação; não há recálculo contínuo de tráfego.

Nada foi implantado em produção, nem foi criado endpoint público. Google pode
exigir projeto com faturamento já habilitado: código e exemplos não habilitam
serviços, criam recursos nem alteram quotas ou cobrança.
