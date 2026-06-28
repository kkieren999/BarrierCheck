// BarrierCheck app bootstrap wrapper.
(function () {
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src;
      s.async = false;
      s.onload = resolve;
      s.onerror = function () { reject(new Error("Could not load " + src)); };
      document.head.appendChild(s);
    });
  }

  loadScript("https://cdn.jsdelivr.net/gh/kkieren999/BarrierCheck@4db56f53565ad851f81d7ec3a85beae19e96a8db/BarrierCheck_APP/app/script.js")
    .then(function () { return loadScript("./firebase-config.js?v=20260628barriercheck32290"); })
    .then(function () { return loadScript("./app-access-override.js?v=20260628access5"); })
    .then(function () {
      if (document.readyState !== "loading" && typeof init === "function") init();
    })
    .catch(function (error) {
      console.error("BarrierCheck startup failed", error);
      document.body.textContent = "Could not open BarrierCheck. Refresh or return to login.";
    });
})();
