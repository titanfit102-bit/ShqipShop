# ADR-006 — Izolim fizik i bizneseve për pilotin Medusa

**Datë:** 2026-10-23  
**Status:** vendim arkitekturor provizor për pilotin; **jo implementim production**  
**Burimi i evidencës:** [Medusa boundary CI run 39946398016](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39946398016)

## Problemi dhe prova që ndryshon vendimin

ShqipShop do të krijojë një vitrinë/website dhe, kur është e nevojshme, një aplikacion Android/iOS me markën e vet për çdo tregtar. Katalogu, klientët, porositë dhe administratorët nuk mund të përzihen midis bizneseve.

Testet e Medusa Store API kishin kaluar ndarjen e katalogut me **dy sales channels dhe dy publishable API keys**. Por [run 39946398016](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39946398016) krijoi një porosi sintetike për kanalin A dhe bëri `GET /store/orders/{id}` me dy çelësa. **A: HTTP 200, B: HTTP 200**. Job dështoi qëllimisht me `SHQIPSHOP_CROSS_CHANNEL_ORDER_ID_EXPOSED`.

Interpretimi: **sales-channel publishable keys nuk janë kufiri i autorizimit të një biznesi.** Nuk vërtetohet se Medusa ka një defekt sigurie universal; konfigurimi demonstrues nuk është një arkitekturë e sigurt multi-tenant dhe nuk duhet përdorur në prodhim për dy tregtarë.

## Vendimi: Modeli A, fillimisht për 3–5 tregtarët pilot

- Një **Medusa backend i pavarur për çdo tregtar**, me autentikim/administratorë dhe konfigurim të vetin.
- Një **PostgreSQL database e veçantë për çdo tregtar**, me përdorues/role, akses dhe kredenciale të veçanta. Skema e njëjtë në një DB nuk mjafton si kufi.
- Redis/queues, cache, sesione dhe workers izolohen në namespace ose instancë me politika strikte; asnjë job/event i një tregtari nuk merr kontekstin e një tjetri.
- Image/media storage me bucket ose prefix dhe kredenciale të dedikuara, kontroll i lejeve të upload/download dhe domain konfigurime të veçanta.
- Çdo frontend PWA ose APK white-label ka endpoint-in **HTTPS** dhe publishable key të tregtarit përkatës. Ky key është publik dhe **nuk trajtohet si autorizim ndaj të dhënave private**.
- Një **ShqipShop control plane** i ndarë ruan vetëm tenant metadata (planin, identitetin publik, domain, provisioning, version deploy, gjendje abonimi dhe vendndodhje teknike të backend-it). **Nuk lexon porosi, identitete klientësh apo kredenciale pagesash** në rrjedhën normale.
- Billing i platformës dhe payment provider i tregtarit janë dy domene financiare të veçanta. Komisionet, nëse futen më pas, kërkojnë kontratë dhe reconciliation.
- Nuk kopjojmë/modifikojmë kod të sistemeve të tjera; ShqipShop mbetet repository i izoluar.

## Përfitime dhe kompromise

- Izolim më i lehtë për t'u provuar me DB roles, backup/restore, deployment dhe auth admin.
- Kosto më e madhe për tenant (compute, DB, maintenance, observability). Përpara se të hapim qindra dyqane, masim për 5, 50, 500 tregtarë dhe krijojmë vendimin e dytë për optimizim.
- Opsioni B (Medusa/shared backend me tenant-aware modules dhe RBAC në çdo endpoint, event, cache, worker e storage) mbetet alternativë **vetëm pas një auditimi sigurie dhe prove të izolimit të plotë**. Nuk mjafton të ndryshojmë vetëm filtrin e produkteve.

## Control plane — kontratë fillestare, jo kod i implementuar

`merchant_id`, `slug`, `public_name`, `currency_policy`, `backend_origin`, `publishable_key_id` (jo tokeni sekret), `domain`, `theme_version`, `billing_plan`, `deployment_id`, `provisioning_state`, `last_healthy_at`. Regjistri duhet të mbështesë idempotent provisioning dhe deprovisioning të auditueshëm.

`merchant_id` nuk lejohet të ndryshohet nga klienti për të kaluar tek backend-i i një biznesi tjetër; origjina e backend-it vendoset nga host/domain i besuar dhe konfigurim i nënshkruar nga platforma. Admin autentikohet vetëm me backend-in përkatës.

## Testet që duhen të kalojnë para 2 pilotëve live

1. Krijo dy instanca Medusa A/B, dy database, dy DB roles, keys dhe admin users të veçantë. Seed produkte/order të ndryshme.
2. Nga klienti A, mos lejo të shihen/modifikohen produktet/porositë/klientët e B me ID të njohur, headers të modifikuar, session/JWT e gabuar, apo backend domain të manipuluar.
3. Admin A nuk mund të thërrasë Admin API e B. Testo roles, auth, refunds, stock, fulfillment, store order, search, assets, event dispatch dhe webhooks.
4. DB credentials A nuk mund të lidhen me DB B; testoni përjashtim të backup/restore, rotations dhe izolim të logjeve.
5. Dy checkout paralel nuk ndryshojnë stokun e njëri-tjetrit; cancel, refund, tax/shipping dhe payment status mbeten brenda tenant-it.
6. Dokumento dhe verifiko koston (compute/storage/monitorim) dhe automatizimin e krijimit/fshirjes. Kontrolli i faturimit dhe kufijtë e burimeve duhet të jenë operativë.
7. Production gate: threat-model review, dependency security remediation, TLS, sekretet, GDPR/privatësia, rate limiting, log redaction, monitoring, release signing dhe app-store policies.

## Pranimi / përcaktimi i progresit

- **G2 (Android checkout teknike):** e provuar në CI në një backend demo.
- **G3 (multi-merchant isolation):** **BLOCKED** — dy instanca me databaza të ndara, autorizim dhe testet negative ende nuk janë implementuar.
- **PR #9:** test diagnostik negativ me CI **RED** për shkak të kufirit të pasigurt (i pritshëm). Nuk duhet kthyer green duke fshehur ose hequr kontrollin.
- **Next:** proof-of-concept provisioning A/B me datastore të ndara, dy mobile/PWA client settings, test i qasjes negative end-to-end dhe ADR i kostove.

**Nuk lejohet deploy me të dhëna klientësh realë ose merge në main derisa këto porta të kalojnë.**
