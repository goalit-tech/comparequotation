sap.ui.define(['sap/ui/core/Fragment'], function (Fragment) {
  'use strict';

  const oCQActions = {
    onCreateLRActionPress: async function (oEvent) {
      oCQActions._oExtThis = this; // store reference to 'this' for later use in fragment controller
      const oView = this.editFlow.getView();
      oCQActions.oRFQListDialog ??= await this.loadFragment({
        name: 'nlab.ai.comparequotation.ext.fragment.RFQList',
        id: oView.getId(), // ensure the fragment gets the same ID as the view to avoid ID conflicts
        controller: oCQActions,
      });
      oView.addDependent(oCQActions.oRFQListDialog);
      oCQActions.oRFQListDialog.open();
    },
    onUpdateLRActionPress: function () {
      // oCQActions.oRFQListDialog.close();
    },
    onDeleteLRActionPress: function () {
      // oCQActions.oRFQListDialog.open();
    },
    onAddRFQConfirmPress: function (oEvent) {
      const oEditFlow = oCQActions?._oExtThis?.editFlow;
      const oRouter = oEditFlow.getAppComponent().getRouter();
      const oSelectedRFQForComparison = oEditFlow.getView().getModel('LocalModel').getProperty('/SelectedRFQForComparison');
      if (!oSelectedRFQForComparison || !oSelectedRFQForComparison.RequestForQuotation) {
        sap.m.MessageToast.show('Please select a Request for Quotation to Create Compare Quotation.');
        return;
      }

      oRouter.navTo('QuotationComparisonObjectPage', {
        key: '000000',
        query: {
          Mode: 'CREATE', //UPDATE
          RequestForQuotation: oSelectedRFQForComparison?.RequestForQuotation || '',
          // QuotationComparison:''
        },
      });
      oCQActions.oRFQListDialog?.close();
    },
    onAddRFQCancelPress: function () {
      oCQActions.oRFQListDialog?.close();
    },
    onRFQDialogTableRowSelectionChange: function (oEvent) {
      const contexts = oEvent.getParameter('selectedContext');
      const selectedContextObject = contexts.map((context) => context.getObject());
      oCQActions?._oExtThis?.editFlow
        .getView()
        .getModel('LocalModel')
        .setProperty('/SelectedRFQForComparison', selectedContextObject[0]);
    },
  };
  return oCQActions;
});
