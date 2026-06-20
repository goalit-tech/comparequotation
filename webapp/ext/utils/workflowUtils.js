sap.ui.define(['sap/m/MessageToast'], function (MessageToast) {
  'use strict';

  var WorkflowUtils = {
    ranking: {
      Initial: 0,
      Default: 1024,
      Before: function (iRank) {
        return iRank + 1024;
      },
      Between: function (iRank1, iRank2) {
        // limited to 53 rows
        return (iRank1 + iRank2) / 2;
      },
      After: function (iRank) {
        return iRank / 2;
      },
    },

    getAvailableProductsTable: function (oView) {
      return oView.byId('availableProducts');
    },

    getSelectedProductsTable: function (oView) {
      return oView.byId('_IDGenWorkflowDefinationTable');
    },

    getSelectedItemContext: function (oTable, fnCallback) {
      var aSelectedItems = oTable.getSelectedItems();
      var oSelectedItem = aSelectedItems[0];

      if (!oSelectedItem) {
        MessageToast.show('Please select a row!');
        return;
      }

      var oSelectedContext = oSelectedItem.getBindingContext('LocalModel');
      if (oSelectedContext && fnCallback) {
        var iSelectedIndex = oTable.indexOfItem(oSelectedItem);
        fnCallback(oSelectedContext, iSelectedIndex);
      }

      return oSelectedContext;
    },

    _prepareSaveWorkflowDefinationData: function () {
      const oTable = this.getSelectedProductsTable();
      debugger;
    },
  };

  return WorkflowUtils;
});
