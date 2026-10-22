# Correção do formulário original de telefone

> Orientação posterior: o build BR de desenvolvimento passa a abrir diretamente a home original. Consulte [PASSAGEIRO-ENTRADA-DIRETA.md](PASSAGEIRO-ENTRADA-DIRETA.md). A correção de telefone permanece no fluxo histórico, que não é a porta de entrada desse modo.

A correção está implementada no PR #2. O teste de regressão reproduziu a falha no APK anterior; os testes do validador passaram localmente e no CI. A validação do novo APK está em andamento na [execução 39785756375](https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/39785756375).

## Problemas observados

Em 22/10/2026, o teste em celular físico encontrou dois bloqueios no APK histórico publicado anteriormente:

1. Dígitos eram aceitos, mas `Continue` permanecia desativado para um telefone brasileiro. O componente selecionava `+91`, limitava a entrada a dez dígitos e aplicava a validação indiana.
2. Um número no formato indiano habilitava o botão, mas o envio levava à tela `You're Offline`. O APK foi montado sem um backend de autenticação: `CONFIG_URL_USER` fica vazio no arquivo de propriedades de teste. `MainActivity.updateConfigURL` grava esse valor em `BASE_URL`; `Services.Config.getBaseUrl` o devolve ao frontend. O tratamento histórico de erros de transporte (`code == -1`) em `withAPIResultBT` abre a tela de ausência de internet, inclusive para uma chamada sem servidor configurado.

A segunda captura não prova que o celular estava sem internet. Também não prova que algum OTP tenha sido entregue.

## Reprodução independente

O teste `Frontend/scripts/test-original-phone.py` usa o APK real no Android 29, restaura a rede, navega pelos controles originais com `adb` e digita onze dígitos. Não substitui o estado do controlador nem injeta respostas de APIs.

[Execução anterior à correção, 39784948676](https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/39784948676): falha reproduzida. A hierarquia Android mostra entrada `1198765432` após tentar digitar `11987654321`, país `+91` e descrição do botão `Enter a valid Mobile Number to continue`. O décimo primeiro dígito foi descartado pelo filtro nativo. A reprodução não clica em Continuar nem solicita OTP.

[Evidências da reprodução](https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/39784948676/artifacts/12428283394).

## Alterações

- O passageiro inicia com país Brasil, código `+55`, e mantém o seletor original, incluindo a opção Índia.
- O validador compartilhado ganha exclusivamente o caso `BR`, com onze dígitos ASCII, DDD brasileiro existente e assinante móvel iniciando em `9`. As regras dos demais países permanecem inalteradas.
- O módulo PureScript puro `Engineering.Helpers.BrazilianMobileNumber` separa a regra brasileira para permitir testes sem Android, serviços ou mocks de backend. O filtro do componente histórico passa a usar o limite brasileiro por meio de `mobileNumberMaxLength`.
- Quando a URL da API está vazia, o formulário mostra `Backend de testes não configurado.`. O clique no botão original mantém o formulário, encerra seu indicador de carregamento e explica por toast que não é possível autenticar nesta versão. Os dois canais de OTP, SMS e WhatsApp, recebem essa proteção antes de sair da tela ou chamar a API.
- Com uma URL preenchida, o fluxo histórico de autenticação permanece responsável pela chamada real. Compatibilidade com um backend brasileiro ainda precisa ser implementada e validada.

Foram preservados os layouts, a navegação do onboarding, os componentes PrestoDOM, os ícones e a tipografia originais. Não foram criadas telas Java, sessões fictícias, respostas de OTP, credenciais ou um novo backend. O backend brasileiro e a função compartilhada com o Alce não foram alterados.

## Testes

O comando abaixo compila o módulo **usado em produção** e suas 92 dependências com o compilador PureScript, e executa as funções geradas com Node:

```sh
python3 Frontend/scripts/test-brazilian-mobile-number.py
```

Requer `purs` 0.15.14, Node e as dependências `.spago` já instaladas em `ui-customer`. `PURS` pode apontar para o executável explicitamente. Não modifica as versões das dependências.

Resultado local: passaram quatro números sintáticos válidos, seus 48 prefixos, 14 entradas inválidas e oito prefixos inválidos. Inclui DDD inexistente, prefixo de telefone fixo, excesso de dígitos, letras, espaços, código internacional duplicado, algarismos Unicode e quebra de linha. Nenhuma entrada é enviada a um serviço. [Log](build-reports/passageiro-telefone/validator.txt).

O teste Android ampliado verifica entrada completa, `+55`, habilitação do botão pelo controlador, tratamento da ausência de backend ao clicar e desativação após um prefixo inválido. O clique só ocorre depois de confirmar o aviso explícito de backend ausente. O teste de abertura sem rede permanece na mesma execução.

## Limites

O contrato existente em `brasil/backend/API.md` oferece `POST /v1/development/session` com `{role,credential}` e resposta `{token,user}`. O frontend histórico chama `/auth` para obter um identificador de OTP, seguido da verificação de token. Esses contratos são diferentes: apontar a URL para o Node brasileiro, isoladamente, não resolve a autenticação. Nenhuma chamada de teste foi feita a esses endpoints nesta correção.

Reconhecer um número brasileiro e tratar a ausência de servidor **não autentica o passageiro**. Este trabalho não implementa a sessão automática de Fagner nem desbloqueia uma operação de corridas. A aplicação continuará sem acesso operacional até que exista uma integração real com um backend de desenvolvimento exclusivo. Não se deve digitar números de terceiros para tentar o OTP histórico.

A tradução completa, a identidade Yatri Brasil, Google Maps/Places/Routes, o motorista e o fluxo de viagens não foram validados nesta correção. Os erros de callbacks e as limitações de recursos remotos registrados em [PASSAGEIRO-ANDROID-ORIGINAL.md](PASSAGEIRO-ANDROID-ORIGINAL.md) continuam pendentes, salvo evidência posterior específica.

Na captura `phone-typed.png` da reprodução anterior à correção também aparece `Config Decode Failed ... ErrorAtProperty enable ... Undefined`, referente à configuração remota histórica. Este erro de configuração não foi tratado como falha do teclado nem suprimido. A recuperação dos valores locais desse recurso continua pendente; a correção do telefone não afirma eliminar todos os avisos do SDK.
