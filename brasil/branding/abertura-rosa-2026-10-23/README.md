# Recursos recebidos para abertura rosa

- `original.mp4`: MP4 original do ZIP Android (1280×720, 60 fps, 2,5 s).
- `15695.png`: ícone AY/BR fornecido, com fundo rosa.
- `15803.png`: marca horizontal com transparência, fornecida para o cabeçalho.

Apenas os recursos de teste do passageiro são atualizados. Não é incorporado o
aplicativo demonstrativo Gradle recebido no ZIP.

`python3 Frontend/scripts/build-br-pink-opening.py` reproduz os recursos (Pillow e
ffmpeg). A abertura mantém os 2500 ms; amostra a 30 fps em
640×360 e normaliza o fundo para #FF00BE usando a cobertura da arte branca do
vídeo. O GIF é exibido com proporção preservada sobre Canvas da mesma cor, sem
moldura, gradiente, estiramento ou corte da marca. O MP4 original é preservado.
O Canvas rosa ocupa toda a área disponível; a composição horizontal fica centralizada.

Ajuste de 2026-10-24: os oito primeiros quadros do fade (aproximadamente 267 ms)
são antecipados, e os tempos restantes são redistribuídos para manter 2500 ms.
A janela de lançamento mostra o primeiro quadro já visível sobre o mesmo rosa;
Android 12+ recebe também o monograma na splash do sistema, sem moldura.
O cabeçalho BR usa 136×44 dp, ou 116×44 dp em telas menores que 380 dp.

O ícone fornecido é preparado em 48/72/96/144/192 px, além de foreground adaptativo
108/162/216/324/432 px. O fundo rosa é separado da arte AY/BR antes de dimensionar,
com margem de segurança para máscaras do launcher. O logo transparente é recortado
somente nas margens transparentes e preserva as cores originais.
