import { createClient } from '@supabase/supabase-js';
import { fetchWeatherApi } from 'openmeteo';

const supabase = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_KEY as string);

const CITIES = [
  { name: 'Roma', lat: 41.9028, lon: 12.4964 },
  { name: 'Milano', lat: 45.4642, lon: 9.1900 },
  { name: 'Napoli', lat: 40.8518, lon: 14.2681 },
  { name: 'Torino', lat: 45.0703, lon: 7.6869 },
  { name: 'Padova', lat: 45.4085, lon: 11.8859 },
  { name: 'Amsterdam', lat: 52.3676, lon: 4.9041 },
  { name: 'Parigi', lat: 48.8566, lon: 2.3522 }
];

interface WeatherParams {
  latitude: number;
  longitude: number;
  hourly: string[];
  timezone: string;
  forecast_days: number;
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
async function updateWeatherData() {
  try {
    const results = await Promise.all(
      CITIES.map(city => fetchCityWeather(city.name, city.lat, city.lon))
    );

    const allWeatherRecords = results.flat();

    const { data, error } = await supabase
      .from('weather_data')
      .upsert(allWeatherRecords, {
        onConflict: 'date,city',
        ignoreDuplicates: false
      });

    if (error) {
      console.error('Error inserting data into Supabase:', error);
      process.exit(1);
    }

    console.log(`Weather data successfully updated for all cities. Processed ${allWeatherRecords.length} records for ${CITIES.length} cities.`);
  } catch (error) {
    console.error('Error in weather update job:', error);
    process.exit(1);
  }
}

updateWeatherData();
