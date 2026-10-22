# Entrada direta no passageiro original — desenvolvimento

A orientação atual é adiar a autenticação própria e abrir primeiro o núcleo do aplicativo. Esta etapa substitui, no build BR de desenvolvimento, a passagem obrigatória pelo onboarding descrita em [PASSAGEIRO-TELEFONE.md](PASSAGEIRO-TELEFONE.md).

## Implementação

- A flag `__YATRI_BR_DEVELOPMENT__` existe exclusivamente no HTML de `app/src/brTest/assets`, que o Gradle inclui somente no debug com `-PbrTestMode=true`.
- `Engineering.Helpers.DevelopmentMode` exige flag booleana explícita e pacote Android terminado em `.debug`. Erros de leitura fecham o gate. Configurações de preferências e parâmetros de URL não habilitam o modo.
- `Main` entra em `Development.Passenger` nesse modo. A execução normal mantém o fluxo histórico. Não altera a autenticação ou a autorização do backend.
- A tela é **`Screens.HomeScreen.View.view` original**, com seus componentes, estilos, mapa e animações. Não há outra implementação visual nem uma Activity Java substituta.
- O controlador de desenvolvimento não inicia OTP, validação de token, perfil, endereços salvos, histórico, ofertas, notificações push, pagamentos, segurança de viagem ou atualização remota. Estes serviços não são pré-condições para renderizar a home.
- O nome Fagner é uma preferência local de exibição. Não representa uma conta autenticada: nenhum ID de passageiro ou token é inventado ou gravado.
- A localização usa os métodos nativos existentes, solicita a permissão Android e atualiza origem/câmera somente com coordenadas válidas recebidas do serviço. Ausência de GPS não deve impedir a abertura da home.
- O botão central abre os campos originais de origem e destino, que permitem edição e retorno à home. Busca de endereços, seleção no mapa e corridas ainda não têm integração operacional neste controlador: ações correspondentes informam essa pendência, sem gerar sugestões, tarifas ou viagens fictícias.
- Serviços opcionais de Remote Config usam seus **defaults locais existentes** nesse modo, por um provedor separado. O decoder de configuração do merchant e os decoders de respostas de API permanecem intactos. Não é uma resposta simulada de backend.
- O menu paralelo não oferece as opções que exigem serviços ainda desativados; seu componente original e a ação de fechar são mantidos.

## Verificação

`node Frontend/scripts/test-development-mode.mjs` testa o gate real usado pelo frontend: flag ausente, tipo incorreto, pacote release/staging, pacote debug e falhas da bridge. Passou localmente. O CI executa o mesmo comando.

O teste Android foi ampliado para verificar: home original sem token, abertura sem rede, ausência de telefone/OTP, botão `Where To` real, edição dos campos originais, retorno e nova abertura com rede. Publica PNG, hierarquia Android e logs sanitizados. O teste não interpreta o simples carregamento do mapa como validação de Places/Routes ou de uma corrida.

A compilação e o teste do novo modo ainda estão pendentes nesta versão do relatório. Nenhum APK da etapa anterior deve ser apresentado como contendo a entrada direta.

## Limites

Este modo libera o frontend para desenvolvimento do núcleo. Não autentica usuários e não permite operar contas do backend. Corridas, localização de motorista, rotas, sugestões reais e comunicação passageiro–motorista exigem integração posterior e não são declaradas operacionais.

A autenticação futura continuará no backend próprio, com autorização por conta. As permissões necessárias do Android continuam sendo solicitadas. Nenhum backend, serviço Alce ou ambiente de produção foi modificado ou publicado.
