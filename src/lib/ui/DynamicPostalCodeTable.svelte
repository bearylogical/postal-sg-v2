<script>
	export let filterPostalCodeData = [];

	function formatValue(value) {
		if (typeof value === 'string' && value.length > 50) {
			return value.substring(0, 47) + '...';
		}
		return value;
	}

	function getHeaders(data) {
		if (data.length === 0) return [];
		const firstFeature = data[0];
		return [...Object.keys(firstFeature.properties || {}), 'Coordinates'];
	}

	function getCellValue(feature, header) {
		if (header === 'Coordinates') {
			return feature.geometry.coordinates.map((coord) => coord.toFixed(3)).join(', ');
		}
		return formatValue(feature.properties[header] || 'N/A');
	}

	$: headers = getHeaders(filterPostalCodeData);
</script>

{#if filterPostalCodeData.length > 0}
	<table>
		<thead>
			<tr>
				{#each headers as header}
					<th>{header}</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each filterPostalCodeData as feature}
				<tr>
					{#each headers as header}
						<td>
							<span class="property-value">
								{getCellValue(feature, header)}
							</span>
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
{:else}
	<p>No data available</p>
{/if}

<style>
	table {
		border-collapse: collapse;
		width: 100%;
	}
	th,
	td {
		border: 1px solid #ddd;
		padding: 8px;
		text-align: left;
	}
	th {
		background-color: #f2f2f2;
	}
	.property-value {
		display: inline-block;
		max-width: 200px;
		word-wrap: break-word;
		overflow-wrap: break-word;
		hyphens: auto;
		vertical-align: top;
	}
</style>
