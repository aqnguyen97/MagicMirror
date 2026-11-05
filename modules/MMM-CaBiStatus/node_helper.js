/* Node helper for MMM-CaBiStatus */
const NodeHelper = require("node_helper");

const GBFS_DISCOVERY = "https://gbfs.capitalbikeshare.com/gbfs/gbfs.json";

async function safeFetch(url) {
  if (global.fetch) return fetch(url);
  const nodeFetch = (await import("node-fetch")).default;
  return nodeFetch(url);
}

module.exports = NodeHelper.create({
  start() { this.timer = null; },

  async socketNotificationReceived(notification, payload) {
    if (notification !== "CABI_CONFIG") return;
    this.stationIds = payload.stationIds || [];
    this.interval = payload.updateInterval || 30000;
    if (this.timer) clearInterval(this.timer);
    await this.tick();
    this.timer = setInterval(() => this.tick(), this.interval);
  },

  async tick() {
    try {
      // 1) Discover GBFS endpoints
      const gbfs = await (await safeFetch(GBFS_DISCOVERY)).json();
      await console.log("[MMM-CaBiStatus] Fetched GBFS discovery: ", gbfs);
      const enFeeds = (gbfs.data && gbfs.data.en && gbfs.data.en.feeds) || [];
      const findFeed = name => enFeeds.find(f => f.name === name)?.url;

      const infoURL = findFeed("station_information");
      const statusURL = findFeed("station_status");
      if (!infoURL || !statusURL) throw new Error("Missing GBFS URLs");

      // 2) Fetch station info + status
      const [info, status] = await Promise.all([
        (await safeFetch(infoURL)).json(),
        (await safeFetch(statusURL)).json()
      ]);

      const infoById = {};
      for (const st of (info.data?.stations || [])) {
        infoById[st.station_id] = st;
      }

      const out = {};
      for (const st of (status.data?.stations || [])) {
        if (this.stationIds.length && !this.stationIds.includes(st.station_id)) continue;

        const name = infoById[st.station_id]?.name || st.station_id;
        const ebikes = st.num_ebikes_available ?? 0;
        const totalBikes = st.num_bikes_available ?? 0;
        const classic = Math.max(totalBikes - ebikes, 0);

        out[st.station_id] = {
          name,
          ebikes,
          classic,
          docks: st.num_docks_available ?? null,
          lastReported: st.last_reported ?? null
        };
      }

      this.sendSocketNotification("CABI_DATA", out);
    } catch (e) {
      console.error("[MMM-CaBiStatus] error:", e);
      // On error, keep previous data but try again next tick
    }
  }
});
