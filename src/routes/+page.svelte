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
		HeatmapLayer,
		ZoomRange,
		Popup
	} from 'svelte-maplibre';
	import type { ExpressionSpecification } from 'svelte-maplibre';
	import type { FeatureCollection, Feature, Point } from 'geojson';
	import { geoCentroid } from 'd3-geo';
	import { mapClasses } from '$lib/styles.js';
	import planningareas from '../assets/planningareas_processed.geojson?url';
	import { contrastingColor } from '$lib/colors.js';
	import { onMount } from 'svelte';
	import postalcodes from '../assets/singpostcode.geojson?url';
	import { planningAreasStore, postalCodesStore } from '$lib/stores';

	let planningAreasData;
	let postalCodesData;
	let planningAreasError;
	let postalCodesError;

	planningAreasStore.subscribe((value) => (planningAreasData = value));
	postalCodesStore.subscribe((value) => (postalCodesData = value));

	planningAreasStore.error.subscribe((value) => (planningAreasError = value));
	postalCodesStore.error.subscribe((value) => (postalCodesError = value));

	let showBorder = true;
	let showFill = true;
	let showClusterCircles = false;
	let showClusterCounts = false;
	let fillColor = '#006000';
	let borderColor = '#003300';
	let debugMode: boolean;

	// START EXTRACT
	let map: maplibregl.Map | undefined;
	let loaded: boolean;
	let touched = false;

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
	onMount(() => {
		planningAreasStore.load(planningareas);
		postalCodesStore.load(postalcodes);
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

	function flyToFilteredPoints() {
		if (map && filterPostalCodeData && filterPostalCodeData.length > 0) {
			const bounds = calculateBounds(filterPostalCodeData);
			if (bounds) {
				map.fitBounds(bounds, {
					padding: 50,
					maxZoom: 18,
					duration: 3000
				});
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
	$: filterPostalCode = inputValue
		? ['==', inputValue, ['slice', ['to-string', ['get', 'POSTAL']], 0, ['length', inputValue]]]
		: undefined;
	$: if (map && loaded && postalCodesData) {
		if (inputValue) {
			filterPostalCodeData = map.querySourceFeatures('postal-codes', {
				filter: filterPostalCode
			});
		} else {
			filterPostalCodeData = postalCodesData.features;
		}
	}

	$: validInput = /^\d{0,6}$/.test(inputValue);
	$: showError = touched && !validInput;

	function handleInput(event) {
		const newValue = event.target.value.replace(/\D/g, '').slice(0, 6);
		inputValue = newValue;
		touched = true;

		setTimeout(flyToFilteredPoints, 0);
	}
	$: planningAreasCenters = planningAreasData ? calculateCenters(planningAreasData) : null;
	// END EXTRACT
</script>

<div class="flex flex-col lg:flex-row h-screen p-4 space-y-4 lg:space-y-0 lg:space-x-4">
	<div class="w-full lg:w-1/4 h-1/2 lg:h-auto">
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
	</div>

	<div class="w-full lg:w-3/4 h-1/2 lg:h-auto">
		<MapLibre
			bind:map
			bind:loaded
			style="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
			class="h-full w-full rounded"
			standardControls={true}
			center={[103.8198, 1.3221]}
			zoom={currentZoom}
			filterLayers={(l) => !isTextLayer(l, 'carto')}
			on:zoomend={({ detail: { map } }) => (currentZoom = map.getZoom())}
		>
			<GeoJSON id="planning-areas" data={planningareas} promoteId="Attributes">
				{#if showFill}
					<FillLayer
						paint={{
							'fill-color': hoverStateFilter(fillColor, colors.hoverBgColor),
							'fill-opacity': 0.5
						}}
						manageHoverState={true}
						on:mousemove={({ detail }) => (hoverArea = detail.features[0].properties.Attributes)}
					></FillLayer>
				{/if}
				{#if showBorder}
					<LineLayer
						layout={{ 'line-cap': 'round', 'line-join': 'round' }}
						paint={{ 'line-color': borderColor, 'line-width': 0.7 }}
					/>
				{/if}
			</GeoJSON>

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
					maxzoom={21}
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
			</GeoJSON>

			<GeoJSON id="planning-areas-centers" data={planningAreasCenters} promoteId="Attributes">
				<SymbolLayer
					paint={{
						'text-color': '#010'
					}}
					layout={{
						'text-font': ['bold', 'Open Sans Bold', 'Arial Unicode MS Bold'],
						'text-allow-overlap': false,
						'text-field': ['get', 'Attributes'],
						'text-size': zoomTransition(6, 10, 15, 18)
					}}
				></SymbolLayer>
			</GeoJSON>

			<GeoJSON
				id="postal-codes-clusters"
				data={postalcodes}
				cluster={{
					radius: 1500,
					maxZoom: 20
				}}
				>{#if showClusterCircles}
					<CircleLayer
						minzoom={14}
						filter={filterPostalCode}
						source="postal-codes-clusters"
						manageHoverState={true}
						applyToClusters={true}
						paint={{
							'circle-color': [
								'interpolate',
								['linear'],
								['get', 'point_count'],
								0,
								'#edf8fb',
								10,
								'#b2e2e2',
								20,
								'#66c2a4',
								50,
								'#2ca25f',
								1000,
								'#006d2c'
							],
							'circle-radius': ['interpolate', ['linear'], ['get', 'point_count'], 0, 15, 100, 40],
							'circle-opacity': 0.8,
							'circle-stroke-color': '#f00',
							'circle-stroke-width': 1,
							'circle-stroke-opacity': hoverStateFilter(0, 1)
						}}
					/>
				{/if}
				{#if showClusterCounts}
					<SymbolLayer
						minzoom={12}
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
	</div>
</div>

<style>
	.grid {
		grid-template-columns: repeat(auto-fill, 150px);
	}
</style>
