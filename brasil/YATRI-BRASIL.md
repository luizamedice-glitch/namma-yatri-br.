# Yatri Brasil — desenvolvimento 0.3.0-dev

Esta revisão é parcial. Não atende ainda ao aceite de reconstrução fiel das interfaces originais. A interface Java brasileira anterior continua como cliente de integração para os testes; não é apresentada como recuperação visual do Namma Yatri. Não foi criado outro template para substituí-la.

## Implementado nesta revisão

- Banco PostgreSQL provisiona Fagner e Giselo com UUIDs diferentes e preserva suas contas entre reinicializações.
- `/v1/development/session` emite sessões reais de 30 dias. Cada perfil tem uma credencial independente; a credencial do passageiro não provisiona o motorista e vice-versa.
- Os aplicativos abrem a conexão automática e entram na operação sem email, senha, convite, OTP ou cadastro. Tokens persistem criptografados no Android Keystore e são reutilizados. Sessões expiradas são reprovisionadas automaticamente.
- Login e cadastro ficam bloqueados no modo de desenvolvimento. O servidor recusa esse modo com `NODE_ENV=production`. O endpoint de provisionamento não existe fora desse modo, e as sessões já emitidas para essas duas contas também são recusadas quando ele é desativado.
- Nome e papel recebidos são validados; o cliente também verifica o UUID esperado. Sessões continuam sujeitas às mesmas autorizações das corridas.
- A URL e apenas a credencial do respectivo perfil entram no build. Não há configuração de servidor na interface. Credenciais extraíveis de APKs limitam o uso a testes privados: não distribuir esses builds publicamente.
- Workflows destinados a celulares exigem URL HTTPS e credencial de perfil configuradas, evitando publicar mais APKs sem backend.

## Operação local

1. Copie `.env.example` para `.env` em `brasil/`, mantenha fora do Git, escolha a senha PostgreSQL e os dados reais do veículo usado nos testes.
2. Gere duas credenciais independentes de 32 bytes, em hexadecimal, nas variáveis `YATRI_PASSENGER_DEV_KEY` e `YATRI_DRIVER_DEV_KEY`. Configure `GOOGLE_MAPS_SERVER_KEY` para Places e Routes.
3. Execute `docker compose --env-file .env up --build` em `brasil/`. API privada em `http://127.0.0.1:8080`; PostgreSQL permanece em rede interna. Migrations são aplicadas ao iniciar a API.
4. Para builds, configure `MOBILITY_API_URL`, `GOOGLE_MAPS_API_KEY` e a credencial do perfil correspondente. O servidor precisa estar acessível aos aparelhos pela rede privada ou HTTPS de desenvolvimento. `10.0.2.2` é exclusivo do emulador.
5. Compile em `brasil/android`: `gradle :app:assemblePassageiroDebug :app:assembleMotoristaDebug`. Não há configuração nem autenticação pelo usuário após instalar, apenas permissões Android.

No GitHub, URL em `vars.MOBILITY_API_URL`; chaves em secrets `GOOGLE_MAPS_API_KEY`, `GOOGLE_MAPS_SERVER_KEY`, `YATRI_PASSENGER_DEV_KEY`, `YATRI_DRIVER_DEV_KEY`. As credenciais de perfil devem coincidir com o backend. Não envie seus valores no chat.

## Verificação e limites

Testes locais desta revisão: 10 testes unitários e 2 suítes de integração HTTP/PostgreSQL passaram. A nova suíte usa Fagner e Giselo, verifica isolamento de credenciais, contas persistentes, tokens armazenados por hash, bloqueio de login/cadastro e o ciclo solicitação → aceite → chegada → início → conclusão. A resposta Google é fixture explicitamente identificada apenas no teste. O servidor operacional nunca a utiliza.

A validação Android é separada: provisionamento pelo aplicativo, sessão persistente, recuperação e capturas em emulador com backend real. Seu resultado deve ser conferido no workflow; teste de backend não comprova a interface nem Google real.

Bloqueios: não existe backend exclusivo do Yatri Brasil acessível pelos celulares. A URL Supabase fornecida pelo usuário atende também ao Alce, respondeu 401 (`Missing authorization header`) na consulta sem credenciais e não foi modificada nem adotada como backend Yatri; ambiente sem chave Google server configurada. Não foi feita implantação pública nem em produção. O fluxo completo em dois APKs com mapas reais e a fidelidade visual permanecem pendentes; os APKs anteriores 0.2.1 não cumprem esta diretriz.

Recuperação dos recursos, inventário e comparação limitada com a Play Store: [INTERFACE-ORIGINAL.md](INTERFACE-ORIGINAL.md). Os APKs agora reutilizam diretamente duas fontes originais; as telas originais ainda não executam no cliente independente.

A inicialização da localização agora aproveita somente fixes recentes (até 30 segundos), seleciona a primeira origem GPS sem sobrescrever uma origem já editada e habilita a camada de posição do Maps após a permissão. O teste em emulador injeta coordenadas de São Paulo de forma explícita; isso não equivale a validar GPS físico nem a rota Google.
