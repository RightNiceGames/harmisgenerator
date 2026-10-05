# Hybridförslag till Harmisgeneratorn

Öppna [mockupen](prototype.html) eller [bildgalleriet](index.html). Musiken ändras bara i sidans minne. Nollställ demo återställer låten. Textbeteendet sparas som en inställning i denna webbläsare. Produktionseditorn och låtfilerna har inte ändrats.

## Godkända val, reviderade 2026-10-05

- Taktnummerraden markerar takten och öppnar ingen textinmatning. Första klicket på ett ackord markerar det. Nästa klick på samma ackord öppnar hela taktens ackordrad; dubbelklick fungerar också. Ett klick på ett annat ackord byter markering. Klick i tomt utrymme inom ackordraden öppnar raden direkt. Klick utanför ackordraden markerar en fylld takt utan att öppna textinmatning. En tom takt öppnar textinmatning direkt, medan taktnummerraden fortsatt bara markerar. Skrivfältet visar omfattningen.
- Skrivmarkör är standard för små rättningar. Inställningar i sidhuvudet kan ändra beteendet till att markera all text i det öppnade fältet. Inställningen gäller nästa öppning och sparas mellan omladdningar.
- Knappar vid den markerade takten tar bort den med X eller duplicerar den och infogar kopian direkt efter. X på delens sista takt tömmer den; delrubrikens X tar bort hela delen. Kopian markeras. Ackord, varianter, anslag och lokala musikbyten kopieras; reprisgränser, hus och rad-/sidbrytning dupliceras inte automatiskt.
- Enter, Tab och klick utanför sparar giltig text. Escape avbryter. Ogiltig text behålls som utkast. Tom text tömmer ackordraden och bevarar takten, anslag och andra takttecken. Enter under pågående IME-inmatning sparar inte.
- Mellanslag skapar flera ackord. Parenteser skrivs direkt. `(D A)` uttrycker att båda ackorden är parentetiserade och normaliseras till `(D) (A)`. Ackord som `Fm(maj9)/Ab` accepteras.
- Två nya ackord börjar på 1 och 3. Tre börjar på 1, 2, 3 och fyra på 1, 2, 3, 4. När antalet är oförändrat bevaras manuella startpunkter.
- Ändra ackord har en redigerbar textrad för hela takten. Tidigare ackord läggs till efter markerat ackord eller sist i takten. N.C. ersätter fortfarande valt ackord. Verktyget innehåller även varianter, spelomgång, följande gånger, stämma, ordning och exakt placering. Flytt med verktygets pil tar med varianten. Ändrat grundackord med en variant kräver ett uttryckligt val att behålla eller ta bort den berörda varianten.
- Variantfältet accepterar flera ackord med mellanslag och uppdaterar giltig text direkt. Spelomgång, följande gånger och stämma uppdateras också direkt. En ofullständig eller ogiltig text stannar i fältet medan bladet behåller senaste giltiga variant. Sammanhängande skrivning blir ett steg för Ångra. Bladet visar exempelvis "Andra gången: G Am".
- Klick på ett befintligt ackord visar vänster- och högerpilar på en fast plats under takten. Verktygsraden följer inte ackordets placering. Vid skärmens kant hålls den inom förhandsgranskningen. Raden döljs under textredigering. Valt notvärde anger placeringssteget: fjärdedel, åttondel eller sextondel. Knapparna visar startpunkten och hindrar att ackord passerar varandra eller taktens gräns. Första ackordet kan också flyttas senare.
- Panelens scrollposition, aktiva skrivfält och skrivmarkör bevaras när dess innehåll uppdateras.
- Både Ändra ackord och Rytm har placeringsrutnät för fjärdedelar, åttondelar och sextondelar samt ackordsordning. Anslagens notvärden väljs separat. Överlappning och anslag efter taktens slut stoppas.
- Ett taktspann kan markeras med första takten, Markera flera och sista takten. Samma metod fungerar på mobil utan att öppna tangentbord eller popup. Shift+klick finns också på dator. Spannet hålls inom samma del.
- Repris & hus har en namngiven tillbaka-knapp från husvalet. Hus har exakt spann och fortsätter över radbrytningar. Infogade takter inne i huset tas med; borttagna takter krymper huset och flyttar dess början till första kvarvarande takt.
- Överlappande hus visar både det gamla och nya spannet. Befintliga hus ändras först efter Ersätt befintligt hus. Att ta bort ett hus från en av dess takter tar bort hela huset.
- Form visar hela spelordningen med block. Återanvändning har annan färg och textetikett. Antal gånger och anvisning finns i Återanvänd del. Pilar och dragning flyttar blocket, även före originalförekomsten.
- Gör till egen del skapar en självständig kopia med nya identiteter och egna husspann. Antal gånger och anvisning bevaras. Ändringar i kopian påverkar inte originalet eller andra återanvändningar.
- Musik, Form och Låt har fasta platser på datorn. På mobil ersätts panelen med en popup. Infoga och Layout visar samma lokala tonarts- och taktartsbyten.
- Låt innehåller titel, artist, grundtonart, grundtaktart, tempo, version och status. Ångra/Gör om återställer hela musikändringen. Vanlig textånger gäller när skrivfältet har fokus.

## Borttagning av delar och repristecken

Klick på delens namn markerar hela delen och visar Ändra titel och X vid rubriken. Ändra titel öppnar ett skrivfält på bladet. Enter, Spara eller klick utanför sparar; Escape och Avbryt avbryter. Namnet uppdateras även i formblock och återanvändningar. Namnet ska vara unikt, inte tomt och högst 80 tecken. X tar bort delen. Om delen innehåller musik visas en bekräftelse med delnamn och antal takter. Finns länkade återanvändningar anges också att de tas bort från formen. En tom del tas bort direkt. Avbryt, Escape och Ångra fungerar utan att lämna trasiga hänvisningar. Om alla delar tas bort visar bladet ett tomt läge med information om Ångra.

När en takt med repristecken tas bort flyttas tecknet till nästa kvarvarande takt. Finns ingen nästa takt används föregående. Både start- och sluttecken följer denna regel. Delens sista takt lämnas som tom takt, och själva delen tas bort med X vid rubriken.

## Modellantaganden och begränsningar

Fri placering och självständiga formblock demonstrerar den godkända kommande modellen. Dagens produktionsformat och PDF-rendering tillåter inte alla dessa fall. [Designbeslutet](../../../docs/adr/0001-deldefinitioner-och-latform.md) dokumenterar skillnaden.

När en del börjar återanvändas förankras dess ingående taktart. Återanvändningar följer sedan källdelens egna taktartsbyten oberoende av blockets plats. En fristående kopia behåller denna taktart. Borttagning av en takt med ett lokalt byte bevarar kvarvarande musikens taktart vid nästa takt. Andra formflyttar som gör befintliga placeringar ogiltiga stoppas.

Prototypen tillåter högst fyra ackord per takt. Den första starten är normalt 1 men kan flyttas med pilarna. Det avviker från dagens produktionsvalidering, som kräver att första ackordet börjar på 1. Även den regeln behöver ses över när designen implementeras. I 6/8 räknas slag i åttondelar: fjärdedelsrutnätet visar 1, 3, 5; åttondelar visar 1–6 och sextondelar halva enheter.

Studiebladet använder en lokal HTML-rendering. Det anropar inte spar-API, PDF-export eller ljuduppspelning. Sidbrytning visas som en avdelare; exakt PDF-paginering ingår inte. Avancerade navigeringstecken, transponering, nottext och full textfilredigering ligger utanför prototypen.

Mobilkontrollerna använder Chromium med simulerade skärmar. Ett riktigt iOS-/Android-tangentbord, viewportförändringar vid tangentbord och pekprecision måste provas före implementation. Ett fullständigt tillgänglighetstest och fokusfälla för mobilpopupen återstår också.

## Verifiering

`revision-review.mjs` kontrollerar de nya flödena, inklusive tangentbordsstyrda taktknappar, inställningens beständighet, husägarskap, borttagna taktartsbyten, varianter, fria återanvändningar, fristående kopior och mobil markering. Resultat finns i `revision-verification.json`.

`independent-review.mjs` och `independent-edge-review.mjs` kontrollerar tidigare flöden och kantfall. Sammanställda resultat finns i `independent-review.json`. `capture.mjs` gör egna interaktionskontroller och skapar bildgalleriet; resultat finns i `verification.json`.

`live-editor-review.mjs` kontrollerar delbekräftelse, tomma delar, flytt av repristecken, flera direkt uppdaterade variantackord, fokus och skrivmarkör, paneltext, tillagda tidigare ackord, bevarad scrollposition och de lokala placeringspilarna. Resultat finns i `live-editor-verification.json`.

`selection-review.mjs` kontrollerar det separerade klickflödet, dubbelklick, fast verktygsplacering, tomma takter, avgränsad ackordyta, tangentbordsaktivering, delmarkering, titeländring och mobilbredd. Resultat finns i `selection-verification.json`. `verify-all.mjs` kör samtliga kontroller och uppdaterar sammanställningen och bildgalleriet.

## Kontextmenyer, reviderade 2026-10-05

Markeringen avgör vilka snabbval som visas. En enda meny ligger på en fast plats under takten. Den följer inte ackordet när placeringen ändras. De vanligaste åtgärderna ligger på huvudraden, medan Fler öppnar en grupp i samma kort med en tydlig Tillbaka-knapp. Raden med huvudknappar stannar kvar när gruppen öppnas. Kortet anger ackord, taktnummer, spann eller återanvänd del så att åtgärdens omfattning är synlig.

| Markering | Snabbval | Fler och kompletterande val |
| --- | --- | --- |
| Ackord | Vänster/höger, notvärde, Skriv, Variant, Lägg till | Parentes, N.C., exakt placering/ordning, ta bort ackord. Tidigare ackord infogas efter markeringen. |
| En takt | Ackord, + Takt, Duplicera, Fler, X | Rytm, Repris & hus, tonart/taktart, markera flera, rad/sida, töm ackordraden. |
| Taktspann | Duplicera, Repris, Hus, Fler | Ny takt efter spannet, rad/sida före första takten, borttagning med bekräftelse och ett gemensamt ångrasteg. |
| Delrubrik | Ändra titel, Återanvänd, flytta, Fler, X | Duplicera del, ny del efter markeringen, låtform. På mobil ligger flyttpilarna under Fler. |
| Återanvänd del | Inställningar, Visa original, flytta, Fler | Gör till egen del, ta bort återanvändning. Källdelen och andra återanvändningar påverkas inte av borttagning. |

Plus Takt markerar den nya tomma takten och öppnar ackordraden direkt. Töm ackordraden och Ta bort ackord bevarar rytm, repris, hus och lokala byten. Delkopior får egna identiteter och egna husspann, placeras efter den markerade källdelen och kan ändras separat. Ny del skapar fyra tomma takter. Återanvänd lägger en länkad förekomst sist i formen och erbjuder inställningar och flyttpilar därifrån. Gör till egen del markerar den nya självständiga delen.

Repris & hus anger exakt vilka takter som påverkas. Borttagningsval visas när markeringen faktiskt innehåller tecknen. Ett eget husnummer har en uttrycklig väg tillbaka till Repris & hus. Överlappande hus kräver valet Ersätt eller Behåll. Tonart/taktart och ackord/rytm kräver en enda takt. För ett spann gäller rad- och sidbrytning före första markerade takten.

Varianter uppdateras direkt i det öppnade kortet på datorn; text, mellanslag, skrivmarkör och sammanhängande ångra bevaras. På mobil öppnas större formulär för varianter, rytm, byten och återanvändning i popupen. Att markera i bladet öppnar fortfarande ingen popup automatiskt.

### Granskning och avvägningar

Två oberoende subagenter granskade funktion, faktisk rendering och arbetsflöde. Granskningen ledde till att utökade kort rullas fram vid öppning, för höga grupper får egen scroll och plats reserveras i taktraden så kortet inte täcker nästa rad. Plus Takt öppnar nu skrivning direkt. Delens flyttpilar flyttades till Fler på mobil. Efter Gör till egen del rensas återanvändningsmarkeringen och den självständiga delen markeras.

Fler ger ett extra klick för mindre vanliga val men gör huvudraden lättare att läsa. Långa mobilmenyer kan ta nästan hela bladområdet och delvis dölja takten; taktnummer och markeringens omfattning står kvar i kortet. Det är en kvarvarande avvägning som bör provas med riktiga mobilanvändare. En popup även för långa grupper är ett möjligt alternativ. Det verkliga mobiltangentbordet, pekprecision och exakt PDF-rendering ingår fortfarande inte i denna mockup.

`contextual-review.mjs` och `contextual-verification.json` innehåller den oberoende verifieringen av de nya funktionerna. `verify-all.mjs` kör också tidigare kontroller och uppdaterar sammanställningen och bildgalleriet.

Senaste verifieringen: 127 godkända webbläsarkontroller, inklusive 35 oberoende kontroller av kontextmenyer, samt 18 godkända kontroller vid bildfångst. Galleriet innehåller 42 aktuella bilder. Inga webbläsarfel. JavaScript- och TypeScript-kontroller passerade.
