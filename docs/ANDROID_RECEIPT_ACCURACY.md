# ShqipShop — Rregullimi i saktësisë së faturës Android

**PR:** https://github.com/titanfit102-bit/ShqipShop/pull/8
**Status:** përmirësimi i kodit dhe regresionet Jest kanë kaluar; screenshot-i i ri Android është në pritje të verifikimit.

## Burimi i gabimit

[Android UI checkout run 39934984130](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39934984130) krijoi një porosi reale në PostgreSQL, me 1500 ALL produkt, 10 ALL transport, total 1510 ALL. [Screenshot-i](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39934984130/artifacts/12493738613) tregon gabimisht `Nëntotali 1510 ALL`. Kodi origjinal përdorte `order.subtotal`, i cili nuk është i njëjtë me item subtotal në këtë version Medusa.

## Korrigjimi

- `native-medusa/app/utils/order-totals.ts`: preferon `item_subtotal`, pastaj shumën e line subtotals, dhe vetëm në mungesë të tyre `unit_price × quantity`. Kur të dhënat janë të paplota kthen `null`, jo vlerë të shpikur. Nuk përdor `order.subtotal` për të shfaqur nëntotalin e mallrave.
- `order/order-detail.tsx`: formatimi në ALL (lekë të reja) dhe në EUR për monedhën kryesore; `ShopPrice` në totalin real me ekuivalent të vogël e gri vetëm nga kurs valid/datuar; transporti shfaq emrin që kthen API kur është i disponueshëm, përndryshe emërtim gjenerik nga lokalizimi.
- `navbar.tsx`: titull qendror me më shumë hapësirë, një rresht dhe shkallëzim për ekrane të vogla.
- `__tests__/order-totals.test.ts`: testet mbulojnë 1500 + 10 = 1510, line discounts, fallback dhe të dhëna të pavlefshme.

## Porta e përfundimit

Në Android emulator me Medusa ephemeral, përdor të njëjtin checkout si run i vërtetuar dhe kontrollo:
- Nëntotali **1.500 lekë**;
- Transporti **10 lekë**;
- Gjithsej **1.510 lekë** dhe, nëse demo FX është i validuar, në një rresht gri `≈ €15,10` me qartësimin se është orientuese;
- Emri i metodës reale të dorëzimit dhe titulli i plotë i faqes.
- Order në PostgreSQL vazhdon të jetë 1510 ALL.

Pa këtë run nuk quhet e verifikuar pamja e re, pavarësisht se kodet/testet e helper-it kalojnë.
