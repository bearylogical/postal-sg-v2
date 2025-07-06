import fs from 'fs';
import * as turf from '@turf/turf';

function calculateCenters(g) {
    const groupedFeatures = {};

    g.features.forEach((feature) => {
        const district = feature.properties?.districtNumber;
        if (district) {
            if (!groupedFeatures[district]) {
                groupedFeatures[district] = [];
            }
            groupedFeatures[district].push(feature);
        }
    });

    const centroids = Object.entries(groupedFeatures).map(
        ([district, features]) => {
            const combined = turf.combine(turf.featureCollection(features));
            const centroid = turf.centroid(combined);

            const mergedProperties = features.reduce(
                (acc, feature) => {
                    Object.entries(feature.properties || {}).forEach(([key, value]) => {
                        if (value != null && (acc[key] == null || acc[key] === '')) {
                            acc[key] = value;
                        }
                    });
                    return acc;
                },
                {}
            );

            mergedProperties.district = district;

            return {
                type: 'Feature',
                properties: mergedProperties,
                geometry: centroid.geometry
            };
        }
    );

    return {
        type: 'FeatureCollection',
        features: centroids
    };
}

const inputPath = './src/assets/singapore_districts.geojson';
const outputPath = './src/assets/singapore_districts_centers.geojson';

fs.readFile(inputPath, 'utf8', (err, data) => {
    if (err) {
        console.error('Error reading the input file:', err);
        return;
    }
    try {
        const geojsonData = JSON.parse(data);
        const centers = calculateCenters(geojsonData);
        fs.writeFile(outputPath, JSON.stringify(centers, null, 2), 'utf8', (err) => {
            if (err) {
                console.error('Error writing the output file:', err);
            } else {
                console.log(`Successfully precomputed and saved centers to ${outputPath}`);
            }
        });
    } catch (parseErr) {
        console.error('Error parsing GeoJSON data:', parseErr);
    }
});
