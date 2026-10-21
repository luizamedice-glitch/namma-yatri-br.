# Relatório de implementação

Os estados abaixo distinguem código existente de validação operacional. Todas
as funcionalidades usam a API real e PostgreSQL na execução normal. Fixtures de
mapas aparecem somente nos testes automatizados e não entram no servidor.

| Área | Implementado | Evidência / limite |
| --- | --- | --- |
| APK passageiro | Build independente, pt-BR, acesso e cadastro por convite | Compilação, lint e cadastro/logout Android → HTTP → PostgreSQL verificados; sem HyperSDK/Firebase |
| APK motorista | Aplicativo separado, conta e veículo persistidos | Compilação, lint e cadastro/logout Android → HTTP → PostgreSQL verificados |
| Permissões e GPS | Localização Android, origem por GPS, erro explícito sem sinal/permissão | Código implementado; falta validar GPS em dispositivo real |
| Google Maps SDK | Mapa nativo, marcadores de origem/destino, polyline e última posição do motorista | Precisa autorizar package/SHA-1 na chave Android; Google real não validado |
| Endereços editáveis | Busca com debounce, sugestões Places Brasil, seleção por details, origem/destino independentes | APIs reais; não há sugestões locais inventadas |
| Rota e estimativa | Routes, metros, segundos, polyline, tarifa informativa configurável e cotação de 5 minutos | Sem chave servidor, pedido não pode prosseguir |
| Solicitação | Cotação vinculada ao passageiro, idempotência por quoteId, uma corrida ativa por passageiro | Validado HTTP + PostgreSQL |
| Disponibilidade | Motorista liga/desliga; GPS recente obrigatório | Validado HTTP + PostgreSQL |
| Localização periódica | LocationManager e serviço foreground com indicador Android, envio ao próprio perfil sem acumular posições na fila da UI | Serviço compilado; teste de bateria e navegação externa pendente |
| Motoristas próximos | Raio configurável, GPS até 60 s, fila de busca persistida, expiração de 10 min | Validado HTTP + PostgreSQL; sem otimização de ETA |
| Oferta e recusa | Ofertas persistidas e privativas; recusa não é reofertada ao mesmo motorista | Validado HTTP + PostgreSQL |
| Aceite concorrente | Só um vencedor por viagem e só uma corrida ativa por motorista | As duas disputas concorrentes validadas no banco real |
| Confirmação | Nome do motorista, veículo e placa no passageiro; nome do passageiro no motorista | Resposta backend validada; apresentação Android implementada |
| Navegação até origem/destino | Intent de navegação Google Maps | Requer app de navegação compatível; sem guia curva a curva embutido |
| Chegada/início/conclusão | Transições autorizadas, na ordem correta e persistidas | Ciclo completo validado na API |
| Cancelamento | Participante pode cancelar antes do início; histórico preservado | Validado na API |
| Atualização em tempo real | SSE persistido por usuário, cursor, reconexão, snapshot e heartbeat | Eventos/privacidade validados na API; sem push em background |
| Histórico | Últimas 100 corridas do próprio usuário, sem GPS atual de antigas viagens | Validado na API; UI implementada |
| Segurança de acesso | Convite, scrypt, sessão aleatória com hash no banco, Keystore Android, autorização por perfil/participação | Testes de credenciais, revogação e isolamento passaram |
| Operação local | Dockerfile, Compose PostgreSQL/API, migrations e exemplos de ambiente | Backend executável verificado no CI; compose não executado neste ambiente |
| Automação | Cinco workflows, APKs, lint, integração, emulador e evidências | Links de execuções em VERIFICACAO.md |

Não foram implementados pagamentos, push, administração, verificação documental,
recuperação de senha, cadastro de produção, suporte de emergência ou publicação
em loja. Componentes visuais legados do motorista ainda não foram extraídos.

A corrida inteira **entre as telas dos dois APKs usando Google real não foi
validada**. A ausência de GOOGLE_MAPS_SERVER_KEY é o bloqueio objetivo atual,
além da necessidade de configurar as restrições das duas aplicações na chave
Android. O teste de API com PostgreSQL prova o núcleo de corridas, sem substituir
essa validação operacional.
