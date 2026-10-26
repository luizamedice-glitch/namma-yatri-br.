# Ícone Driver — 26/10/2026

## Escopo

Arte oficial `16214.jpg`, recebida do proprietário, aplicada ao ícone do APK
motorista BR debug. Fundo vinho #800253 e inscrição Driver. Foram mantidos
splash, logo interno, telas PureScript/PrestoDOM, passageiro e backend.

O commit local anterior ff133069b4 não havia sido publicado. Foi reaplicado
sobre fe4420df23, preservando as melhorias posteriores de GPS em segundo plano,
reconexão e backup. Fonte inicial publicada: 567efd55a49ec1a5b0fce97b4e21af5c0b556b3e.
Fonte final da arte: cbdec7f371194ba86def5bd903c757d2da553786.
A versão preliminar do workflow que usava o baseline antigo 40145108191 foi
retirada antes da publicação, para preservar os incrementos atuais do motorista.

## Recursos

- 15 PNGs: legado quadrado/circular 48 dp e foreground adaptativo 108 dp,
  nas densidades mdpi, hdpi, xhdpi, xxhdpi e xxxhdpi.
- Arte completa centralizada em 68/108 dp; símbolo e texto dentro da área
  segura de 66 dp. Sem recorte, redesenho ou transformação generativa da arte.
- Cor alterada somente em br_icon_blue do overlay motorista; splash preservada.
- JPEG original, gerador reprodutível e prévias das três máscaras em
  Frontend/branding/driver. Pillow é ferramenta de geração/verificação,
  sem dependência nova no APK.

## Compilação e testes

Workflow br-driver-background.yml, run 40257355937, API 36, com
bundle_apk_run_id=40236963482 e verify_driver_icon=true.
Comparação estrita de ui-driver/ui-common/packages.dhall aprovada localmente:
nenhuma diferença em relação à compilação operacional f585ad66f82e12c230f3b2f627333560ba96aa28.
Novo build Android necessário para empacotar recursos; zero recompilação
PureScript e sem reinstalar dependências npm do frontend.

Dezesseis testes Node de adaptadores/mapas passaram localmente. A validação
no CI confere todos os assets do APK de referência byte a byte e os pixels dos
15 PNGs empacotados, tolerando apenas recompressão PNG lossless pelo Android.
A automação captura o ícone no launcher e abre o app por esse ícone, depois
encerra o processo de smoke antes do aceite operacional isolado existente.

O primeiro build 40256981697 aprovou compilação e integridade dos assets,
mas foi cancelado antes do aceite Android para uma correção da área segura:
o raio de pixels claros medido caiu de 33,81 dp para 32,85 dp, dentro do raio
seguro de 33 dp. Não houve falha de memória ou recompilação PureScript.
O APK dessa tentativa não é o entregável final.

Build final aprovado: 3 min 05 s na etapa Android, sem PureScript.
76 assets preservados e 15 PNGs aprovados. APK artefato 12623317227,
SHA256 f192046cc1f2de5c4c8812b157da43af976cf99c1179aa29c267da3d9684d6d6,
271139319 bytes.

Primeiro smoke API 36 capturou ícone correto e abriu o aplicativo, mas encontrou
o diálogo real do Google Location Accuracy sobre a Activity. O teste exigia
que o motorista estivesse retomado, por isso falhou antes do aceite operacional.
Ajuste restrito à automação responde a esse diálogo e repete com o mesmo APK;
nenhuma alteração no Android/bundle do aplicativo.

A repetição 40258136000 encontrou o launcher antes de indexar o aplicativo.
Nova correção somente do teste usa até 12 gestos reais Home→drawer, guarda PNGs
de cada tentativa e falha se o ícone continuar ausente; não aumenta o timeout
de compilação nem injeta resultado de aplicativo.

Aceite Android final APROVADO: 40258541630, fonte de testes
3ba772e6d4624ae2028ef65c81c09395d24b8d78, usando exatamente o APK 40257355937.
Comparação Android/ui-driver/ui-common sem diferenças após cbdec7f371.

- Ícone encontrado no drawer e abertura pelo toque aprovados; ausência de fatal.
  Capturas finais conferidas: arte vinho completa, símbolo/BR/Driver legíveis,
  sem cortes na máscara circular. Tela de conexão original preservada.
- Cinco casos operacionais aprovados: rede cortada/recuperada com tela bloqueada,
  GPS desligado até perder elegibilidade e recuperado, oferta deduplicada com
  tela bloqueada, notificação abre oferta/aceite/GPS alcança passageiro e offline
  encerra serviço. Mesmo PID nos casos de recuperação.
- 22 uploads, 34 snapshots, uma notificação, um erro intencional do corte e
  zero fatal. Serviço parado ao final. API/PostgreSQL reais isolados;
  passageiro por HTTP e GPS do sensor emulado, sem nova corrida no Lightsail.
- Relatório estruturado: 40258541630.json. Captura: launcher-driver.png.

Links de entrega:
- APK: https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/40257355937/artifacts/12623317227
- Aceite Android 16: https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/40258541630
- Evidência visual: https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/40258541630/artifacts/12624130679

## Correção operacional durante a retomada

Antes de atualizar a branch, a retomada indevida do deploy antigo 40213952223,
fontes 554c147e625b, recolocou temporariamente o piloto anterior no servidor.
O problema foi detectado e comunicado. A implantação aprovada 40241930473 foi
reexecutada apenas no job deploy (tentativa 2, job 121363891794), restaurando
8d24ad18edebe754341e7839261122b70a440777 com sucesso. Guardas de corrida ativa,
migrations, serviços e janela originais preservados; nenhum provisionamento
ou nova ativação. Essa correção não faz parte das mudanças de ícone no código.

## Limitações

O aceite usa emulador e API/PostgreSQL isolados; não constitui teste físico de
bateria/Doze ou dois celulares. A assinatura debug do CI é efêmera; pode ser
necessário reinstalar apenas o motorista e reconectá-lo ao piloto com ativação
privada válida. Foi emitida ativação privada somente do motorista no run 40258702334,
criptografada em Actions e disponibilizada fora do Git, válida até
2026-10-27T02:21:49.613Z. Não consumida nos testes e sem invalidar as sessões
existentes. A reaplicação corretiva descrita acima restaurou a versão operacional
já aprovada; não houve recurso novo de backend. Não há novo recurso de ícone temático monocromático.
