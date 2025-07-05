import { PUBLIC_MAPTILER_KEY } from '$env/static/public';

export const hasMaptilerKey = PUBLIC_MAPTILER_KEY && PUBLIC_MAPTILER_KEY !== 'key';
export const streetsStyle = `https://api.maptiler.com/maps/streets-v2/style.json?key=${PUBLIC_MAPTILER_KEY}`;
