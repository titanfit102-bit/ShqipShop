# ShqipShop — prova e parë për backend-e Medusa të izoluar

**PR:** https://github.com/titanfit102-bit/ShqipShop/pull/10  
**CI:** https://github.com/titanfit102-bit/ShqipShop/actions/runs/39947677104 — **PASSED**  
**Datë:** 23 tetor 2026

## Modeli demonstrues
GitHub Actions krijon dy databaza PostgreSQL 16: `shqipshop_ci_a` dhe `shqipshop_ci_b` me role login `shqipshop_ci_a` dhe `shqipshop_ci_b`. `CONNECT` për PUBLIC revokohet nga të dy databazat; bashkë me credentials të veçanta kjo është prova e parë e kufirit fizik.

Me të njëjtin kod Medusa v2, databaza A migrohet dhe popullohet me produktet shqiptare/ALL. Instanca A ngrihet në port 9000 dhe krijon një porosi sintetike nëpërmjet Store API. Pasi A ndalet, databaza B migrohet dhe instanca B ngrihet në port 9001 me çelësin e vet.

## Evidenca e vërtetuar (pa të dhëna private)

| Kontrolli | Rezultati |
|---|---|
| B role lidhet në A DB | Refuzuar |
| A role lidhet në B DB | Refuzuar |
| B key kërkon katalogun e B | HTTP 200 |
| A key kërkon katalogun e B | HTTP 400 |
| B key kërkon me ID porosinë e A në backend-in B | HTTP 404 |

Markers: `SHQIPSHOP_TWO_DATABASE_ROLE_DENIAL_PASSED`, `SHQIPSHOP_MERCHANT_A_ORDER_CREATED`, `SHQIPSHOP_SEPARATE_MEDUSA_ORDER_BOUNDARY_PASSED`.

Krahasimi i domosdoshëm: [CI i modelit të gabuar me sales channels](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39946398016) kishte HTTP 200 për të njëjtën porosi me të dy çelësat e kanaleve. Prandaj për pilotin rekomandohet **dedicated backend + dedicated database**.

## Çfarë nuk provon kjo

- Instancat Medusa **nuk qëndrojnë aktive paralelisht** në këtë CI. Izolimi Redis/queues/workers, eventet dhe logjet nuk janë audituar.
- Testi i portës Store nuk nënkupton që sesionet, përdoruesit, adminët, media, refunds, payments, autentikimi apo API calls të tjera janë të sigurta automatikisht.
- Nuk ka provisioner, deployment production, TLS/secret manager për tenant, kosto reale, backup/restore ose shtim/fshirje tregtarësh.
- Nuk ka publikim te klientët, procesim kartash apo EUR checkout real.

## Hapi konkret pasues
Krijo një test **paralel A+B** me dy medusa processes me veçim datastores, synimet e mjeteve admin/customer, negativë me ID/cookie/JWT/admin tokens, rastet e ndryshimit të databazës dhe logs, dhe provë backup restore. Ndërto një provisioner të idempotent të sigurt vetëm pasi kontrata e infrastrukturës është testuar.

**G3 multi-merchant isolation: INCOMPLETE.** Ndalo lançimin me dy tregtarë dhe PII reale deri sa të kalojnë portat negative dhe security review.
