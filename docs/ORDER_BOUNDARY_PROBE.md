# ShqipShop — Cross-channel Store order access diagnostic

**PR #9:** https://github.com/titanfit102-bit/ShqipShop/pull/9  
**Run i parë:** https://github.com/titanfit102-bit/ShqipShop/actions/runs/39946398016  
**Status fillestar:** verifiko rezultatin live; nuk është provë për izolimin e tenantëve.

## Pse ekziston

Medusa Store publishable API keys mund të kufizojnë katalogët sipas sales channels, por **një sales channel nuk është automatikisht një tenant**. Testet e mëparshme treguan që çelësi B nuk liston produktet e kanalit A dhe nuk i lexon me ID. Ato nuk testuan porositë apo klientët.

## Çfarë bën testi

Në një runner CI me database PostgreSQL dhe Redis të përkohshëm, krijohet porosia e testit me kanalin fillestar A. Skripti `probe-order-channel-boundary.mjs` lexon të njëjtën ID përmes `GET /store/orders/{id}` me:

- publishable API key të kanalit A;
- një publishable API key të kanalit B me katalog bosh.

**Vetëm statuset HTTP** shkruhen në log. Asnjë porosi, klient, API key apo payload i ndjeshëm nuk printohet.

## Interpretim pa pretendime të tepruara

- **B → HTTP 200:** potencial për akses të një porosie tjetër përmes API të synuar; CI dështon me `SHQIPSHOP_CROSS_CHANNEL_ORDER_ID_EXPOSED`. Sales channels nuk mund të përdoren si kufiri i izolimit të bizneseve.
- **A → HTTP 200; B → HTTP 403/404:** prova negative e **këtij endpoint-i**; jo provë e izolimit të klientëve, admin, refunds etj.
- **A → 401/403/404; B ≠ 200:** `SHQIPSHOP_STORE_ORDER_SCOPE_INCONCLUSIVE`. Order endpoint ka nevojë për autentikim shtesë dhe prova me sesione të veçanta për A/B nuk është bërë. Mos shëno tenant isolation PASS.

## Hapat për një multi-tenant production-grade

Merr vendim arkitekturor me dy kandidatë: (A) instancë Medusa dhe databazë të veçantë për tregtarin, me control-plane të përbashkët ShqipShop; (B) backend i përbashkët me tenant_id, RBAC dhe tenant-bound query për çdo modul. Deri në rezultatet e provave negative dhe llogaritjen e kostos, **asnjëri nuk shpallet i përfunduar**.

Testet e ardhshme duhet të përfshijnë customer authentication, identitete të veçanta të adminëve dhe merchant users, order list/detail/update, inventar, fulfillment/refund, event subscriptions, caching, media, file storage, billing dhe back-up/restore. Dy biznese me kontrata izolimi të verifikuara janë kusht për prodhim.

## 23 tetor 2026 — PROVË KRITIKE: sales channel B lexon order të A

- **[CI run 39946398016](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39946398016): FAILURE, për arsye sigurisë së parashikuar.** Një porosi **vetëm sintetike** u krijua në kanalin A (1510 ALL). `GET /store/orders/{id}` me key publik të kanalit A ktheu **HTTP 200**, dhe me key publik të kanalit të dytë bosh B ktheu **HTTP 200**. Log `SHQIPSHOP_STORE_ORDER_ACCESS_STATUSES {"originalChannelStatus":200,"otherChannelStatus":200}` dhe `SHQIPSHOP_CROSS_CHANNEL_ORDER_ID_EXPOSED`. Kjo tregon që ndarja e sales channels/publishable keys në Medusa demo **NUK është multi-tenant authorization për porositë**. Është problem i projektimit të modelit tonë të përbashkët, JO pretendim se Medusa ka një defekt universal.
- **Vendimi arkitekturor provizor i pilotit:** [ADR-006](ADR-006_TENANT_BACKEND_ISOLATION.md) — nga 3 deri në 5 dyqane të para, çdo tregtar me Medusa backend, PostgreSQL database/role, admin dhe storage/Redis të izoluara, menaxhuara nga një control plane ShqipShop që nuk ndërhyn te të dhënat e klientëve. Para zgjerimit duhet analizë e kostos për 5/50/500 tenant dhe testet negative të plota.
- **KUFIRI REAL:** Ky është vendim projektimi dhe dokument, jo implementim i dy backend-eve. `G3 tenant isolation` mbetet **BLOCKED**; PR #9 mbetet Draft/red derisa të krijojmë dhe provojmë realisht modelin e ri. **Mos e zgjidh dështimin duke fshirë testin e aksesit** dhe mos përdor të dhëna reale.
- **Testi i faturës Android:** [Run 39946022933](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39946022933) është një workstream tjetër, i papërfunduar në shënimin fillestar. Kontrollo live për screenshot dhe marker `SHQIPSHOP_ANDROID_RECEIPT_ALL_ROWS_PASSED` me 1500+10=1510 dhe `SHQIPSHOP_ANDROID_RECEIPT_UI_PASSED`. Nuk mund të deklarohet success para këtyre.
