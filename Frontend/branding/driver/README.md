# Ícone exclusivo do motorista — 26/10/2026

Arte original `16214.jpg` enviada pelo proprietário, preservada em
`official-driver.jpg`. Fundo vinho e inscrição Driver diferenciam os dois APKs.
Sem geração de imagem, remoção de fundo ou redesenho da marca.

`generate-icons.py` usa Pillow apenas como ferramenta de reamostragem: cria os
15 PNGs nas cinco densidades (48 dp legado, 108 dp adaptativo). A arte completa
ocupa 70 dp centralizados; o símbolo e o texto permanecem na área segura de
66 dp. `launcher-masks.png` permite conferir máscaras quadrada, circular e
arredondada. O fundo adaptativo é #800253. Não há ícone monocromático temático:
esta entrega preserva as cores fornecidas.

Escopo: somente recursos `brTest/driver/res/mipmap-*` e a cor do ícone em
`values/branding.xml`; splash, logotipo interno e passageiro preservados.

Build manual: workflow `br-driver-background.yml`, `verify_driver_icon=true`,
`bundle_apk_run_id=40236963482`. Reutiliza o bundle mais recente aprovado após
comparação estrita de todas as fontes motorista/ui-common. Compila o Android
atual, preservando GPS em segundo plano e recuperação operacional; não chama
npm/PureScript no frontend. Confere todos os assets originais e os pixels dos
15 PNGs no APK, depois captura o launcher e a abertura no emulador e executa
o aceite operacional existente (rede/GPS/notificações/aceite/parada).
