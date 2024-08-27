import dotenv from 'dotenv';
import axios from 'axios';
import { promises as fs } from 'fs';

dotenv.config();

const BASE_URL = 'https://www.onemap.gov.sg'
const APPROVED_YEARS = [1998, 2008, 2014, 2019];

const fetchPlanningAreaData = async (year = null) => {
    try {
        if (year !== null && !APPROVED_YEARS.includes(year)) {
            throw new Error(`Invalid year. Approved years are: ${APPROVED_YEARS.join(', ')}`);
        }

        let url = BASE_URL + '/api/public/popapi/getAllPlanningarea';
        if (year) {
            url += `?year=${year}`;
        }

        const response = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${process.env.API_KEY}`
            }
        });

        console.log('Data fetched successfully');
        return response.data;
    } catch (error) {
        console.error('Error fetching data:', error.message);
        throw error;
    }
};

const saveDataAsJson = async (data, filename) => {
    try {
        await fs.writeFile(filename, JSON.stringify(data, null, 2));
        console.log(`Data saved successfully to ${filename}`);
    } catch (error) {
        console.error('Error saving data:', error.message);
        throw error;
    }
};

const getYearFromCLI = () => {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        return null; // No year specified
    }
    const year = parseInt(args[0], 10);
    if (isNaN(year)) {
        throw new Error('Invalid year format. Please provide a valid number.');
    }
    return year;
};

const main = async () => {
    try {
        const year = getYearFromCLI();

        if (year === null) {
            console.log('No year specified. Fetching data for all years.');
            const data = await fetchPlanningAreaData();
            await saveDataAsJson(data, 'planningAreaDataAllYears.json');
        } else {
            console.log(`Fetching data for year: ${year}`);
            const data = await fetchPlanningAreaData(year);
            await saveDataAsJson(data, `planningAreaData${year}.json`);
        }
    } catch (error) {
        console.error('An error occurred:', error.message);
        console.log('\nUsage:');
        console.log('  node fetchPlanningAreaData.js [year]');
        console.log('  - If no year is provided, data for all years will be fetched.');
        console.log(`  - Approved years are: ${APPROVED_YEARS.join(', ')}`);
        process.exit(1);
    }
};

main();