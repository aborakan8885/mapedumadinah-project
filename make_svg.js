import fs from 'fs';

// Official Saudi Ministry of Education vector logo SVG
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 450" width="500" height="450">
  <!-- Ministry of Education Official Emblem -->
  <g transform="translate(250, 160)" text-anchor="middle">
    <!-- 24-Dot Matrix Symbol -->
    <g fill="#00A887">
      <!-- Left Wing -->
      <!-- Row 1 (Top) -->
      <circle cx="-130" cy="-70" r="11" />
      <circle cx="-95" cy="-60" r="10" />
      <circle cx="-62" cy="-48" r="9" />

      <!-- Row 2 (Middle) -->
      <circle cx="-130" cy="-35" r="11" />
      <circle cx="-95" cy="-27" r="10" />
      <circle cx="-62" cy="-17" r="9" />

      <!-- Row 3 (Lower) -->
      <circle cx="-130" cy="0" r="10" />
      <circle cx="-95" cy="6" r="9" />
      <circle cx="-62" cy="12" r="8" />

      <!-- Inner curve left -->
      <circle cx="-32" cy="-34" r="7.5" />
      <circle cx="-5" cy="-20" r="6.5" />
      <circle cx="-25" cy="2" r="6" />
      <circle cx="-47" cy="18" r="5.5" />
      <circle cx="-68" cy="30" r="5" />
      <circle cx="-90" cy="38" r="4.5" />
      <circle cx="-112" cy="42" r="4" />

      <!-- Right Wing -->
      <!-- Row 1 (Top) -->
      <circle cx="130" cy="-70" r="11" />
      <circle cx="95" cy="-60" r="10" />
      <circle cx="62" cy="-48" r="9" />

      <!-- Row 2 (Middle) -->
      <circle cx="130" cy="-35" r="11" />
      <circle cx="95" cy="-27" r="10" />
      <circle cx="62" cy="-17" r="9" />

      <!-- Row 3 (Lower) -->
      <circle cx="130" cy="0" r="10" />
      <circle cx="95" cy="6" r="9" />
      <circle cx="62" cy="12" r="8" />

      <!-- Inner curve right -->
      <circle cx="32" cy="-34" r="7.5" />
      <circle cx="5" cy="-20" r="6.5" />
      <circle cx="25" cy="2" r="6" />
      <circle cx="47" cy="18" r="5.5" />
      <circle cx="68" cy="30" r="5" />
      <circle cx="90" cy="38" r="4.5" />
      <circle cx="112" cy="42" r="4" />
    </g>

    <!-- Arabic Text: وزارة التعليم -->
    <text y="125" font-family="'Tajawal', 'Cairo', 'Almarai', Arial, sans-serif" font-weight="900" font-size="52" fill="#00A887" letter-spacing="1">وزارة التـعـلـيـم</text>

    <!-- English Text: Ministry of Education -->
    <text y="175" font-family="'Tajawal', 'Inter', Arial, sans-serif" font-weight="600" font-size="28" fill="#71777D" letter-spacing="0.8">Ministry of Education</text>
  </g>
</svg>`;

if (!fs.existsSync('public')) {
  fs.mkdirSync('public');
}

fs.writeFileSync('public/moe-logo.svg', svgContent);
console.log('Saved public/moe-logo.svg successfully');
