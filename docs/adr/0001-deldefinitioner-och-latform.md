---
status: accepted
---
# Deldefinitioner och låtform är separata

Låtdelar definieras oberoende av sina platser i spelordningen. Låtformen hänvisar till delarna, vilket gör att en återanvändning kan placeras före den skrivna originalförekomsten. Återanvändningar följer källdelens musik, medan "Gör till egen del" skapar en självständig definition och behåller antalet spelningar.

Format 1 behåller sin struktur. En återanvändning får hänvisa till en unik utskriven del var som helst i låten. Namn, taktintervall och avslutande taktart kan därför slås upp innan delen ritas. För en hänvisning före originalet beräknas avslutande taktart genom de utskrivna definitionernas ordning. När originalet redan har passerats används dess faktiska avslutande taktart, vilket bevarar äldre låtars ärvda byten. Taktartsberäkningen delas av validering, redigering och rendering.

En utskriven del får ha flera spelningar. Musiken skrivs en gång och delrubriken visar antalet. Låten får sakna delar och en takt får sakna ackord. Det gör att tomma blad och tillfälligt tomma takter kan sparas och ångras utan ersättningsackord. Varianter kan hänvisa till ett grundackord med `ackord_nr` och ha egen rytm inom dess spann. Äldre varianter utan denna hänvisning gäller fortfarande hela takten.

Det tidigare alternativet krävde att originaldelen låg först. Det förenklade hänvisningarna men begränsade flytt av formblock. Editorn får egna träffytor och utrymme för verktyg i SVG-renderingen. Bladet växer med innehållet och delas endast vid uttryckliga sidbrytningar. Det ger plats för mobilens knappar utan att automatiska A4-gränser avbryter redigeringen. PDF, spelvy och vanlig förhandsgranskning använder den befintliga sidlayouten och dess automatiska sidbrytningar.
