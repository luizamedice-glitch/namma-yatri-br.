# Mobilidade Brasil — piloto local

Código na branch `passageiro-pt-br` do repositório
[`luizamedice-glitch/namma-yatri-br.`](https://github.com/luizamedice-glitch/namma-yatri-br./tree/passageiro-pt-br).
O ponto final faz parte do nome do repositório.

Downloads e certificados dos APKs desta versão estão em [ENTREGA.md](ENTREGA.md).

Dois clientes Android independentes do HyperSDK compartilham uma API Node e
PostgreSQL. Nenhuma corrida é criada ou aceita automaticamente por usuários
fictícios. Para conhecer o que foi efetivamente testado, consulte
[VERIFICACAO.md](VERIFICACAO.md); limitações estão em [DECISOES.md](DECISOES.md).

## Iniciar backend e banco

Requisitos: Docker Compose, rede para baixar imagens/dependências e acesso às
APIs Google se for calcular rotas. Da raiz do repositório:

```bash
cd brasil
cp .env.example .env
# Edite .env: defina senha local aleatória e convite com pelo menos 16 caracteres.
# Defina GOOGLE_MAPS_SERVER_KEY para Places (New) e Routes.
docker compose up --build -d
curl http://127.0.0.1:8080/health
docker compose logs -f api
```

Migrations são aplicadas antes de iniciar a API; falha de banco impede a
inicialização. O banco persiste em volume. `docker compose down` preserva dados;
não use `down -v` se quiser manter os testes. O compose publica somente na
interface local; não expõe o PostgreSQL.

Alternativa com PostgreSQL 16 instalado e Node 22:

```bash
cd brasil/backend
cp .env.example .env
# Crie banco/usuário locais, ajuste DATABASE_URL, convite e chave Google.
npm ci --ignore-scripts
npm run migrate
npm start
```

Não execute o servidor `legacy/`. Configure somente `GOOGLE_MAPS_SERVER_KEY`
no servidor; a chave Android não substitui a chave servidor. O serviço responde
503 se mapas não estiverem configurados e 502/422 em indisponibilidade/rota
ausente. Não usa rota reta, sugestão ou tarifa simulada como fallback.

## Compilar e instalar Android

Requisitos: JDK 17, Gradle 8.9, Android SDK 35 e build tools. O projeto novo
é `brasil/android`; o build Android legado permanece separado.

```bash
cd brasil/android
# Exporte GOOGLE_MAPS_API_KEY e opcionalmente MOBILITY_API_URL no seu ambiente.
gradle :app:assemblePassageiroDebug :app:assembleMotoristaDebug
adb install app/build/outputs/apk/passageiro/debug/app-passageiro-debug.apk
adb install app/build/outputs/apk/motorista/debug/app-motorista-debug.apk
adb reverse tcp:8080 tcp:8080
```

No primeiro acesso, toque em **Configurar servidor de testes**. Para dispositivos
via `adb reverse`, use `http://127.0.0.1:8080` nos dois apps. Para emuladores no
mesmo computador, o padrão é `http://10.0.2.2:8080`. Para rede local, mantenha o
acesso privado e configure o bind do backend conscientemente. Não abra portas
públicas. HTTP é permitido apenas nos APKs debug; release exige HTTPS.

ApplicationIds: `br.com.namma.mobilidade.passageiro` e
`br.com.namma.mobilidade.motorista`. Cadastre ambos e o SHA-1 de assinatura nas
restrições da chave Maps SDK Android. Um certificado debug local pode diferir
do usado pelo GitHub Actions; valide com `gradle :app:signingReport` no ambiente
de build. Nunca coloque GOOGLE_MAPS_SERVER_KEY no Gradle, manifest ou APK.

Workflows separados `BR - APK Passageiro` e `BR - APK Motorista` usam o secret
`GOOGLE_MAPS_API_KEY` e a variável opcional `MOBILITY_API_URL`; seus artefatos
`passageiro-debug-apk` e `motorista-debug-apk` ficam na página da execução em
[Actions](https://github.com/luizamedice-glitch/namma-yatri-br./actions).
São APKs debug para testes privados, sem publicação em loja.

## Operar uma corrida de teste

1. Abra cada APK, configure o mesmo servidor e crie uma conta por convite em
   cada um. O motorista informa placa brasileira, modelo e cor do veículo de
   teste. Use contas diferentes; elas serão persistidas no banco real.
2. Autorize localização no motorista, aguarde GPS recente e toque em **Ficar
   disponível**. Mantenha a Activity aberta para ver ofertas; o serviço de
   localização acompanha a navegação externa com indicação do Android.
3. No passageiro, selecione origem por GPS ou pesquisa. Pesquise destino e
   selecione uma sugestão real. Origem e destino podem ser editados antes do pedido.
4. Toque em **Calcular rota e estimativa**. Confira marcadores, rota, distância,
   tempo e tarifa informativa. Sem rota válida, não é possível solicitar.
5. Toque em **Solicitar corrida**. Motoristas disponíveis a até 5 km (configurável)
   com GPS atualizado recebem oferta. Recuse ou aceite no motorista.
6. Confira nome e veículo no passageiro. No motorista, **Navegar até a origem**
   abre navegação externa; volte à Activity para continuar o teste. Toque em
   **Cheguei à origem**, **Iniciar viagem** e **Concluir viagem**, nessa ordem.
7. Confira o histórico nos dois aplicativos. Cancelamento está disponível antes
   de iniciar. Sem motoristas próximos, o pedido permanece em busca e expira em
   10 minutos; nenhum motorista é inventado.

Não utilizar em operação com passageiros reais: o rastreamento pelo serviço
foreground e o fluxo completo com Google real ainda exigem validação em dispositivos.

## Verificação

```bash
cd brasil/backend
npm test
# Use exclusivamente um banco de testes: o runner cria e apaga seu schema.
DATABASE_URL=postgresql://usuario:senha@localhost:5432/mobilidade_test npm run test:integration
cd ../android
gradle :app:lintPassageiroDebug :app:lintMotoristaDebug
gradle :app:connectedPassageiroDebugAndroidTest :app:connectedMotoristaDebugAndroidTest
```

Os testes de cadastro e logout pelo Android requerem backend local em execução
e `-Pandroid.testInstrumentationRunnerArguments.BR_TEST_INVITE=SEU_CONVITE_DE_TESTES`
no comando Gradle. Sem esse argumento, esses testes são explicitamente ignorados;
os testes de abertura e polyline continuam offline. No workflow do emulador,
PostgreSQL e Node são iniciados no runner e o argumento é fornecido automaticamente.
Use ambiente exclusivo de testes: esse teste cadastra contas reais no banco.

Integração exercita HTTP real e PostgreSQL real, com somente o transporte Google
substituído por fixture explícita de teste. Essa fixture não existe no servidor
de operação. Teste de abertura e screenshots não comprovam uma corrida completa
nos APKs. Contrato REST está em [backend/openapi.json](backend/openapi.json),
com detalhes de SSE em [backend/API.md](backend/API.md).

Relatório por funcionalidade: [FUNCIONALIDADES.md](FUNCIONALIDADES.md).
