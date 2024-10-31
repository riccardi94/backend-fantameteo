// import { fetchWeatherApi } from 'openmeteo';

// interface RequestParams {
//     latitude : number,
//     longitude : number,
//     hourly : ["temperature_2m", "precipitation_probability", "precipitation", "cloud_cover"],
//     timezone : 'Europe/Berlin',
//     forecast_days : 3
// }

// export class GetWeatherDataFromApi {



//     getWeatherData = async (city : string) => {
//         const params: RequestParams = {
//             latitude: 48.1656,
//             longitude: 11.5528,
//             hourly: ["temperature_2m", "precipitation_probability", "precipitation", "cloud_cover"],
//             timezone: 'Europe/Berlin',
//             forecast_days: 3
//         };
//         const url = "https://api.open-meteo.com/v1/forecast";
//         const responses = await fetchWeatherApi(url, params);
//         // Helper function to form time ranges
//         const range = (start: number, stop: number, step: number) =>
//             Array.from({ length: (stop - start) / step }, (_, i) => start + i * step);

//         // Process first location. Add a for-loop for multiple locations or weather models
//         const response = responses[0];
//         const utcOffsetSeconds = response.utcOffsetSeconds();

//         const hourly = response.hourly()!;

//         const weatherData = {
//             hourly: {
//                 time: range(Number(hourly.time()), Number(hourly.timeEnd()), hourly.interval()).map(
//                     (t) => new Date((t + utcOffsetSeconds) * 1000)
//                 ),
//                 temperature2m: hourly.variables(0)!.valuesArray()!,
//                 precipitationProbability: hourly.variables(1)!.valuesArray()!,
//                 precipitation: hourly.variables(2)!.valuesArray()!,
//                 cloudCover: hourly.variables(3)!.valuesArray()!,
//             },
//         };

//         // Inserisci i dati nel database
//         try {
//             const client = await this.pool.connect();

//             try {
//                 await client.query('BEGIN'); // Inizia una transazione

//                 for (let i = 0; i < weatherData.hourly.time.length; i++) {
//                     const date = weatherData.hourly.time[i].toISOString();
//                     const temperature = weatherData.hourly.temperature2m[i];
//                     const precipitation = weatherData.hourly.precipitation[i];
//                     const precipitationProbability = weatherData.hourly.precipitationProbability[i];
//                     const cloudCover = weatherData.hourly.cloudCover[i];

//                     const queryText = `
//                         INSERT INTO weather_data (date, temperature, precipitation, precipitation_probability, cloud_cover, city)
//                         VALUES ($1, $2, $3, $4, $5, $6)
//                         ON CONFLICT (date, city)
//                         DO UPDATE SET
//                           temperature = EXCLUDED.temperature,
//                           precipitation = EXCLUDED.precipitation,
//                           precipitation_probability = EXCLUDED.precipitation_probability,
//                           cloud_cover = EXCLUDED.cloud_cover;
//                     `;
//                     const values = [date, temperature, precipitation, precipitationProbability, cloudCover, city];

//                     await client.query(queryText, values);
//                 }

//                 await client.query('COMMIT'); // Conferma la transazione
//                 console.log('dati inseriti correttamente');
//             } catch (err) {
//                 await client.query('ROLLBACK'); // Annulla la transazione in caso di errore
//                 throw err;
//             } finally {
//                 client.release();
//             }
//         } catch (err) {
//             console.error('Database operation failed:', err);
//             return;
//         }
//     };


// }
