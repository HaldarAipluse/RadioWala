document.addEventListener('DOMContentLoaded', () => {
    // --- DOM ELEMENTS ---
    const audioPlayer = document.getElementById('audio-player');
    const powerButton = document.getElementById('power-button');
    const volumeSlider = document.getElementById('volume-slider');
    const stationNameDisplay = document.getElementById('station-name-display');
    const powerIndicator = document.querySelector('.power-indicator');
    const stereoIndicator = document.querySelector('.stereo-indicator');
    const searchForm = document.getElementById('search-form');
    const searchInput = document.getElementById('search-input');
    const stationList = document.getElementById('station-list');
    const prevButton = document.getElementById('prev-station');
    const nextButton = document.getElementById('next-station');
    const searchSuggestions = document.getElementById('search-suggestions');
    const findMeButton = document.getElementById('find-me-btn');

    // --- API & STATE MANAGEMENT ---
    const API_BASE_URL = 'https://de1.api.radio-browser.info/json';
    const REVERSE_GEO_API_URL = 'https://api.bigdatacloud.net/data/reverse-geocode-client';
    let isPowerOn = false;
    let stations = [];
    let currentStationIndex = -1;
    let debounceTimer;

    // --- CORE FUNCTIONS ---
    function powerToggle() {
        isPowerOn = !isPowerOn;
        if (isPowerOn) {
            powerIndicator.classList.add('on');
            if (stations.length > 0 && currentStationIndex !== -1) {
                playCurrentStation();
            } else {
                stationNameDisplay.textContent = '-- ON --';
                stereoIndicator.classList.add('on');
            }
        } else {
            audioPlayer.pause();
            powerIndicator.classList.remove('on');
            stereoIndicator.classList.remove('on');
            stationNameDisplay.textContent = '-- OFF --';
        }
    }
    
    function setVolume() {
        audioPlayer.volume = volumeSlider.value;
    }

    // --- SEARCH AND GEOLOCATION LOGIC ---

    async function fetchAndDisplayStations(searchTerm) {
        hideSuggestions();
        displayMessage(`Searching for "${searchTerm}"...`);
        
        try {
            const response = await fetch(`${API_BASE_URL}/stations/search?name=${searchTerm}&limit=100&hidebroken=true&order=clickcount&reverse=true`);
            if (!response.ok) throw new Error('Network response was not ok.');
            
            const data = await response.json();
            stations = data.filter(station => station.url_resolved);
            
            if (stations.length === 0) {
                displayMessage(`No stations found for "${searchTerm}".`);
                return;
            }
            
            displayStations();
            if (isPowerOn) playStation(0);

        } catch (error) {
            console.error('Error fetching stations:', error);
            displayMessage('Error fetching stations.');
        }
    }
    
    function handleSearchSubmit(event) {
        event.preventDefault();
        const searchTerm = searchInput.value.trim();
        if (!searchTerm) return;
        fetchAndDisplayStations(searchTerm);
    }

    async function findStationsNearMe() {
        if (!navigator.geolocation) {
            displayMessage("Geolocation is not supported by your browser.");
            return;
        }

        displayMessage("Getting your location...");

        try {
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
            });
            const { latitude, longitude } = position.coords;

            displayMessage("Finding your country...");

            const geoResponse = await fetch(`${REVERSE_GEO_API_URL}?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`);
            const geoData = await geoResponse.json();
            const country = geoData.countryName;
            
            if (!country) {
                displayMessage("Could not determine your country.");
                return;
            }
            
            searchInput.value = country;
            await fetchAndDisplayStations(country);

        } catch (error) {
            console.error('Geolocation Error:', error);
            if (error.code === 1) { // User denied permission
                displayMessage("Location access denied. Please allow location to use this feature.");
            } else {
                displayMessage("Could not get your location.");
            }
        }
    }

    // --- SUGGESTIONS & DISPLAY LOGIC ---

    async function getSuggestions() {
        const searchTerm = searchInput.value.trim();
        if (searchTerm.length < 3) {
            hideSuggestions();
            return;
        }
        try {
            const response = await fetch(`${API_BASE_URL}/stations/byname/${searchTerm}?limit=5&hidebroken=true`);
            if (!response.ok) return;
            const suggestions = await response.json();
            displaySuggestions(suggestions);
        } catch (error) {
            console.error('Suggestion fetch error:', error);
        }
    }
    
    function displaySuggestions(suggestions) {
        if (suggestions.length === 0) { hideSuggestions(); return; }
        searchSuggestions.innerHTML = '';
        suggestions.forEach(station => {
            const item = document.createElement('div');
            item.className = 'suggestion-item';
            item.textContent = station.name;
            item.addEventListener('click', () => {
                searchInput.value = station.name;
                hideSuggestions();
                searchForm.requestSubmit();
            });
            searchSuggestions.appendChild(item);
        });
        searchSuggestions.style.display = 'block';
    }

    function hideSuggestions() {
        searchSuggestions.innerHTML = '';
        searchSuggestions.style.display = 'none';
    }

    function displayStations() {
        stationList.innerHTML = '';
        stations.forEach((station, index) => {
            const item = document.createElement('div');
            item.className = 'station-item';
            item.textContent = station.name;
            item.dataset.index = index;
            item.addEventListener('click', () => {
                if (isPowerOn) playStation(index);
                else {
                    currentStationIndex = index;
                    updateActiveStationVisuals();
                }
            });
            stationList.appendChild(item);
        });
    }

    function playStation(index) {
        if (index < 0 || index >= stations.length) return;
        currentStationIndex = index;
        playCurrentStation();
    }
    
    function playCurrentStation() {
        if (!isPowerOn || currentStationIndex === -1) return;
        const station = stations[currentStationIndex];
        audioPlayer.src = station.url_resolved;
        audioPlayer.play().catch(error => console.error('Playback Error:', error));
        stationNameDisplay.textContent = station.name;
        stereoIndicator.classList.add('on');
        updateActiveStationVisuals();
    }
    
    function changeStation(direction) {
        if (stations.length === 0) return;
        let newIndex = currentStationIndex + direction;
        if (newIndex < 0) newIndex = stations.length - 1;
        if (newIndex >= stations.length) newIndex = 0;
        playStation(newIndex);
    }
    
    function updateActiveStationVisuals() {
        Array.from(stationList.children).forEach((item, index) => {
            if (index === currentStationIndex) {
                item.classList.add('active');
                item.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
                item.classList.remove('active');
            }
        });
    }

    function displayMessage(message) {
        stationList.innerHTML = `<div class="station-item-message">${message}</div>`;
    }

    // --- EVENT LISTENERS ---
    powerButton.addEventListener('click', powerToggle);
    volumeSlider.addEventListener('input', setVolume);
    searchForm.addEventListener('submit', handleSearchSubmit);
    prevButton.addEventListener('click', () => changeStation(-1));
    nextButton.addEventListener('click', () => changeStation(1));
    findMeButton.addEventListener('click', findStationsNearMe);

    searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(getSuggestions, 300);
    });

    document.addEventListener('click', (event) => {
        if (!searchForm.parentElement.contains(event.target)) {
            hideSuggestions();
        }
    });

    // --- INITIALIZATION ---
    setVolume();
});