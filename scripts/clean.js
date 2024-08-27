import path from 'path';
import fsPromises from 'fs/promises';
import * as cheerio from 'cheerio';

// Get the input file path from command line arguments
const inputFilePath = process.argv[2];

if (!inputFilePath) {
    console.error('Error: Please provide the path to the GeoJSON file as an argument.');
    console.error('Usage: node script.js path/to/your/geojson/file.geojson');
    process.exit(1);
}

async function processGeoJSON(inputPath) {
    try {
        const GeoJSONFile = await fsPromises.readFile(inputPath, 'utf8');
        const processedGeoJSON = extractAndModifyGeoJSONProperties(GeoJSONFile);

        // Generate the output file path with _processed suffix
        const parsedPath = path.parse(inputPath);
        const outputPath = path.join(
            parsedPath.dir,
            `${parsedPath.name}_processed${parsedPath.ext}`
        );

        await fsPromises.writeFile(outputPath, JSON.stringify(processedGeoJSON, null, 2));
        console.log(`Processed GeoJSON saved to ${outputPath}`);
    } catch (error) {
        console.error('Error processing GeoJSON:', error.message);
        if (error.stack) {
            console.error(error.stack);
        }
        process.exit(1);
    }
}

function extractAndModifyGeoJSONProperties(obj) {
    try {
        let descriptionInfo = [];
        const planningAreas = JSON.parse(obj);
        let tables = getDescriptionTables(planningAreas);
        descriptionInfo = tables.map((table) => parseTable(table));
        return appendToProperties(planningAreas, descriptionInfo);
    } catch (error) {
        console.error('Error in extractAndModifyGeoJSONProperties:', error.message);
        throw error;
    }
}

function appendToProperties(obj, descriptionInfo) {
    obj.features.forEach((feature, i) => {
        if (descriptionInfo[i]) {
            Object.assign(feature.properties, descriptionInfo[i]);
        }
    });
    return obj;
}

function parseTable(table) {
    const $ = cheerio.load(table);
    let results = {};
    let headers = [];

    $('th').each((i, column) => {
        headers.push($(column).text().trim());
    });

    $('tr').each((i, row) => {
        const columns = $(row).find('td');
        if (columns.length > 0) {
            const key = headers[i - 1]; // Subtract 1 to account for header row
            const value = $(columns[0]).text().trim();
            if (key) {
                results[key] = value;
            }
        }
    });

    return results;
}

function getDescriptionTables(obj) {
    return obj.features.map(feature => {
        const $ = cheerio.load(feature.properties.Description);
        return $('table').toString();
    });
}

// Run the process
processGeoJSON(inputFilePath);