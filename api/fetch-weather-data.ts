import { createClient } from '@supabase/supabase-js';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchWeatherApi } from 'openmeteo';

const supabase = createClient('https://gcsjlnhslitmmqpzgrxn.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdjc2psbmhzbGl0bW1xcHpncnhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY0OTQ3ODksImV4cCI6MjA0MjA3MDc4OX0.iNujFZ5PeJRKR8wAQTkE340yJpuUb37wAH6hDEGHv94');

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const params: WeatherParams = {
      latitude: 45.408,
      longitude: 11.8859,
      hourly: ["temperature_2m", "precipitation_probability", "precipitation", "weather_code", "cloud_cover"],
      timezone: "Europe/Berlin",
      forecast_days: 3
    };

    const url = "https://api.open-meteo.com/v1/forecast";
    const responses = await fetchWeatherApi(url, params);

    // Helper function to form time ranges
    const range = (start: number, stop: number, step: number): number[] =>
      Array.from({ length: (stop - start) / step }, (_, i) => start + i * step);

    // Process first location
    const response = responses[0];
    const hourly = response.hourly()!;

    // Prepare data for insertion
    const times = range(Number(hourly.time()), Number(hourly.timeEnd()), hourly.interval())
      .map(t => new Date((t + response.utcOffsetSeconds()) * 1000));
    
    const temperature2m = Array.from(hourly.variables(0)!.valuesArray()!);
    const precipitationProbability = Array.from(hourly.variables(1)!.valuesArray()!);
    const precipitation = Array.from(hourly.variables(2)!.valuesArray()!);
    const weatherCode = Array.from(hourly.variables(3)!.valuesArray()!);
    const cloudCover = Array.from(hourly.variables(4)!.valuesArray()!);

    // Create records for database insertion with full timestamp
    const weatherRecords: WeatherRecord[] = times.map((time, index) => ({
      date: time.toISOString(), // Salviamo il timestamp completo
      temperature: parseFloat(temperature2m[index].toFixed(2)),
      precipitation: parseFloat(precipitation[index].toFixed(2)),
      precipitation_probability: parseFloat(precipitationProbability[index].toFixed(2)),
      cloud_cover: parseFloat(cloudCover[index].toFixed(2)),
      code: weatherCode[index],
      city: 'Padova'
    }));

    // Usiamo upsert con il nuovo vincolo di unicità timestamp-city
    const { data, error } = await supabase
      .from('weather_data')
      .upsert(weatherRecords, {
        onConflict: 'date,city',
        ignoreDuplicates: false
      });

    if (error) {
      console.error('Error inserting data into Supabase:', error);
      return res.status(500).json({ error: 'Database Error', details: error });
    }

    return res.status(200).json({ 
      message: 'Weather data successfully updated',
      recordsProcessed: weatherRecords.length,
      data 
    });

  } catch (error) {
    console.error('Error in weather API handler:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}