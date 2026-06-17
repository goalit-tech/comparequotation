sap.ui.define([], function () {
  'use strict';

  return {
    onInit: function () {
      // Called when the List Report is initialized
    },

    onAfterRendering: function () {
      // Your custom logic
      const oFilterBar = this.editFlow
        ?.getView()
        ?.byId('nlab.ai.comparequotation::QuotationComparisonList--fe::DynamicPageTitle');
      if (oFilterBar) {
        oFilterBar.setVisible(false);
      }
    },
  };
});
