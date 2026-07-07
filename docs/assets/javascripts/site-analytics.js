(function () {
  var config = window.KBC_SITE_ANALYTICS || {};

  if (config.provider !== "goatcounter") return;

  var code = String(config.goatcounterCode || "").trim();
  if (!code || code === "YOUR_GOATCOUNTER_CODE") return;

  var host = window.location.hostname;
  var isLocal =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "" ||
    host.endsWith(".local");

  if (isLocal && !config.trackLocal) return;

  if (
    Array.isArray(config.enabledHosts) &&
    config.enabledHosts.length > 0 &&
    config.enabledHosts.indexOf(host) === -1
  ) {
    return;
  }

  if (document.querySelector("script[data-goatcounter]")) return;

  var endpoint = code.indexOf("https://") === 0
    ? code
    : "https://" + code + ".goatcounter.com/count";

  var script = document.createElement("script");
  script.async = true;
  script.src = "https://gc.zgo.at/count.js";
  script.setAttribute("data-goatcounter", endpoint);
  document.head.appendChild(script);
})();
