# Deploy · Japan–Kamchatka Monitor

## Vercel

1. Import `SunWolf77/japan-kamchatka-monitor`
2. Framework preset: Other / Vite (Nitro handles output)
3. Build command: `npm run build`
4. Node 22
5. No secrets required for public monitor

## SES registration

Add to `sun-earth-sentinel` `publishedMonitors.ts`:

```ts
{
  sesNodeId: "japan",
  name: "Japan Arc",
  networkOrder: 3,
  shortCode: "JP",
  role: "Published focus · SES #3 · JMA + tsunami",
  monitorUrl: "https://japan-kamchatka-monitor.vercel.app/",
  catalogFeedUrl:
    "https://japan-kamchatka-monitor.vercel.app/api/ses/catalog?window=7d&node=japan",
  authority: "JMA Bosai (→ USGS fill)",
  aliases: ["japan", "jp", "jma", "tokara", "nansei", "japan-arc"],
  focusNote: "SES node #3 — Japan arc + Kamchatka companion. Tsunami watch first-class.",
},
{
  sesNodeId: "kamchatka",
  name: "Kamchatka–Kurils",
  networkOrder: 3,
  shortCode: "KM",
  role: "Published focus · SES #3 companion · USGS",
  monitorUrl: "https://japan-kamchatka-monitor.vercel.app/?node=kamchatka",
  catalogFeedUrl:
    "https://japan-kamchatka-monitor.vercel.app/api/ses/catalog?window=7d&node=kamchatka",
  authority: "USGS FDSN / realtime",
  aliases: ["kamchatka", "km", "kuril", "kurils", "kvert"],
  focusNote: "Kamchatka–Kurils on Japan board. USGS exclusive. KVERT for volcano status.",
},
```

## Smoke

```bash
npm run dev
# open /?node=japan and /?node=kamchatka
# open /?from=ses&sesNode=japan
curl -s "http://127.0.0.1:8080/api/ses/catalog?window=7d&node=japan" | head
```
