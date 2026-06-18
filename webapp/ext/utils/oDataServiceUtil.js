sap.ui.define(['sap/m/MessageBox'], function (MessageBox) {
  'use strict';
  class QuotationHelper {
    constructor(oView) {
      this._oView = oView;
    }
    getView() {
      return this._oView;
    }
    async saveQuotationComparison(oHeader, aItems = [], aTerms = [], mode) {
      const oModel = this.getView().getModel();
      const sGroupId = 'quotationSaveGroup';

      try {
        // ==================================================
        // CREATE
        // ==================================================
        if (mode === 'CREATE') {
          return await this.createQuotationComparison(oHeader, aItems, aTerms);
        }

        // ==================================================
        // UPDATE
        // ==================================================

        const sQuotationComparison = oHeader.QuotationComparison;

        const oHeaderBinding = oModel.bindContext(`/QuotationComparison('${sQuotationComparison}')`, null, {
          $$updateGroupId: sGroupId,
        });

        const oHeaderContext = oHeaderBinding.getBoundContext();

        await oHeaderBinding.requestObject();

        // ----------------------------
        // Header update
        // ----------------------------
        Object.keys(oHeader).forEach((sKey) => {
          if (sKey === 'QuotationComparison') {
            return;
          }

          oHeaderContext.setProperty(sKey, oHeader[sKey]);
        });

        // ==================================================
        // ITEMS
        // ==================================================

        const oItemsBinding = oModel.bindList(`/QuotationComparison('${sQuotationComparison}')/_CompareQuotationItem`, null, null, null, {
          $$updateGroupId: sGroupId,
        });

        const aExistingItemContexts = await oItemsBinding.requestContexts();

        for (const oItem of aItems) {
          const oExistingContext = aExistingItemContexts.find((oCtx) => oCtx.getProperty('SNo') === oItem.SNo);

          if (oExistingContext) {
            Object.keys(oItem).forEach((sKey) => {
              if (sKey === 'QuotationComparison' || sKey === 'SNo') {
                return;
              }

              oExistingContext.setProperty(sKey, oItem[sKey]);
            });
          } else {
            const oCreateItem = { ...oItem };

            delete oCreateItem.QuotationComparison;

            oItemsBinding.create(oCreateItem);
          }
        }

        // ==================================================
        // TERMS
        // ==================================================

        const oTermsBinding = oModel.bindList(`/QuotationComparison('${sQuotationComparison}')/_TermsAndConditions`, null, null, null, {
          $$updateGroupId: sGroupId,
        });

        const aExistingTermContexts = await oTermsBinding.requestContexts();

        for (const oTerm of aTerms) {
          const oExistingContext = aExistingTermContexts.find(
            (oCtx) => oCtx.getProperty('QuotationComparisonItem') === oTerm.QuotationComparisonItem && oCtx.getProperty('ItemNo') === oTerm.ItemNo,
          );

          if (oExistingContext) {
            Object.keys(oTerm).forEach((sKey) => {
              if (sKey === 'QuotationComparison' || sKey === 'QuotationComparisonItem' || sKey === 'ItemNo') {
                return;
              }

              oExistingContext.setProperty(sKey, oTerm[sKey]);
            });
          } else {
            const oCreateTerm = { ...oTerm };

            delete oCreateTerm.QuotationComparison;

            oTermsBinding.create(oCreateTerm);
          }
        }

        await oModel.submitBatch(sGroupId);

        return {
          status: 'Success',
          mode: 'UPDATE',
          quotationComparison: sQuotationComparison,
        };
      } catch (oError) {
        oModel.resetChanges(sGroupId);

        return {
          status: 'Error',
          message: oError.message || 'Error while saving data',
        };
      }
    }
    async createQuotationComparison(oHeader, aItems = [], aTerms = []) {
      const oModel = this.getView().getModel();
      const sGroupId = 'quotationSaveGroup';

      try {
        // =====================================
        // Create Header
        // =====================================
        const oHeaderBinding = oModel.bindList('/QuotationComparison', null, null, null, {
          $$updateGroupId: sGroupId,
        });

        const oHeaderPayload = { ...oHeader };

        delete oHeaderPayload.QuotationComparison;

        const oHeaderContext = oHeaderBinding.create(oHeaderPayload);

        await oModel.submitBatch(sGroupId);
        await oHeaderContext.created();

        const sQuotationComparison = oHeaderContext.getProperty('QuotationComparison');

        // =====================================
        // Create Items
        // =====================================
        if (aItems?.length) {
          const oItemsBinding = oModel.bindList(`/QuotationComparison('${sQuotationComparison}')/_CompareQuotationItem`, null, null, null, {
            $$updateGroupId: sGroupId,
          });

          aItems.forEach((oItem) => {
            const oCreateItem = {
              ...oItem,

              Quantity: Number(oItem.Quantity || 0).toFixed(2),
              UnitRate: Number(oItem.UnitRate || 0).toFixed(2),
              TotalAmount: Number(oItem.TotalAmount || 0).toFixed(2),
            };

            delete oCreateItem.QuotationComparison;

            oItemsBinding.create(oCreateItem);
          });
        }

        // =====================================
        // Create Terms
        // =====================================
        if (aTerms?.length) {
          const oTermsBinding = oModel.bindList(`/QuotationComparison('${sQuotationComparison}')/_TermsAndConditions`, null, null, null, {
            $$updateGroupId: sGroupId,
          });

          aTerms.forEach((oTerm) => {
            const oCreateTerm = { ...oTerm };

            delete oCreateTerm.QuotationComparison;

            oTermsBinding.create(oCreateTerm);
          });
        }

        // =====================================
        // Submit child records
        // =====================================
        if (aItems?.length || aTerms?.length) {
          await oModel.submitBatch(sGroupId);
        }

        return {
          status: 'Success',
          mode: 'CREATE',
          quotationComparison: sQuotationComparison,
        };
      } catch (oError) {
        oModel.resetChanges(sGroupId);

        return {
          status: 'Error',
          message: oError.message || 'Error while creating data',
        };
      }
    }
  }
  return QuotationHelper;
});
