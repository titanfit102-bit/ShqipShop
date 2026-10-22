# ShqipShop — projekt / histori ndryshimesh

**Qëllimi:** Ky dokument është log kronologjik. Për statusin e sotëm lexo `MASTER_HANDOFF.md`; për vendimet e arkitekturës lexo `ADR-003_MEDUSA_NATIVE_VS_CUSTOM_PILOT.md`.

## 2026-10-22 · Origjina e idesë

- Repository origjinal i identifikuar: https://github.com/bloomsynth/medusa-mobile-react-native. Është klient React Native për Medusa v2, me licencë MIT.
- Përdoruesi sqaroi se dëshiron të përdorë kodin për biznese në Shqipëri: secili biznes të ketë **aplikacionin e vet të branduar**, me produkte, klientë dhe porosi. Nuk po ndërtonim një marketplace shumëshitës të përbashkët.
- Diskutuam konceptin white-label SaaS dhe modelet PWA/Android/iOS. Tarifat dhe kostot ishin shembuj, jo kontrata apo verifikim tregu.

## 2026-10-22 · Ndërtimi i pilotit

- Në vend të importimit të plotë të React Native origjinal u zhvillua një prototip i veçantë PWA me FastAPI, SQLite, templates, CSS dhe JavaScript. Kjo ishte zgjedhje për të demonstruar menjëherë sistemin multi-merchant dhe panelin.
- Përmbajtja: dyqane per slug, theme, katalog, shportë, porosi cash-on-delivery, sesione administrimi, inventar, status porosish; 3 dyqane fikse demo.
- U krijua kit shqip `mobile-medusa/` për t'u aplikuar te React Native upstream. **Nuk u importua i gjithë upstream dhe nuk u bë build APK/IPA**.
- U krijua paketa ZIP lokale dhe një PREVIEW_OFFLINE vetëm demonstrim pamjeje.

## 2026-10-22 · GitHub dhe verifikimi

- Përdoruesi krijoi `titanfit102-bit/ShqipShop`; u hap branch `feat/bootstrap-pwa-mvp` dhe PR #1 Draft.
- Përdoruesi ngarkoi kodin me GitHub Upload. Mungonin dotfiles nga ngarkimi manual; ato u krijuan përmes GitHub connector.
- U shtuan teste izolimi të biznesit dhe keys për idempotency të porosive.
- U konfigurua GitHub Actions në `ubuntu-latest` me Python 3.13 dhe read-only permissions. U përditësuan action-et te variantet Node 24.
- Run 39822589301 për commit `2a8b1d1bd3c98a34149d4056097768003c0178cc`: **10 passed, 1 dependency deprecation warning**, logje konfirmuese. Nuk u krye deploy publik.
- `main` në kohën e kontrollit nuk kishte ndryshuar; PR mbeti Draft.

## 2026-10-22 · Pyetja strategjike dhe vendimi

- Përdoruesi pyeti nëse duhej marrë e modifikuar drejtpërdrejt vepra origjinale Medusa. Vlerësim: **po, për native ky është një drejtim më i përshtatshëm** se të rindërtojmë një aplikacion të tërë nga zero.
- Por kodi origjinal është klient, jo platformë multi-tenant SaaS dhe kërkon backend v2. Pilotin ekzistues nuk e shkatërrojmë. Eksperimentojmë në branch/dosje të veçantë dhe më pas unifikojmë burimin e të dhënave.
- Ky vendim ruhet në ADR-003, dhe gates në ROADMAP.

## Regjistri i vendimeve të hapura

| Tema | Vendimi aktual | Kriteri që e ndryshon |
|---|---|---|
| Native klienti | Medusa Mobile është **kandidat kryesor**, i pa-testuar nga ne | Build + backend + checkout E2E |
| Commerce production engine | Ende i papërcaktuar; mos e supozo FastAPI SQLite | POC Medusa tenant isolation, performance dhe kosto |
| Izolimi multi-tenant | Thelbësor në arkitekturë; pilot nuk është provë prodhimi | Integration/security tests, migration/backup |
| Branding/URL e çdo biznesi | Path per slug në pilot; domain/app real TBD | Rezultatet e 3–5 pilotëve |
| Pagesat | COD vetëm në pilot; pagesat online nuk implementohen pa provider | PSP kontratë + sandbox + siguri + legal |
| Tarifat SaaS | 29€ dhe 79€ vetëm hipoteza | Angazhimi i blerësve, marzhi dhe kostoja reale |
| Publikimi në app stores | Nuk premtohet për të gjitha bizneset | Politikat Apple/Google dhe kush e zotëron llogarinë e publikimit |

## Format për seancat e ardhshme

Pas çdo sesioni, shto në fund: `data · branch · commit SHA · PR · çfarë ndryshoi · testet (link run) · bllokimet · vendimi/next action`. Pa një run të ri mos kopjo statusin 'passed' për commit-in pasardhës.

## 2026-10-22 · Origjinali Medusa u fut realisht në ShqipShop

- Përdoruesi propozoi ShqipShop si **katalog APK Android**, ku dyqanet e bizneseve shkarkohen si aplikacione të veçanta nga ShqipShop. Koncepti u analizua; nuk është implementuar, dhe nuk zëvendëson automatikisht strategjinë PWA/native. Shih ADR-004.
- U krijua branch feat/native-medusa-poc nga feat/bootstrap-pwa-mvp, me PR #2 Draft mbi PR #1.
- U kopjua kodi MIT i upstream në native-medusa/ nga commit 4ad76d0. Importimi u bë përmes GitHub Actions me workflow të përkohshëm që hoqi vetveten pas commit-it; nuk ishte e nevojshme ngarkimi manual.
- Origjinali përmbante 170 files, 2 prej tyre JVM crash logs të injoruara nga root .gitignore; .env.template u rikthye. Kodi i përfshirë përmban React Native Android/iOS, teste, package-lock dhe LICENSE.
- U shtua sq-AL localization në React Native: katalogu, provider, settings dhe type/env config. Testet native JavaScript/TypeScript/Jest kaluan në run https://github.com/titanfit102-bit/ShqipShop/actions/runs/39826582144 (**5 suites, 17 tests**).
- **Status real:** APK nuk është ndërtuar, Medusa backend test nuk është ngritur; nuk ka gjenerator app-esh, dyqan APK, billing apo publikim. main nuk është prekur.
