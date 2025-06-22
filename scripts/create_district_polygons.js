import fs from 'fs/promises';
import * as turf from '@turf/turf';

function parseGeoJSON(inputGeoJSON) {
    const districts = {};

    inputGeoJSON.features.forEach(feature => {
        const properties = feature.properties;
        const geometry = feature.geometry;

        if ('DISTRICT' in properties && geometry.type === 'Point') {
            const district = properties.DISTRICT;
            if (!districts[district]) {
                districts[district] = [];
            }
            districts[district].push(geometry.coordinates);
        }
    });

    return districts;
}

function createDistrictPolygons(districts) {
    const polygonFeatures = [];

    for (const [district, points] of Object.entries(districts)) {
        if (points.length < 3) continue; // Need at least 3 points to form a polygon

        // Create a feature collection of points
        const pointFeatures = points.map(coord => turf.point(coord));
        const pointCollection = turf.featureCollection(pointFeatures);

        // Create a convex hull from the points
        const hull = turf.convex(pointCollection);

        if (hull) {
            hull.properties = { DISTRICT: district };
            polygonFeatures.push(hull);
        }
    }

    return polygonFeatures;
}

async function saveGeoJSON(features, outputFile) {
    const geojsonOutput = {
        type: "FeatureCollection",
        features: features
    };

    await fs.writeFile(outputFile, JSON.stringify(geojsonOutput, null, 2));
}

async function main(inputFile, outputFile) {
    try {
        // Load input GeoJSON
        const inputData = await fs.readFile(inputFile, 'utf8');
        const inputGeoJSON = JSON.parse(inputData);

        // Parse the input GeoJSON and group points by district
        const districts = parseGeoJSON(inputGeoJSON);

        // Create polygon features for each district
        const polygonFeatures = createDistrictPolygons(districts);

        // Save the result as a new GeoJSON file
        await saveGeoJSON(polygonFeatures, outputFile);

        console.log(`Polygon GeoJSON saved to ${outputFile}`);
    } catch (error) {
        console.error('An error occurred:', error);
    }
}

// Usage
const inputFile = "/Users/syamil/Projects/postal-sg-v2/src/assets/singpostcode_processed.geojson";
const outputFile = "district_polygons.geojson";
main(inputFile, outputFile);

export { parseGeoJSON, createDistrictPolygons, saveGeoJSON, main };