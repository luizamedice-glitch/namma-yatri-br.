# Yatri Brasil — instruções para agentes de desenvolvimento

## Missão
Adaptar a base original Namma Yatri para uma plataforma de mobilidade brasileira, preservando componentes maduros e validando todas as integrações. O projeto Alce App é independente e **não deve ser modificado nem incorporado** sem decisão explícita posterior.

## Fontes de verdade
Leia antes de modificar o código:
1. `PROJECT_STATUS.md`: fatos confirmados, histórico e pendências.
2. `ARCHITECTURE.md`: módulos, fronteiras e integrações a verificar.
3. `ROADMAP.md`: fases e critérios objetivos de aceite.
4. Os próprios arquivos do repositório, workflows e logs da execução atual. Documentação não substitui verificação.

## Regras de execução
- Comece inspecionando a branch, estado do CI, configurações e arquivos relacionados à tarefa; não presuma que resultados antigos continuam válidos.
- Trabalhe em alterações pequenas, reversíveis e com escopo claramente delimitado.
- Preserve telas, navegação e lógica originais quando possível; não crie telas demonstrativas para simular funcionalidades críticas.
- Não remova autenticação ou verificações de segurança das versões de produção. Qualquer bypass de desenvolvimento deve permanecer estritamente restrito ao build debug e ser explícito.
- Não registre credenciais, OTP, tokens, dados de usuários ou chaves em commits/logs.
- Não integre ou migre o backend do Alce. Na Yatri, identifique a API brasileira escolhida e evite duas fontes de verdade para o estado das corridas.
- Não aumente timeouts de compilação como primeira reação; investigue primeiro logs, consumo de memória, cache e dependências.
- Não altere licença nem elimine avisos de direitos autorais; respeite as obrigações AGPL e documente mudanças relevantes.
- Não faça alegações de que APK, mapa ou corrida funcionam sem teste e evidência da respectiva versão.
- Para ações de alto risco (mudança destrutiva, banco, secrets, publicação), peça revisão específica.

## Processo por tarefa
1. Declare objetivo, arquivos afetados e critério de aceite.
2. Faça inventário das dependências reais e do comportamento atual.
3. Implemente o menor incremento que entregue comportamento verificável.
4. Rode validação adequada (compilação incremental, testes, build Android, teste em dispositivo/emulador quando aplicável).
5. Registre resultados e limitações em `PROJECT_STATUS.md`; atualize o roadmap se mudar a prioridade.
6. Resuma commits, testes, problemas abertos e próximo passo.

## Objetivo imediato
Consolidar o piloto dos dois APKs: ciclo completo com mapa/GPS aprovado contra Lightsail em 40145108191. Passageiro atualizado para Geoapify, marcadores/enquadramento e runtime/reconexão preservados em 554c147e625b: APK/Android 16 aprovados em 40213953987; piloto Lightsail em 40215991172 e consulta real Geoapify em 40216101093. Leia Frontend/build-reports/passageiro-geoapify/RELATORIO.md e seus limites. Próximos incrementos: confirmação física dos novos endereços, teste de rua em dois celulares, assinatura debug persistente e segundo plano/push. Preserve a fonte única no backend, produção e telas originais; não confunda GPS emulado com deslocamento físico. Para alterações exclusivas em TripMapRuntime.js, use apenas o reaproveitamento de compilação com comparação estrita documentado no workflow.

## Servidor de desenvolvimento AWS
Leia também `AWS-DESENVOLVIMENTO.md` antes de alterar integração remota, autenticação, rotas HTTP ou infraestrutura. A URL de testes atual é `https://52-67-246-31.sslip.io`, com mapas de teste e um piloto autenticado temporário; consulte nesse documento as rotas, evidências e expiração atuais, sem presumir liberação geral de endpoints. Documentação não concede acesso SSH e nunca se devem incluir credenciais no APK ou no Git.
