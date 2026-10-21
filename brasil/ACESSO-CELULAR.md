# Acesso no celular físico

Instalar o APK não inicia um servidor. Login e cadastro exigem a API e o
PostgreSQL em execução, acessíveis pelo telefone. Não existe um login universal
nem uma conta pré-cadastrada. A chave Google é exigida para mapas/rotas, não para
entrar ou criar uma conta.

## Computador e celular por USB

No computador, instale Docker Compose e Android Platform Tools (`adb`).
Clone a branch `passageiro-pt-br` e execute na pasta `brasil`:

```bash
cp .env.example .env
```

Edite `.env`: troque POSTGRES_PASSWORD por uma senha alfanumérica aleatória e
TEST_INVITE_CODE por um convite aleatório com ao menos 16 caracteres. Guarde
esses valores localmente; não os envie por chat nem os publique no GitHub.
GOOGLE_MAPS_SERVER_KEY pode ficar vazio para testar somente acesso/cadastro.

```bash
docker compose up --build -d
curl --fail http://127.0.0.1:8080/health
adb devices
adb reverse tcp:8080 tcp:8080
```

O celular deve ter depuração USB habilitada e autorizar o computador. O comando
`adb devices` precisa listar o dispositivo como `device`, sem `unauthorized`.
Se houver vários aparelhos, use `adb -s NUMERO_DO_APARELHO reverse tcp:8080 tcp:8080`
em cada telefone que participará do teste. Refaça o encaminhamento após reconectar.

Nos dois aplicativos:

1. Toque em **Configurar servidor de testes**.
2. Informe `http://127.0.0.1:8080` e salve.
3. Verifique se aparece **Servidor conectado**.
4. No primeiro acesso, crie uma conta usando o convite definido no `.env`.
5. Depois, use **Entrar** com o email e a senha cadastrados nesse servidor.

Use uma conta de passageiro no APK de passageiro e outra de motorista no APK
de motorista. A conta do motorista também exige placa, modelo e cor do veículo.

## Diagnóstico

| Resultado | Ação |
| --- | --- |
| `/health` não responde no computador | Execute `docker compose logs api db` e verifique a inicialização |
| Computador responde, celular não conecta | Confira autorização USB, `adb reverse` e endereço configurado no app |
| Servidor conectado, email/senha incorretos | Crie a conta nesse servidor ou use os dados já cadastrados nele |
| Convite inválido | Confira localmente TEST_INVITE_CODE do servidor ativo |
| Conta pertence ao outro aplicativo | Use a conta correspondente a passageiro ou motorista |

`10.0.2.2` é um endereço especial do emulador Android e não conecta um celular
físico ao computador. Não use esse endereço no telefone.

Sem computador por USB, é necessário um backend acessível em rede privada ou
HTTPS. O compose padrão fica restrito ao computador; não abra portas públicas
para contornar o problema. Nenhum servidor público foi implantado nesta entrega.
