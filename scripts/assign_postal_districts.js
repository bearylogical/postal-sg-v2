import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Function to read JSON file
async function readJSONFile(filePath) {
    try {
        const fileContent = await fs.readFile(filePath, 'utf8');
        return JSON.parse(fileContent);
    } catch (error) {
        if (error instanceof SyntaxError) {
            console.error(`Error parsing JSON in file ${filePath}:`);
            console.error(error.message);
            console.error('Please check that your JSON file is properly formatted.');
        } else {
            console.error(`Error reading file ${filePath}:`);
            console.error(error.message);
        }
        throw error;
    }
}

// Function to validate postal districts data
function validatePostalDistricts(data) {
    if (!data.postalDistricts || !Array.isArray(data.postalDistricts)) {
        throw new Error('Invalid postal districts data: "postalDistricts" array is missing or not an array');
    }
    if (data.postalDistricts.length === 0) {
        throw new Error('Postal districts array is empty');
    }
    data.postalDistricts.forEach((district, index) => {
        if (typeof district !== 'object' || district === null) {
            throw new Error(`Invalid district at index ${index}: must be an object`);
        }
        if (typeof district.district !== 'number') {
            throw new Error(`Invalid district at index ${index}: 'district' must be a number`);
        }
        if (!Array.isArray(district.postalSectors)) {
            throw new Error(`Invalid district at index ${index}: 'postalSectors' must be an array`);
        }
        if (typeof district.generalLocation !== 'string') {
            throw new Error(`Invalid district at index ${index}: 'generalLocation' must be a string`);
        }
    });
    return data.postalDistricts;
}

// Function to find the district based on postal code
function findDistrict(postalCode, postalDistricts) {
    const postalSector = postalCode.substring(0, 2);
    return postalDistricts.find(district =>
        district.postalSectors.includes(postalSector)
    );
}

// Function to parse GeoJSON and assign districts
function parseGeoJSON(geoJSON, postalDistricts) {
    if (!geoJSON.features || !Array.isArray(geoJSON.features)) {
        throw new Error('Invalid GeoJSON structure: "features" array is missing or not an array');
    }

    const features = geoJSON.features;

    return {
        ...geoJSON,
        features: features.map(feature => {
            if (!feature.properties || typeof feature.properties.POSTAL !== 'string') {
                console.warn('Invalid feature structure: missing properties or POSTAL code');
                return feature;
            }

            const postalCode = feature.properties.POSTAL;
            const district = findDistrict(postalCode, postalDistricts);

            return {
                ...feature,
                properties: {
                    ...feature.properties,
                    DISTRICT: district ? district.district : null,
                    GENERAL_LOCATION: district ? district.generalLocation : null
                }
            };
        })
    };
}

// Function to save JSON to file
async function saveJSONToFile(data, filePath) {
    try {
        await fs.writeFile(filePath, JSON.stringify(data, null, 2));
        console.log(`Processed data saved to ${filePath}`);
    } catch (error) {
        console.error(`Error saving file ${filePath}:`);
        console.error(error.message);
        throw error;
    }
}

// Main function
async function main() {
    // Check if correct number of arguments is provided
    if (process.argv.length !== 4) {
        console.log('Usage: node script.js <path_to_geojson> <path_to_postal_districts_json>');
        process.exit(1);
    }

    const geoJSONPath = process.argv[2];
    const postalDistrictsPath = process.argv[3];

    try {
        // Read GeoJSON and postal districts data from files
        console.log('Reading GeoJSON file...');
        const geoJSONData = await readJSONFile(geoJSONPath);
        console.log('Reading postal districts file...');
        const postalDistrictsData = await readJSONFile(postalDistrictsPath);

        console.log('Validating postal districts data...');
        const postalDistricts = validatePostalDistricts(postalDistrictsData);

        // Parse the GeoJSON and assign districts
        console.log('Parsing GeoJSON and assigning districts...');
        const parsedGeoJSON = parseGeoJSON(geoJSONData, postalDistricts);

        // Generate output file path
        const outputPath = path.join(
            path.dirname(geoJSONPath),
            `${path.basename(geoJSONPath, '.json')}_processed.json`
        );

        // Save the processed data
        await saveJSONToFile(parsedGeoJSON, outputPath);

        console.log('Processing complete.');
    } catch (error) {
        console.error('An error occurred during processing:');
        console.error(error.message);
        if (error.message.includes('postal districts')) {
            console.error('Please ensure your postal districts JSON file has the following structure:');
            console.error(`
{
  "postalDistricts": [
    {
      "district": 1,
      "postalSectors": ["01", "02", "03", ...],
      "generalLocation": "Some location description"
    },
    ...
  ]
}`);
        }
        process.exit(1);
    }
}

// Run the main function
main();