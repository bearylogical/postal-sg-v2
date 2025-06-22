import { writable, derived } from 'svelte/store';

export const createGeoJsonLoader = (initialValue = null) => {
    const data = writable(initialValue);
    const error = writable(null);
    const loading = writable(false);

    const loadGeoJson = async (url) => {
        loading.set(true);
        error.set(null);

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const jsonData = await response.json();

            // Ensure the loaded data is a valid FeatureCollection
            if (jsonData.type !== 'FeatureCollection' || !Array.isArray(jsonData.features)) {
                throw new Error('Invalid GeoJSON: Not a FeatureCollection');
            }

            data.set(jsonData);
        } catch (e) {
            error.set(`Failed to load GeoJSON: ${e.message}`);
            data.set(null);
        } finally {
            loading.set(false);
        }
    };

    const state = derived(
        [data, loading, error],
        ([$data, $loading, $error]) => ({
            data: $data,
            loading: $loading,
            error: $error
        })
    );

    return {
        subscribe: state.subscribe,
        load: loadGeoJson,
    };
};