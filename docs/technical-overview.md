# Teknisk översikt

## Öppen karta

Spelklientens filer ligger i `dist/client` i singleplayer-paketet. Releasegruppen
i den här repan återskapar klienten från en låst basversion och en versionspatch.

- `world-material-art.js` förvaltar de sammanhängande marktexturerna.
  `landscape-art.js` blandar dem efter kartans marktyper.
- `coast-art.js` ritar stränder och vatten. `orc-island-art.js` använder samma
  markmaterial och strandrendering med Orc Islands egen karta.
- `village-art.js` och `creator-runtime.js` ritar träd och kartobjekt.
- `reference-scene-art.js` och `reference-joins.js` ritar originalmiljöerna och
  deras förbindelser. `assets/reference-world/manifest.json` innehåller bildhashar.
  `reference-world.js`, `reference-expansion.js` och kartdata styr framkomlighet.
- `version.js` visar spelets ändringslogg. `release-request.json` innehåller
  byggplanen och anteckningar för granskningsbygget.

## Kontroller

- Kontrollera ändrade klientfiler med `node --check`. Jämför kartan och
  gångbara rutor före och efter om ändringen enbart gäller grafik.
- Kör `node release/build-release.mjs /sökväg/till/bas.zip` i en ren byggmapp
  med rätt releasefiler. Bygget verifierar baspaket, patch och spelpaket.
- Kör `node release/smoke.mjs /sökväg/till/ren/spelmapp` för start, lokal
  sparning och omstart. Kör den installerade Windows-klienten före publicering.
- Följ [den visuella målbilden](visual-contract.md) och jämför aktuella
  skärmbilder från spelmotorn med motsvarande original.

### Exterior transitions in the 8.4.0 review build

In the unpacked client, `reference-scene-art.js` owns exterior contours, sampled outcrops, approach paths and the harbour water mask. `coast-art.js` supplies the repeating animated water surface used by the harbour and the ocean horizon. Gameplay entrances remain in `reference-expansion.js`. Rebuild the split patch with the release procedure above.
