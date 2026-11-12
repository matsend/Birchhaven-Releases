# Birchhaven – Singleplayer

Hämta installationspaketet under [Releases](https://github.com/matsend/Birchhaven-Releases/releases/latest).

1. Installera Node.js 24 om det saknas.
2. Packa upp `Birchhaven-Singleplayer-<version>.zip`.
3. Kör `Install-Birchhaven.cmd` första gången.
4. Starta med `Start-Birchhaven.cmd`.

Spelet körs lokalt i webbläsaren. Framtida publicerade versioner hämtas via **Sök efter uppdateringar** i spelet. Behåll `birchhaven-solo-data` och dess säkerhetskopior.

## World Creator från 7.21.0

**Spara och synka** sparar kartan lokalt och skickar kartändringarna till ägarens privata kartlagring. Vid första användningen behövs ChatGPT-inloggning. Kartöverföringen innehåller inte karaktärer eller deras framsteg. Spelet går att spela utan internet; synkning och uppdateringar kräver anslutning.

När kartan är synkad ber ägaren Work om en ny speluppdatering. Den byggs och publiceras här och installeras sedan med spelets uppdateringsknapp.

## Publicering

Ägaren har godkänt GitHub Actions-flödet. Det startas genom en färdig `release-request.json` på `main` eller manuellt i Actions. Bygget kontrollerar filernas hashvärden. Ett separat Windows-test måste klara start, kartlagring, kartuppdatering och karaktärssparning innan en ny release publiceras. Befintliga releaser ersätts inte.

Detta repo innehåller distributionsfiler och byggverktyg. Lägg aldrig upp sparfiler, säkerhetskopior, inloggningsuppgifter eller åtkomstnycklar.
