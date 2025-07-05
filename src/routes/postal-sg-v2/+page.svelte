<script lang="ts">
	import {
		MapLibre,
		GeoJSONSource,
		FillLayer,
		LineLayer,
		CircleLayer,
		NavigationControl,
		SymbolLayer
		// HeatmapLayer
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
	import { DeckGLOverlay } from '@svelte-maplibre-gl/deckgl';
	import { HeatmapLayer } from '@deck.gl/aggregation-layers';

	import Counter from '$lib/ui/Counter.svelte';
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
	let showDistricts = $state(false);
	let autoZoom = $state(false);

	// Data states
	let dataLoading = $state(true);
	let dataError = $state(null);

	// Data variables
	let totalPostalCodes = $state(null);
	let currentBounds = $state(null);
	let filterPostalCodeDataSimplified = $state<Array | null>([]);

	let displayedValue = $state('');
	// Variables to hold visible section IDs of Scroller components
	let mapSectionId = $state<string | number | null>(1);

	let postalWorker: Worker;
	let workerReady = $state(false);

	// CONFIG FOR SCROLLER COMPONENTS
	// Config
	const threshold = 0.6;

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
			},
			map03: () => {
				explore = false;
				showHeatmap = true;
				showDistricts = false;
				inputValue = '*';
				autoZoom = true;
				flyToFilteredPoints({ zoom: 11, center: false });
				showPostalInfo = false;
				setPanRotate(false);
				showInputOverlay = false;
			},
			map04: () => {
				explore = false;
				showHeatmap = true;
				inputValue = '54*';
				autoZoom = true;
				flyToFilteredPoints({ zoom: 14 });
				showPostalInfo = false;
				showClusterCircles = false;
				showInputOverlay = false;
				setPanRotate(false);
			},
			map05: () => {
				explore = false;
				showHeatmap = true;
				inputValue = '54[1-4]264';
				autoZoom = true;
				flyToFilteredPoints({ zoom: 18, pitch: 30, bearing: 60 });
				showPostalInfo = true;
				showClusterCircles = false;
				showInputOverlay = false;
				setPanRotate(false);
			},
			map06: () => {
				explore = false;
				showHeatmap = true;
				inputValue = '542264';
				displayedValue = '';
				autoZoom = true;
				flyToFilteredPoints({ zoom: 18, pitch: 45, bearing: 35 });
				showPostalInfo = true;
				showClusterCircles = false;
				showInputOverlay = false;
				setPanRotate(false);
			},
			map07: () => {
				explore = false;
				showHeatmap = false;
				inputValue = '54*264';
				autoZoom = true;
				flyToFilteredPoints({ zoom: 14, pitch: 0, bearing: 0 });
				showPostalInfo = false;
				showClusterCircles = true;
				showInputOverlay = false;
				setPanRotate(false);
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
	$effect(() => {
		if (mapSectionId) {
			runActions(mapSectionId, actions.map);
		}
	});
	function runActions(sectionId: string, actions: Map<string, () => void>) {
		const _mapSectionId: string = 'map0' + (parseInt(sectionId, 10) + 1);
		// console.log('Running action for section:', _mapSectionId);
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

	let textLayers = $state<maplibregl.LayerSpecification[]>([]);
	let hoverArea = $state<Record<string, any> | null>(null);

	$effect.pre(() => {
		if (map && loaded) {
			textLayers = map.getStyle().layers.filter((layer) => layer['source-layer'] === 'place');
		}
	});
	$effect(() => {
		console.log('AutoZoom:', autoZoom);
	});
	let planningAreasCenters = $state(null);
	let error = $state(null);
	let currentZoom = $state(10);
	let inputValue = $state<string | null>(null);
	let filterPostalCodeData = $state<Array | null>([]);
	let previousWorkingPostal = $state<string>(null);

	const BUILDING_ZOOM_START = 15;

	const planningAreasCentersUrl = '/src/assets/singapore_districts_centers.geojson';

	onMount(() => {
		planningAreasStore.load(planningareas);
		fetch(planningAreasCentersUrl)
			.then((res) => res.json())
			.then((data) => (planningAreasCenters = data))
			.catch((err) => (error = err));
		postalWorker = new PostalWorker();

		postalWorker.onmessage = (e) => {
			const { type, data, pattern } = e.data;

			switch (type) {
				case 'LOAD_COMPLETE':
					if (data.success) {
						workerReady = true;
						totalPostalCodes = data.count;
						filterPostalCodeData = data.features;
						filterPostalCodeDataSimplified = data.simplified;

						// get statitics on the simplified array [[lng, lat], weigfht] like min and max of the weight and distribution
						const weights = filterPostalCodeDataSimplified.map((f) => f[1]);
						const minWeight = Math.min(...weights);
						const maxWeight = Math.max(...weights);
						const distribution = weights.reduce((acc, weight) => {
							acc[weight] = (acc[weight] || 0) + 1;
							return acc;
						}, {});
						console.log(
							`Loaded ${data.count} postal codes with simplified data. Min weight: ${minWeight}, Max weight: ${maxWeight}` +
								`, Distribution: ${JSON.stringify(distribution)}`
						);

						// console.log(`Loaded ${data.count} postal codes in worker`);
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
						// get statitics on the simplified array [[lng, lat], weigfht] like min and max of the weight and distribution
						const weights = filterPostalCodeDataSimplified.map((f) => f[1]);
						const minWeight = Math.min(...weights);
						const maxWeight = Math.max(...weights);
						const distribution = weights.reduce((acc, weight) => {
							acc[weight] = (acc[weight] || 0) + 1;
							return acc;
						}, {});
						console.log(
							`Loaded ${data.count} postal codes with simplified data. Min weight: ${minWeight}, Max weight: ${maxWeight}` +
								`, Distribution: ${JSON.stringify(distribution)}`
						);

						// console.log(
						// 	`Filtered postal codes with pattern "${data.pattern}":`,
						// 	filterPostalCodeData.count
						// );

						totalPostalCodes = data.count;
						currentBounds = data.bounds;
						if ((totalPostalCodes ? totalPostalCodes > 0 : false) && !autoZoom) {
							fitBounds(currentBounds, getZoomLevel(Number(displayedValue)));
							// console.log(filterPostalCodeData);
							previousWorkingPostal = filterPostalCodeData.features[0].properties.POSTAL;

							if (data.features.length < 6 && displayedValue.length > 4) {
								flyToFilteredPoints({ zoom: 18, pitch: 25, bearing: 35, center: true });
								showHeatmap = false;
							} else {
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

		// Load data into worker
		postalWorker.postMessage({
			type: 'LOAD_DATA',
			data: { url: postalcodes }
		});

		// Cleanup
		return () => {
			postalWorker?.terminate();
		};
	});

	// Update data from stores
	// $effect(() => {
	// 	planningAreasData = $planningAreasStore.data;
	// });

	// Functions for map component
	function fitBounds(bounds, maxZoom = 18, pitch = 0, bearing = 0) {
		if (map) {
			map.fitBounds(bounds, {
				padding: 50,
				maxZoom: maxZoom,
				duration: 5000,
				pitch: pitch,
				bearing: bearing
			});
		}
	}
	// Simplify your existing filter effect
	$effect(() => {
		if (!workerReady || !postalWorker) return;

		if (inputValue) {
			console.log(`InputValue changed to: ${inputValue}, sending to worker`);
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
		// Use turf.center to calculate the center of the bounding box of all features
		// const center = turf.center(featureCollection);

		// If we want a more precise centroid, we can use turf.centroid
		const centroid = turf.centroid(featureCollection);

		// Return the center as a GeoJSON Feature
		return centroid;
	}

	function flyToFilteredPoints({ zoom = 18, pitch = 0, bearing = 0, center = false }) {
		// Early return if no data or bounds
		// console.log('Current bounds:', currentBounds);
		if (!filterPostalCodeData?.features?.length || !currentBounds) {
			return;
		}

		if (center) {
			console.log('Centering map on filtered postal codes');
			// Calculate centroid from the filtered features (this is fast)
			const centroid = calculateCentroid(filterPostalCodeData);
			map?.flyTo({
				center: centroid.geometry.coordinates,
				zoom,
				pitch,
				bearing,
				speed: 1
			});
		} else {
			// Use pre-calculated bounds
			fitBounds(currentBounds, zoom, pitch, bearing);
		}
	}

	function handleZoomEnd(event) {
		const {
			detail: { map }
		} = event;
		// console.log('Zoom level changed:', map.getZoom());
		currentZoom = map.getZoom();

		checkZoomAndUpdate();
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

			if (displayedValue.trim().length === 0) {
				resetView();
			}
		}
	}

	function checkZoomAndUpdate() {
		if (map.getZoom() >= BUILDING_ZOOM_START && inputValue && filterPostalCodeData.length < 12) {
			console.log('Zoom level is high enough, updating building colors');
			// updateBuildingColors(filterPostalCodeData);
		}
	}

	let filteredPolygons = $state();

	function updateBuildingColors(data) {
		if (!map || !data) return;
		const features = map.querySourceFeatures('maptiler_planet', {
			sourceLayer: 'building'
		});
		console.log('Number of building features:', features.length);
		// filter out buildings that are not MultiPolygon
		const filteredFeatures = features.filter((feature) => feature.geometry.type === 'MultiPolygon');

		const containingPolygons = [];

		filteredFeatures.forEach((building) => {
			try {
				if (building.geometry.type !== 'MultiPolygon') {
					console.warn('Unexpected geometry type:', building.geometry.type);
					return;
				}

				building.geometry.coordinates.forEach((polygonCoords, polygonIndex) => {
					const polygon = turf.rewind(turf.polygon(polygonCoords));
					const bufferedPolygon = turf.buffer(polygon, 0.5, { units: 'meters' });
					const containingPoint = data.find((pointFeature) => {
						if (pointFeature.geometry.type !== 'Point') {
							console.warn(
								'Unexpected geometry type in filterPostalCodeData:',
								pointFeature.geometry.type
							);
							return false;
						}
						const point = turf.point(pointFeature.geometry.coordinates);
						return turf.booleanPointInPolygon(point, bufferedPolygon);
					});

					if (containingPoint) {
						containingPolygons.push({
							type: 'Feature',
							properties: {
								...building.properties,
								...containingPoint.properties,
								original_id: building.id,
								polygon_index: polygonIndex,
								render_height: building.properties.render_height || 30
							},
							geometry: bufferedPolygon.geometry
						});
					}
				});
			} catch (error) {
				console.error('Error processing building:', error, building);
			}
		});

		// console.log('Number of polygons containing points:', containingPolygons.length);
		filteredPolygons = {
			type: 'FeatureCollection',
			features: containingPolygons
		};
		if (map.getSource('containing-polygons')) {
			// If it exists, update the data
			map.getSource('containing-polygons').setData(filteredPolygons);
		} else {
			// If it doesn't exist, add the new source
			map.addSource('containing-polygons', {
				type: 'geojson',
				data: filteredPolygons
			});
			map.addLayer({
				id: 'building-extrusions-base',
				type: 'fill-extrusion',
				source: 'maptiler_planet',
				'source-layer': 'building',
				paint: {
					'fill-extrusion-color': '#aaa',
					'fill-extrusion-height': ['get', 'render_height'],
					'fill-extrusion-base': ['get', 'render_min_height'],
					'fill-extrusion-opacity': 0
				}
			});
			console.log('Adding new source and layers for containing polygons');
			console.log('Filtered polygons:', filteredPolygons);
			// Add the extrusion layer
			map.addLayer({
				id: 'building-extrusions',
				type: 'fill-extrusion',
				source: 'containing-polygons',
				paint: {
					'fill-extrusion-color': '#ff0000',
					'fill-extrusion-height': [
						'+',
						['get', 'render_height'],
						['*', ['get', 'polygon_index'], 0.05]
					],
					'fill-extrusion-base': ['get', 'render_min_height'],
					'fill-extrusion-opacity': 0.7
				}
			});
			map.addLayer({
				id: 'building-labels',
				type: 'symbol',
				source: 'containing-polygons',
				minzoom: 16, // Only show labels from zoom level 14 and above
				paint: {
					'text-color': '#000',
					'text-halo-color': '#fff',
					'text-halo-width': 2,
					'text-opacity': 1
				},
				layout: {
					'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
					'text-field': ['get', 'ADDRESS'],
					'text-size': ['interpolate', ['linear'], ['zoom'], 16, 10, 18, 14, 20, 16],
					'text-anchor': 'bottom',
					// 'text-offset': [0, 10],
					'text-justify': 'left',
					'text-allow-overlap': false,
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
				}
			});
		}
		// Update filteredPolygons to include SVG data
	}

	// END EXTRACT
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
	<p class="text-muted text-small">01 September 2024 // bearylogical</p>
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
						style={streetsStyle}
						center={[103.8198, 1.3221]}
						bind:zoom={currentZoom}
						interactive={false}
						antialias={true}
						class="sticky aspect-[9/16] max-h-screen w-full sm:aspect-video sm:max-h-full"
						on:zoomend={handleZoomEnd}
						onzoom={() => {
							const zoomdist = map.getZoom();
							// map.setPaintProperty(
							// 	'building-extrusions',
							// 	'fill-extrusion-opacity',
							// 	Math.min(1, Math.max(0, (zoomdist - BUILDING_ZOOM_START) / 2))
							// ); // Fade in between zoom 14-16
						}}
						filterLayers={(l) => {
							// Hide the built-in 3D building layer since we're doing our own.
							return l.id !== 'building-3d';
						}}
					>
						{#if explore}
							<NavigationControl position={controlPosition} visualizePitch />
						{/if}
						{#if showDistricts}
							<GeoJSONSource id="planning-areas" data={planningareas} promoteId="name">
								{#if showFill}
									<FillLayer
										paint={{
											'fill-color': fillColor,
											'fill-opacity': 0.5
										}}
									></FillLayer>
								{/if}
								{#if showBorder}
									<LineLayer
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
						{#if showHeatmap}
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
										getWeight: (d) => d[1],
										intensity: 3,
										radiusPixels: 3,
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
							<!-- <GeoJSONSource
								id="postal-codes"
								data={filterPostalCodeData && filterPostalCodeData.features?.length > 0
									? { type: 'FeatureCollection', features: filterPostalCodeData.features }
									: { type: 'FeatureCollection', features: [] }}
								cluster={false}
								clusterRadius={3}
								clusterMaxZoom={22}
							>
								<HeatmapLayer
									source="postal-codes"
									maxzoom={BUILDING_ZOOM_START}
									paint={{
										'heatmap-weight': 1,
										'heatmap-intensity': 1,
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
										'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 9, 5, 19, 20],
										// Transition from heatmap to circle layer by zoom level
										'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 10, 1, 22, 0]
									}}
								/> -->

							<!-- {#if showPostalInfo}
								<SymbolLayer applyToClusters={false} source="postal-codes" filter={filterPostalCode}
								></SymbolLayer>
							{/if} -->
							<!-- </GeoJSONSource> -->
						{/if}

						<!-- <GeoJSONSource
							id="postal-codes-clusters"
							data={filterPostalCodeData}
							cluster={showClusterCircles}
							clusterMaxZoom={showClusterCircles ? BUILDING_ZOOM_START : undefined}
							clusterRadius={showClusterCircles ? 6 : undefined}
						>
							{#if showClusterCircles}
								<CircleLayer
									id="clusters"
									paint={{
										'circle-color': '#1c9099',
										'circle-radius': 12,
										'circle-opacity': 0.8,
										'circle-stroke-color': '#636363',
										'circle-stroke-width': 3,
										'circle-stroke-opacity': hoverStateFilter(0, 1)
									}}
								>
									<!-- <Popup open={true} let:data anchor="top">
									{@const props = data?.properties}
									{#if props}
										<div class="popup-content">
											<strong>Address:</strong> <span class="address-text">{props.ADDRESS}</span>
											<br />
											<strong>Streetname:</strong>
											<span class="address-text">{props.ROAD_NAME}</span>
										</div>
									{/if}
								</Popup> 
								</CircleLayer>

								<SymbolLayer
									filter={filterPostalCodeData}
									source="postal-codes-clusters"
									id="cluster_labels"
									interactive={false}
									applyToClusters={false}
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
							{#if showClusterCounts}
								<SymbolLayer
									filter={filterPostalCodeData}
									source="postal-codes-clusters"
									id="cluster_labels"
									interactive={false}
									applyToClusters
									layout={{
										'text-field': [
											'format',
											'Count: ',
											{ 'font-scale': 0.8 },
											['get', 'point_count_abbreviated'],
											{ 'font-scale': 1.2 }
										],
										'text-size': [
											'interpolate',
											['linear'],
											['zoom'],
											8,
											['interpolate', ['linear'], ['get', 'point_count'], 0, 14, 100, 28],
											13,
											['interpolate', ['linear'], ['get', 'point_count'], 0, 12, 100, 24]
										],
										'text-offset': [0, 0.1],
										'text-allow-overlap': true,
										'text-ignore-placement': false
									}}
									paint={{
										'text-color': ['step', ['get', 'point_count'], '#000000', 50, '#ffffff'],
										'text-halo-color': ['step', ['get', 'point_count'], '#ffffff', 50, '#000000'],
										'text-halo-width': ['interpolate', ['linear'], ['zoom'], 8, 2, 13, 1],
										'text-opacity': ['interpolate', ['linear'], ['zoom'], 8, 1, 13, 0.9]
									}}
								/>
							{/if}
						</GeoJSONSource> -->
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

	svelte-scroller-background-container {
		pointer-events: all !important;
		position: relative;
		z-index: 2; /* Above regular content but below header */
	}

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
