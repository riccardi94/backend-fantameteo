import { createClient } from "@supabase/supabase-js";
import dayjs from "dayjs";
import { fetchWeatherApi } from "openmeteo";
import { CITIES } from './global-data';
import * as dotenv from 'dotenv';
dotenv.config();

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    console.error('Missing required environment variables SUPABASE_URL or SUPABASE_KEY');
    process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

interface HistoricalPrecipitationInterface {
    latitude: number,
    longitude: number,
    start_date: string,
    end_date: string,
    daily: 'precipitation_sum',
    timezone: 'Europe/Berlin'
}

interface PrecipitationData {
    city: string,
    time: string,
    precipitation_sum: number
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRetry<T>(
    fn: () => Promise<T>, 
    retries = 3, 
    delayMs = 1000
): Promise<T> {
    try {
        return await fn();
    } catch (error) {
        if (retries <= 0) throw error;
        await delay(delayMs);
        return fetchWithRetry(fn, retries - 1, delayMs * 2);
    }
}

async function fetchHistoryPrecipitationSum(city: string, latitude: number, longitude: number) {
    try {
        const now = dayjs();
        const two_days_ago = now.subtract(2, 'days').startOf('day').format('YYYY-MM-DD');
        const params: HistoricalPrecipitationInterface = {
            latitude: latitude,
            longitude: longitude,
            start_date: two_days_ago,
            end_date: two_days_ago,
            daily: 'precipitation_sum',
            timezone: 'Europe/Berlin'
        }
        
        const responses = await fetchWithRetry(
            () => fetchWeatherApi("https://archive-api.open-meteo.com/v1/archive", params)
        );    

        const response = responses[0];
        const daily = response.daily()!;
        const precipitationSumArray = daily.variables(0)!.valuesArray()!;

        const result = {
            city,
            time: two_days_ago,  
            precipitation_sum: parseFloat(precipitationSumArray[0].toFixed(2))
        };

        console.log(result);
        return result;
    }
    catch(error) {
        console.error(`Error for ${city}:`, error);
        return null;
    }
}

async function updateHistoricalPrecipitationData() {
    try {
        // Verifica connessione a Supabase
        const { data: testData, error: testError } = await supabase
            .from('precipitation_history')  // Corretto nome della tabella
            .select('count')
            .limit(1);

        if (testError) {
            console.error('Failed to connect to Supabase:', testError);
            process.exit(1);
        }

        const results = await Promise.all(
            CITIES.map(city => fetchHistoryPrecipitationSum(city.name, city.lat, city.lon))
        );

        const validResults = results.filter((result): result is PrecipitationData => result !== null);

        if (validResults.length === 0) {
            console.log('No valid results to insert.');
            return;
        }

        console.log('Attempting to insert/update the following data:', validResults);

        // Verifica dati esistenti
        const { data: existingData, error: selectError } = await supabase
            .from('precipitation_history')  // Corretto nome della tabella
            .select('*')
            .in('city', validResults.map(r => r.city))
            .eq('time', validResults[0].time);  // Cambiato da 'date' a 'time'

        if (selectError) {
            console.error('Error checking existing data:', selectError);
            process.exit(1);
        }

        console.log('Existing data:', existingData);

        // Upsert dei dati
        const { data, error } = await supabase
            .from('precipitation_history') 
            .upsert(validResults, {
                onConflict: 'city,time' 
            });

        if (error) {
            console.error('Supabase error:', {
                message: error.message,
                code: error.code,
                details: error.details,
                hint: error.hint,
                fullError: JSON.stringify(error, null, 2)
            });
            process.exit(1);
        }

        console.log(`Successfully updated ${validResults.length} records`);
        console.log('Update response:', data);

    } catch (error) {
        console.error('Unexpected error:', error);
        process.exit(1);
    }
}

updateHistoricalPrecipitationData();