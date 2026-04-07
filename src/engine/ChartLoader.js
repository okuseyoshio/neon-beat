/**
 * ChartLoader - reads song-list.json and individual chart.json files
 * from /public/songs/ via fetch.
 */

export async function loadSongList() {
  try {
    const res = await fetch('/songs/song-list.json', { cache: 'no-cache' });
    if (!res.ok) {
      // 404 = no songs imported yet
      return { songs: [] };
    }
    const data = await res.json();
    if (!data || !Array.isArray(data.songs)) return { songs: [] };
    return data;
  } catch {
    return { songs: [] };
  }
}

export async function loadChart(songId) {
  const res = await fetch(`/songs/${songId}/chart.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Failed to load chart for ${songId}`);
  return res.json();
}

export function getAudioUrl(songId) {
  return `/songs/${songId}/audio.wav`;
}
