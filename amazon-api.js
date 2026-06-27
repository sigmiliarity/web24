/**
 * Amazon Music Search
 * Uses t2tunes.site API with codetabs proxy for search functionality
 */

const AmazonAPI = (() => {
    const CODETABS_PROXY = "https://corx.venipa.workers.dev/?url=";
    const SEARCH_API = "https://t2tunes.site/api/amazon-music/search";

    /**
     * Search Amazon Music for tracks and albums
     */
    async function search(query) {
        try {
            const searchUrl = `${SEARCH_API}?query=${encodeURIComponent(query)}&types=track,album,playlist&country=US`;
            const proxyUrl = CODETABS_PROXY + encodeURIComponent(searchUrl);
            
            const response = await fetch(proxyUrl);
            const data = await response.json();
            
            if (!data?.results) return null;

            // Extract results by type
            const tracks = data.results.find(r => r.label === "catalog_track")?.hits || [];
            const albums = data.results.find(r => r.label === "catalog_album")?.hits || [];
            const playlists = data.results.find(r => r.label === "catalog_playlist")?.hits || [];

            return { tracks, albums, playlists };
        } catch (error) {
            console.error('Search failed:', error);
            return null;
        }
    }

    /**
     * Parse search results into displayable format
     */
    function parseData(results, type) {
        if (!results) return null;

        if (type === 'search') {
            return {
                type: 'search',
                tracks: (results.tracks || []).map(hit => ({
                    type: 'track',
                    id: hit.document?.asin,
                    title: hit.document?.title,
                    subtitle: hit.document?.artistName,
                    image: hit.document?.artOriginal?.URL,
                    asin: hit.document?.asin
                })),
                albums: (results.albums || []).map(hit => ({
                    type: 'album',
                    id: hit.document?.asin,
                    title: hit.document?.title,
                    subtitle: hit.document?.artistName,
                    image: hit.document?.artOriginal?.URL,
                    asin: hit.document?.asin
                })),
                playlists: (results.playlists || []).map(hit => ({
                    type: 'playlist',
                    id: hit.document?.asin,
                    title: hit.document?.title,
                    subtitle: hit.document?.artistName,
                    image: hit.document?.artOriginal?.URL,
                    asin: hit.document?.asin
                }))
            };
        }

        return null;
    }

    return {
        search,
        parseData,
        getTemplate: () => null  // Not supported with this API
    };
})();
