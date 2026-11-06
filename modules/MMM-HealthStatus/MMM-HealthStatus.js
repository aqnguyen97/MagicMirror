/* MagicMirror² Module: MMM-HealthStatus
 * Small status icons for the device running the dashboard:
 * - Wi-Fi / internet: "Online" in gray (with signal bars on Linux), red "Offline" when not
 * - CPU temperature (°F by default): always shown on the Raspberry Pi, amber/red when warm; "— °F" where unavailable
 */
Module.register("MMM-HealthStatus", {
    defaults: {
        checkUrl: "https://api.open-meteo.com/",   // any reachable HTTPS endpoint; a reply of any kind = online
        checkInterval: 30 * 1000,
        checkTimeout: 8 * 1000,
        offlineAfterFailures: 2,                   // consecutive failed checks before showing "Offline"
        tempUnit: "F",                             // display unit: "F" or "C" (thresholds below stay in °C)
        tempWarnAt: 70,                          // °C: amber
        tempHotAt: 80                              // °C: red (a Pi starts slowing itself down around 80-85)
    },

    start() {
        this.status = null;
        this.failures = 0;
        this.sendSocketNotification("HEALTH_CONFIG", {
            checkUrl: this.config.checkUrl,
            checkInterval: this.config.checkInterval,
            checkTimeout: this.config.checkTimeout
        });
    },

    getStyles() {
        return ["MMM-HealthStatus.css"];
    },

    socketNotificationReceived(notification, payload) {
        if (notification !== "HEALTH_STATUS") return;
        this.failures = payload.online ? 0 : this.failures + 1;
        this.status = payload;
        this.updateDom();
    },

    el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    },

    /** "126°F" (or "52°C" with tempUnit: "C") from a reading in °C. */
    formatTemp(celsius) {
        const value = this.config.tempUnit === "C" ? celsius : Math.round(celsius * 9 / 5 + 32);
        return `${value}°${this.config.tempUnit}`;
    },

    /** Three small bars, filled according to signal strength (0-100). */
    signalBars(signal) {
        const bars = this.el("span", "health-bars");
        const filled = signal >= 67 ? 3 : signal >= 34 ? 2 : signal > 0 ? 1 : 0;
        for (let i = 1; i <= 3; i++) {
            bars.appendChild(this.el("span", `health-bars__bar health-bars__bar--${i}${i <= filled ? " is-on" : ""}`));
        }
        return bars;
    },

    getDom() {
        const wrapper = this.el("div", "health");
        if (!this.status) return wrapper;

        // Wi-Fi / internet
        const offline = this.failures >= this.config.offlineAfterFailures;
        const wifi = this.el("span", `health-item${offline ? " health-item--bad" : ""}`);
        wifi.appendChild(this.el("i", "fas fa-wifi"));
        if (!offline && this.status.signal !== null) {
            wifi.appendChild(this.signalBars(this.status.signal));
        }
        wifi.appendChild(this.el("span", "", offline ? "Offline" : "Online"));
        wrapper.appendChild(wifi);


        // CPU temperature: the real value on the Pi; a dim "— °C" where there's no readable sensor (e.g. macOS)
        const temp = this.status.cpuTemp;
        if (temp === null) {
            const item = this.el("span", "health-item health-item--unavailable");
            item.appendChild(this.el("i", "fas fa-temperature-half"));
            item.appendChild(this.el("span", "", `— °${this.config.tempUnit}`));
            wrapper.appendChild(item);
        } else {
            let level = "";
            if (temp >= this.config.tempHotAt) level = "health-item--bad";
            else if (temp >= this.config.tempWarnAt) level = "health-item--warn";
            const item = this.el("span", `health-item ${level}`);
            item.appendChild(this.el("i", "fas fa-temperature-half"));
            item.appendChild(this.el("span", "", this.formatTemp(temp)));
            wrapper.appendChild(item);
        }

        return wrapper;
    }
});
