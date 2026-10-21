# Entrega de desenvolvimento — v0.2.1

Código dos aplicativos e backend: commit
[`345d6d15cdb19009e4f090c24bd7e78df0175dc4`](https://github.com/luizamedice-glitch/namma-yatri-br./commit/345d6d15cdb19009e4f090c24bd7e78df0175dc4),
na branch `passageiro-pt-br`. Commits posteriores atualizam testes, captura de evidências
e documentação, sem substituir o código presente nestes APKs.

## Correção de acesso no celular físico

Sem backend iniciado e acessível pelo telefone, login e cadastro não funcionam.
A versão 0.2.1 exige configuração explícita do servidor e valida `/health` antes
de autenticar. O endereço do emulador não é mais usado como padrão em APKs sem
MOBILITY_API_URL. Veja [ACESSO-CELULAR.md](ACESSO-CELULAR.md) para conexão USB.

## APKs debug para testes privados

| Aplicativo | Download do artefato ZIP contendo o APK | ApplicationId |
| --- | --- | --- |
| Passageiro | [passageiro-debug-apk](https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/39664690126/artifacts/12377041711) | br.com.namma.mobilidade.passageiro |
| Motorista | [motorista-debug-apk](https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/39664690356/artifacts/12376882212) | br.com.namma.mobilidade.motorista |

Artefatos GitHub podem exigir login e expiram segundo a retenção do repositório.
Também foram baixados para a pasta de artefatos do workspace desta execução.

SHA-256 dos arquivos APK descompactados:

```text
97d3ef90cde84a0e213f7d98d626fea12454f1b5e23cadfbcebb31832252abb0  app-passageiro-debug.apk
e60542c667154a8e61164f0c56d3c7e2c1b8ae44aaed92872037a44e57d4d02d  app-motorista-debug.apk
```

Para restringir GOOGLE_MAPS_API_KEY aos APKs desta entrega, use os applicationIds
acima e os seguintes SHA-1 **públicos dos certificados de assinatura**, extraídos
dos blocos de assinatura APK v2:

```text
Passageiro: 71:55:FB:F7:8B:66:AB:88:4A:0A:0A:48:CB:6E:76:1F:75:46:0F:FE
Motorista:  72:90:49:EA:7F:CD:F0:DD:D9:14:64:40:9E:52:9C:63:2D:0A:D6:38
```

Cada job usa assinatura debug do runner. Novos builds podem gerar outro
certificado; confira as restrições antes de instalar um novo artefato. Nenhuma
chave privada de assinatura foi publicada ou armazenada no código-fonte.

## Backend e documentação

- [Instruções de operação local](README.md): Compose ou Node + PostgreSQL.
- [Exemplo de ambiente Compose](.env.example) e [Node](backend/.env.example).
- [Contrato REST OpenAPI](backend/openapi.json) e [SSE/erros/autorização](backend/API.md).
- [Funcionalidades e limites](FUNCIONALIDADES.md).
- [Decisões e dependências](DECISOES.md), [licenças e atribuições](NOTICE.md).
- [Evidências e pendências](VERIFICACAO.md).

GOOGLE_MAPS_SERVER_KEY precisa ser configurada no backend para sugestões e
rotas reais. Ela não foi disponibilizada no ambiente nem no secret do CI nesta
execução. Sem ela, os APKs abrem e autenticam, mas não conseguem completar a
solicitação de corrida a partir de uma rota real. O servidor informa esse erro;
nenhuma rota ou viagem é simulada.

O núcleo de corridas foi validado com API HTTP e PostgreSQL reais. A validação
obrigatória da viagem inteira pelas interfaces dos dois aplicativos com Google
real permanece pendente. Esta entrega não representa liberação para operação
comercial ou transporte de passageiros reais.
