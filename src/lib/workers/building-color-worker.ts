// src/lib/workers/building-color-worker.ts

import * as turf from '@turf/turf';
import type { Feature, FeatureCollection, Point, Polygon, MultiPolygon } from 'geojson';

export type BuildingFeature = Feature<Polygon | MultiPolygon, any>;
export type PostalFeature = Feature<Point, any>;

self.onmessage = (e) => {
	const { type, data } = e.data;

	if (type === 'UPDATE_BUILDING_COLORS') {
		const { postalPoints, buildingFeatures } = data;

		// Prepare output
		const containingPolygons: FeatureCollection = {
			type: 'FeatureCollection',
			features: []
		};

		for (const building of buildingFeatures) {
			if (building.geometry.type !== 'MultiPolygon' && building.geometry.type !== 'Polygon')
				continue;

			// Normalize to MultiPolygon for easier handling
			const polygons =
				building.geometry.type === 'MultiPolygon'
					? building.geometry.coordinates
					: [building.geometry.coordinates];

			polygons.forEach((polygonCoords, polygonIndex) => {
				const polygon = turf.polygon(polygonCoords);
				const bufferedPolygon = turf.buffer(polygon, 0.5, { units: 'meters' });

				const containingPoint = postalPoints.find((pointFeature) => {
					if (pointFeature.geometry.type !== 'Point') return false;
					const point = turf.point(pointFeature.geometry.coordinates);
					return turf.booleanPointInPolygon(point, bufferedPolygon);
				});

				if (containingPoint) {
					containingPolygons.features.push({
						type: 'Feature',
						properties: {
							...building.properties,
							...containingPoint.properties,
							original_id: building.id,
							building_color: '#d14200',
							polygon_index: polygonIndex,
							render_height: building.properties?.render_height || 30
						},
						geometry: bufferedPolygon.geometry
					});
				} else {
					// If no postal point contains this building, we can still add it with a default color
					containingPolygons.features.push({
						type: 'Feature',
						properties: {
							...building.properties,
							original_id: building.id,
							building_color: '#aaa', // Default color
							polygon_index: polygonIndex,
							render_height: building.properties?.render_height || 30
						},
						geometry: bufferedPolygon.geometry
					});
				}
			});
		}

		self.postMessage({
			type: 'BUILDING_COLORS_UPDATED',
			data: containingPolygons
		});
	}
};
