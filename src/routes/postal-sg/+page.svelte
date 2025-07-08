<script lang="ts">
	import {
		MapLibre,
		GeoJSONSource,
		FillLayer,
		LineLayer,
		CircleLayer,
		FillExtrusionLayer,
		NavigationControl,
		QuerySourceFeatures,
		SymbolLayer,
		HeatmapLayer
	} from 'svelte-maplibre-gl';
	import type { FeatureCollection, Feature, Point } from 'geojson';
	import * as turf from '@turf/turf';
	import Section from '$lib/layout/Section.svelte';
	import Scroller from '$lib/layout/Scroller.svelte';
	import { contrastingColor } from '$lib/colors.js';
	import { onMount } from 'svelte';
	import { planningAreasStore } from '$lib/stores';
	import { streetsStyle } from '$lib/styles';
	import Em from '$lib/ui/Em.svelte';
	import { fade } from 'svelte/transition';
	import maplibregl from 'maplibre-gl';
	import PostalWorker from '$lib/workers/postal-worker.js?worker';
	import BuildingColorWorker from '$lib/workers/building-color-worker.ts?worker';

	// import { DeckGLOverlay } from '@svelte-maplibre-gl/deckgl';
	// import { HeatmapLayer } from '@deck.gl/aggregation-layers';

	import Counter from '$lib/ui/Counter.svelte';
	import type { LayerSpecification } from 'maplibre-gl';
	let hoveredFeature: maplibregl.MapGeoJSONFeature | undefined = $state.raw();
	let lnglat = $state.raw(new maplibregl.LngLat(0, 0));
	let controlPosition: maplibregl.ControlPosition | undefined = $state('bottom-right');
	// import '.css';

	const planningareas = 'https://data.bearylogical.net/singapore_districts.geojson';
	const postalcodes = 'https://data.bearylogical.net/singpostcode.geojson';

	//states
	let showBorder = $state(true);
	let showFill = $state(true);
	let showClusterCircles = $state(false);
	let showClusterCounts = $state(false);
	let showPostalInfo = $state(false);
	let fillColor = $state('#006000');
	let borderColor = $state('#003300');
	let debugMode = $state<boolean>();
	let explore = $state(true); // map interactivity on/off
	let showHeatmap = $state(false);
	let renderHeatmap = $state(true);
	let showDistricts = $state(false);
	let showBuildingExtrusions = $state(false);
	let autoZoom = $state(false);
	let previousMapSectionId = $state(null);
	let overrideBounds = $state(false);

	// Data states
	let dataLoading = $state(true);
	let dataError = $state(null);

	// Data variables
	let totalPostalCodes = $state(null);
	let currentBounds = $state<maplibregl.LngLatBounds | null>(null);
	let filterPostalCodeDataSimplified = $state<Array | null>([]);
	let renderedFeatures = $state<Array | null>([]);

	let displayedValue = $state('');
	// Variables to hold visible section IDs of Scroller components
	let mapSectionId = $state<string | number | null>(1);

	let postalWorker: Worker;
	let workerReady = $state(false);
	let pendingFlyToOptions = $state<{
		zoom: number;
		pitch?: number;
		bearing?: number;
		center?: boolean;
		duration?: number;
	} | null>(null);

	let buildingColorWorker: Worker;
	let filteredPolygons = $state();

	// CONFIG FOR SCROLLER COMPONENTS
	// Config
	const threshold = 0.85;

	// Actions for Scroller components
	const actions = {
		map: {
			// Actions for <Scroller/> with id="map"
			map01: () => {
				// Action for <section/> with data-id="map01"
				explore = false;
				showHeatmap = false;
				showFill = true;
				showDistricts = true;
				showPostalInfo = false;
				showClusterCircles = false;
				displayedValue = '';
				resetView();
				showInputOverlay = false;
				setPanRotate(false);
				autoZoom = false;
				overrideBounds = false;
			},
			map02: () => {
				explore = false;
				showHeatmap = false;
				showDistricts = true;
				resetView();
				showPostalInfo = false;
				showClusterCircles = false;
				showInputOverlay = false;
				autoZoom = false;
				setPanRotate(false);
				overrideBounds = false;
			},
			map03: () => {
				explore = false;
				showHeatmap = true;
				showDistricts = false;
				inputValue = '*';
				autoZoom = true;
				showPostalInfo = false;
				setPanRotate(false);
				showInputOverlay = false;
				overrideBounds = false;
			},
			map04: () => {
				explore = false;
				showHeatmap = true;
				inputValue = '54*';
				autoZoom = true;
				pendingFlyToOptions = { zoom: 11, duration: 3000 };
				showPostalInfo = false;
				showClusterCircles = false;
				showBuildingExtrusions = false;
				showInputOverlay = false;
				setPanRotate(false);
				overrideBounds = false;
			},
			map05: () => {
				explore = false;
				showHeatmap = false;
				inputValue = '54[2-4]264';
				displayedValue = '';
				autoZoom = true;
				pendingFlyToOptions = { zoom: 18, pitch: 60, bearing: 35 };
				showPostalInfo = false;
				showClusterCircles = false;
				showBuildingExtrusions = true;
				showInputOverlay = false;
				setPanRotate(false);
				overrideBounds = true;
			},
			map06: () => {
				explore = false;
				showHeatmap = false;
				inputValue = '542264';
				displayedValue = '';
				autoZoom = true;
				pendingFlyToOptions = { zoom: 18, pitch: 45, bearing: 35 };
				showPostalInfo = false;
				showBuildingExtrusions = true;
				showClusterCircles = false;
				showInputOverlay = false;
				setPanRotate(false);
				overrideBounds = false;
			},
			map07: () => {
				explore = false;
				showHeatmap = true;
				inputValue = '54*264';
				autoZoom = true;
				pendingFlyToOptions = { zoom: 14, pitch: 0, bearing: 0 };
				showPostalInfo = true;
				showBuildingExtrusions = false;
				showClusterCircles = true;
				showInputOverlay = false;
				setPanRotate(false);
				overrideBounds = false;
			},
			map08: () => {
				explore = false;
				showHeatmap = true;
				inputValue = '*';
				displayedValue = '';
				autoZoom = false;
				resetView();
				showPostalInfo = false;
				showClusterCircles = false;
				showInputOverlay = true;
				setPanRotate(false);
				overrideBounds = false;
			}
		}
	};

	function setPanRotate(flag: boolean) {
		if (flag) {
			map?.dragPan.enable();
			map?.dragRotate.enable();
		} else {
			map?.dragPan.disable();
			map?.dragRotate.disable();
		}
	}

	// Code to run Scroller actions when new caption IDs come into view
	let currentActionId = $state(null);

	let shouldRunAction = $derived.by(() => {
		if (mapSectionId && mapSectionId !== currentActionId) {
			return mapSectionId;
		}
		return null;
	});

	$effect(() => {
		if (shouldRunAction) {
			runActions(shouldRunAction, actions.map);
			currentActionId = shouldRunAction;
		}
	});
	function runActions(sectionId: string, actions: Map<string, () => void>) {
		const _mapSectionId: string = 'map' + (parseInt(sectionId, 10) + 1).toString().padStart(2, '0');
		if (actions[_mapSectionId]) {
			actions[_mapSectionId]();
		}
	}

	// START EXTRACT
	let map = $state<maplibregl.Map | undefined>();
	let loaded = $state(false);
	let touched = $state(false);
	let showInputOverlay = $state(false);
	let progressValue = $state<number>(0);

	let planningAreasCenters = $state(null);
	let error = $state(null);
	let currentZoom = $state(10);
	let inputValue = $state<string | null>(null);
	let filterPostalCodeData = $state<Array | null>([]);
	let previousWorkingPostal = $state<string>(null);

	let modifiedStreetsStyle: maplibregl.StyleSpecification | null = $state(null);

	const BUILDING_ZOOM_START = 16;
	const NUM_BUILDINGS_TO_RENDER = 500; // Number of buildings to render at high zoom levels

	const planningAreasCentersUrl = '/src/assets/singapore_districts_centers.geojson';
	let layers: LayerSpecification[] = $state.raw([]);
	$effect(() => {});
	onMount(() => {
		// Extract the layers spec from the OSM style

		fetch(streetsStyle)
			.then((response) => response.json())
			.then((data) => {
				layers = data['layers'].filter((layer: LayerSpecification) => layer.id !== 'Building 3D');
				modifiedStreetsStyle = {
					...data,
					layers
				};
			});

		planningAreasStore.load(planningareas);
		fetch(planningAreasCentersUrl)
			.then((res) => res.json())
			.then((data) => (planningAreasCenters = data))
			.catch((err) => (error = err));
		// workers
		postalWorker = new PostalWorker();
		buildingColorWorker = new BuildingColorWorker();

		postalWorker.onmessage = (e) => {
			const { type, data, pattern } = e.data;

			switch (type) {
				case 'LOAD_COMPLETE':
					if (data.success) {
						workerReady = true;
						totalPostalCodes = data.count;
						filterPostalCodeData = data.features;
						filterPostalCodeDataSimplified = data.simplified;

						dataLoading = false;
					} else {
						dataError = data.error;
						console.error('Failed to load postal codes:', data.error);
					}
					break;

				case 'FILTER_COMPLETE':
					if (data.pattern === inputValue) {
						filterPostalCodeData = data.features;
						filterPostalCodeDataSimplified = data.simplified;

						totalPostalCodes = data.count;
						currentBounds = new maplibregl.LngLatBounds(data.bounds);

						if (autoZoom && pendingFlyToOptions) {
							flyToFilteredPoints(pendingFlyToOptions);
							pendingFlyToOptions = null;
						} else if ((totalPostalCodes ? totalPostalCodes > 0 : false) && !autoZoom) {
							fitBounds(currentBounds, getZoomLevel(Number(displayedValue)));
							// console.log(filterPostalCodeData);
							previousWorkingPostal = filterPostalCodeData.features[0].properties.POSTAL;

							if ((totalPostalCodes ? totalPostalCodes < 6 : false) && displayedValue.length > 4) {
								showBuildingExtrusions = true;

								flyToFilteredPoints({ zoom: 18, pitch: 25, bearing: 35, center: true });
								showHeatmap = false;
							} else {
								showBuildingExtrusions = true;
								showHeatmap = true;

								setTimeout(() => {
									flyToFilteredPoints({
										zoom: getZoomLevel(Number(displayedValue)),
										center: false
									});
								}, 200);
							}
						}
						e;
					}
					break;

				case 'ERROR':
					dataError = data.message;
					console.error('Worker error:', data.message);
					break;
			}
		};

		buildingColorWorker.onmessage = (e) => {
			const { type, data } = e.data;
			if (type === 'BUILDING_COLORS_UPDATED') {
				filteredPolygons = data;
			}
		};

		// Load data into worker
		postalWorker.postMessage({
			type: 'LOAD_DATA',
			data: { url: postalcodes }
		});

		// Cleanup
		return () => {
			postalWorker?.terminate();
			buildingColorWorker?.terminate();
		};
	});

	// Functions for map component
	function fitBounds(
		bounds: maplibregl.LngLatBound,
		zoom = 18,
		pitch = 0,
		bearing = 0,
		duration = 5000
	) {
		if (map) {
			map.fitBounds(bounds, {
				zoom: zoom,
				pitch: pitch,
				duration: duration,
				bearing: bearing
			});
		}
	}
	// Simplify your existing filter effect
	$effect(() => {
		if (!workerReady || !postalWorker) return;

		// Clear polygons before filtering
		filteredPolygons = null;

		if (inputValue) {
			postalWorker.postMessage({
				type: 'FILTER',
				data: {
					pattern: inputValue,
					maxResults: -1
				}
			});
		} else {
			// Clear the filter if inputValue is empty
			filterPostalCodeData = [];
		}
	});

	$effect(() => {
		if (!showBuildingExtrusions) {
			filteredPolygons = null;
		}
	});

	function calculateCentroid(input: FeatureCollection | Feature[]): Feature<Point> {
		let featureCollection: FeatureCollection;

		// Check if input is already a FeatureCollection
		if ('type' in input && input.type === 'FeatureCollection') {
			featureCollection = input;
		} else {
			// If it's an array of features, convert it to a FeatureCollection
			featureCollection = {
				type: 'FeatureCollection',
				features: input
			};
		}

		// If we want a more precise centroid, we can use turf.centroid
		const centroid = turf.centroid(featureCollection);

		// Return the center as a GeoJSON Feature
		return centroid;
	}

	function flyToFilteredPoints({
		zoom = 18,
		pitch = 0,
		bearing = 0,
		center = false,
		duration = 5000
	}) {
		// Early return if no data or bounds
		// console.log('Current bounds:', currentBounds);
		if (!filterPostalCodeData?.features?.length || !currentBounds) {
			return;
		}

		if (center) {
			// Calculate centroid from the filtered features (this is fast)
			const centroid = calculateCentroid(filterPostalCodeData);
			map?.flyTo({
				center: centroid.geometry.coordinates,
				zoom,
				pitch,
				bearing,
				speed: 1,
				duration: duration
			});
		} else {
			// Use pre-calculated bounds

			fitBounds(currentBounds, zoom, pitch, bearing, duration);
		}
	}

	function debounce(func, wait) {
		let timeout;
		return function executedFunction(...args) {
			const later = () => {
				clearTimeout(timeout);
				func(...args);
			};
			clearTimeout(timeout);
			timeout = setTimeout(later, wait);
		};
	}

	const debouncedHandleInput = debounce((event) => {
		if (!workerReady || !postalWorker) return;

		handleInput(event);
	}, 300);

	let validInput = $derived(/^\d{0,6}$/.test(displayedValue));
	let showError = $derived(touched && !validInput);

	function resetView() {
		map?.flyTo({ center: [103.8198, 1.3221], zoom: 10, bearing: 0, pitch: 0 });
	}

	function getZoomLevel(number) {
		// Convert the number to a string to easily count its digits
		const numStr = Math.abs(number).toString();

		// Count the number of digits
		const digitCount = numStr === '0' ? 0 : numStr.length;

		// Calculate the zoom level
		// Start at 10 for 0 digits, increase by 1.6 for each digit, max out at 18
		const zoomLevel = Math.min(10 + digitCount * 1.6, 18);

		// Round to one decimal place
		return Math.round(zoomLevel * 10) / 10;
	}
	function handleInput(event) {
		if (event) {
			touched = true;
		}

		if (validInput || displayedValue === '') {
			inputValue = displayedValue + '*';

			// Clear polygons when input changes
			filteredPolygons = null;

			if (displayedValue.trim().length === 0) {
				resetView();
			}
		}
	}

	function checkZoomAndUpdate() {
		if (totalPostalCodes < NUM_BUILDINGS_TO_RENDER) {
			// If there are less than NUM_BUILDINGS_TO_RENDER postal codes, we can show building extrusions
			updateBuildingColors(filterPostalCodeData.features, renderedFeatures);
		}
	}

	function updateBuildingColors(data, renderedFeatures = []) {
		if (!map || !data) return;

		// Only send the necessary data to the worker (strip out circular references)
		const buildingFeatures = renderedFeatures.map((f) => ({
			type: 'Feature',
			geometry: f.geometry,
			properties: f.properties,
			id: f.id
		}));

		// data is your filtered postal code features (array of GeoJSON Features)
		buildingColorWorker.postMessage({
			type: 'UPDATE_BUILDING_COLORS',
			data: {
				postalPoints: $state.snapshot(data),
				buildingFeatures
			}
		});
	}
</script>

<svelte:head>
	<title>Topography of Singapore Postal Codes</title>
	<meta name="description" content="This is where the description goes for SEO" />
	<meta property="og:title" content="Topography of Singapore Postal Codes | Bearylogical" />
	<meta property="og:description" content="A short explainer on Singapore's postal codes" />
	<meta property="og:image" content="/web_thumb.png" />
	<meta property="og:url" content="https://stories.bearylogical.net/postal-sg/index.html" />
	<meta property="og:type" content="website" />
</svelte:head>

<Section>
	<h2>Topography of Singapore Postal Codes</h2>
	<p class="text-muted text-small">(modified) 06 July 2025 // bearylogical</p>
	<p class="mb">
		Singapore's postal code system not only aids mail delivery but also offers a unique view of the
		city's layout and organization. It's like a hidden map showing how the island is structured and
		divided.
	</p>
	<p class="mb">
		This small visualization illustrates Singapore's postal code system and is inspired by Ben Fry's
		<a href="https://benfry.com/zipdecode/">zipdecode</a>.
	</p>
	<p class="mb">Scroll down to learn more!</p>
	<p class="text-small">Acknowledgements</p>
	<!-- <h3 class="text-small">Acknowledgements</h3> -->
	<ol class="text-small" style="padding-left: 20px; margin-left: 0; padding-bottom:10px">
		<li>
			Postal Code Data sourced from <a href="https://www.onemap.gov.sg/">onemap</a>
		</li>

		<li>
			Postal districts boundaries from Timothy's
			<a href="https://www.penang-traveltips.com/singapore/postal-districts.htm">
				Singapore Postal Districts</a
			>
		</li>
		<li>
			Wikipedia Explanation of <a href="https://github.com/ONSvisual/sk-scrolly/tree/main"
				>Singapore Postal Code
			</a>system
		</li>
		<li>
			Scroller implmentation adapted from UK's Office of National Statistics <a
				href="https://en.wikipedia.org/wiki/Postal_codes_in_Singapore">scrolly template</a
			>
		</li>
	</ol>
	<p>
		<span class="text-small"
			>(Update) Migrated to svelte-5, expected some differences as optimizations are ongoing!</span
		>
	</p>
</Section>

{#if dataLoading}
	<div class="loading-container">
		<div class="loading-spinner"></div>
		<div class="loading-text">Initializing the story..</div>
	</div>
{:else if dataError}
	<p>Error: {dataError}</p>
	<!-- <button on:click={loadData}>Try Again</button> -->
{:else if totalPostalCodes}
	<Scroller {threshold} bottom={0.8} bind:index={mapSectionId} bind:progress={progressValue}>
		{#snippet backgroundElements()}
			<div slot="background">
				<div class="col-full height-full">
					<MapLibre
						bind:map
						style={modifiedStreetsStyle ?? streetsStyle}
						center={[103.8198, 1.3221]}
						bind:zoom={currentZoom}
						maxZoom={20}
						interactive={false}
						antialias={true}
						class="sticky aspect-[9/16] max-h-screen w-full sm:aspect-video sm:max-h-full"
						onzoomstart={() => {
							renderHeatmap = currentZoom <= BUILDING_ZOOM_START;
							if (currentZoom > BUILDING_ZOOM_START) {
								checkZoomAndUpdate();
							}
						}}
						onzoomend={() => {
							renderHeatmap = true;
							if (currentZoom > BUILDING_ZOOM_START) {
								checkZoomAndUpdate();
							}
						}}
						onmovestart={() => (renderHeatmap = false)}
						onmoveend={() => (renderHeatmap = true)}
						onresize={() => {
							// Resize the map when the window is resized also do some debouncing
							if (map) {
								map.resize();
							}
						}}
					>
						{#if currentZoom > 15}
							<QuerySourceFeatures
								bind:features={renderedFeatures}
								source="maptiler_planet"
								sourceLayer="building"
							></QuerySourceFeatures>
						{/if}
						{#if filteredPolygons?.features?.length > 0}
							<GeoJSONSource id="custom-building-3d" data={filteredPolygons} promoteId="id">
								{#if showBuildingExtrusions}
									<FillExtrusionLayer
										id="building-extrusions"
										source="custom-building-3d"
										paint={{
											'fill-extrusion-color': ['get', 'building_color'],
											'fill-extrusion-height': ['get', 'render_height'],
											'fill-extrusion-base': ['get', 'render_min_height'],
											'fill-extrusion-opacity': 0.7
										}}
									/>
									<SymbolLayer
										paint={{
											'text-color': '#000',
											'text-halo-color': '#fff',
											'text-halo-width': 2,
											'text-opacity': 1
										}}
										layout={{
											'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
											'text-field': ['get', 'ADDRESS'],
											'text-size': ['interpolate', ['linear'], ['zoom'], 16, 10, 18, 14, 20, 16],
											'text-anchor': 'bottom',
											// 'text-offset': [0, 10],
											'text-justify': 'left',
											'text-allow-overlap': true,
											'text-ignore-placement': false,
											'text-variable-anchor': ['left', 'top'],
											'text-radial-offset': [
												'interpolate',
												['linear'],
												['zoom'],
												16,
												0.5,
												18,
												['/', ['get', 'render_height'], 20],
												20,
												['/', ['get', 'render_height'], 16]
											]
										}}
									/>
								{/if}
							</GeoJSONSource>
						{/if}

						{#if explore}
							<NavigationControl position={controlPosition} visualizePitch />
						{/if}
						{#if showDistricts}
							<GeoJSONSource id="planning-areas" data={planningareas} promoteId="name">
								{#if showFill}
									<FillLayer
										minzoom={8}
										maxzoom={14}
										paint={{
											'fill-color': fillColor,
											'fill-opacity': ['interpolate', ['linear'], ['zoom'], 8, 0.6, 14, 0.1]
										}}
									></FillLayer>
								{/if}
								{#if showBorder}
									<LineLayer
										minzoom={8}
										layout={{ 'line-cap': 'round', 'line-join': 'round' }}
										paint={{ 'line-color': borderColor, 'line-width': 0.7 }}
									/>
								{/if}
								<GeoJSONSource
									id="planning-areas-centers"
									data={planningAreasCentersUrl}
									promoteId="district"
								>
									<SymbolLayer
										minzoom={9}
										paint={{
											'text-color': '#010',
											'text-halo-color': '#fff',
											'text-halo-width': 1.5,
											'text-halo-blur': 1
										}}
										layout={{
											'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
											'text-allow-overlap': false,
											'text-field': ['get', 'district'],
											'text-size': ['interpolate', ['linear'], ['zoom'], 10, 12, 14, 14, 18, 16],
											'text-offset': [0, 0]
											// 'text-anchor': 'left'
										}}
									/>
								</GeoJSONSource>
							</GeoJSONSource>
						{/if}
						{#if showHeatmap && renderHeatmap && currentZoom > 9}
							<!-- <div class="heatmap-overlay" transition:fade={{ duration: 100 }}>
								<DeckGLOverlay
									style="pointer-events: none; position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
									interleaved
									layers={[
										new HeatmapLayer({
											id: 'heatmap-layer',
											data: filterPostalCodeDataSimplified,
											pickable: false,
											getPosition: (d) => d[0],
											//emphasize smaller weights
											getWeight: (d) => Math.log2(d[1] + 1),
											intensity: 1,
											threshold: 0.01,
											radiusPixels: (() => {
												// MapLibre: 9 → 3, 19 → 15
												const z = currentZoom;
												if (z <= 9) return 3;
												if (z >= 19) return 15;
												return 3 + ((z - 9) / (19 - 9)) * (15 - 3);
											})(),
											opacity: 0.6,
											colorRange: [
												[33, 102, 172, 0], // transparent blue (0)
												[103, 169, 207, 255], // light blue (0.2)
												[209, 229, 240, 255], // pale blue (0.4)
												[253, 219, 199, 255], // light orange (0.6)
												[239, 138, 98, 255], // orange (0.8)
												[178, 24, 43, 255] // deep red (1)
											]
										})
									]}
								/>
							</div> -->
						{/if}

						<GeoJSONSource
							id="postal-codes-clusters"
							data={filterPostalCodeData}
							cluster={true}
							clusterMaxZoom={22}
							clusterRadius={3}
							promoteId="POSTAL"
						>
							{#if showHeatmap && renderHeatmap && currentZoom > 9}
								<HeatmapLayer
									id="postal-heatmap"
									source="postal-codes-clusters"
									maxzoom={BUILDING_ZOOM_START}
									paint={{
										// Increase the heatmap weight based on frequency and property magnitude
										'heatmap-weight': [
											'interpolate',
											['linear'],
											['get', 'point_count'],
											0,
											0,
											1,
											0.5,
											5,
											1
										],
										// Increase the heatmap color weight weight by zoom level
										// heatmap-intensity is a multiplier on top of heatmap-weight
										'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 19, 3],
										// Color ramp for heatmap.  Domain is 0 (low) to 1 (high).
										// Begin color ramp at 0-stop with a 0-transparancy color
										// to create a blur-like effect.
										'heatmap-color': [
											'interpolate',
											['linear'],
											['heatmap-density'],
											0,
											'rgba(33,102,172,0)',
											0.2,
											'rgb(103,169,207)',
											0.4,
											'rgb(209,229,240)',
											0.6,
											'rgb(253,219,199)',
											0.8,
											'rgb(239,138,98)',
											1,
											'rgb(178,24,43)'
										],
										// Adjust the heatmap radius by zoom level
										'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 9, 5, 19, 8],
										// Transition from heatmap to circle layer by zoom level
										'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 10, 1, 22, 0]
									}}
								/>
							{/if}
							{#if showPostalInfo}
								<SymbolLayer
									source="postal-codes-clusters"
									id="cluster_labels"
									layout={{
										'text-field': ['format', 'Address: ', {}, ['get', 'ADDRESS'], {}],
										'text-variable-anchor': ['right', 'top'],
										'text-offset': [0.5, 0.1],
										'text-allow-overlap': false,
										'text-ignore-placement': false,
										'text-justify': 'left'
									}}
									paint={{
										'text-halo-width': ['interpolate', ['linear'], ['zoom'], 8, 2, 13, 1],
										'text-opacity': ['interpolate', ['linear'], ['zoom'], 8, 1, 13, 0.9]
									}}
								/>
							{/if}
						</GeoJSONSource>
					</MapLibre>
					{#if showInputOverlay && progressValue > 0.95}
						<div class="map-overlay top" transition:fade={{ delay: 250, duration: 300 }}>
							<div class="map-overlay-inner">
								<h3 class="text-big" style="margin-bottom: 15px;">Postal Code Explorer</h3>
								<input
									type="text"
									placeholder="Enter a 6 digit postal code"
									bind:value={displayedValue}
									oninput={debouncedHandleInput}
								/>

								{#if showError}
									<p class=" error">Please enter only digits.</p>
								{:else if displayedValue?.length > 6}
									<p class=" error">Postal codes have only 6 digits.</p>
								{:else if totalPostalCodes === 0}
									<p class=" error">
										Can't find that postal code, try removing entries or try {previousWorkingPostal}
									</p>
								{/if}

								<p style="margin-top: 5px">
									<Em color="#206095">{totalPostalCodes}</Em> Postal Codes are currently shown.
								</p>
							</div>
						</div>
					{/if}
				</div>
			</div>
		{/snippet}
		{#snippet foregroundElements()}
			<div slot="foreground">
				<section data-id="map01"></section>
				<section data-id="map02">
					<div class="col-medium">
						<p>
							Beginning in the 1950s, Singapore was originally split into <Em color="#206095">28</Em
							> Postal Districts.
						</p>
					</div>
				</section>
				<section data-id="map03">
					<div class="col-medium">
						<p>
							Fast forward to September 1995, the postal code uses a <Em color="#206095">6</Em> digit
							system which divides Singapore into 80 postal sectors.
						</p>
						<p>
							<Em color="#206095">{totalPostalCodes}</Em> postal codes are displayed on this map to illustrate
							its distribution.
						</p>
					</div>
				</section>
				<section data-id="map04">
					<div class="col-medium">
						<p>Singapore's 6 digit postal code system works as follows:</p>
						<h2><Em color="#003C57">54</Em><span color="grey">2264</span></h2>
						<p>The first two digits of each postal code denote a postal sector.</p>
					</div>
				</section>
				<section data-id="map05">
					<div class="col-medium">
						<h2>542<Em color="#003C57">264</Em></h2>
						<p>
							The last 3 digits are used to indicate residential properties in an apartment block.
						</p>
					</div>
				</section>
				<section data-id="map06">
					<div class="col-medium">
						<h2>
							54<Em color="#003C57">2</Em>264
						</h2>
						<p>
							For residential blocks that share the same number, the 3rd digit is used to
							differentiate between blocks.
						</p>
					</div>
				</section>
				<section data-id="map07">
					<div class="col-medium">
						<h2>
							54<Em color="#003C57"><Counter></Counter></Em>264
						</h2>
						<p>
							Within the same postal sector, postal codes are given out based on street names, from
							A to Z. In each area:
						</p>
						<ol>
							<li>Streets starting with 'A' get codes first</li>
							<li>Then streets starting with 'B', and so on</li>
							<li>The third number in the code often matches something about the street name</li>
						</ol>

						This system is used for homes, shops, and factories.
					</div>
				</section>
				<section data-id="map08">
					{#if progressValue < 0.95}
						<div class="col-medium">
							<h2>Try it yourself!</h2>
							<p>Scroll below to try some postal codes!</p>
						</div>
					{/if}
				</section>
			</div>
		{/snippet}
	</Scroller>
{/if}

<style>
	/* GLOBALS */

	/* COMPONENTS */

	input {
		font-family: inherit;
		font-size: inherit;
		-webkit-padding: 0.4em 0;
		padding: 0.4em;
		margin: 0 0 0.5em 0;
		-webkit-box-sizing: border-box;
		box-sizing: border-box;
		border: 1px solid #ccc;
		border-radius: 2px;
	}

	/* Other layout elements - positioned below header */
	section {
		display: -webkit-box;
		display: -ms-flexbox;
		display: flex;
		-webkit-box-pack: center;
		-ms-flex-pack: center;
		justify-content: center;
		background-position: center;
		background-repeat: no-repeat;
		background-size: cover;
		margin: 0;
		padding: 0;
		position: relative;
		z-index: 1; /* Below header but above background */
	}

	/* CLASSES */

	.col-full {
		width: 100%;
	}

	.col-medium {
		width: 100%;
		max-width: 680px;
		margin: 0 24px;
	}

	.height-full {
		min-height: 100vh;
	}

	.text-big {
		font-size: 30px;
		margin: 20px 0;
	}

	.text-small {
		font-size: 14px;
	}

	.text-muted {
		color: #777;
	}

	/* SCROLL-SPECIFIC ELEMENTS */

	[slot='foreground'] {
		position: relative;
		z-index: 10; /* Above background but below header */
	}

	[slot='foreground'] section {
		padding: 100vh 0 100vh 0;
		position: relative;
		z-index: 10;
	}

	[slot='foreground'] section + section {
		padding: 0 0 100vh 0;
	}

	[slot='foreground'] section div {
		padding: 12px;
		position: relative;
		z-index: 11;
	}

	[slot='foreground'] section div::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background-color: #fff;
		opacity: 0.8;
		z-index: -1;
	}

	[slot='foreground'] section div p {
		margin: 0;
	}

	[slot='foreground'] section div p + p {
		margin-top: 30px;
	}

	[slot='foreground'] section div h2,
	[slot='foreground'] section div h3 {
		margin: 10px 0 20px 0;
	}

	/* Styles specific to elements within the demo */
	:global(svelte-scroller-foreground) {
		pointer-events: none !important;
	}
	:global(svelte-scroller-foreground section div) {
		pointer-events: all !important;
	}

	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}

	.loading-container {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		background-color: rgba(255, 255, 255, 0.8);
		padding: 20px;
		border-radius: 8px;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
	}

	.loading-spinner {
		border: 4px solid #f3f3f3;
		border-top: 4px solid #3498db;
		border-radius: 50%;
		width: 40px;
		height: 40px;
		animation: spin 1s linear infinite;
		margin: 0 auto;
	}

	.loading-text {
		text-align: center;
		font-size: 18px;
		margin-top: 10px;
		color: #333;
	}

	.map-overlay {
		font-size: 16px;
		line-height: 1.5;
		position: absolute;
		width: 60%;
		max-width: 400px;
		bottom: 10%;
		left: 20px;
		padding: 10px;
		box-sizing: border-box;
	}

	@supports (-webkit-touch-callout: none) {
		.map-overlay {
			/* top: auto; */
			bottom: 20px;
			left: 20px;
			width: calc(100% - 40px);
			max-width: none;
		}
	}

	@media (max-width: 844px) and (orientation: portrait),
		(max-width: 926px) and (orientation: landscape) {
		.map-overlay {
			/* top: auto; */
			bottom: 20px;
			left: 20px;
			width: calc(100% - 40px);
			max-width: none;
		}
	}

	.map-overlay .map-overlay-inner {
		background-color: #fff;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
		border-radius: 3px;
		padding: 10px;
		margin-bottom: 10px;
	}

	.map-overlay-inner h3 {
		padding: 0;
		margin-bottom: 10px;
		margin-top: 10px;
	}

	.error {
		color: red;
		font-size: 0.9em;
		font-style: italic;
		margin-top: 5px;
	}

	/* Safari-specific styles */
	@supports (-webkit-overflow-scrolling: touch) {
		.map-overlay {
			-webkit-overflow-scrolling: touch;
		}
	}

	/* Media query for smaller viewports */
	@media screen and (max-width: 600px) {
		.map-overlay {
			width: 95%;
			left: 2.5%;
			right: 2.5%;
			top: 2%;
		}

		.map-overlay-inner {
			padding: 8px;
		}

		.map-overlay-inner h3 {
			font-size: 14px;
		}
	}
</style>
