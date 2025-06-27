<script lang="ts">
	import {
		MapLibre,
		GeoJSON,
		FillLayer,
		LineLayer,
		hoverStateFilter,
		CircleLayer,
		SymbolLayer,
		zoomTransition,
		HeatmapLayer
	} from 'svelte-maplibre';
	import type { FeatureCollection, Feature, Point } from 'geojson';
	import * as turf from '@turf/turf';
	import Section from '$lib/layout/Section.svelte';
	import Scroller from '$lib/layout/Scroller.svelte';
	import { contrastingColor } from '$lib/colors.js';
	import { onMount } from 'svelte';
	import { derived } from 'svelte/store';
	import { planningAreasStore, postalCodesStore } from '$lib/stores';
	import { streetsStyle } from '$lib/styles';
	import Em from '$lib/ui/Em.svelte';
	import { fade } from 'svelte/transition';
	import Counter from '$lib/ui/Counter.svelte';

	let planningAreasData;
	let postalCodesData;
	let planningAreasError;
	let postalCodesError;

	const planningareas = 'https://data.bearylogical.net/singapore_districts.geojson';
	const postalcodes = 'https://data.bearylogical.net/singpostcode.geojson';
	//states

	let showBorder = true;
	let showFill = true;
	let showClusterCircles = false;
	let showClusterCounts = false;
	let showPostalInfo = false;
	let fillColor = '#006000';
	let borderColor = '#003300';
	let debugMode: boolean;
	let explore = false; // map interactivity on/off
	let showHeatmap = false;
	let showDistricts = false;

	// Variables to hold visible section IDs of Scroller components
	let mapSectionId: string | null = null;

	// CONFIG FOR SCROLLER COMPONENTS
	// Config
	const threshold = 0.8;

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
				resetView();
				showInputOverlay = false;
				setPanRotate(false);
			},
			map02: () => {
				explore = false;
				showHeatmap = false;
				showDistricts = true;
				resetView();
				showPostalInfo = false;
				showClusterCircles = false;
				showInputOverlay = false;
				setPanRotate(false);
			},
			map03: () => {
				explore = false;
				showHeatmap = true;
				showDistricts = false;
				inputValue = '';
				flyToFilteredPoints({ zoom: 11, center: false });
				showPostalInfo = false;
				setPanRotate(false);
				showInputOverlay = false;
			},
			map04: () => {
				explore = false;
				showHeatmap = true;
				inputValue = '54*';
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
	function runActions(sectionId, actions) {
		if (actions[sectionId]) actions[sectionId]();
	}
	$: mapSectionId && runActions(mapSectionId, actions.map);

	// START EXTRACT
	let map: maplibregl.Map | undefined;
	let loaded: boolean;
	let touched = false;
	let showInputOverlay = false;
	let progressValue: number = 0;

	let textLayers: maplibregl.LayerSpecification[] = [];
	let hoverArea: Record<string, any> | null = null;
	$: if (map && loaded) {
		textLayers = map.getStyle().layers.filter((layer) => layer['source-layer'] === 'place');
	}
	let planningAreasCenters = null;
	let error = null;
	let currentZoom = 10;
	let inputValue: string | null = null;
	let filterPostalCodeData: Array | null = null;
	let previousWorkingPostal: string = null;

	const BUILDING_ZOOM_START = 15;
	onMount(() => {
		planningAreasStore.load(planningareas);
		planningAreasData = derived(
			planningAreasStore,
			($planningAreasStore) => $planningAreasStore.data
		);
		postalCodesStore.load(postalcodes);
		postalCodesData = derived(postalCodesStore, ($postalCodesStore) => $postalCodesStore.data);
	});

	function calculateCenters(g: FeatureCollection): FeatureCollection {
		const groupedFeatures: { [key: string]: Feature[] } = {};

		g.features.forEach((feature) => {
			const district = feature.properties?.districtNumber;
			if (district) {
				if (!groupedFeatures[district]) {
					groupedFeatures[district] = [];
				}
				groupedFeatures[district].push(feature);
			}
		});

		// Calculate centroid for each district and merge properties
		const centroids: Feature<Point>[] = Object.entries(groupedFeatures).map(
			([district, features]) => {
				const combined = turf.combine(turf.featureCollection(features));
				const centroid = turf.centroid(combined);

				// Merge properties from all features in the district
				const mergedProperties = features.reduce(
					(acc, feature) => {
						Object.entries(feature.properties || {}).forEach(([key, value]) => {
							// Only update if the current value is null/undefined or if it's not set yet
							if (value != null && (acc[key] == null || acc[key] === '')) {
								acc[key] = value;
							}
						});
						return acc;
					},
					{} as { [key: string]: any }
				);

				// Ensure the district property is set
				mergedProperties.district = district;

				// Create a new Feature with Point geometry and merged properties
				return {
					type: 'Feature',
					properties: mergedProperties,
					geometry: centroid.geometry
				};
			}
		);

		// Return a FeatureCollection
		return {
			type: 'FeatureCollection',
			features: centroids
		};
	}

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

	$: filterPostalCodeData = inputValue ? postalCodeDataFilter(inputValue) : [];

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
		if (filterPostalCodeData.length > 0) {
			const bounds = calculateBounds(filterPostalCodeData);
			if (bounds) {
				fitBounds(bounds, zoom, pitch, bearing);
			}
			if (center) {
				const centers = calculateCentroid(filterPostalCodeData);
				map?.flyTo({ center: centers.geometry.coordinates, zoom, pitch, bearing });
			}
		}
	}

	$: colors = contrastingColor(fillColor);
	$: if (map && loaded) {
		for (let layer of textLayers) {
			map.setPaintProperty(layer.id, 'text-color', colors.textColor);
			map.setPaintProperty(layer.id, 'text-halo-color', colors.textOutlineColor);
		}
	}

	let filterPlanningAreas = false;
	// $: filter = filterPlanningAreas ? ['==', 'T', ['slice', ['get', 'Attributes'], 0, 1]] : undefined;
	function createPostalFilter(pattern) {
		if (pattern.includes('*')) {
			const parts = pattern.split('*');
			const conditions = parts
				.map((part, index) => {
					if (part === '') return null;
					if (index === 0) {
						return ['==', ['slice', ['get', 'POSTAL'], 0, ['length', part]], part];
					} else if (index === parts.length - 1) {
						return [
							'==',
							['slice', ['get', 'POSTAL'], ['-', ['length', ['get', 'POSTAL']], ['length', part]]],
							part
						];
					} else {
						return ['in', part, ['get', 'POSTAL']];
					}
				})
				.filter((c) => c !== null);
			return ['all', ...conditions];
		}
		// Parse the pattern
		const prefix = pattern.split('[')[0];
		const suffix = pattern.split(']')[1];
		const range = pattern.match(/\[(\d)-(\d)\]/);

		if (!range) {
			// If there's no range, use a simple equality check
			return ['==', ['get', 'POSTAL'], pattern];
		}

		const start = parseInt(range[1]);
		const end = parseInt(range[2]);

		// Create conditions for each number in the range
		const rangeConditions = [];
		for (let i = start; i <= end; i++) {
			rangeConditions.push(['==', ['get', 'POSTAL'], `${prefix}${i}${suffix}`]);
		}

		return ['any', ...rangeConditions];
	}

	function vanillaPostalCodeFilter(pattern) {
		if (pattern.includes('*')) {
			const parts = pattern.split('*');
			return (feature) => {
				const postal = feature.properties.POSTAL;
				return parts.every((part, index) => {
					if (part === '') return true;
					if (index === 0) return postal.startsWith(part);
					if (index === parts.length - 1) return postal.endsWith(part);
					return postal.includes(part);
				});
			};
		}

		// Parse the pattern
		const prefix = pattern.split('[')[0];
		const suffix = pattern.split(']')[1] || '';
		const range = pattern.match(/\[(\d)-(\d)\]/);

		if (!range) {
			// If there's no range, use a simple equality check
			return (feature) => feature.properties.POSTAL === pattern;
		}

		const start = parseInt(range[1]);
		const end = parseInt(range[2]);

		// Create a function to check if the postal code is in the range
		return (feature) => {
			const postal = feature.properties.POSTAL;
			for (let i = start; i <= end; i++) {
				if (postal === `${prefix}${i}${suffix}`) {
					return true;
				}
			}
			return false;
		};
	}

	function handleZoomEnd(event) {
		const {
			detail: { map }
		} = event;
		currentZoom = map.getZoom();
		checkZoomAndUpdate();
	}

	$: filterPostalCode = inputValue ? createPostalFilter(inputValue) : null;

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

	const debouncedHandleInput = debounce(handleInput, 500); // 300ms delay

	function postalCodeDataFilter(val) {
		const wildcardFilter = vanillaPostalCodeFilter(val);
		const res = $postalCodesStore.data.features?.filter(wildcardFilter);
		return res;
	}

	let validInput = false;
	$: validInput = /^\d{0,6}$/.test(displayedValue);
	$: showError = touched && !validInput;

	let displayedValue = '';

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
		const input = event.target;
		const newValue = input.value;

		if (validInput) {
			// displayedValue = shownVal;
			inputValue = displayedValue + '*';
			const numCodes = postalCodeDataFilter(inputValue);

			if (displayedValue.trim().length === 0) {
				resetView();
			} else {
				if (numCodes.length > 0) {
					previousWorkingPostal = numCodes[0].properties.POSTAL;
					if (numCodes.length < 6 && displayedValue.length > 4) {
						flyToFilteredPoints({ zoom: 18, pitch: 25, bearing: 35, center: true });
						showHeatmap = false;
					} else {
						showHeatmap = true;
						setTimeout(
							flyToFilteredPoints({ zoom: getZoomLevel(Number(displayedValue)), center: false }),
							200
						);
					}
				}
			}
		}
	}

	function checkZoomAndUpdate() {
		if (map.getZoom() >= BUILDING_ZOOM_START && inputValue && filterPostalCodeData.length < 12) {
			updateBuildingColors(filterPostalCodeData);
		}
	}

	let filteredPolygons;

	function updateBuildingColors(data) {
		if (!map || !data) return;
		const features = map.querySourceFeatures('maptiler_planet', {
			sourceLayer: 'building'
		});
		// console.log('Number of buildings to process:', features.length);

		const containingPolygons = [];

		features.forEach((building) => {
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
	$: planningAreasCenters = $planningAreasData ? calculateCenters($planningAreasData) : null;
	// END EXTRACT
</script>

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
			Wikipedia Explanation of <a href="https://en.wikipedia.org/wiki/Postal_codes_in_Singapore"
				>Singapore Postal Code
			</a>system
		</li>
		<li>
			Scroller implmentation adapted from UK's Office of National Statistics <a
				href="https://github.com/ONSvisual/sk-scrolly/tree/main">scrolly template</a
			>
		</li>
	</ol>
</Section>

{#if $postalCodesStore.loading}
	<div class="loading-container">
		<div class="loading-spinner"></div>
		<div class="loading-text">Initializing the story..</div>
	</div>
{:else if $postalCodesStore.error}
	<p>Error: {$postalCodesStore.error}</p>
	<!-- <button on:click={loadData}>Try Again</button> -->
{:else if $postalCodesStore.data}
	<Scroller {threshold} bottom={0.95} bind:id={mapSectionId} bind:progress={progressValue}>
		<div slot="background">
			<div class="col-full height-full">
				<MapLibre
					bind:map
					bind:loaded
					style={streetsStyle}
					standardControls={explore}
					center={[103.8198, 1.3221]}
					zoom={currentZoom}
					interactive={explore}
					antialias={true}
					zoomOnDoubleClick={false}
					on:zoomend={handleZoomEnd}
					on:zoom={() => {
						const zoomdist = map.getZoom();
						map.setPaintProperty(
							'building-extrusions',
							'fill-extrusion-opacity',
							Math.min(1, Math.max(0, (zoomdist - BUILDING_ZOOM_START) / 2))
						); // Fade in between zoom 14-16
					}}
					filterLayers={(l) => {
						// Hide the built-in 3D building layer since we're doing our own.
						return l.id !== 'building-3d';
					}}
				>
					{#if showDistricts}
						<GeoJSON id="planning-areas" data={planningareas} promoteId="name">
							{#if showFill}
								<FillLayer
									paint={{
										'fill-color': hoverStateFilter(fillColor, colors.hoverBgColor),
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
							<GeoJSON id="planning-areas-centers" data={planningAreasCenters} promoteId="district">
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
										'text-size': zoomTransition(6, 10, 15, 18),
										'text-offset': [0, 0]
										// 'text-anchor': 'left'
									}}
								/>
							</GeoJSON>
						</GeoJSON>
					{/if}
					{#if showHeatmap}
						<GeoJSON
							id="postal-codes"
							data={postalcodes}
							cluster={{
								radius: 15,
								maxZoom: 22
							}}
						>
							<HeatmapLayer
								filter={filterPostalCode}
								source="postal-codes"
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
									'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 9, 3, 19, 15],
									// Transition from heatmap to circle layer by zoom level
									'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 10, 1, 22, 0]
								}}
							/>

							<!-- {#if showPostalInfo}
								<SymbolLayer applyToClusters={false} source="postal-codes" filter={filterPostalCode}
								></SymbolLayer>
							{/if} -->
						</GeoJSON>
					{/if}

					<GeoJSON
						id="postal-codes-clusters"
						data={postalcodes}
						cluster={{
							radius: 500,
							maxZoom: 10
						}}
					>
						{#if showClusterCircles}
							<CircleLayer
								id="clusters"
								applyToClusters={false}
								filter={filterPostalCode}
								manageHoverState={true}
								source="postal-codes-clusters"
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
								</Popup> -->
							</CircleLayer>

							<SymbolLayer
								filter={filterPostalCode}
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
								filter={filterPostalCode}
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
					</GeoJSON>
				</MapLibre>
				{#if showInputOverlay && progressValue > 0.95}
					<div class="map-overlay top" transition:fade={{ delay: 250, duration: 300 }}>
						<div class="map-overlay-inner">
							<h3 class="text-big" style="margin-bottom: 15px;">Postal Code Explorer</h3>
							<input
								type="text"
								placeholder="Enter a 6 digit postal code"
								bind:value={displayedValue}
								on:input={debouncedHandleInput}
							/>

							{#if showError}
								<p class=" error">Please enter only digits.</p>
							{:else if displayedValue.length > 6}
								<p class=" error">Postal codes have only 6 digits.</p>
							{:else if filterPostalCodeData.length === 0}
								<p class=" error">
									Can't find that postal code, try removing entries or try {previousWorkingPostal}
								</p>
							{/if}

							<p style="margin-top: 5px">
								<Em color="#206095">{filterPostalCodeData.length}</Em> Postal Codes are currently shown.
							</p>
						</div>
					</div>
				{/if}
			</div>
		</div>

		<div slot="foreground">
			<section data-id="map01"></section>
			<section data-id="map02">
				<div class="col-medium">
					<p>
						Beginning in the 1950s, Singapore was originally split into <Em color="#206095">28</Em> Postal
						Districts.
					</p>
				</div>
			</section>
			<section data-id="map03">
				<div class="col-medium">
					<p>
						Fast forward to September 1995, the postal code uses a <Em color="#206095">6</Em> digit system
						which divides Singapore into 80 postal sectors.
					</p>
					<p>
						<Em color="#206095">{$postalCodesStore.data.features.length}</Em> postal codes are displayed
						on this map to illustrate its distribution.
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
						Within the same postal sector, postal codes are given out based on street names, from A
						to Z. In each area:
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
	</Scroller>
{/if}

<!-- </div> -->
<!-- 
<Section>
	<h2>This is a dynamic map section</h2>
	<p class="text-xs">
		The map below will respond to the captions as you scroll down. The scroller is not set to
		splitscreen, so captions are placed over the map on any screen size.
	</p>
</Section> -->
<style>
	/* Styles specific to elements within the demo */
	:global(svelte-scroller-foreground) {
		pointer-events: none !important;
	}
	:global(svelte-scroller-foreground section div) {
		pointer-events: all !important;
	}
	select {
		max-width: 350px;
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

	.popup-content {
		max-width: 200px; /* Adjust this value as needed */
		word-wrap: break-word;
		white-space: normal;
		font-family: 'Open Sans', 'Helvetica Neue', 'Arial', sans-serif;
		font-size: 12px;
	}

	.address-text {
		font-weight: 500;
		color: #1f2937; /* This is equivalent to Tailwind's text-gray-800 */
	}

	.property-value {
		display: inline-block;
		max-width: 200px;
		word-wrap: break-word;
		overflow-wrap: break-word;
		hyphens: auto;
		vertical-align: top;
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
