/* Node helper for MMM-HealthStatus
 *
 * Runs on the MagicMirror server (e.g. the Raspberry Pi) and reports:
 * - online:   whether an HTTP request to checkUrl gets any response
 * - signal:   Wi-Fi signal 0-100 (/proc/net/wireless on Linux, system_profiler on macOS; else null)
 * - cpuTemp:  CPU temperature in °C from /sys/class/thermal (Linux only, else null)
 */
const fs = require("node:fs");
const { execFile } = require("node:child_process");
const NodeHelper = require("node_helper");
const Log = require("logger");

module.exports = NodeHelper.create({
    start() {
        this.timer = null;
    },

    socketNotificationReceived(notification, payload) {
        if (notification !== "HEALTH_CONFIG") return;

        this.config = payload;
        if (this.timer) clearInterval(this.timer);
        this.check();
        this.timer = setInterval(() => this.check(), this.config.checkInterval);
    },

    async check() {
        const [online, signal, cpuTemp] = await Promise.all([
            this.checkInternet(),
            this.readWifiSignal(),
            this.readCpuTemp()
        ]);

        this.sendSocketNotification("HEALTH_STATUS", { online, signal, cpuTemp, checkedAt: Date.now() });
    },

    /** Any HTTP response (even an error status) means the internet is reachable. */
    async checkInternet() {
        try {
            await fetch(this.config.checkUrl, {
                method: "HEAD",
                signal: AbortSignal.timeout(this.config.checkTimeout)
            });
            return true;
        } catch (error) {
            Log.warn(`[MMM-HealthStatus] Internet check failed: ${error.message}`);
            return false;
        }
    },

    /** Wi-Fi signal 0-100: /proc/net/wireless on Linux (the Pi), system_profiler on macOS. */
    async readWifiSignal() {
        if (process.platform === "darwin") return this.readMacWifiSignal();

        try {
            const text = await fs.promises.readFile("/proc/net/wireless", "utf8");
            // Data lines look like: " wlan0: 0000   54.  -56.  -256   0 ..."
            const line = text.split("\n").find((l) => /^\s*\w+:/.test(l));
            if (!line) return null;
            const quality = parseFloat(line.split(":")[1].trim().split(/\s+/)[1]);
            if (Number.isNaN(quality)) return null;
            return Math.max(0, Math.min(100, Math.round((quality / 70) * 100)));
        } catch {
            return null;
        }
    },

    /**
     * macOS: "Signal / Noise: -66 dBm" from system_profiler, mapped -90 dBm → 0 … -50 dBm → 100.
     * The command takes a few seconds, so the result is reused for a minute.
     */
    async readMacWifiSignal() {
        if (this.macSignal && Date.now() - this.macSignal.at < 60 * 1000) return this.macSignal.value;

        const value = await new Promise((resolve) => {
            execFile("system_profiler", ["SPAirPortDataType"], { timeout: 15000 }, (error, stdout) => {
                const match = !error && stdout.match(/Signal \/ Noise:\s*(-?\d+)\s*dBm/);
                if (!match) return resolve(null);
                const dbm = parseInt(match[1], 10);
                resolve(Math.max(0, Math.min(100, Math.round((dbm + 90) * 2.5))));
            });
        });

        this.macSignal = { value, at: Date.now() };
        return value;
    },

    /** CPU temperature in °C from the first thermal zone. null when unavailable (e.g. macOS). */
    async readCpuTemp() {
        try {
            const text = await fs.promises.readFile("/sys/class/thermal/thermal_zone0/temp", "utf8");
            const milli = parseInt(text.trim(), 10);
            return Number.isNaN(milli) ? null : Math.round(milli / 1000);
        } catch {
            return null;
        }
    }
});
