import fs from 'fs';

// 1. Vertical / Full Official Logo (Exact copy of attached image)
const verticalSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 480" width="500" height="480">
  <rect width="100%" height="100%" fill="none"/>
  <g transform="translate(250, 150)" text-anchor="middle">
    <!-- Official 24-Dot Matrix Emblem of Saudi Ministry of Education -->
    <g fill="#00A887">
      <!-- Left Wing Dots -->
      <circle cx="-135" cy="-65" r="11" />
      <circle cx="-100" cy="-56" r="10.5" />
      <circle cx="-66" cy="-44" r="9.5" />
      
      <circle cx="-135" cy="-30" r="11" />
      <circle cx="-100" cy="-22" r="10.5" />
      <circle cx="-66" cy="-12" r="9.5" />

      <circle cx="-135" cy="5" r="10.5" />
      <circle cx="-100" cy="12" r="9.5" />
      <circle cx="-66" cy="18" r="8.5" />

      <!-- Left Lower Curve Dots -->
      <circle cx="-35" cy="-30" r="8.5" />
      <circle cx="-8" cy="-16" r="7" />
      <circle cx="-28" cy="7" r="6.5" />
      <circle cx="-50" cy="24" r="6" />
      <circle cx="-73" cy="35" r="5.5" />
      <circle cx="-95" cy="42" r="5" />
      <circle cx="-116" cy="46" r="4.5" />

      <!-- Right Wing Dots -->
      <circle cx="135" cy="-65" r="11" />
      <circle cx="100" cy="-56" r="10.5" />
      <circle cx="66" cy="-44" r="9.5" />
      
      <circle cx="135" cy="-30" r="11" />
      <circle cx="100" cy="-22" r="10.5" />
      <circle cx="66" cy="-12" r="9.5" />

      <circle cx="135" cy="5" r="10.5" />
      <circle cx="100" cy="12" r="9.5" />
      <circle cx="66" cy="18" r="8.5" />

      <!-- Right Lower Curve Dots -->
      <circle cx="35" cy="-30" r="8.5" />
      <circle cx="8" cy="-16" r="7" />
      <circle cx="28" cy="7" r="6.5" />
      <circle cx="50" cy="24" r="6" />
      <circle cx="73" cy="35" r="5.5" />
      <circle cx="95" cy="42" r="5" />
      <circle cx="116" cy="46" r="4.5" />
    </g>

    <!-- Main Title in Arabic -->
    <text y="135" font-family="'Tajawal', 'Cairo', 'Almarai', system-ui, sans-serif" font-weight="900" font-size="54" fill="#00A887" letter-spacing="0.5">وزارة التـعـلـيـم</text>

    <!-- Subtitle in English -->
    <text y="185" font-family="'Tajawal', 'Inter', system-ui, sans-serif" font-weight="600" font-size="28" fill="#71777D" letter-spacing="1">Ministry of Education</text>
  </g>
</svg>`;

// 2. Horizontal Logo (for header bars and compact spaces)
const horizontalSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 460 140" width="460" height="140">
  <rect width="100%" height="100%" fill="none"/>
  <!-- Emblem on Left -->
  <g transform="translate(75, 65)">
    <g fill="#00A887">
      <!-- Left Wing -->
      <circle cx="-50" cy="-25" r="5.5" />
      <circle cx="-36" cy="-21" r="5" />
      <circle cx="-23" cy="-16" r="4.5" />

      <circle cx="-50" cy="-11" r="5.5" />
      <circle cx="-36" cy="-8" r="5" />
      <circle cx="-23" cy="-4" r="4.5" />

      <circle cx="-50" cy="3" r="5" />
      <circle cx="-36" cy="5" r="4.5" />
      <circle cx="-23" cy="7" r="4" />

      <circle cx="-12" cy="-11" r="3.5" />
      <circle cx="-2" cy="-6" r="3" />
      <circle cx="-10" cy="3" r="2.8" />
      <circle cx="-18" cy="9" r="2.5" />
      <circle cx="-27" cy="14" r="2.2" />

      <!-- Right Wing -->
      <circle cx="50" cy="-25" r="5.5" />
      <circle cx="36" cy="-21" r="5" />
      <circle cx="23" cy="-16" r="4.5" />

      <circle cx="50" cy="-11" r="5.5" />
      <circle cx="36" cy="-8" r="5" />
      <circle cx="23" cy="-4" r="4.5" />

      <circle cx="50" cy="3" r="5" />
      <circle cx="36" cy="5" r="4.5" />
      <circle cx="23" cy="7" r="4" />

      <circle cx="12" cy="-11" r="3.5" />
      <circle cx="2" cy="-6" r="3" />
      <circle cx="10" cy="3" r="2.8" />
      <circle cx="18" cy="9" r="2.5" />
      <circle cx="27" cy="14" r="2.2" />
    </g>
  </g>

  <!-- Text on Right -->
  <g transform="translate(150, 0)">
    <text x="0" y="70" font-family="'Tajawal', 'Cairo', 'Almarai', system-ui, sans-serif" font-weight="900" font-size="42" fill="#00A887">وزارة التـعـلـيـم</text>
    <text x="0" y="105" font-family="'Tajawal', 'Inter', system-ui, sans-serif" font-weight="600" font-size="22" fill="#71777D" letter-spacing="0.5">Ministry of Education</text>
  </g>
</svg>`;

if (!fs.existsSync('public')) {
  fs.mkdirSync('public');
}

fs.writeFileSync('public/moe-logo.svg', verticalSvg);
fs.writeFileSync('public/moe-logo-horizontal.svg', horizontalSvg);
console.log('Successfully generated public/moe-logo.svg and public/moe-logo-horizontal.svg');
