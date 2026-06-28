(function () {
  var source = "/BarrierCheck_APP/app/index.html?v=20260628barriercheck32290";

  function showError(message) {
    document.body.innerHTML = '<div class="loading"><div class="loading-card"><strong>Could not open BarrierCheck.</strong><p>' + message + '</p><p><a href="/app/login/">Return to login</a></p></div></div>';
  }

  fetch(source, { cache: "no-store" })
    .then(function (response) {
      if (!response.ok) throw new Error("Could not load the BarrierCheck app.");
      return response.text();
    })
    .then(function (html) {
      var baseTag = '<base href="/BarrierCheck_APP/app/">';
      var configScript = '<script src="/BarrierCheck_APP/app/firebase-config.js?v=20260628barriercheck32290"><\\/script>';
      var accessScript = '<script src="/BarrierCheck_APP/app/app-access-override.js?v=20260628access3"><\\/script>';

      html = html.replace('<head>', '<head>\n' + baseTag);
      html = html.replace(/<script\s+defer=""\s+src=/g, '<script src=');
      html = html.replace(/<script\s+defer\s+src=/g, '<script src=');
      html = html.replace('<script src="./script.js?v=20260616admin4"></script>', configScript + '\n<script src="./script.js?v=20260616admin4"></script>\n' + accessScript);

      document.body.innerHTML = "";
      document.documentElement.style.margin = "0";
      document.body.style.margin = "0";
      document.body.style.minHeight = "100vh";
      document.body.style.overflow = "hidden";

      var frame = document.createElement("iframe");
      frame.title = "BarrierCheck inspection app";
      frame.setAttribute("sandbox", "allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-downloads");
      frame.style.position = "fixed";
      frame.style.inset = "0";
      frame.style.width = "100%";
      frame.style.height = "100%";
      frame.style.border = "0";
      frame.style.display = "block";
      frame.srcdoc = html;
      document.body.appendChild(frame);

      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', '/app/' + window.location.search + window.location.hash);
      }
    })
    .catch(function (error) {
      showError(error.message);
    });
})();
