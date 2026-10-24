# Português do Brasil no passageiro BR

`pt-BR.json` cobre as 1.789 chaves do catálogo original, inclusive 125 funções
currificadas. Os 309 textos listados em `reviewed-pt-BR.txt` têm revisão manual,
assim como os rótulos/acessibilidade em `reviewed-literals-pt-BR.txt` e os recursos
Android em `app/src/brTest/res/values-pt-rBR/strings.xml`. Os demais textos têm
tradução inicial automática e precisam de revisão funcional antes de ativar os
respectivos recursos secundários (pagamentos, segurança, transporte público etc.).

O Webpack Android adapta o record do catálogo inglês usado como fallback quando
`languageKey=PT_BR`, sem alterar contratos ou output PureScript. Um plugin Babel
localiza somente literais de propriedades de apresentação PrestoDOM e toasts,
sem substituir identificadores, dados de usuário, endereços ou requisições.
A implementação original continua disponível via `?br-original-locale`.

Ativação exige ANDROID, as flags imutáveis do entrypoint BR e pacote `.debug`.
Produção, WEB/iOS e motorista preservam seus recursos originais. O contexto
Android recebe `pt-BR`; o idioma do dispositivo permanece intacto. Moedas e
valores de funcionalidades legadas não são convertidos para reais, nem se
presume integração brasileira desses serviços.

Validação: `python3 Frontend/scripts/validate-portuguese-catalog.py` e
`node --test Frontend/scripts/test-portuguese-localization.mjs`. O CI também testa
o adaptador com o catálogo PureScript compilado real e valida a Home original.
Não é necessário recompilar `Flow` para atualizar o JSON e o texto revisado.

## Proveniência da tradução inicial

Tradução local/offline com OPUS-MT, idioma-alvo brasileiro `>>pob<<`:
Helsinki-NLP, **opus-mt-tc-big-en-pt** (CC-BY 4.0),
https://huggingface.co/Helsinki-NLP/opus-mt-tc-big-en-pt . Conversão CTranslate2
int8 de https://huggingface.co/playto-mt/opus-mt-tc-big-en-pt-ct2 , revisão
`86bd3fee2b37851b8eb86747c1078b885f5808fd`.
O modelo e as ferramentas de tradução não fazem parte do APK nem das dependências
do projeto. As traduções foram adaptadas à terminologia de mobilidade brasileira.
