import { createClient } from '@supabase/supabase-js';
import { fetchWeatherApi } from 'openmeteo';

const supabase = createClient('https://gcsjlnhslitmmqpzgrxn.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdjc2psbmhzbGl0bW1xcHpncnhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY0OTQ3ODksImV4cCI6MjA0MjA3MDc4OX0.iNujFZ5PeJRKR8wAQTkE340yJpuUb37wAH6hDEGHv94');

export default async function handler(req, res) {
  const { city, latitude, longitude } = req.query;

  if (!city || !latitude || !longitude) {
    return res.status(400).json({ error: 'Missing city, latitude, or longitude parameter' });
  }

  // Helper function to form time ranges
  const range = (start: number, stop: number, step: number) =>
	Array.from({ length: (stop - start) / step }, (_, i) => start + i * step);

  const params = {
    latitude: parseFloat(latitude),
    longitude: parseFloat(longitude),
    "hourly": ["temperature_2m", "precipitation_probability", "precipitation", "weather_code", "cloud_cover"],
    "forecast_days": 3
  };

  const url = "https://api.open-meteo.com/v1/forecast";
  const responses = await fetchWeatherApi(url, params);


  try {
    
    const response = responses[0];

    const utcOffsetSeconds = response.utcOffsetSeconds();
    const timezone = response.timezone();
    const timezoneAbbreviation = response.timezoneAbbreviation();
    const latitude = response.latitude();
    const longitude = response.longitude();
    const hourly  = response.hourly()!;


    const weatherData : any = {
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

    console.log(weatherData);

    for (let i = 0; i < weatherData.time.length; i++) {
      const date = weatherData.time[i].toISOString().split('T')[0];
      const temperature = weatherData.temperature2m[i];
      const precipitationProbability = weatherData.precipitationProbability[i];
      const precipitation = weatherData.precipitation[i];
      const weatherCode = weatherData.weatherCode[i];
      const cloudCover = weatherData.cloudCover[i];

      const { error } = await supabase.from('weather_data').upsert([
        {
          date,
          temperature,
          precipitation,
          precipitation_probability: precipitationProbability,
          cloud_cover: cloudCover,
          code: weatherCode,
          city,
        },
      ], { onConflict: 'date, city' });

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