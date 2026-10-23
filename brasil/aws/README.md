# AWS — integração dos celulares no ambiente de testes

Configuração para EC2 com Docker Engine e Compose v2 com suporte a `--wait`.
Usa a API e o PostgreSQL existentes; Caddy fornece HTTPS e preserva os eventos SSE.
O banco não publica porta, e a API permanece publicada somente em 127.0.0.1:8080.
Esta configuração mantém as contas de desenvolvimento: destina-se a testes privados.

## Dados e acessos necessários

- Instância EC2: ID, região, IP/DNS e acesso via SSM ou SSH disponibilizado no ambiente.
- Domínio exclusivo da API com registro A apontando para o IP estável da instância.
  Só publique AAAA se o IPv6 também alcançar esse servidor.
- Portas TCP 80 e 443 livres. No Security Group, 80 deve aceitar validação pública
  do Let's Encrypt; restrinja 443 aos IPs dos aparelhos/rede de teste. Não exponha
  5432 ou 8080. Se usar SSH, restrinja 22 à origem administrativa.
- Chave Google de servidor com Places API (New) e Routes API habilitadas e faturamento ativo.
  Restrinja a chave ao IP de saída do servidor.
- Chave Google Maps SDK for Android, restrita aos aplicativos e certificados correspondentes.
- Duas credenciais de perfil diferentes, com 64 caracteres hexadecimais cada,
  e placa, modelo e cor do veículo efetivamente usado nos testes.

Configure segredos no ambiente ou gerenciador de segredos; não envie valores no chat.
Não use o banco de outro produto para este serviço.

## Instalação e atualização

Use a branch com este diretório, baseada em `passageiro-pt-br`.
Antes de executar em servidor existente, identifique a instalação, seus volumes
e faça backup do PostgreSQL. O projeto Compose deste script é `yatri-br`;
se houver outro nome em uso, adapte o comando antes de iniciar para reutilizar
o volume correto. Não execute `down -v`.

Na raiz do repositório, copie o modelo uma única vez:

```bash
cp brasil/.env.example brasil/.env
chmod 600 brasil/.env
```

Preencha `brasil/.env`: senha PostgreSQL aleatória alfanumérica,
`GOOGLE_MAPS_SERVER_KEY`, as duas `YATRI_*_DEV_KEY` e os três campos do veículo.
Acrescente o domínio (sem `https://` e sem caminho) e um email para o certificado:

```dotenv
AWS_API_DOMAIN=api.seu-dominio.com.br
ACME_EMAIL=operacao@seu-dominio.com.br
```

Execute da raiz:

```bash
bash brasil/aws/deploy.sh
curl --fail --show-error https://api.seu-dominio.com.br/health
```

Resultado esperado: `{"status":"ok","service":"namma-yatri-br"}`.
Execute o curl de uma origem permitida em 443. O `--wait` verifica prontidão
local; a consulta HTTPS confirma DNS, certificado e acesso externo.
O script usa cache Docker, recria somente serviços alterados e preserva volumes.
Não reconstrói Android, não importa upstream e não executa auditoria completa.
Os logs têm rotação; o certificado persiste em volume.

O limitador da API usa o IP da conexão: atrás do Caddy, os clientes compartilham
o limite atual de 120 requisições/minuto (15/minuto para autenticação).
Isso atende ao piloto restrito, mas precisa ser revisto antes de ampliar o uso.

## Usar a chave já armazenada em Actions

O workflow **BR - Implantar API na AWS por SSH** usa o nome do secret existente
como parâmetro `ssh_key_secret`, sem ler nem imprimir seu conteúdo.
Configure `vars.AWS_SSH_HOST` e `vars.AWS_SSH_USER` e o secret
`AWS_SSH_KNOWN_HOSTS` com a chave pública SSH do servidor, verificada por um
canal administrativo confiável. A instância deve permitir SSH da origem do runner;
se isso não for possível, use um runner próprio na rede autorizada.

Prepare o checkout em `~/yatri-br` do usuário SSH e o arquivo
`~/yatri-br/brasil/.env` antes da primeira execução. Esse usuário precisa poder
executar Docker. O workflow envia apenas o backend e a configuração de implantação,
preserva `.env` e volumes e reutiliza cache. Ele não instala Docker nem altera o
Security Group. O workflow precisa estar registrado na branch padrão do GitHub
para ser disparado manualmente; selecione depois a branch que contém a API.

## Concluir a conexão dos APKs

No GitHub, configure `vars.MOBILITY_API_URL=https://api.seu-dominio.com.br`.
Configure os secrets `GOOGLE_MAPS_API_KEY`, `YATRI_PASSENGER_DEV_KEY` e
`YATRI_DRIVER_DEV_KEY`; as credenciais de perfil devem coincidir com o servidor.
`GOOGLE_MAPS_SERVER_KEY` fica no servidor e não deve entrar no APK.
Execute uma vez os workflows **BR - APK Passageiro** e **BR - APK Motorista**
na branch com o código brasileiro. Instale os dois APKs e valide uma corrida
com mapas reais. Não distribua estes APKs de desenvolvimento publicamente.

## Estado desta entrega

Arquivos de implantação preparados localmente. Implantação AWS, emissão TLS,
Google real e conexão em dois celulares dependem dos acessos e dados acima;
não foram executados nesta entrega. Esta configuração não converte a API em produção.
