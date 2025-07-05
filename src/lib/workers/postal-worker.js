// postal-filter-worker.js
let postalCodesData = null;

const precision = 8; // Default precision for rounding coordinates
const simplifiedPrecision = 6; // Precision for simplified coordinates

// Function to round coordinates to a specified precision
function roundCoord(coord, precision = 6) {
	return Number(coord.toFixed(precision));
}

// Load postal codes data once
async function loadPostalCodes(url) {
	try {
		const response = await fetch(url);
		const data = await response.json();
		postalCodesData = data;
		const simplified = aggregateByCoordinate(data.features, simplifiedPrecision);
		return {
			success: true,
			count: data.features?.length || 0,
			features: data,
			simplified: simplified
		};
	} catch (error) {
		return { success: false, error: error.message };
	}
}

// Optimized filter function using regex
function createFilterFunction(pattern) {
	if (!pattern || pattern === '*') {
		console.warn('Pattern is empty or "*", returning all postal codes');
		return () => true;
	}

	// Handle range patterns like 54[1-4]264
	const rangeMatch = pattern.match(/^(.+)\[(\d)-(\d)\](.*)$/);
	if (rangeMatch) {
		const [, prefix, start, end, suffix] = rangeMatch;
		const startNum = parseInt(start);
		const endNum = parseInt(end);

		// Create regex pattern for range
		const rangePattern = `^${escapeRegex(prefix)}[${start}-${end}]${escapeRegex(suffix)}$`;
		const regex = new RegExp(rangePattern);

		return (postal) => regex.test(postal);
	}

	// Handle wildcard patterns with *
	if (pattern.includes('*')) {
		// Convert wildcard pattern to regex
		// Escape special regex characters except *
		const escapedPattern = pattern
			.replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape special chars
			.replace(/\*/g, '.*'); // Convert * to .*

		const regex = new RegExp(`^${escapedPattern}$`);
		return (postal) => regex.test(postal);
	}

	// Exact match - also use regex for consistency
	const exactRegex = new RegExp(`^${escapeRegex(pattern)}$`);
	return (postal) => exactRegex.test(postal);
}

// Helper function to escape regex special characters
function escapeRegex(string) {
	return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
// Filter postal codes
function filterPostalCodes(pattern, maxResults = 10000, precision = 6) {
	if (!postalCodesData || !postalCodesData.features) {
		return { features: [], count: 0 };
	}

	const filterFn = createFilterFunction(pattern);
	const filteredFeatures = [];

	if (maxResults === -1) {
		maxResults = postalCodesData.features.length; // No limit
	}
	for (const feature of postalCodesData.features) {
		// Stop if we reach maxResults but how dows it handle 0?
		if (maxResults <= 0) {
			return { features: [], count: 0 };
		}
		if (filteredFeatures.length >= maxResults) break;

		const postal = feature.properties.POSTAL;
		if (filterFn(postal)) {
			filteredFeatures.push(feature);
		}
	}

	// If too many features, reduce precision
	if (filteredFeatures.length > 10000) {
		for (const feature of filteredFeatures) {
			if (feature.geometry && Array.isArray(feature.geometry.coordinates)) {
				feature.geometry.coordinates = feature.geometry.coordinates.map((c) =>
					roundCoord(c, precision)
				);
			}
		}
	}

	return {
		type: 'FeatureCollection',
		features: filteredFeatures
	};
}

function calculateBounds(features) {
	if (!features || features.length === 0) return null;

	const bounds = features.reduce(
		(bounds, feature) => {
			const [lng, lat] = feature.geometry.coordinates;
			return {
				minLng: Math.min(bounds.minLng, lng),
				minLat: Math.min(bounds.minLat, lat),
				maxLng: Math.max(bounds.maxLng, lng),
				maxLat: Math.max(bounds.maxLat, lat)
			};
		},
		{
			minLng: Infinity,
			minLat: Infinity,
			maxLng: -Infinity,
			maxLat: -Infinity
		}
	);

	return [
		[bounds.minLng, bounds.minLat],
		[bounds.maxLng, bounds.maxLat]
	];
}

// Aggregate features by coordinate, summing weights
function aggregateByCoordinate(features, precision = 6) {
	const coordMap = new Map();

	for (const feature of features) {
		if (
			feature.geometry &&
			Array.isArray(feature.geometry.coordinates) &&
			feature.geometry.coordinates.length === 2
		) {
			// Round coordinates for grouping
			const lng = roundCoord(feature.geometry.coordinates[0], precision);
			const lat = roundCoord(feature.geometry.coordinates[1], precision);
			const key = `${lng},${lat}`;

			// Use weight property if present, else default to 1
			const weight = typeof feature.properties.weight === 'number' ? feature.properties.weight : 1;

			if (!coordMap.has(key)) {
				coordMap.set(key, [[lng, lat], 0]);
			}
			coordMap.get(key)[1] += weight;
		}
	}

	// Return as array of [ [lng, lat], weight ]
	return Array.from(coordMap.values());
}

// Worker message handler
self.onmessage = async function (e) {
	const { type, data } = e.data;

	switch (type) {
		case 'LOAD_DATA':
			const result = await loadPostalCodes(data.url);
			self.postMessage({ type: 'LOAD_COMPLETE', data: result });
			break;

		case 'FILTER':
			const { pattern, maxResults } = data;
			// console.log(`Filtering postal codes with pattern: ${pattern}, maxResults: ${maxResults}`);
			const filtered = filterPostalCodes(pattern, maxResults, precision);
			const simplified = aggregateByCoordinate(
				filtered.features,
				filtered.features?.length > 1000 ? simplifiedPrecision : precision
			);

			const bounds = calculateBounds(filtered.features);

			self.postMessage({
				type: 'FILTER_COMPLETE',
				data: {
					features: filtered,
					count: filtered.features.length,
					bounds: bounds,
					pattern: pattern,
					simplified: simplified // Array of { coordinates, weight }
				}
			});
			break;

		default:
			self.postMessage({ type: 'ERROR', data: { message: 'Unknown message type' } });
	}
};
