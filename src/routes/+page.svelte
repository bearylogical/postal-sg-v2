<script lang="ts">
	import {
		MapLibre,
		GeoJSON,
		FillLayer,
		LineLayer,
		hoverStateFilter,
		isTextLayer,
		CircleLayer,
		SymbolLayer,
		zoomTransition,
		FillExtrusionLayer,
		HeatmapLayer,
		ZoomRange,
		Popup
	} from 'svelte-maplibre';
	import type { FeatureCollection, Feature, Point } from 'geojson';
	import * as turf from '@turf/turf';
	import { geoCentroid } from 'd3-geo';
	import Section from '$lib/layout/Section.svelte';
	import Scroller from '$lib/layout/Scroller.svelte';
	import planningareas from '../assets/singapore_districts.geojson?url';
	import { contrastingColor } from '$lib/colors.js';
	import { onMount } from 'svelte';
	import { derived } from 'svelte/store';
	import postalcodes from '../assets/singpostcode.geojson?url';
	import { planningAreasStore, postalCodesStore } from '$lib/stores';
	import { streetsStyle } from '$lib/styles';
	import Em from '$lib/ui/Em.svelte';
	import { fade } from 'svelte/transition';

	let planningAreasData;
	let postalCodesData;
	let planningAreasError;
	let postalCodesError;

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
	let mapSectionId;

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
				showDistricts = true;
				showPostalInfo = false;
				showClusterCircles = false;
				resetView();
				showInputOverlay = false;
			},
			map02: () => {
				explore = false;
				showHeatmap = false;
				showDistricts = true;
				resetView();
				showPostalInfo = false;
				showClusterCircles = false;
				showInputOverlay = false;
			},
			map03: () => {
				explore = false;
				showHeatmap = true;
				showDistricts = false;
				inputValue = '';
				flyToFilteredPoints(11);
				showPostalInfo = false;
				showInputOverlay = false;
			},
			map04: () => {
				explore = false;
				showHeatmap = true;
				inputValue = '54*';
				flyToFilteredPoints(14);
				showPostalInfo = false;
				showClusterCircles = false;
				showInputOverlay = false;
			},
			map05: () => {
				explore = false;
				showHeatmap = true;
				inputValue = '54[1-4]264';
				flyToFilteredPoints(18, 30, 60);
				showPostalInfo = true;
				showClusterCircles = false;
				showInputOverlay = false;
			},
			map06: () => {
				explore = false;
				showHeatmap = true;
				inputValue = '542264';
				flyToFilteredPoints(18, 45, 35);
				showPostalInfo = true;
				showClusterCircles = false;
				showInputOverlay = false;
			},
			map07: () => {
				explore = false;
				showHeatmap = false;
				inputValue = '54*264';
				flyToFilteredPoints(14, 0, 0);
				showPostalInfo = false;
				showClusterCircles = true;
				showInputOverlay = false;
			},
			map08: () => {
				explore = false;
				showHeatmap = true;
				inputValue = '*';
				resetView();
				showPostalInfo = false;
				showClusterCircles = false;
				showInputOverlay = true;
			}
		}
	};

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
	let progressValue;

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

	const BUILDING_ZOOM_START = 15;
	onMount(() => {
		planningAreasStore.load(planningareas);
		postalCodesStore.load(postalcodes);
		postalCodesData = derived(postalCodesStore, ($postalCodesStore) => $postalCodesStore.data);
	});

	function calculateCenters(g: FeatureCollection): FeatureCollection {
		let centers: Feature<Point>[] = g.features.map((f) => {
			return {
				...f,
				geometry: {
					type: 'Point',
					coordinates: geoCentroid(f)
				}
			};
		});
		return {
			type: 'FeatureCollection',
			features: centers
		};
	}

	// Functions for map component
	function fitBounds(bounds, maxZoom = 18, pitch = 0, bearing = 0) {
		if (map) {
			map.fitBounds(bounds, {
				padding: 50,
				maxZoom: maxZoom,
				duration: 3000,
				pitch: pitch,
				bearing: bearing
			});
		}
	}
	function fitById(id) {
		if (filterPostalCodeData && id) {
			let feature = filterPostalCodeData.features.find((d) => d.properties.AREACD == id);
			let bounds = bbox(feature.geometry);
			fitBounds(bounds);
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

	function flyToFilteredPoints(maxzoom = 18, pitch = 0, bearing = 0) {
		if (filterPostalCodeData) {
			const bounds = calculateBounds(filterPostalCodeData);
			if (bounds) {
				fitBounds(bounds, maxzoom, pitch, bearing);
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
	// $: filterPostalCode = inputValue
	// 	? [
	// 			'any',
	// 			['==', ['slice', ['to-string', ['get', 'POSTAL']], 0, ['length', inputValue]], inputValue],
	// 			[
	// 				'match',
	// 				['to-string', ['get', 'POSTAL']],
	// 				inputValue.split('*').map(escapeRegExp).join('.*'),
	// 				true,
	// 				false
	// 			]
	// 		]
	// 	: undefined;

	$: if (map && loaded && postalCodesData) {
		if (inputValue || touched) {
			// console.log('filtering is active');
			const wildcardFilter = vanillaPostalCodeFilter(inputValue);
			filterPostalCodeData = $postalCodesStore.data.features?.filter(wildcardFilter);
		} else {
			filterPostalCodeData = postalCodesData.features;
		}
	}
	let validInput = false;
	$: validInput = /^\d{0,6}$/.test(displayedValue);
	$: showError = touched && !validInput;

	let displayedValue = '';

	function resetView() {
		map?.flyTo({ center: [103.8198, 1.3221], zoom: 10, bearing: 0, pitch: 0 });
	}
	$: if (displayedValue && validInput) {
		handleInput(null);
	}

	function handleInput(event) {
		const shownVal = event?.target.value;
		if (event) {
			touched = true;
		}
		inputValue = displayedValue + '*';
		// console.log(typeof displayedValue);
		if (!validInput && touched) {
			displayedValue; // Update the input field
			// displayedValue = shownVal;
		}

		if (displayedValue.trim().length === 0) {
			resetView();
			// console.log(filterPostalCodeData.length);
		} else {
			if ((map && filterPostalCodeData.length > 0) || filterPostalCodeData.length === 1) {
				if (displayedValue.length === 6) {
					flyToFilteredPoints(18, 25, 35);
					showHeatmap = false;
				} else {
					setTimeout(flyToFilteredPoints(), 0);
				}
			}
		}
	}

	function checkZoomAndUpdate() {
		if (map.getZoom() >= BUILDING_ZOOM_START && filterPostalCodeData) {
			updateBuildingColors();
		}
	}

	let filteredPolygons;

	function updateBuildingColors() {
		if (!map || !filterPostalCodeData) return;

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
					const containingPoint = filterPostalCodeData.find((pointFeature) => {
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

	$: planningAreasCenters = planningAreasData ? calculateCenters(planningAreasData) : null;
	// END EXTRACT

	function formatValue(value) {
		if (typeof value === 'string' && value.length > 50) {
			return value.substring(0, 47) + '...';
		}
		return value;
	}
</script>

<!-- 
<div class="flex flex-col lg:flex-row h-screen p-4 space-y-4 lg:space-y-0 lg:space-x-4"> -->
<!-- <div class="w-full lg:w-1/4 h-1/2 lg:h-auto">
		<div class="bg-white shadow-md rounded px-4 py-4 h-full overflow-y-auto">
			<h2 class="text-xl font-bold">Singapore Postal Code Explorer</h2>
			<p class="text-sm text-gray-600 italic mb-4">
				Explore {postalCodesData?.features.length} Singapore Postal Codes
			</p>

			<p class="text-sm mb-4">
				Since 1995, Postal Codes in Singapore uses a six digit format which is administered by
				Singapore Post.
			</p>
			<div>
				<h3 class="text-lg font-semibold mb-2">Postal Code Filter</h3>
				<input
					type="text"
					class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 text-sm leading-tight focus:outline-none focus:shadow-outline mb-8"
					placeholder="Enter a 6 digit postal code"
					bind:value={inputValue}
					on:input={handleInput}
				/>

				{#if showError}
					<p class="text-red-500 text-xs italic mt-1">Please enter up to 6 digits only.</p>
				{/if}
			</div>
			<label class="flex items-center">
				<input
					type="checkbox"
					bind:checked={debugMode}
					class="form-checkbox h-5 w-5 text-blue-600"
				/>
				<span class="ml-2 text-sm">Enable Dev Mode</span>
			</label>
			{#if debugMode}
				<h2 class="text-xl font-bold mb-4 mt-6">Dev Mode</h2>
				<div class="space-y-4">
					<div>
						<h3 class="text-lg font-semibold mb-2">Filters</h3>
						<label class="flex items-center">
							<input
								type="checkbox"
								bind:checked={filterPlanningAreas}
								class="form-checkbox h-5 w-5 text-blue-600"
							/>
							<span class="ml-2 text-sm">Only show PlanningAreas starting with 'T'</span>
						</label>
					</div>
					<h2 class="text-xl font-bold mb-4">Debug Mode</h2>
					<div>
						<h3 class="text-lg font-semibold mb-2">Map Information</h3>
						<p class="text-sm">Zoom level: <span class="font-bold">{currentZoom}</span></p>
					</div>

					<div>
						<h3 class="text-lg font-semibold mb-2">Layer Information</h3>
						<p class="text-sm">
							Filtered Postal Codes <span class="font-bold">{filterPostalCodeData?.length}</span>
						</p>
					</div>
					<h2 class="text-xl font-bold mb-4">Map Options</h2>
					<div>
						<h3 class="text-lg font-semibold mb-2">Layer Visibility</h3>
						<div class="space-y-2">
							<label class="flex items-center">
								<input
									type="checkbox"
									bind:checked={showFill}
									class="form-checkbox h-5 w-5 text-blue-600"
								/>
								<span class="ml-2">Show fill</span>
							</label>
							<label class="flex items-center">
								<input
									type="checkbox"
									bind:checked={showBorder}
									class="form-checkbox h-5 w-5 text-blue-600"
								/>
								<span class="ml-2">Show border</span>
							</label>
							<label class="flex items-center">
								<input
									type="checkbox"
									bind:checked={showClusterCircles}
									class="form-checkbox h-5 w-5 text-blue-600"
								/>
								<span class="ml-2">Show clusters</span>
							</label>
							<label class="flex items-center">
								<input
									type="checkbox"
									bind:checked={showClusterCounts}
									class="form-checkbox h-5 w-5 text-blue-600"
								/>
								<span class="ml-2">Show cluster counts</span>
							</label>
						</div>
					</div>

					<div>
						<h3 class="text-lg font-semibold mb-2">Color Settings</h3>
						<div class="space-y-2">
							<label class="flex items-center justify-between">
								<span>Fill:</span>
								<input type="color" bind:value={fillColor} class="form-input" />
							</label>
							<label class="flex items-center justify-between">
								<span>Border:</span>
								<input type="color" bind:value={borderColor} class="form-input" />
							</label>
						</div>
					</div>
				</div>
			{/if}
		</div>
	</div> -->

<Section>
	<h2>Topology of Singapore Postal Codes</h2>
	<p class="text-muted text-small">01 September 2024 // bearylogical</p>
	<p class="mb">
		Singapore's postal code system not only aids mail delivery but also offers a unique view of the
		city's layout and organization. It's like a hidden map showing how the island is structured and
		divided.
	</p>
	<p class="mb">
		This small microsite illustrates Singapore's postal code system and is inspired by Ben Fry's
		<a href="https://benfry.com/zipdecode/">zipdecode</a>.
	</p>

	<h3>Acknowledgements</h3>
	<ol>
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
{#if $postalCodesStore.loading}
	<div class="loading-container">
		<div class="loading-spinner"></div>
		<div class="loading-text">Initializing the story..</div>
	</div>
{:else if $postalCodesStore.error}
	<p>Error: {$postalCodesStore.error}</p>
	<!-- <button on:click={loadData}>Try Again</button> -->
{:else if $postalCodesStore.data}
	<Scroller {threshold} bind:id={mapSectionId} bind:progress={progressValue}>
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
									manageHoverState={true}
									on:mousemove={({ detail }) => (hoverArea = detail.features[0].properties.name)}
								></FillLayer>
							{/if}
							{#if showBorder}
								<LineLayer
									layout={{ 'line-cap': 'round', 'line-join': 'round' }}
									paint={{ 'line-color': borderColor, 'line-width': 0.7 }}
								/>
							{/if}
						</GeoJSON>
					{/if}

					<!-- extrude specific polygons -->

					<!-- <FillExtrusionLayer
						id="building-extrusions"
						source="containing-polygons"
						minzoom={14}
						paint={{
							'fill-extrusion-color': '#ff0000',
							'fill-extrusion-height': [
								'interpolate',
								['linear'],
								['zoom'],
								14,
								0,
								14.05,
								['get', 'render_height']
							],
							'fill-extrusion-base': [
								'interpolate',
								['linear'],
								['zoom'],
								14,
								0,
								14.05,
								['get', 'render_min_height']
							],
							'fill-extrusion-opacity': 0.6
						}}
					/> -->

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

						<GeoJSON id="planning-areas-centers" data={planningAreasCenters} promoteId="name">
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
									'text-field': ['get', 'name'],
									'text-size': zoomTransition(6, 10, 15, 18),
									'text-offset': [0, 1.5],
									'text-anchor': 'top'
								}}
							/>
							<!-- <SymbolLayer
								paint={{
									'text-color': 'transparent',
									'text-halo-color': 'rgba(255, 255, 255, 0.75)',
									'text-halo-width': 2
								}}
								layout={{
									'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
									'text-allow-overlap': false,
									'text-field': ['get', 'name'],
									'text-size': zoomTransition(6, 10, 15, 18),
									'text-offset': [0, 1.5],
									'text-anchor': 'top'
								}}
							/> -->
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
				{#if showInputOverlay && progressValue > 0.9999}
					<div class="map-overlay top" transition:fade={{ delay: 250, duration: 300 }}>
						<div class="map-overlay-inner">
							<h3 class="text-big" style="margin-bottom: 30px;">Postal Code Explorer</h3>
							<input
								type="text"
								placeholder="Enter a 6 digit postal code"
								bind:value={displayedValue}
								on:input={handleInput}
							/>

							{#if showError}
								<p class=" error">Please enter only digits.</p>
							{:else if displayedValue.length > 6}
								<p class=" error">Postal codes have only 6 digits.</p>
							{:else if filterPostalCodeData.length === 0}
								<p class=" error">Can't find that postal code, try removing entries</p>
							{/if}

							<p style="margin-top: 5px">
								<Em>{filterPostalCodeData.length}</Em> Postal Codes are shown.
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
						Beginning in the 1950s, Singapore was originally split into <Em>28</Em> Postal Districts.
					</p>
				</div>
			</section>
			<section data-id="map03">
				<div class="col-medium">
					<p>
						Since September 1995, the postal code uses a <Em>6</Em> digit system which divides Singapore
						into 80 postal sectors.
					</p>
					<p>
						<Em>{$postalCodesStore.data.features.length}</Em> postal codes are displayed on this map
						to illustrate its distribution.
					</p>
				</div>
			</section>
			<section data-id="map04">
				<div class="col-medium">
					<p>The 6 digit postal code system works as follows:</p>
					<h2><Em>54</Em><span color="grey">2264</span></h2>
					<p>The first two digits of each postal code denote a postal sector.</p>
				</div>
			</section>
			<section data-id="map05">
				<div class="col-medium">
					<h2>542<Em>264</Em></h2>
					<p>
						The last 3 digits are used to indicate residential properties in an apartment block.
					</p>
				</div>
			</section>
			<section data-id="map06">
				<div class="col-medium">
					<h2>
						54<Em>2</Em>264
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
						54<Em>&ltdigit&gt;</Em>264
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
				<div class="col-medium">
					<h2>Try it yourself</h2>
					<p>Enter a postal code to explore the map.</p>
				</div>
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

	.fill-overlay {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-size: 50px 50px;
		animation: 6s;
		pointer-events: none;
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
	table {
		border-collapse: collapse;
		width: 100%;
	}
	th,
	td {
		border: 1px solid #ddd;
		padding: 8px;
		text-align: left;
		font-size: 12px;
	}
	th {
		background-color: #f2f2f2;
	}
	ul {
		margin: 0;
		padding-left: 20px;
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
		font: 12px/20px;
		position: absolute;
		width: 400px;
		top: 5%;
		left: 50px;
		padding: 10px;
	}

	.map-overlay .map-overlay-inner {
		background-color: #fff;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
		border-radius: 3px;
		padding: 10px;
		margin-bottom: 10px;
	}

	.map-overlay-inner h3 {
		padding: 0px;
		margin-bottom: 10px;
		margin-top: 10px;
	}
	.error {
		color: red;
		font-size: smaller;
		font-style: italic;
		margin-top: 5px;
	}
</style>
