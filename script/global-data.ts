export interface CityInterface{
    name : string,
    lat : number,
    lon : number
}

export const CITIES : CityInterface[] = [
    { name: 'Roma', lat: 41.9028, lon: 12.4964 },
    { name: 'Milano', lat: 45.4642, lon: 9.1900 },
    { name: 'Napoli', lat: 40.8518, lon: 14.2681 },
    { name: 'Torino', lat: 45.0703, lon: 7.6869 },
    { name: 'Padova', lat: 45.4085, lon: 11.8859 },
    { name: 'Amsterdam', lat: 52.3676, lon: 4.9041 },
    { name: 'Parigi', lat: 48.8566, lon: 2.3522 }
];
  