import { createClient } from '@supabase/supabase-js';
import { VercelRequest, VercelRequestQuery, VercelResponse } from '@vercel/node';
import { fetchWeatherApi } from 'openmeteo';

const supabase = createClient('https://gcsjlnhslitmmqpzgrxn.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdjc2psbmhzbGl0bW1xcHpncnhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY0OTQ3ODksImV4cCI6MjA0MjA3MDc4OX0.iNujFZ5PeJRKR8wAQTkE340yJpuUb37wAH6hDEGHv94');

const CITIES = [
  { name: 'Roma', lat: 41.9028, lon: 12.4964 },
  { name: 'Milano', lat: 45.4642, lon: 9.1900 },
  { name: 'Napoli', lat: 40.8518, lon: 14.2681 },
  { name: 'Torino', lat: 45.0703, lon: 7.6869 },
  { name: 'Padova', lat: 45.4085, lon: 11.8859 }
];

interface WeatherParams {
  latitude: number;
  longitude: number;
  hourly: string[];
  timezone: string;
  forecast_days: number;
}

interface WeatherRecord {
  date: string;  // Ora useremo il timestamp completo come stringa ISO
  temperature: number;
  precipitation: number;
  precipitation_probability: number;
  cloud_cover: number;
  code: number;
  city: string;
}

interface QueryParams extends VercelRequestQuery {
  city: string;
  lat: string;
  lon: string;
}

async function fetchCityWeather(city: string, latitude: number, longitude: number) {
  try {
    const params: WeatherParams = {
      latitude,
      longitude,
      hourly: ["temperature_2m", "precipitation_probability", "precipitation", "weather_code", "cloud_cover"],
      timezone: "Europe/Berlin",
      forecast_days: 3
    };

    const url = "https://api.open-meteo.com/v1/forecast";
    const responses = await fetchWeatherApi(url, params);
    const response = responses[0];
    const hourly = response.hourly()!;

    const times = Array.from({ length: (Number(hourly.timeEnd()) - Number(hourly.time())) / hourly.interval() }, 
      (_, i) => new Date((Number(hourly.time()) + i * hourly.interval() + response.utcOffsetSeconds()) * 1000));
    
    const temperature2m = Array.from(hourly.variables(0)!.valuesArray()!);
    const precipitationProbability = Array.from(hourly.variables(1)!.valuesArray()!);
    const precipitation = Array.from(hourly.variables(2)!.valuesArray()!);
    const weatherCode = Array.from(hourly.variables(3)!.valuesArray()!);
    const cloudCover = Array.from(hourly.variables(4)!.valuesArray()!);

    return times.map((time, index) => ({
      date: time.toISOString(),
      temperature: parseFloat(temperature2m[index].toFixed(2)),
      precipitation: parseFloat(precipitation[index].toFixed(2)),
      precipitation_probability: parseFloat(precipitationProbability[index].toFixed(2)),
      cloud_cover: parseFloat(cloudCover[index].toFixed(2)),
      code: weatherCode[index],
      city
    }));
  } catch (error) {
    console.error(`Error fetching weather for ${city}:`, error);
    return [];
  }

}
export default async function handler(req: VercelRequest, res: VercelResponse) {

  if (req.headers['x-vercel-cron'] !== 'true') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const results = await Promise.all(
      CITIES.map(city => fetchCityWeather(city.name, city.lat, city.lon))
    );

    const allWeatherRecords = results.flat();

    // Upsert data on supbase
    const { data, error } = await supabase
      .from('weather_data')
      .upsert(allWeatherRecords, {
        onConflict: 'date,city',
        ignoreDuplicates: false
      });

    if (error) {
      console.error('Error inserting data into Supabase:', error);
      return res.status(500).json({ error: 'Database Error', details: error });
    }

    return res.status(200).json({ 
      message: 'Weather data successfully updated for all cities',
      recordsProcessed: allWeatherRecords.length,
      citiesProcessed: CITIES.length
    });

  } catch (error) {
    console.error('Error in weather cron job:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
