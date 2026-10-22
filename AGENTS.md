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
Priorizar a tela principal original do passageiro (HomeScreen): inicialização debug sem login, mapa, origem/destino e navegação. Depois conectar progressivamente serviços reais brasileiros, sem mascarar respostas do backend. Otimizar o ciclo de build antes de alterações extensas.
