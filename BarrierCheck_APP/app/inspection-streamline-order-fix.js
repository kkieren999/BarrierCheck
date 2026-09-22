// Preserve fence/NCZ/gate data alignment when a middle layout item is removed.
(function () {
  "use strict";

  function moveIndexedCardToEnd(selector, index) {
    var cards = Array.prototype.slice.call(document.querySelectorAll(selector));
    var card = cards[index];
    if (card && card.parentNode) card.parentNode.appendChild(card);
  }

  document.addEventListener("click", function (event) {
    var fenceButton = event.target.closest && event.target.closest("[data-remove-fence]");
    if (fenceButton) {
      var fenceRows = Array.prototype.slice.call(document.querySelectorAll("#streamlineFenceEditors [data-fence-id]"));
      var fenceRow = fenceButton.closest("[data-fence-id]");
      var fenceIndex = fenceRows.indexOf(fenceRow);
      if (fenceIndex >= 0 && fenceIndex < fenceRows.length - 1) {
        moveIndexedCardToEnd('.fence-card[data-section="fence"]', fenceIndex);
        moveIndexedCardToEnd(".climbability-card", fenceIndex);
      }
      return;
    }

    var gateButton = event.target.closest && event.target.closest("[data-remove-gate]");
    if (gateButton) {
      var gateRows = Array.prototype.slice.call(document.querySelectorAll("#streamlineGateEditors [data-gate-id]"));
      var gateRow = gateButton.closest("[data-gate-id]");
      var gateIndex = gateRows.indexOf(gateRow);
      if (gateIndex >= 0 && gateIndex < gateRows.length - 1) {
        moveIndexedCardToEnd(".gate-card", gateIndex);
      }
    }
  }, true);
})();
