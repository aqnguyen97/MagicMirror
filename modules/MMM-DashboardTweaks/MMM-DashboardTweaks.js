/* MagicMirror² Module: MMM-DashboardTweaks
 * Small display tweaks for other modules that their config can't do.
 * Has no position and draws nothing itself.
 *
 * - Hourly weather: shows "8 pm" instead of "8:00 pm".
 * - With a position: a one-line legend for the status bars along the bottom of the
 *   transit and bikeshare cards (keep the minutes in sync with those modules' config).
 */
Module.register("MMM-DashboardTweaks", {
    defaults: {
        statusAgingMinutes: 2,
        statusStaleMinutes: 5,
        statusErrorMinutes: 30
    },

    getDom() {
        const legend = document.createElement("div");
        legend.className = "status-legend";

        const items = [
            ["fresh", `Updated < ${this.config.statusAgingMinutes} min ago`],
            ["late", "Update late"],
            ["aging", `${this.config.statusAgingMinutes}–${this.config.statusStaleMinutes} min`],
            ["stale", `Over ${this.config.statusStaleMinutes} min`]
        ];

        for (const [status, label] of items) {
            const item = document.createElement("span");
            item.className = "status-legend__item";
            const sample = document.createElement("span");
            sample.className = `legend-bar legend-bar--${status}`;
            item.appendChild(sample);
            item.appendChild(document.createTextNode(label));
            legend.appendChild(item);
        }

        // Long outage: the dot is replaced by a warning with the last update time
        const error = document.createElement("span");
        error.className = "status-legend__item status-legend__item--error";
        const icon = document.createElement("i");
        icon.className = "fas fa-triangle-exclamation";
        error.appendChild(icon);
        error.appendChild(document.createTextNode(`Over ${this.config.statusErrorMinutes} min`));
        legend.appendChild(error);

        return legend;
    },

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
