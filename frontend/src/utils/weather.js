const OPENWEATHER_BASE = 'https://api.openweathermap.org/data/2.5';

/**
 * Fetch current weather at (lat, lng) from OpenWeatherMap.
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Promise<{ tempFormatted: string, description: string, icon: string } | null>}
 */
export async function fetchWeatherAt(lat, lng) {
  const apiKey = process.env.EXPO_PUBLIC_WEATHER_API_KEY;
  if (!apiKey) {
    console.warn('EXPO_PUBLIC_WEATHER_API_KEY is not set');
    return null;
  }
  try {
    const url = `${OPENWEATHER_BASE}/weather?lat=${lat}&lon=${lng}&appid=${apiKey}&units=metric`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const temp = data.main?.temp;
    const weather = data.weather?.[0];
    const tempFormatted = typeof temp === 'number' ? `${Math.round(temp)}°C` : '—°C';
    const description = weather?.description ?? '—';
    const icon = weather?.icon ?? '';
    return { tempFormatted, description, icon };
  } catch {
    return null;
  }
}

/** Map OpenWeatherMap icon code to Ionicons name for display. */
export function weatherIconToIonicons(icon) {
  if (!icon) return 'partly-sunny-outline';
  const code = icon.slice(0, 2);
  const map = {
    '01': 'sunny-outline',       // clear
    '02': 'partly-sunny-outline',
    '03': 'cloud-outline',
    '04': 'cloudy-outline',
    '09': 'rainy-outline',
    '10': 'rainy-outline',
    '11': 'thunderstorm-outline',
    '13': 'snow-outline',
    '50': 'cloudy-outline',      // mist
  };
  return map[code] || 'partly-sunny-outline';
}
