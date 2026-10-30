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
Incremento de resiliência PostgreSQL/backup: fonte 8d24ad18edebe754341e7839261122b70a440777,
CI 40241759979, instalação/restauração real 40241777998 e deploy de piloto
40241930473 aprovados. Backups
cifrados diários e monitor local ativos; chave privada fora do servidor.
Leia brasil/backend/ops/RECOVERY-REPORT-2026-10-25.md. PR #5 incorporado à main
com autorização explícita do proprietário: cron externo ativo para cópia diária
e saúde a cada 15 minutos, fonte operacional imutável 8d24ad18edebe754341e7839261122b70a440777.
Não executar restore ativo ou reconstrução de instância sem revisão específica.
Próximos aceites: carga isolada, duração física prolongada e assinatura persistente.

Atualização de prioridade: backend/driver f585ad66f82e com recuperação entregue.
Piloto implantado em 40236965537, APK build 40236963482, aprovado em API 36/29
(40237490959/40238396498). Leia Frontend/build-reports/recuperacao-operacional/RELATORIO.md.
Proprietário confirmou a versão anterior operacional e adiou pagamentos,
Firebase e autenticação definitiva para os ajustes finais. Preserve proteção
atual e passageiro; próximos aceites são teste físico prolongado, bateria,
falha/retorno de PostgreSQL, backup/observabilidade, carga e assinatura persistente.
A referência abaixo é o marco anterior de segundo plano.

Consolidar o piloto dos dois APKs. Motorista com serviço nativo de GPS/alertas em segundo plano, fonte 61d9290c43f5, build 40222415126, aprovado em API 36/29 (40222825183/40222827520). Leia Frontend/build-reports/motorista-segundo-plano/RELATORIO.md: API/banco isolados, passageiro por HTTP e sensor emulado; confirmação física em dois celulares pendente. Proprietário adiou Firebase e escolheu transporte nativo de testes. Passageiro Geoapify 554c147e625b e backend Lightsail 40215991172 preservados. Próximos incrementos: teste físico com tela bloqueada/mapa, bateria/reconexão nativa, assinatura persistente e Firebase posteriormente. Preserve fonte única do backend, produção e telas originais. Reaproveitamento de bundle exige comparação estrita; alterações Java sempre exigem novo APK e aceite Android.

## Servidor de desenvolvimento AWS
Leia também `AWS-DESENVOLVIMENTO.md` antes de alterar integração remota, autenticação, rotas HTTP ou infraestrutura. A URL de testes atual é `https://52-67-246-31.sslip.io`, com mapas de teste e um piloto autenticado temporário; consulte nesse documento as rotas, evidências e expiração atuais, sem presumir liberação geral de endpoints. Documentação não concede acesso SSH e nunca se devem incluir credenciais no APK ou no Git.

30/10/2026 — acesso e recuperação de endereços Alce via GitHub autorizados pelo
proprietário. Branch codex/alce-address-recovery48, inspeção40987509401 confirmou
SSH autenticado/release9bcec2ef69b507fb. Deploy40987673189 success,4testes helper,
health200/auth401 após restart somentealce-lab-compat. Patch guardou SHA original
09c6a80b7759d05f3d948f2b19090386275d9b8b7f4ab2e8ab9a737f1ab01805;
SHAimplantado76ce2a4ea52d7a76d0fc5c22148d92fe7174ba02b5232fb2bd9be2431a482131.
Backup /opt/alce-lab/private/address48-http-before.mjs; nenhuma mutação no banco,
nenhuma migração nem atualização de serviços Namma. Novas cotações recuperam
endereço enviado, seleção salva exata do próprio usuário ou reverse. Corridas
antigas não backfilled; resultado físico ainda pendente. Código e rollback em
brasil/backend/ops/alce/address-recovery48/deploy.py. Não reexecutar deploy sem
revalidar hash; guardas impedem reaplicar sobre outra revisão.

Regressão aparente busca Lab49 em30/10 02:11UTC: logs40990492371 mostram
geo/autocomplete401 COM x-session-token opaque64; sessões passenger valid0,
última expiração02:07:40.999UTC; motorista valid1. Não atribuir a busca ao
hook49 sem evidência. Run40990700593 renovou SOMENTE sessão passenger piloto
recém-expirada preservando credencial até04:16:32UTC dentro janela original.
Nenhum APK50 publicado/recomendado. Workflow voltou a diagnóstico read-only
para impedir renovações repetidas. Aceite físico da retomada de busca pendente.

30/10 04:31UTC busca Passageiro Lab54: diagnóstico41003229562 mostrou
geo/geocode e addresses/history401 com tokenpresente. Read-only41003347022
confirmou passenger valid0 e expiry04:16:32.285UTC, driver valid1, runtime saudável.
Run41003413723 renovou uma única sessão passenger recentemente expirada até
06:32:09.511UTC, mesma credencial, dentro janela piloto existente. Não houve
APK novo, alteração de mapas, backup/restauração, nem extensão da janela piloto.
Workflow alce-search-session54 retorna a diagnóstico read-only após execução.
Aceite físico da retomada de busca ainda pendente; não declarar HTTP200 real
para o token do telefone sem essa evidência. Sessão temporária continua sujeita
à expiração; renovação definitiva não foi implementada.
