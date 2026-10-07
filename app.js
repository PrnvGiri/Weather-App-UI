const API_KEY = window.OPENWEATHER_API_KEY || "";
const API_BASE_URL = "https://api.openweathermap.org";
const searchForm = document.querySelector("#search-form");
const citySearch = document.querySelector("#city-search");
const searchButton = searchForm.querySelector("button");
const statusMessage = document.querySelector("#weather-status");
const weatherCard = document.querySelector(".container");
const forecastList = document.querySelector("#forecast-list");

const iconClasses = {
    Thunderstorm: "bx-cloud-lightning",
    Drizzle: "bx-cloud-drizzle",
    Rain: "bx-cloud-rain",
    Snow: "bx-snowflake",
    Clear: "bx-sun",
    Clouds: "bx-cloud",
    Mist: "bx-cloud",
    Smoke: "bx-cloud",
    Haze: "bx-cloud",
    Dust: "bx-cloud",
    Fog: "bx-cloud",
    Sand: "bx-cloud",
    Ash: "bx-cloud",
    Squall: "bx-wind",
    Tornado: "bx-wind"
};

let activeRequest;

function setStatus(message = "", isError = false) {
    statusMessage.textContent = message;
    statusMessage.classList.toggle("error", isError);
}

function setLoading(isLoading) {
    citySearch.disabled = isLoading;
    searchButton.disabled = isLoading;
    searchButton.textContent = isLoading ? "Loading..." : "Search Location";
    weatherCard.setAttribute("aria-busy", String(isLoading));

    if (isLoading && !forecastList.children.length) {
        renderForecastLoading();
    }
}

function renderForecastLoading() {
    const placeholders = Array.from({ length: 4 }, () => `
        <li class="forecast-placeholder" aria-hidden="true">
            <i class="bx bx-cloud"></i>
            <span>...</span>
            <span class="day-temp">—</span>
        </li>
    `);
    forecastList.innerHTML = placeholders.join("");
}

async function getJson(url, signal) {
    const response = await fetch(url, { signal });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.message || "Weather data could not be loaded.");
    }

    return data;
}

function localDate(timestamp, timezoneOffset) {
    return new Date((timestamp + timezoneOffset) * 1000);
}

function localDateKey(timestamp, timezoneOffset) {
    return localDate(timestamp, timezoneOffset).toISOString().slice(0, 10);
}

function formatDate(timestamp, timezoneOffset) {
    return new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC"
    }).format(localDate(timestamp, timezoneOffset));
}

function formatWeekday(timestamp, timezoneOffset) {
    return new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        timeZone: "UTC"
    }).format(localDate(timestamp, timezoneOffset));
}

function weatherIconClass(weather) {
    return iconClasses[weather.main] || "bx-cloud";
}

function renderCurrentWeather(weather) {
    document.querySelector("#current-day").textContent = formatWeekday(weather.dt, weather.timezone);
    document.querySelector("#current-date").textContent = formatDate(weather.dt, weather.timezone);
    document.querySelector("#current-location").textContent = `${weather.name}, ${weather.sys.country}`;
    document.querySelector("#current-temperature").textContent = `${Math.round(weather.main.temp)}°C`;
    document.querySelector("#current-condition").textContent = weather.weather[0].description;
    document.querySelector("#current-weather-icon").className = `bx ${weatherIconClass(weather.weather[0])}`;
    document.querySelector("#humidity").textContent = `${weather.main.humidity} %`;
    document.querySelector("#wind-speed").textContent = `${Math.round(weather.wind.speed * 3.6)} km/h`;
}

function selectDailyForecasts(entries, timezoneOffset, currentTimestamp) {
    const today = localDateKey(currentTimestamp, timezoneOffset);
    const dailyEntries = new Map();

    entries.forEach((entry) => {
        const dateKey = localDateKey(entry.dt, timezoneOffset);
        if (dateKey === today) return;

        const entriesForDay = dailyEntries.get(dateKey) || [];
        entriesForDay.push(entry);
        dailyEntries.set(dateKey, entriesForDay);
    });

    return [...dailyEntries.values()]
        .slice(0, 4)
        .map((entriesForDay) => entriesForDay.reduce((closestToMidday, entry) => {
            const hour = localDate(entry.dt, timezoneOffset).getUTCHours();
            const closestHour = localDate(closestToMidday.dt, timezoneOffset).getUTCHours();
            return Math.abs(hour - 12) < Math.abs(closestHour - 12) ? entry : closestToMidday;
        }));
}

function renderForecast(forecast, currentTimestamp) {
    const forecasts = selectDailyForecasts(forecast.list, forecast.city.timezone, currentTimestamp);
    forecastList.innerHTML = "";

    forecasts.forEach((entry) => {
        const item = document.createElement("li");
        const weather = entry.weather[0];
        item.innerHTML = `
            <i class="bx ${weatherIconClass(weather)}"></i>
            <span>${formatWeekday(entry.dt, forecast.city.timezone)}</span>
            <span class="day-temp">${Math.round(entry.main.temp)}°C</span>
        `;
        forecastList.append(item);
    });

    const nextForecast = forecast.list[0];
    document.querySelector("#precipitation").textContent = nextForecast ? `${Math.round((nextForecast.pop || 0) * 100)} %` : "—";
}

async function loadWeather(city) {
    if (!API_KEY) {
        setStatus("Add your OpenWeather API key to config.js before searching.", true);
        return;
    }

    activeRequest?.abort();
    const request = new AbortController();
    activeRequest = request;
    setLoading(true);
    setStatus("Loading weather...");

    try {
        const query = encodeURIComponent(city.trim());
        const locations = await getJson(
            `${API_BASE_URL}/geo/1.0/direct?q=${query}&limit=1&appid=${API_KEY}`,
            request.signal
        );

        if (!locations.length) {
            throw new Error("No matching city was found. Try including a country name.");
        }

        const { lat, lon } = locations[0];
        const parameters = `lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`;
        const [currentWeather, forecast] = await Promise.all([
            getJson(`${API_BASE_URL}/data/2.5/weather?${parameters}`, request.signal),
            getJson(`${API_BASE_URL}/data/2.5/forecast?${parameters}`, request.signal)
        ]);

        renderCurrentWeather(currentWeather);
        renderForecast(forecast, currentWeather.dt);
        setStatus(`Updated for ${currentWeather.name}.`);
    } catch (error) {
        if (error.name !== "AbortError") {
            setStatus(error.message || "Unable to load weather right now. Please try again.", true);
        }
    } finally {
        if (activeRequest === request) {
            setLoading(false);
        }
    }
}

searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const city = citySearch.value.trim();

    if (!city) {
        setStatus("Enter a city name to search.", true);
        citySearch.focus();
        return;
    }

    loadWeather(city);
});

loadWeather(citySearch.value);
