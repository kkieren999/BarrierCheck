(function () {
  var source = "/BarrierCheck_APP/app/index.html?v=20260628barriercheck32290";

  fetch(source, { cache: "no-store" })
    .then(function (response) {
      if (!response.ok) throw new Error("Could not load the BarrierCheck app.");
      return response.text();
    })
    .then(function (html) {
      var baseTag = '<base href="/BarrierCheck_APP/app/">';
      var configScript = '<script src="/BarrierCheck_APP/app/firebase-config.js?v=20260628barriercheck32290"><\\/script>';
      var accessScript = '<script src="/BarrierCheck_APP/app/app-access-override.js?v=20260628access2"><\\/script>';

      html = html.replace('<head>', '<head>\n' + baseTag);
      html = html.replace(/<script\s+defer=""\s+src=/g, '<script src=');
      html = html.replace(/<script\s+defer\s+src=/g, '<script src=');
      html = html.replace('<script src="./script.js?v=20260616admin4"></script>', configScript + '\n<script src="./script.js?v=20260616admin4"></script>\n' + accessScript);

      document.open();
      document.write(html);
      document.close();

      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', '/app/' + window.location.search + window.location.hash);
      }
    })
    .catch(function (error) {
      document.body.innerHTML = '<div class="loading"><div class="loading-card"><strong>Could not open BarrierCheck.</strong><p>' + error.message + '</p><p><a href="/app/login/">Return to login</a></p></div></div>';
    });
})();
