# Yatri Brasil — situação do projeto

Atualizado em: 2026-10-22. Este documento registra o histórico reportado durante o desenvolvimento; os itens assinalados como pendentes requerem auditoria do estado atual.

## Diretrizes confirmadas
- Yatri Brasil é a frente principal de desenvolvimento.
- Alce App permanece um piloto independente, sem alterações nem integração automática.
- Reutilizar a base Namma Yatri, minimizando reescritas.
- Não confundir protótipo de interface com operação de mobilidade validada.

## Histórico técnico reportado
- Código original do frontend passageiro em PureScript/PrestoDOM recuperado e compilado em uma execução anterior.
- APK com interface original já gerado; posteriormente foi relatado protótipo funcional do passageiro.
- Controlador de desenvolvimento reportado em `Frontend/ui-customer/src/Development/Passenger.purs`, visando abrir `Screens.HomeScreen.View.view` sem telefone/OTP no APK debug.
- Branch de trabalho usada: `codex/issue-1-purescript-memory`.
- Compilações PureScript longas e encerradas com exit 124 em execuções anteriores, entre elas #39791852321 e #39797933448.
- Ajustes de timeout/cache e modo de compilação staged foram reportados nos commits `a687e40` e `dd0b7ec`. Sua eficácia na execução atual **ainda deve ser comprovada**.
- Dependência de debug LeakCanary foi identificada anteriormente; não há confirmação aqui de sua remoção.
- Backend brasileiro e fluxo operacional completo ainda não foram comprovados como integrados à UI original.

## Confirmar na auditoria inicial
- SHA atual do código e versão exata do APK testado.
- Se HomeScreen, mapa, campo de destino, edição de origem e retorno realmente funcionam no dispositivo Android.
- Qual workflow gera o APK atual, se o modo staged é usado e quanto tempo demanda com cache frio e quente.
- Se o bypass de autenticação é exclusivo de debug; verificar release.
- Inventário dos serviços indianos chamados pela HomeScreen e dependências nativas.
- Endpoints e banco efetivamente existentes do backend Yatri Brasil.
- Estado do aplicativo do motorista, dos mecanismos de segurança, geolocalização em segundo plano e notificações.
- Licenças e obrigações de distribuição da base derivada.

## Regra de evidência
Use os estados `IMPLEMENTADO`, `COMPILADO`, `TESTADO EM ANDROID` e `VALIDADO DE PONTA A PONTA` separadamente. Sem prova (run, testes, logs ou vídeo/screenshot verificável), marque `NÃO VALIDADO`.

## Próximo marco
Obter uma versão reproduzível do APK passageiro com HomeScreen original e navegação funcional, acompanhada de diagnóstico das dependências e de um ciclo incremental de compilação. Em seguida: origem/destino reais, rota/cotação e primeiro fluxo de corrida com backend brasileiro.
