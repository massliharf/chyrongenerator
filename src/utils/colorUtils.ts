// Safe, predictable RGB darkening helper for border & shadow colors
// Eliminates browser inconsistencies with CSS color-mix() in SVG foreignObject contexts

export function darkenColor(color: string, percent: number = 0.2): string {
  if (!color) return '#000000';
  
  // If named or rgba, handle gracefully
  let hex = color.trim();
  if (hex.startsWith('#')) {
    hex = hex.substring(1);
  }
  
  if (hex.length === 3) {
    hex = hex.split('').map(char => char + char).join('');
  }
  
  const num = parseInt(hex, 16);
  if (isNaN(num)) {
    return 'rgba(0,0,0,0.4)';
  }
  
  const factor = Math.max(0, Math.min(1, 1 - percent));
  const r = Math.max(0, Math.min(255, Math.floor(((num >> 16) & 255) * factor)));
  const g = Math.max(0, Math.min(255, Math.floor(((num >> 8) & 255) * factor)));
  const b = Math.max(0, Math.min(255, Math.floor((num & 255) * factor)));
  
  return `rgb(${r}, ${g}, ${b})`;
}
