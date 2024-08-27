import { readFile, writeFile } from 'fs/promises';
import { basename, extname } from 'path';
import { fileURLToPath } from 'url';

function convertToGeoJSON(data) {
    const features = data.map(item => ({
        type: "Feature",
        properties: {
            ADDRESS: item.ADDRESS,
            BLK_NO: item.BLK_NO,
            BUILDING: item.BUILDING,
            POSTAL: item.POSTAL,
            ROAD_NAME: item.ROAD_NAME,
            SEARCHVAL: item.SEARCHVAL,
            X: item.X,
            Y: item.Y
        },
        geometry: {
            type: "Point",
            coordinates: [parseFloat(item.LONGITUDE), parseFloat(item.LATITUDE)]
        }
    }));

    return {
        type: "FeatureCollection",
        features: features
    };
}

async function main() {
    // Get input file name from command line argument
    const inputFile = process.argv[2];

    if (!inputFile) {
        console.log("Please provide an input file name.");
        console.log("Usage: node script.js <input-file>");
        return;
    }

    try {
        // Read input JSON file
        const jsonString = await readFile(inputFile, 'utf8');
        const data = JSON.parse(jsonString);
        const geojsonData = convertToGeoJSON(data);

        // Generate output file name
        const inputBaseName = basename(inputFile, extname(inputFile));
        const outputFile = `${inputBaseName}.geojson`;

        // Write GeoJSON to file
        await writeFile(outputFile, JSON.stringify(geojsonData, null, 2));
        console.log(`Conversion completed. GeoJSON file "${outputFile}" has been created.`);
    } catch (err) {
        console.error('Error:', err.message);
    }
}

// Use top-level await to run the main function
await main();