# Birchhaven – Windows-klienten

**[Hämta Windows-klienten](https://github.com/matsend/Birchhaven-Releases/releases/latest)**

1. Hämta `Birchhaven-Setup-7.23.1-x64.exe` under Assets.
2. Kör installationen.
3. Starta **Birchhaven** från skrivbordet eller Start-menyn.

Spelet körs i ett eget programfönster. Spelmotor och Node ingår. F11 växlar helskärm. Windows 10/11 x64. Installationsfilen är inte kodsignerad; Windows kan visa okänd utgivare.

## Fortsätt med din gamla sparning

Stäng den gamla starten. I klientens startfönster klickar du **Ta över gammal sparning** och väljer mappen med `Start-Birchhaven.cmd`. Karaktärer, utrustning och kartor kopieras. Den gamla mappen ändras inte. Har du redan en sparning i klienten säkerhetskopieras den före importen.

Sparningar och säkerhetskopior finns separat under `%APPDATA%\Birchhaven`. Avinstallation tar inte bort dem. Behåll ändå dina gamla sparningar tills du har kontrollerat karaktärerna i klienten.

## Upplösning och bildskärm

Öppna **Upplösning och bildskärm** i startfönstret eller spelets inställningar. **F10** öppnar samma meny under spel. Välj fönsterupplösning, helskärm och gränssnittsstorlek (75–150 %). Tryck **Prova bildläge** och sedan **Behåll** inom 15 sekunder; annars återställs föregående läge. Valet sparas till nästa start. Helskärm använder skärmens ordinarie upplösning. Fönster som är större än skärmen anpassas så att de får plats.

## Uppdateringar

Välj **Sök efter uppdateringar** i spelets inställningar. Klienten hämtar nästa Windows-installation, kontrollerar filens kontrollsumma och sparar/stänger spelet innan installationen startas. Sparningarna behålls. World Creator ska sparas och stängas före uppdatering eller avslut.

`.bhupdate` och `birchhaven-update.json` är kompatibilitetsfiler för den äldre webbläsarstarten, inte installationsfiler. Den gamla starten konverteras genom att installera Windows-klienten ovan.

## Innehåll

7.23.1 innehåller det publicerade spelinnehållet från 7.22.2 och den nya Windows-klienten. Expansionen 8.0.0 med nya set, föremål och uppdrag är fortfarande en separat, opublicerad arbetsversion.

World Creator **Spara och synka** finns kvar. Spel och lokala sparningar fungerar utan internet; synkning och uppdateringar kräver internet. Kartöverföringen innehåller inte karaktärernas framsteg.

## Publicering

GitHub Actions bygger från hashkontrollerade distributionsfiler och officiella Electron/Node-versioner. Installation, eget spelfönster, sparning, omstart, ominstallation, import och kartlagring testas på Windows innan en release kan publiceras. En misslyckad kontroll blockerar publicering.

Detta repo innehåller distribution och klientens byggverktyg. Lägg aldrig upp sparfiler, säkerhetskopior, inloggningsuppgifter eller åtkomstnycklar.
