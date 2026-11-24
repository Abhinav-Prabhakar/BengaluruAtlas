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
  <img src="./assets/readme/hero-light.webp" alt="Bengaluru Atlas on desktop: a map of central Bengaluru with a detail panel for Cubbon Park" />
</a>

<div align="center"><sub>MG Road → Cubbon Park · 8 minutes by auto · one editorial pick out of 109.</sub></div>

<br/>

<table>
<tr>
<td align="center" width="33%"><h3>Pick a corner</h3><p>53 neighbourhoods, from Chickpet to Whitefield. Or drop a pin anywhere.</p></td>
<td align="center" width="33%"><h3>Name a mood</h3><p>Eat, coffee, parks, temples, bookshops, bars, museums, markets, transit, stays.</p></td>
<td align="center" width="33%"><h3>Set a window</h3><p>Walk, cycle, auto or cab. Five minutes to an hour. Watch the city redraw itself.</p></td>
</tr>
</table>

<br/>

<div align="center">
  <h3>One dial. The whole city.</h3>
  <sub>Fifteen minutes to sixty. The circle grows, the list follows.</sub>
</div>

<a href="https://abhinav-prabhakar.github.io/BengaluruAtlas/">
  <img src="./assets/readme/reach.gif" alt="The travel-time dial expanding from 15 to 60 minutes as the map radius and place count grow" />
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
<td align="center"><sub><strong>Twelve trails.</strong> Eight city walks, four day trips, every stop linked.</sub></td>
</tr>
</table>

<br/>

<a href="https://abhinav-prabhakar.github.io/BengaluruAtlas/?area=church-street&cat=eat&time=30">
  <img src="./assets/readme/discover.webp" alt="Eating places within 30 minutes of Church Street, shown across central Bengaluru" />
</a>

<div align="center"><sub>Church Street · 30 minutes · eating only · 1,796 places, ordered by what’s worth the trip.</sub></div>

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
  <th align="center">10,143</th>
  <th align="center">109</th>
  <th align="center">53</th>
  <th align="center">12</th>
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

> **The honest bit.** Travel times are estimates — straight-line distance, typical door-to-door speeds, a 1.28× road factor. No live traffic, no pretend precision. Every listing opens in Google Maps, where the real routing and the “start directions” button live.

<div align="center">

<strong>Saved &amp; visited</strong> stays in your browser · <strong>shareable links</strong> remember the whole view · <strong>installable</strong> · <strong>no accounts</strong> · <strong>no tracking</strong> · <strong>no keys</strong>

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

<p>10,143 OpenStreetMap places, cleaned and categorised. 109 editorial picks with photographs, best times and a point of view. Trail stops and area notes live in <a href="./data/"><code>data/</code></a>. The build scripts are in <a href="./scripts/"><code>scripts/</code></a>.</p>

</td>
</tr>
</table>

<div align="center">
  <sub>Map data © OpenStreetMap contributors (ODbL) · styles and tiles by <a href="https://openfreemap.org">OpenFreeMap</a> · photographs from Wikimedia Commons · weather by <a href="https://open-meteo.com">Open-Meteo</a>.</sub>
  <br/>
  <sub>Made for Bengaluru. <a href="https://abhinav-prabhakar.github.io/BengaluruAtlas/">Open the atlas →</a> · <a href="./PLAN.md">the original field plan</a></sub>
</div>
