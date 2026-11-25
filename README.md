<div align="center">
  <img src="./app/public/icon-192.png" width="76" alt="Bengaluru Atlas" />
  <h1>Bengaluru Atlas</h1>
  <p><em>A field guide to the city, sorted by how far you’ll actually go.</em></p>
  <p>
    <a href="https://abhinav-prabhakar.github.io/BengaluruAtlas/"><img src="https://img.shields.io/badge/Open_the_atlas-live-15251B?style=for-the-badge&logo=githubpages&logoColor=EFE7D6" alt="Open the live atlas"></a>
    <img src="https://img.shields.io/badge/React-19-1B3A2A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React 19">
    <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
    <img src="https://img.shields.io/badge/MapLibre_GL-5.9-295DAA?style=for-the-badge" alt="MapLibre GL">
    <img src="https://img.shields.io/badge/License-MIT-D96C47?style=for-the-badge" alt="MIT License">
  </p>
  <p><strong>Bengaluru, inside out.</strong> Pick a corner. Pick a mood. Pick how far you’ll go.<br/>
  Then let the map do the arguing.</p>
</div>

<br/>

<a href="https://abhinav-prabhakar.github.io/BengaluruAtlas/">
  <img src="./assets/readme/hero-light.webp" alt="Bengaluru Atlas on desktop: live traffic ribbons on the map, place cards with photos, and 37 moods in the filter rail" />
</a>

<div align="center"><sub>MG Road · 20 minutes by auto · 800+ places in reach · 13 corridors of live traffic.</sub></div>

<br/>

<table>
<tr>
<td align="center" width="33%"><h3>Pick a corner</h3><p>53 neighbourhoods, from Chickpet to Whitefield. Or drop a pin anywhere.</p></td>
<td align="center" width="33%"><h3>Name a mood</h3><p>37 moods — tiffin, Chinese, lakes, bookshops, temples, bars, breweries, sunsets, stays.</p></td>
<td align="center" width="33%"><h3>Set a window</h3><p>Walk, cycle, auto or cab. Five minutes to an hour, with live traffic on the roads.</p></td>
</tr>
</table>

<br/>

<div align="center">
  <h3>One dial. The whole city.</h3>
  <sub>Five minutes to sixty. The circle grows, the list follows — and the clock is traffic-aware.</sub>
</div>

<a href="https://abhinav-prabhakar.github.io/BengaluruAtlas/">
  <img src="./assets/readme/reach.gif" alt="The travel-time dial expanding as the map radius and place count grow" />
</a>

<br/>
<br/>

<table>
<tr>
<td width="50%">
  <img src="./assets/readme/hero-dark.webp" alt="Bengaluru Atlas in dark mode" />
</td>
<td width="50%">
  <img src="./assets/readme/trail.webp" alt="A walking trail drawn across old Bangalore, with its stops listed in the rail" />
</td>
</tr>
<tr>
<td align="center"><sub><strong>Dark mode, drawn —</strong> not inverted. A second hand-tuned map style.</sub></td>
<td align="center"><sub><strong>206 trails.</strong> City walks, food crawls, temple runs and day trips — searchable, filterable, and fitted to the map.</sub></td>
</tr>
</table>

<br/>

<a href="https://abhinav-prabhakar.github.io/BengaluruAtlas/?area=church-street&mood=coffee&time=30">
  <img src="./assets/readme/discover.webp" alt="Coffee places within 30 minutes of Church Street, shown across central Bengaluru" />
</a>

<div align="center"><sub>Church Street · 30 minutes · filter coffee only · ordered by what’s worth the trip.</sub></div>

<br/>
<br/>

<div align="center">
  <h3>And it fits in a pocket.</h3>
  <sub>Full map, full list, full detail sheet. Nothing watered down.</sub>
</div>

<p align="center">
  <img src="./assets/readme/mobile-discover.webp" width="24%" alt="Mobile map and place list" />
  <img src="./assets/readme/mobile-detail.webp" width="24%" alt="Cubbon Park detail sheet on mobile" />
  <img src="./assets/readme/mobile-filters.webp" width="24%" alt="Mobile filter sheet with travel time and categories" />
</p>

<br/>

<table align="center">
<thead>
<tr>
  <th align="center">9,362</th>
  <th align="center">201</th>
  <th align="center">53</th>
  <th align="center">206</th>
  <th align="center">0</th>
</tr>
</thead>
<tbody>
<tr>
  <td align="center">places mapped</td>
  <td align="center">editorial picks</td>
  <td align="center">neighbourhoods</td>
  <td align="center">walks &amp; day trips</td>
  <td align="center">API keys</td>
</tr>
</tbody>
</table>

<br/>

> **The honest bit.** The first cards use real road routes from OSRM, adjusted by live readings from 13 instrumented Bengaluru corridors. The rest are modelled from the same speeds, with a baked 24-hour profile when GitHub is unreachable. Traffic updates every ten minutes; every listing opens Google Maps for turn-by-turn.

<div align="center">

<strong>Saved &amp; visited</strong> stays in your browser · <strong>shareable links</strong> remember the whole view · <strong>37 moods</strong> · <strong>206 trails</strong> · <strong>live traffic</strong> · <strong>follows your device theme</strong> · <strong>installable</strong> · <strong>no accounts</strong> · <strong>no tracking</strong> · <strong>no keys</strong>

</div>

<br/>

<div align="center">
  <h3>Built with</h3>
  <p>React 19 · TypeScript · Vite · MapLibre GL · OpenFreeMap<br/>
  Self-hosted Fraunces, Manrope and JetBrains Mono · a warm, hand-recoloured paper-and-ink basemap</p>
</div>

<br/>

<table>
<tr>
<td width="50%" valign="top">

<p><strong>Run it</strong></p>

<pre><code>cd app
npm install
npm run dev
npm run build   # → ../docs, ready for Pages</code></pre>

</td>
<td width="50%" valign="top">

<p><strong>The data</strong></p>

<p>9,362 OpenStreetMap places, cleaned and categorised. 201 editorial picks with best times and a point of view; 188 places carry an openly licensed photograph, and the rest get a designed cover. Traffic is modelled from 13 instrumented corridors; live readings come from the <a href="https://github.com/thecont1/traffic-monitor-lizard">traffic-monitor-lizard</a> dataset. 206 trails are assembled from curated anchors, and every stop links back to the atlas. Trail stops and area notes live in <a href="./data/"><code>data/</code></a>; the build scripts are in <a href="./scripts/"><code>scripts/</code></a>.</p>

</td>
</tr>
</table>

<div align="center">
  <sub>Map data © OpenStreetMap contributors (ODbL) · styles and tiles by <a href="https://openfreemap.org">OpenFreeMap</a> · routing by <a href="https://routing.openstreetmap.de">OSRM / OpenStreetMap.de</a> · photographs from Wikimedia Commons · weather by <a href="https://open-meteo.com">Open-Meteo</a>.</sub>
  <br/>
  <sub>Made for Bengaluru. <a href="https://abhinav-prabhakar.github.io/BengaluruAtlas/">Open the atlas →</a> · <a href="./PLAN.md">the original field plan</a></sub>
</div>
