import { writable } from 'svelte/store';

export const createGeoJsonLoader = (initialValue = null) => {
    const { subscribe, set } = writable(initialValue);
    const error = writable(null);

    const loadGeoJson = async (url) => {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();

            // Ensure the loaded data is a valid FeatureCollection
            if (data.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
                throw new Error('Invalid GeoJSON: Not a FeatureCollection');
            }

            set(data);
            error.set(null);
        } catch (e) {
            error.set(`Failed to load GeoJSON: ${e.message}`);
            set(null);
        }
    };

    return {
        subscribe,
        load: loadGeoJson,
        error: { subscribe: error.subscribe }
    };
};