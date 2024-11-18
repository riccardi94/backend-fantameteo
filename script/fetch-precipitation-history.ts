import { createClient } from "@supabase/supabase-js";
import dayjs from "dayjs";
import { fetchWeatherApi } from "openmeteo";
import { CITIES } from './global-data';

const supabase = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_KEY as string);

interface HistoricalPrecipitationInterface {
    latitude: number,
    longitude: number,
    start_date: Date,
    end_date: Date,
    daily: 'precipitation_sum',
    timezone: 'Europe/Berlin'
}

async function fetchHistoryPrecipitationSum(city: string, latitude: number, longitude: number) {
    try {
        const now = dayjs();
        const two_days_ago = now.subtract(2, 'days').startOf('day').toDate();
        const params: HistoricalPrecipitationInterface = {
            latitude: latitude,
            longitude: longitude,
            start_date: two_days_ago,
            end_date: two_days_ago,
            daily: 'precipitation_sum',
            timezone: 'Europe/Berlin'
        }
        const url = "https://archive-api.open-meteo.com/v1/archive";
        const responses = await fetchWeatherApi(url, params);    

        const response = responses[0];
        const daily = response.daily()!;

        const times = daily.time();
        const precipitationSumArray = daily.variables(0)!.valuesArray()!;

        return {
            city,
            date: two_days_ago.toISOString().split('T')[0],
            precipitation_sum: parseFloat(precipitationSumArray[0].toFixed(2))
        };
    }
    catch(error) {
        console.error(`Error for  ${city}:`, error);
        return null;
    }
}

async function updateHistoricalPrecipitationData() {
    try {
        const results = await Promise.all(
            CITIES.map(city => fetchHistoryPrecipitationSum(city.name, city.lat, city.lon))
        );

        // Filtra eventuali risultati nulli
        const validResults = results.filter(result => result !== null);

        if (validResults.length > 0) {
            const { data, error } = await supabase
                .from('historical_precipitation')
                .upsert(validResults, {
                    onConflict: 'date,city',
                    ignoreDuplicates: false
                });

            if (error) {
                console.error('Error for inserting data on supabase:', error);
                process.exit(1);
            }
        } else {
            console.log('Null value.');
        }
    } catch (error) {
        console.error('Error', error);
        process.exit(1);
    }
}

updateHistoricalPrecipitationData();