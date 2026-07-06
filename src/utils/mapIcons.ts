import L from 'leaflet'

export function categoryDivIcon(color: string, selected = false) {
  const size = selected ? 34 : 26
  return L.divIcon({
    className: 'reperage-marker',
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50% 50% 50% 0;
      background:${color};transform:rotate(-45deg);
      border:2px solid #0b1220;box-shadow:0 2px 6px rgba(0,0,0,0.5);
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
  })
}

export const userLocationIcon = L.divIcon({
  className: 'user-location-marker',
  html: `<div style="
    width:18px;height:18px;border-radius:50%;
    background:#38bdf8;border:3px solid white;
    box-shadow:0 0 0 4px rgba(56,189,248,0.35);
  "></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})
