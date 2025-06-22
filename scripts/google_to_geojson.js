#!/usr/bin/env node

import fs from 'fs';
import readline from 'readline';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
function parseInputData(inputString) {
    // Remove the outer brackets and split by the outermost array
    const cleanedString = inputString.trim().slice(1, -1);
    const districtStrings = splitOutermostArray(cleanedString);

    console.log(districtStrings)

    // Parse each district entry
    return districtStrings.filter(districtString => districtString.length > 1).map(districtString => {
        // Parse the string as JSON
        const unescapedString = districtString.replace(/\\"/g, '"').replace(/,\s*$/, '')
        try {
            return JSON.parse(unescapedString);
        } catch (error) {
            console.error("Error parsing district:", unescapedString);
            console.error("Error message:", error.message);
            return null;
        }
    }).filter(districtNumber => districtNumber !== null);
}

function splitOutermostArray(str) {
    const result = [];
    let bracketCount = 0;
    let currentChunk = '';

    for (let i = 0; i < str.length; i++) {
        const char = str[i];
        if (char === '[') bracketCount++;
        if (char === ']') bracketCount--;

        currentChunk += char;

        if (bracketCount === 0 && currentChunk.trim() !== '') {
            result.push(currentChunk);
            currentChunk = '';
        }
    }

    return result;
}
// Function to create GeoJSON from the parsed input data
function createGeoJSON(inputArray) {
    const geojson = {
        type: "FeatureCollection",
        features: []
    };

    inputArray.forEach((district) => {
        const [id, , , coordinates, , properties, , districtIndex] = district;
        const [, [name],] = properties[0];
        const [, [description],] = properties[1];
        // Create the feature
        const feature = {
            type: "Feature",
            properties: {
                id,
                name,
                description,
                districtNumber: districtIndex + 1
            },
            geometry: {
                type: "Polygon",
                coordinates: coordinates[0][0][0] // Access the correct level of nested arrays
            }
        };

        geojson.features.push(feature);
    });

    return geojson;
}

function cleanGeoJSON(geojsonInput) {
    const cleanedGeoJSON = JSON.parse(JSON.stringify(geojsonInput)); // Deep clone to avoid modifying original
    cleanedGeoJSON.features.forEach(feature => {
        if (feature.geometry.type === "Polygon") {
            feature.geometry.coordinates = feature.geometry.coordinates.map(ring => {
                // Remove nested arrays and swap lat/long
                const cleanedRing = ring.map(coord => {
                    if (Array.isArray(coord[0])) {
                        return [coord[0][1], coord[0][0]]; // Swap and unnest
                    }
                    return [coord[1], coord[0]]; // Just swap
                });

                // Ensure the polygon is closed
                if (JSON.stringify(cleanedRing[0]) !== JSON.stringify(cleanedRing[cleanedRing.length - 1])) {
                    cleanedRing.push(cleanedRing[0]);
                }

                return cleanedRing;
            });
        }

        // Clean up the description string
        if (feature.properties && feature.properties.description) {
            feature.properties.description = feature.properties.description.replace(/\\n/g, '\n');
        }
    });

    return cleanedGeoJSON;
}

async function processFile(inputFile, outputFile) {
    return new Promise((resolve, reject) => {
        const fileStream = fs.createReadStream(inputFile);
        let fileContent = '';

        fileStream.on('data', (chunk) => {
            fileContent += chunk;
        });

        fileStream.on('end', () => {
            try {

                // const inputText = `[[\"223329F6AEEA82D3\",null,null,[[[[[[[1.2866226,103.8515067]],[[1.2870946,103.8510025]],[[1.2887678,103.8497901]],[[1.2897117,103.8489318]],[[1.2900121,103.8480091]],[[1.2901408,103.8466573]],[[1.2894758,103.845005]],[[1.2899048,103.8447154]],[[1.290602,103.8446724]],[[1.2912349,103.8439107]],[[1.2912992,103.8430309]],[[1.2881028,103.8412607]],[[1.2874646,103.8423336]],[[1.2868586,103.842119]],[[1.2863866,103.8423014]],[[1.2857109,103.8427198]],[[1.2849708,103.8418937]],[[1.2836837,103.8417542]],[[1.2816028,103.8394046]],[[1.2807125,103.8394153]],[[1.2823107,103.8408315]],[[1.281946,103.8412178]],[[1.2830052,103.8420975]],[[1.2823831,103.8429987]],[[1.2819943,103.8428003]],[[1.2814633,103.8437739]],[[1.2808734,103.8436934]],[[1.2768404,103.8474083]],[[1.274309,103.8514423]],[[1.2713486,103.8515711]],[[1.2676158,103.8583946]],[[1.2636686,103.8614416]],[[1.2641835,103.8626862]],[[1.2677875,103.8603687]],[[1.2695037,103.8628578]],[[1.2703618,103.8635015]],[[1.27654,103.8720417]],[[1.2785995,103.8725567]],[[1.2812595,103.8715267]],[[1.282847,103.869338]],[[1.2845632,103.8659477]],[[1.2943454,103.8646173]],[[1.2967052,103.8646173]],[[1.2969626,103.8642311]],[[1.2986788,103.8646603]],[[1.3000088,103.8655615]],[[1.301017,103.8642097]],[[1.2987431,103.8607335]],[[1.2966837,103.8586307]],[[1.2939915,103.8566136]],[[1.2912992,103.8551116]],[[1.2915137,103.8548648]],[[1.2905806,103.8544893]],[[1.2889287,103.8541996]],[[1.2889073,103.8536739]],[[1.2877918,103.8530731]],[[1.2866226,103.8520646]]]]]]],0,[[\"name\",[\"District 1\"],1],[\"description\",[\"Postal codes starting with 01, 02, 03, 04, 05 and 06.\\n\\nRaffles Place: https://www.penang-traveltips.com/singapore/raffles-place.htm\\nMarina Bay: https://www.penang-traveltips.com/singapore/marina-bay.htm\\nMarina South: https://www.penang-traveltips.com/singapore/marina-south.htm\\nChinatown: https://www.penang-traveltips.com/singapore/chinatown.htm\\nBoat Quay: https://www.penang-traveltips.com/singapore/boat-quay.htm\"],1]],null,0]`;
                const parsedData = parseInputData(fileContent)
                const geojsonData = createGeoJSON(parsedData);
                const cleangeojson = cleanGeoJSON(geojsonData)
                console.log(cleangeojson)
                fs.writeFileSync(outputFile, JSON.stringify(cleangeojson, null, 2));
                console.log(`GeoJSON data written to ${outputFile}`);
                resolve();
            } catch (error) {
                reject(error);
            }
        });

        fileStream.on('error', (error) => {
            reject(error);
        });
    });
}

async function main() {
    const inputFile = process.argv[2];
    const outputFile = process.argv[3] || 'singapore_districts.geojson';

    if (!inputFile) {
        console.error('Usage: node script.js <input_file> [output_file]');
        process.exit(1);
    }

    try {
        console.log('Starting to process file...');
        await processFile(inputFile, outputFile);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

main();