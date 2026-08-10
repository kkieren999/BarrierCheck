// BarrierCheck address autocomplete layout fix.
// Keeps address suggestions inside the Details card so the card grows instead of clipping the list.
(function () {
  "use strict";

  if (document.getElementById("barrierCheckAddressAutocompleteLayoutFix")) return;

  var style = document.createElement("style");
  style.id = "barrierCheckAddressAutocompleteLayoutFix";
  style.textContent = [
    ".streamline-address-wrap{overflow:visible}",
    ".streamline-address-results{position:relative!important;left:auto!important;right:auto!important;top:auto!important;width:100%;max-height:230px;margin-top:8px!important;overflow-y:auto;overflow-x:hidden}",
    ".streamline-address-results[hidden]{display:none!important}",
    "@media(max-width:720px){.streamline-address-results{max-height:210px}}"
  ].join("\n");

  document.head.appendChild(style);
})();
