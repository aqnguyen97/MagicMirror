/* MagicMirror² Module: MMM-DashboardTweaks
 * Small display tweaks for other modules that their config can't do.
 * Has no position and draws nothing itself.
 *
 * - Hourly weather: shows "8 pm" instead of "8:00 pm".
 */
Module.register("MMM-DashboardTweaks", {
    notificationReceived(notification) {
        if (notification === "DOM_OBJECTS_CREATED") {
            this.watchHourlyWeather();
        }
    },

    watchHourlyWeather() {
        const hourly = document.querySelector(".weather-today--hourly");
        if (!hourly) return;

        const shortenLabels = () => {
            hourly.querySelectorAll(".day").forEach(cell => {
                const text = cell.textContent.trim();
                const shortened = text.replace(/:00(?=\s*[ap]m$)/i, "");
                if (shortened !== text) cell.textContent = shortened;
            });
        };

        shortenLabels();
        // The weather module re-renders its table on every update; shorten again each time
        new MutationObserver(shortenLabels).observe(hourly, { childList: true, subtree: true });
    }
});
