# Entrega de desenvolvimento — v0.2.0

Código dos aplicativos e backend: commit
[`b884fbf36db07aedfd5fb20121df9c5697d2a00c`](https://github.com/luizamedice-glitch/namma-yatri-br./commit/b884fbf36db07aedfd5fb20121df9c5697d2a00c),
na branch `passageiro-pt-br`. Commits posteriores atualizam testes, captura de evidências
e documentação, sem substituir o código presente nestes APKs.

## APKs debug para testes privados

| Aplicativo | Download do artefato ZIP contendo o APK | ApplicationId |
| --- | --- | --- |
| Passageiro | [passageiro-debug-apk](https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/39661088753/artifacts/12373073283) | br.com.namma.mobilidade.passageiro |
| Motorista | [motorista-debug-apk](https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/39661088750/artifacts/12374156946) | br.com.namma.mobilidade.motorista |

Artefatos GitHub podem exigir login e expiram segundo a retenção do repositório.
Também foram baixados para a pasta de artefatos do workspace desta execução.

SHA-256 dos arquivos APK descompactados:

```text
da1a728071fb0c3a5148890d4a528c8f183c2531fc8e8b563b86de20f96ce4a4  app-passageiro-debug.apk
cbe427b64a0c47b3cac8940368fe19aeb9e2ce90c75fdcf43db20b795c811865  app-motorista-debug.apk
```

Para restringir GOOGLE_MAPS_API_KEY aos APKs desta entrega, use os applicationIds
acima e os seguintes SHA-1 **públicos dos certificados de assinatura**, extraídos
dos blocos de assinatura APK v2:

```text
Passageiro: 01:3A:97:1E:50:47:24:62:F5:5A:2D:5A:1C:81:8B:B8:EA:8D:86:80
Motorista:  E8:0F:7E:10:2F:F4:FC:D1:5B:90:EC:F3:46:F4:C2:95:CB:F9:82:19
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
