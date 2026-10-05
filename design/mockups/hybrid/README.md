# Harmisgeneratorn: redigera på bladet

Öppna [mockupen](prototype.html) eller [bildgalleriet](index.html). Musiken ändras bara i sidans minne. Nollställ demo återställer låten.

## Direkta ikonrader, reviderade 2026-10-05

Alla åtgärder visas direkt som ikoner. Det finns inga Fler-menyer. Hover och tangentbordsfokus visar förklaringar. Ackordnamn, notvärden, startpunkter och formblock behåller sina läsbara värden.

| Markering | Plats | Åtgärder |
| --- | --- | --- |
| Takt eller flera takter | En rad ovanför takten, förankrad vid dess högra hörn | Infoga, duplicera, ta bort, töm ackord, rytm, tonart/taktart, reprisstart/slut, repris runt markeringen, första/andra/eget hus, ny rad/sida. Borttagning av befintliga tecken visas när den behövs. |
| Ackord | En separat rad under takten | Vänster/höger, placeringssteg 1/4, 1/8 eller 1/16, skriv, variant, lägg till tidigare ackord, parentes, N.C., ordning/startpunkter och ta bort ackord. Taktraden finns kvar. |
| Delrubrik | Vid rubriken | Ändra namn, återanvänd, flytta, duplicera, skapa del och ta bort. |
| Återanvänd del | Vid återanvändningen | Inställningar, visa original, flytta, gör till egen del och ta bort återanvändning. |

Smala avdelare grupperar ikonerna utan extra menyer. Verktygen stannar på samma plats när ett ackord flyttas. Takt- och ackordraderna rullas i sidled när utrymmet är för litet. Då visas en hänvisning till att svepa eller rulla. Mobilens knappar har minst 44 pixels tryckytor.

En ikon med parametrar öppnar ett kompakt formulär. På dator visas det vid takten, på mobil i en separat modal popup. Stängknappen och Escape återför fokus till ikonknappen och behåller markeringen. När ordningsknappen blir inaktiverad efter en flytt får samma ackords startpunktsfält fokus.

Sidopanelen innehåller endast Form och Låt. Den gamla inställningen för textmarkering och dess lagrade preferens används inte längre. Den stora headern med dubblerade låtuppgifter är borttagen. Titel, artist, tonart, taktart och tempo står på bladet, och ändras via Låt. Nollställ demo ligger i den tunna verktygsraden. Form visar hela låten och låter användaren välja ett block eller dra det till en annan plats. Blockets musikaliska verktyg visas vid den valda delen på bladet. Lokala musikverktyg och återanvändningens parametrar upprepas inte i panelen. Den fasta menyknappen fäller in eller ut kolumnen och öppnar panelen på mobil. Form och Låt nås också från verktygsraden.

## Markering och direkt skrivning

Taktnummerraden markerar en takt. Kryssrutan på samma rad lägger till eller tar bort just den takten. Markeringen får innehålla luckor, men hålls inom en del. Endast den aktuella delens kryssrutor visas när en takt är vald. Rutorna döljs under textredigering och när en hel del eller återanvändning är vald. Klick på en annan dels taktnummerrad byter markering.

Kopiera, ta bort och töm gäller endast de kryssade takterna. Repris runt markeringen och hus kräver sammanhängande takter. Dessa ikoner är inaktiverade vid luckor och deras förklaringar anger varför. Separat reprisstart sätts i första valda takten och reprisslut i den sista. Ny takt infogas efter sista valda takten. Rad- och sidbrytning ligger före den första.

Första klicket på ett ackord markerar det. Nästa klick på samma ackord öppnar hela taktens ackordrad. Dubbelklick fungerar också. Klick på ett annat ackord byter markering. Klick i tomt utrymme inom ackordraden öppnar textfältet direkt. Tomma takter är tillåtna. Klick på taktnumret öppnar fortsatt ingen inmatning.

Textfältet öppnas alltid med skrivmarkör för små rättningar. Mellanslag ger flera ackord och parenteser skrivs i texten. `(D A)` normaliseras till `(D) (A)`. Även `Fm(maj9)/Ab` accepteras. Två nya ackord börjar på 1 och 3, tre på 1, 2, 3 och fyra på 1, 2, 3, 4. Oförändrat antal bevarar manuella startpunkter.

Enter, Tab och klick utanför sparar giltig text. Escape avbryter. Ogiltig text stannar som utkast. Tom text tömmer ackorden och bevarar takten, rytm och övriga tecken. Enter under pågående IME-inmatning sparar inte. Tidigare ackord läggs till efter valt ackord; N.C. ersätter det valda ackordet. Textinmatning finns bara på bladet och via skrivikonen.

## Varianter, rytm och form

Variantikonen vid ett grundackord skapar en egen ackordrad på bladet. Skriv flera ackord med mellanslag och parenteser direkt i raden. Giltig text uppdaterar varianten direkt. Enter, Tab och klick utanför avslutar redigeringen. Escape återställer den ursprungliga varianten och ångrahistoriken; en helt ny tom rad försvinner. Första klicket på ett befintligt variantackord markerar det och nästa klick öppnar radens text. Vanlig Ctrl+Z/Ctrl+Y fungerar i textfältet, vars DOM-element behålls under skrivning. Sammanhängande varianttext blir ett ångrasteg.

Etiketten står ovanför variantens egen taktram och visar exempelvis "2:a · D" eller "3:e+ · D". Grundackordet efter punkten visar vilken harmonik som ersätts; plus anger även följande gånger. Inställningsikonen öppnar endast spelomgång och följande gånger. Det gamla textfältet Ackord i parametermenyn är borttaget. Parametrarna har egna ångrasteg. Ett ändrat grundackord med befintlig variant kräver fortsatt valet att behålla eller ta bort den.

Varje variant har egna ackordsidentiteter och startpunkter. Variantens ram visar grundackordets spann som en förstorad segmentvy. Slaglinjalen under ackorden visar deras faktiska slag, även när grundackordet börjar på exempelvis slag 3. Detta gör täta byten läsbara utan att ändra tidsplaceringen. På mobil visar en del med varianter två takter per rad, inklusive korrekt fortsättning av hus över radbrytningar. Raderna uppdateras direkt vid byte mellan dator- och mobilbredd.

Markerade variantackord får placeringspilar, valt notvärde, ordning/startpunkter och ett verktyg för variantens rytm. Pilarna påverkar ett ackord. Rytmverktyget gäller anslagen för hela den aktuella variantraden, vilket framgår av ackordsföljden och grundackordet i formuläret. Grundtaktens rytm och variantens rytm lagras och redigeras separat. Båda hindrar överlappning och anslag utanför sitt spann. Flyttade grundackord tar med variantens relativa placeringar, medan en flytt som skulle göra placeringarna ogiltiga stoppas. Kopierade takter och delar får nya identiteter även för variantackorden.

Rytmen återges med notsymboler på rätt slag. Fjärdedelar, åttondelar och sextondelar har skilda notvärden. Täta åttondelar och sextondelar får balkar så flaggorna inte överlappar. Enskilda symboler anpassar sin bredd efter utrymmet. De gamla små slagnummertexterna under takten är borttagna. Klick på notbilden öppnar rätt rytmverktyg. Rutnätet lägger till och tar bort anslag, och notvärdet per anslag väljs separat.

Hus har exakta spann och fortsätter över radbrytningar. Infogade takter inne i huset tas med. Borttagna takter krymper huset och flyttar början till första kvarvarande takt. Överlappande hus kräver ett uttryckligt val att ersätta det gamla. Att ta bort ett hus från någon av dess takter tar bort hela huset.

Återanvändningar har annan färg och följer originaldelens musik. Antal gånger och anvisning gäller bara den valda förekomsten. Pilar och dragning flyttar blocket, även före originalförekomsten. Gör till egen del skapar en fristående kopia med egna identiteter och husspann. Antal gånger och anvisning bevaras. Ny del skapar fyra tomma takter.

Klick på delnamnet visar namnändring och borttagning. Namnet måste vara unikt, inte tomt och högst 80 tecken. En del med musik kräver bekräftelse före borttagning. Dialogen anger också om länkade återanvändningar tas bort. En tom del tas bort direkt. Ångra återställer delen och formblocken.

När en takt med repristecken tas bort flyttas tecknet till nästa kvarvarande takt, annars till föregående. Delens sista takt lämnas tom. Delrubrikens borttagningsknapp tar bort hela delen. Duplicerade takter får ackord, varianter, anslag och lokala byten, men inga automatiskt kopierade reprisgränser, hus eller rad-/sidbrytningar.

## Granskning och begränsningar

Två subagenter granskade flöden, faktisk rendering och tidigare funktioner. Granskningen ledde till bredare ordningsfält, bevarat tangentbordsfokus efter omordning och att öppnade parameterformulär rullas in i synfältet. Plats reserveras före markering så att första klicket inte flyttar ackordet inför nästa klick. En ackordrad som hamnar utanför synfältet rullas fram efter 650 ms utan ny interaktion. På dator väntar detta också tills pekaren lämnat ackordet. Ett nytt klick, tangenttryck eller egen scroll avbryter förflyttningen.

Alla ikoner på en rad minskar antalet klick men kräver mer inlärning. Mobilraderna behöver svepas för att nå senare åtgärder. Synlig svephänvisning och stora tryckytor hjälper, men symbolerna och precisionen behöver provas på en fysisk telefon. Ett verkligt mobiltangentbord och fullständig tillgänglighetsgranskning ingår inte i webbläsarkontrollerna. De lokala parameterdialogerna använder webbläsarens modalhantering; den globala mobilpanelens tillgänglighet behöver granskas vidare.

Fri placering och självständiga formblock demonstrerar den kommande modellen. Dagens produktionsformat och PDF-rendering stöder inte alla dessa fall. [Designbeslutet](../../../docs/adr/0001-deldefinitioner-och-latform.md) dokumenterar skillnaden. Produktionseditorn och låtfilerna är oförändrade.

När en del återanvänds förankras dess ingående taktart. Återanvändningar följer sedan källdelens taktartsbyten oberoende av blockets plats. Fristående kopior behåller denna taktart. Borttagning av en takt med ett lokalt byte bevarar kvarvarande musikens taktart vid nästa takt. Formflyttar som gör befintliga placeringar ogiltiga stoppas.

Prototypen tillåter högst fyra grundackord per takt och högst fyra ackord per variantrad. Det första kan flyttas senare än slag 1, vilket avviker från dagens produktionsvalidering. I 6/8 räknas slag i åttondelar. Fjärdedelsrutnätet visar 1, 3, 5; åttondelar visar 1 till 6 och sextondelar halva enheter.

Bladet använder lokal HTML-rendering. Det anropar inte spar-API, PDF-export eller ljuduppspelning. Sidbrytning visas som en avdelare. Avancerade navigeringstecken, transponering, nottext och full textfilredigering ligger utanför prototypen.

## Verifiering

`verify-all.mjs` kör nio webbläsargranskningar och bildfångsten. `independent-review.json` sammanställer funktionstesterna. `verification.json` innehåller bildfångstens kontroller och aktuellt bildantal. `flat-review.mjs` kontrollerar de direkta ikonraderna, kryssrutornas omfattning, urval med luckor, massåtgärder, lokala parametrar och mobilbredderna 320, 375 och 430 pixels. Tidigare granskningar kontrollerar textredigering, varianter, rytm, hus, delar, återanvändningar, ångra, fokus och menybeteende.

`notation-review.mjs` kontrollerar dessutom variantens egna startpunkter och rytm, SVG-noternas faktiska läsbarhet, balkning, segmentets slaglinjal, mobilens två kolumner, kopiering av variantidentiteter, Escape och textfältets vanliga ångra/gör om.

Galleriet visar de aktuella arbetsmomenten på dator och mobil. Äldre bilder finns kvar i mappen för tidigare designversioner och används inte i den aktuella presentationen.

Senaste slutverifiering: 238 godkända funktionstester och 15 godkända kontroller vid bildfångst. Galleriet har 23 aktuella bilder. Inga JavaScriptfel. Syntax- och diffkontroller passerade.
