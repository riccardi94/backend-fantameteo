import { createClient } from '@supabase/supabase-js';
import { fetchWeatherApi } from 'openmeteo';

const supabase = createClient('https://gcsjlnhslitmmqpzgrxn.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdjc2psbmhzbGl0bW1xcHpncnhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY0OTQ3ODksImV4cCI6MjA0MjA3MDc4OX0.iNujFZ5PeJRKR8wAQTkE340yJpuUb37wAH6hDEGHv94');

export default async function handler(req, res) {
  const { city, latitude, longitude } = req.query;
  console.log(city, latitude, longitude);

  if (!city || !latitude || !longitude) {
    return res.status(400).json({ error: 'Missing city, latitude, or longitude parameter' });
  }

  const params = {
    latitude: parseFloat(latitude),
    longitude: parseFloat(longitude),
    "hourly": ["temperature_2m", "precipitation_probability", "precipitation", "weather_code", "cloud_cover"],
    "forecast_days": 3
  };

  const url = "https://api.open-meteo.com/v1/forecast";

  try {
    const responses = await fetchWeatherApi(url, params);
    const response = responses[0];
    const utcOffsetSeconds = response.utcOffsetSeconds();
    const hourly = response.hourly()!;

    const range = (start, stop, step) =>
      Array.from({ length: (stop - start) / step }, (_, i) => start + i * step);

    const weatherData = {
      hourly: {
        time: range(Number(hourly.time()), Number(hourly.timeEnd()), hourly.interval()).map(
          (t) => new Date((t + utcOffsetSeconds) * 1000)
        ),
        temperature2m: hourly.variables(0)!.valuesArray()!,
        precipitationProbability: hourly.variables(1)!.valuesArray()!,
        precipitation: hourly.variables(2)!.valuesArray()!,
        weatherCode: hourly.variables(3)!.valuesArray()!,
        cloudCover: hourly.variables(4)!.valuesArray()!,
      },
    };

    console.log('weatherData', weatherData);

    // Implementazione del batch upsert
    const batchSize = 10; // Puoi regolare questo numero in base alle tue esigenze
    const batches : any[] = [];

    for (let i = 0; i < weatherData.hourly.time.length; i += batchSize) {
      const batch : any = [];
      for (let j = i; j < i + batchSize && j < weatherData.hourly.time.length; j++) {
        batch.push({
          date: weatherData.hourly.time[j].toISOString(),
          temperature: weatherData.hourly.temperature2m[j],
          precipitation: weatherData.hourly.precipitation[j],
          precipitation_probability: weatherData.hourly.precipitationProbability[j],
          cloud_cover: weatherData.hourly.cloudCover[j],
          code: weatherData.hourly.weatherCode[j],
          city,
        });
      }
      batches.push(batch);
    }

    for (const batch of batches) {
      const { error } = await supabase.from('weather_data').upsert(batch, { onConflict: 'date, city' });
      if (error) {
        console.error('Error upserting data:', error);
        return res.status(500).json({ error: 'Failed to upsert data' });
      }
    }

    res.status(200).json({ message: 'Data upserted successfully' });
  } catch (err) {
    console.error('Error fetching or processing weather data:', err);
    res.status(500).json({ error: 'Failed to fetch or process weather data', details: err.message });
  }
}