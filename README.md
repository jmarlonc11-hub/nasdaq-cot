# COT//NQ Terminal

Dashboard estilo Bloomberg × Matrix para analizar el **Commitments of Traders (TFF)** del Nasdaq-100
(E-mini `209742`, Micro E-mini y vista combinada con el Micro a 1/10).

## Qué muestra
- **Sesgo compuesto** (heurística sobre COT Index 52s: Asset Mgrs y Dealers a favor, Lev Funds contrarian)
- **Snapshot**: fecha de posición, próximo reporte, Open Interest y su lectura con el precio
- **Tabla por tipo de trader**: long/short/neto, cambios semanales, %OI, COT Index 26/52/156 y Z-score 52s
- **Gráficos** (TradingView Lightweight Charts): neto por categoría vs NQ, COT Index con bandas 10/90, OI vs NQ
- **Divergencias** precio vs posicionamiento (4 semanas)
- **Backtest** de extremos del COT Index: retorno del NQ a +4/+8/+12 semanas vs la media de todas las semanas

Atajos de teclado: `E` E-mini · `M` Micro · `C` Combinado.

## Datos
- COT: API pública de la CFTC (`publicreporting.cftc.gov`, dataset TFF Futures Only `gpe5-46if`).
- Precio: Yahoo Finance (`NQ=F`, con `^NDX` de respaldo).
- Se revalida cada hora (ISR). Si la CFTC no responde en desarrollo/build, se muestran **datos demo** con aviso visible;
  en producción se sigue sirviendo la última versión buena.
- `GET /api/cot` devuelve los datos en JSON.

Variables opcionales: `CFTC_APP_TOKEN` (token de Socrata para más cuota), `CFTC_TFF_DATASET`.

## Desarrollo
```bash
cd nasdaq-cot
npm install
npm run dev
```

## Deploy en Vercel
1. Importa el repo en Vercel.
2. En **Root Directory** elige `nasdaq-cot`. El framework (Next.js) se detecta solo.
3. Deploy.

> Herramienta informativa; no constituye asesoría financiera.
