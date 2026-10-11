(() => {
    const STORAGE_KEY = 'grassquest_completed_areas';
    const ELEMENT_STYLES = {
        'Monsoon Water': { color: '#0284c7', badge: '🌊 Monsoon Water' },
        'Earthy Terra': { color: '#78350f', badge: '🪨 Earthy Terra' },
        'Urban Flora': { color: '#15803d', badge: '🌿 Urban Flora' },
        'Solar Heat': { color: '#ea580c', badge: '☀️ Solar Heat' }
    };
    const FOG_RADIUS_METERS = 150;

    let map = null;
    let fogLayerGroup = null;
    let currentUserLocation = null;

    function getStoredAreas() {
        try {
            const storedAreas = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
            if (!Array.isArray(storedAreas)) {
                console.error(`Expected ${STORAGE_KEY} to contain an array.`);
                return [];
            }

            return storedAreas.filter((area) =>
                area &&
                Number.isFinite(Number(area.latitude)) &&
                Number.isFinite(Number(area.longitude)) &&
                typeof area.element === 'string' &&
                typeof area.reflection === 'string' &&
                typeof area.timestamp === 'string'
            );
        } catch (error) {
            console.error(`Could not read saved quest areas from ${STORAGE_KEY}.`, error);
            return [];
        }
    }

    function distanceBetweenMeters(first, second) {
        const earthRadiusMeters = 6371000;
        const toRadians = (degrees) => degrees * Math.PI / 180;
        const latitudeDifference = toRadians(Number(second.latitude) - Number(first.latitude));
        const longitudeDifference = toRadians(Number(second.longitude) - Number(first.longitude));
        const firstLatitude = toRadians(Number(first.latitude));
        const secondLatitude = toRadians(Number(second.latitude));
        const haversine = Math.sin(latitudeDifference / 2) ** 2 +
            Math.cos(firstLatitude) * Math.cos(secondLatitude) *
            Math.sin(longitudeDifference / 2) ** 2;

        return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
    }

    function drawFogCircle(area) {
        if (
            currentUserLocation &&
            distanceBetweenMeters(area, currentUserLocation) <= FOG_RADIUS_METERS
        ) {
            return;
        }

        const style = ELEMENT_STYLES[area.element] || {
            color: '#6366f1',
            badge: area.element
        };
        const popup = document.createElement('div');
        popup.className = 'fog-map-popup';
        popup.style.cssText = 'text-align:center;font-family:sans-serif;padding:4px;';

        const heading = document.createElement('h4');
        heading.textContent = style.badge;
        heading.style.cssText = `margin:0 0 6px;color:${style.color};font-size:1.1rem;`;

        const reflection = document.createElement('p');
        reflection.textContent = `“${area.reflection}”`;
        reflection.style.cssText = 'margin:0 0 8px;font-style:italic;font-size:0.9rem;';

        const unlockedDate = document.createElement('small');
        const parsedTimestamp = new Date(area.timestamp);
        unlockedDate.textContent = `Unlocked: ${Number.isNaN(parsedTimestamp.getTime()) ? 'Unknown date' : parsedTimestamp.toLocaleDateString()}`;
        unlockedDate.style.cssText = 'color:#666;font-size:0.75rem;';

        popup.append(heading, reflection, unlockedDate);

        const circle = L.circle([Number(area.latitude), Number(area.longitude)], {
            color: style.color,
            fillColor: style.color,
            fillOpacity: 0.32,
            stroke: false,
            radius: FOG_RADIUS_METERS,
            className: 'grassquest-fog-cloud'
        });
        circle.bindPopup(popup);
        fogLayerGroup.addLayer(circle);
    }

    function initialize(existingMap) {
        if (!existingMap) {
            throw new Error('The Leaflet map must be initialized before the fog map.');
        }
        if (map) {
            return map;
        }

        map = existingMap;
        fogLayerGroup = L.layerGroup().addTo(map);
        getStoredAreas().forEach(drawFogCircle);
        return map;
    }

    function setCurrentLocation(location) {
        if (
            !Number.isFinite(Number(location.latitude)) ||
            !Number.isFinite(Number(location.longitude))
        ) {
            throw new Error('The current location is invalid.');
        }

        currentUserLocation = {
            latitude: Number(location.latitude),
            longitude: Number(location.longitude)
        };
        fogLayerGroup.clearLayers();
        getStoredAreas().forEach(drawFogCircle);
    }

    function addCompletedQuestToFogMap(apiResponse, questTarget) {
        if (!map || !fogLayerGroup) {
            throw new Error('The fog map has not been initialized.');
        }
        if (
            !questTarget ||
            !Number.isFinite(Number(questTarget.latitude)) ||
            !Number.isFinite(Number(questTarget.longitude)) ||
            typeof apiResponse.element !== 'string' ||
            typeof apiResponse.reflection !== 'string'
        ) {
            throw new Error('The API response or quest target does not contain valid quest data.');
        }

        const area = {
            latitude: Number(questTarget.latitude),
            longitude: Number(questTarget.longitude),
            element: apiResponse.element,
            reflection: apiResponse.reflection,
            timestamp: new Date().toISOString()
        };
        const savedAreas = getStoredAreas();

        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify([...savedAreas, area]));
        } catch (error) {
            console.error(`Could not save completed quest to ${STORAGE_KEY}.`, error);
            throw new Error('Quest classified, but could not be saved to this browser.');
        }

        drawFogCircle(area);
        map.flyTo([area.latitude, area.longitude], 15, {
            animate: true,
            duration: 1.5
        });

        return area;
    }

    window.GrassQuestFogMap = {
        initialize,
        setCurrentLocation,
        addCompletedQuestToFogMap
    };
})();
