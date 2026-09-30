# Termo PWA

Estrutura:
index.html · styles.css · app.js · words.js · multiplayer.js · manifest.json · sw.js · icons/icon-192.png · icons/icon-512.png

Ícones: substitua os placeholders em `icons/` por PNGs quadrados 192x192 e 512x512 (mesmos nomes).
Para o ícone "maskable" (Android), deixe o desenho dentro dos 80% centrais da imagem.

Firebase: cole sua config em `multiplayer.js` e publique regras de teste no Realtime Database:
{ "rules": { "salas": { "$code": { ".read": true, ".write": true } } } }
Depois de mudar arquivos, aumente CACHE_VERSION em `sw.js`.
