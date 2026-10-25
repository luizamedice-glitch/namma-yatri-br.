# Corrida com mapa e GPS — 25/10/2026

Fontes APK: `6c0542d4b11b0b59cbeb77cfebabe503dd1315d5`.
Run **40145108191 aprovado**, Pixel 2/API 29. Relatório estruturado em
[40145108191.json](40145108191.json). Backend `2ff16a8`, implantação
40142001067; contratos PostgreSQL/HTTP 40142200365 aprovados.

## Resultado confirmado

Dois APKs reais, ativados pela interface, contra Google e Lightsail/PostgreSQL.
Pedido → oferta correspondente → aceite → chegada → início → conclusão.
Cancelamento anterior, recuperação dos processos e retorno ao painel aprovados.
Rota de aproximação e rota da cotação desenhadas no Google Maps nativo;
marcador do veículo existente no mapa do passageiro e duas mudanças de posição
recebidas pelo app motorista → API/banco → passageiro. O deslocamento foi
injetado no provedor GPS do emulador; não se declara teste de rua.

Capturas conferidas: carro visível, geometria em ameixa, mapa completo,
posição atualizada e painel final sem modal. Zero exceções fatais/ANRs no
resumo. Artefato **12580502272**; nenhum logcat bruto, código ou placa publicado.
O marcador próprio é removido por ID quando o GPS vence; a câmera enquadra
geometria e posição sem alterar os pontos rodoviários do Google.

## Downloads

- [Passageiro — ZIP do APK](https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/40145108191/artifacts/12580950856)
- [Motorista — ZIP do APK](https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/40145108191/artifacts/12580691234)
- [Evidências Android](https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/40145108191/artifacts/12580502272)

SHA256 dos APKs internos, conferidos após verificar também o digest dos ZIPs:

- Passageiro: `656e7eba731bfa3436dbdae88f7eafde2c01851755cda6122a64d1ff6e3f1dcf`.
- Motorista: `8186521346b3371ff42fce39c684e7ee965138b19c69b1dc7076e34adc28171f`.

## Operação pelo celular

Assinatura debug desta rodada pode exigir remover as instalações anteriores.
Instale os dois APKs e ative cada perfil com seu código privado, de uso único.
Não há chave ou sessão incorporada. Para o teste de rua, use um celular por app,
localização precisa concedida e motorista aberto/disponível.

Passageiro: Ver estimativa → Solicitar viagem. Motorista: Aceitar viagem →
Cheguei ao embarque → Iniciar viagem → Concluir viagem. Passageiro acompanha
posição e estados; o valor é o cotado, sem cobrança financeira.

## Limites e pendências

Há um ajuste visual ainda pendente: pinos verdes de origem podem permanecer
após atualizar a rota. A ponte legada grava o marcador inicial com a chave
`pointerIcon` no ramo comum de `drawRouteV2`, enquanto o final usa `markerId`.
A próxima limpeza deve considerar também `ny_ic_source_dot`; não se afirma
que a limpeza visual de todos os pinos esteja concluída nesta versão.
Esse limite não impediu o marcador do carro, a rota nem os estados confirmados.

Push, GPS com app fechado, navegação curva a curva, recalcular automaticamente
o percurso da viagem em andamento, pagamentos e menus secundários não foram
implementados neste incremento. O indicador legado de GPS da Home motorista
ainda não representa o novo cliente operacional. Teste em dois celulares
físicos/Android recente continua necessário.

## Processamento e segurança

HomeScreens/PureScript/FFI/nativo preservados nas últimas revisões do runtime.
Cache de compilação 40143012209 reutilizado somente após comparar fontes e
configurações e exigir o cache exato. O compilador não foi executado na rodada
final; bundles, APKs e aceite Android foram refeitos. Auditoria em cada artefato
ride-*-diagnostico/runtime-reuse.json. Sem aumento de heap/timeouts.

Fonte única dos estados permanece no PostgreSQL. Rota de aproximação requer
sessão/associação à corrida e GPS recente; consulta Google é compartilhada por
30 s entre os dois perfis. Não houve migration, nova conta, porta pública ou
recriação dos serviços principais nas revisões de interface. Ativações privadas
para a entrega foram emitidas nos runs 40143662234 e 40143665011; valores e
arquivo privado não fazem parte do repositório.
