import fs from 'fs/promises';

function arePointsEqual(point1, point2, epsilon = 1e-9) {
    return Math.abs(point1[0] - point2[0]) < epsilon && Math.abs(point1[1] - point2[1]) < epsilon;
}

function findConnectedSegments(features) {
    const segmentGroups = [];
    const usedFeatures = new Set();

    for (let i = 0; i < features.length; i++) {
        if (usedFeatures.has(i)) continue;

        const group = [features[i]];
        usedFeatures.add(i);

        let changed = true;
        while (changed) {
            changed = false;
            for (let j = 0; j < features.length; j++) {
                if (usedFeatures.has(j)) continue;

                const lastSegment = group[group.length - 1];
                const lastPoint = lastSegment.geometry.coordinates[lastSegment.geometry.coordinates.length - 1];
                const firstPointOfJ = features[j].geometry.coordinates[0];

                if (arePointsEqual(lastPoint, firstPointOfJ)) {
                    group.push(features[j]);
                    usedFeatures.add(j);
                    changed = true;
                    break;
                }
            }
        }

        segmentGroups.push(group);
    }

    return segmentGroups;
}

function mergeSegmentsIntoPolygon(segments) {
    const coordinates = segments.flatMap(segment => segment.geometry.coordinates);

    // Remove duplicate points
    const uniqueCoordinates = [coordinates[0]];
    for (let i = 1; i < coordinates.length; i++) {
        if (!arePointsEqual(coordinates[i], uniqueCoordinates[uniqueCoordinates.length - 1])) {
            uniqueCoordinates.push(coordinates[i]);
        }
    }

    // Close the polygon if it's not already closed
    if (!arePointsEqual(uniqueCoordinates[0], uniqueCoordinates[uniqueCoordinates.length - 1])) {
        uniqueCoordinates.push(uniqueCoordinates[0]);
    }

    return {
        type: "Feature",
        geometry: {
            type: "Polygon",
            coordinates: [uniqueCoordinates]
        },
        properties: {
            id: segments[0].properties.id // Use the ID of the first segment
        }
    };
}

async function convertToGeoJSON(data) {
    const features = data.overlays
        .filter(overlay => overlay.styleId === "daf07587d6")
        .map(overlay => ({
            type: "Feature",
            geometry: {
                type: "LineString",
                coordinates: overlay.points.map(point => [parseFloat(point[1]), parseFloat(point[0])])
            },
            properties: {
                id: overlay.id,
                title: overlay.title,
                description: overlay.description
            }
        }));

    const segmentGroups = findConnectedSegments(features);
    const polygons = segmentGroups.map(mergeSegmentsIntoPolygon);

    return {
        type: "FeatureCollection",
        features: polygons
    };
}

async function main() {
    try {
        const inputData = await fs.readFile('/Users/syamil/Projects/postal-sg-v2/src/assets/scribble.json', 'utf8');
        const jsonData = JSON.parse(inputData);
        const geojsonData = await convertToGeoJSON(jsonData);
        await fs.writeFile('singapore_map_polygons.geojson', JSON.stringify(geojsonData, null, 2));
        console.log('Conversion completed. GeoJSON file saved as singapore_map_polygons.geojson');
    } catch (error) {
        console.error('An error occurred:', error);
    }
}

main();