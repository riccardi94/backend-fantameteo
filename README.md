# FantaCalcio Weather App

This repository is a training project aimed at creating an Angular application that displays weather information for cities where my friends who play FantaCalcio live. The weather data is fetched from the OpenMeteo API.

## Project Overview

This project combines several technologies and concepts:
- Angular for the frontend
- Node.js for backend scripting
- GitHub Actions for automated data fetching
- Supabase for data storage
- OpenMeteo API for weather data

## Workflow

1. **Data Fetching**
   - A Node.js script (`script/fetch-weather-data.ts`) fetches weather data from OpenMeteo API.
   - GitHub Actions run this script hourly to keep data up-to-date.

2. **Data Storage**
   - Fetched weather data is stored in a Supabase database.

3. **Frontend Display**
   - An Angular application retrieves data from Supabase and displays it to users.
