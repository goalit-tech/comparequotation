sap.ui.define(['sap/m/MessageBox', 'sap/ui/model/json/JSONModel'], function (MessageBox, JSONModel) {
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
          // mode: 'UPDATE',
          message: 'Updated Successfully',
          quotationComparison: sQuotationComparison,
        };
      } catch (oError) {
        oModel.resetChanges(sGroupId);

        return {
          status: 'Error',
          message: oError?.message || 'Error while saving data',
          quotationComparison: sQuotationComparison,
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
          message: 'Created Successfully',
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
    async getRequestForQuotation(rfqId) {
      const oModel = this._oView.getModel('RFQModel');

      return new Promise((resolve, reject) => {
        oModel.read('/A_RequestForQuotation', {
          filters: [new sap.ui.model.Filter('RequestForQuotation', sap.ui.model.FilterOperator.EQ, rfqId)],
          urlParameters: {
            $expand: 'to_RequestForQuotationItem',
          },
          success: function (oData) {
            const oRFQ = oData.results?.[0];

            if (!oRFQ) {
              resolve(null);
              return;
            }

            resolve({
              ...oRFQ,
              to_RequestForQuotationItem: oRFQ.to_RequestForQuotationItem?.results || [],
            });
          },
          error: function (oError) {
            console.error('Error loading supplier quotations', oError);
            reject(oError);
          },
        });
      });
    }
    async getSupplierQuotationForRFQ(rfqId) {
      const oModel = this._oView?.getModel();
      try {
        const oListBinding = oModel.bindList('/SupplierQuotation', undefined, undefined, undefined, {
          $filter: `RequestForQuotation eq '${rfqId}'`,
          $expand: '_SupplierQuotationItem',
        });
        const aContexts = await oListBinding.requestContexts(0, 200);
        const aSupplierQuotation = aContexts.map((oContext) => oContext.getObject());

        console.log('Supplier Quotations', aSupplierQuotation);

        return aSupplierQuotation;
      } catch (oError) {
        console.error('Error loading supplier quotations & Items', oError);
        return [];
      }
    }
    async getCompareQuotation(keyId) {
      const oModel = this._oView?.getModel();
      const oContextBinding = oModel.bindContext(`/QuotationComparison('${keyId}')`, undefined, {
        $expand: '_CompareQuotationItem,_TermsAndConditions',
      });
      try {
        const oCompareQuotation = await oContextBinding.requestObject();
        console.log('Compare Quotation', oCompareQuotation);
        return oCompareQuotation;
      } catch (oError) {
        console.error('Error loading Request for CompareQuotation & items', oError);
        return [];
      }
    }
    async getWorkflowDefination(quotationComparison) {
      const oModel = this._oView?.getModel();
      try {
        // const filters = isDraftActive
        //   ? `QuotationComparison eq '${quotationComparison}' and IsDraft eq true`
        //   : `QuotationComparison eq '${quotationComparison}'`;
        const oListBinding = oModel.bindList('/ApprovalDef', undefined, undefined, undefined, {
          // $filter: filters,
          $filter: `QuotationComparison eq '${quotationComparison}'`,
        });
        const aContexts = await oListBinding.requestContexts(0, 100);
        const aApprovalDef = aContexts.map((oContext) => oContext.getObject());
        console.log('Workflow Defination Quotations', aApprovalDef);

        return aApprovalDef;
      } catch (oError) {
        console.error('Error loading Workflow Defination', oError);
        return [];
      }
    }
    async getWorkflowTransaction(quotationComparison) {
      const oModel = this._oView?.getModel();
      try {
        // const filters = isDraftActive
        // ? `QuotationComparison eq '${quotationComparison}' and IsDraft eq true`
        // : `QuotationComparison eq '${quotationComparison}'`;
        const oListBinding = oModel.bindList('/ApprovalTxn', undefined, undefined, undefined, {
          // $filter: filters,
          $filter: `QuotationComparison eq '${quotationComparison}'`,
        });
        const aContexts = await oListBinding.requestContexts(0, 500);
        const aApprovalTxn = aContexts.map((oContext) => oContext.getObject());

        console.log('Workflow transaction Quotations', aApprovalTxn);

        return aApprovalTxn;
      } catch (oError) {
        console.error('Error loading Workflow transaction quotations & Items', oError);
        return [];
      }
    }
    // async determineWorkflowVersion(quotationComparison) {}
    // oWorflowContextToSave, qCId, currentStep, action, nextStep
    // oResult?.quotationComparison/
    async saveWorkflowDefination(aRecords, sQuotationComparison) {
      const aCreatePromises = [];
      const oListBinding = this._oView.getModel().bindList('/ApprovalDef');
      aRecords.sort((a, b) => a.Rank - b.Rank);
      aRecords.forEach((oRecord, index) => {
        oRecord.SeqNo = index + 1;
        oRecord.QuotationComparison = sQuotationComparison;
        delete oRecord?.ApprovalId;
        delete oRecord?.Rank;
        oListBinding.create(oRecord);
        // const oContext = oListBinding.create(oRecord);
        // aCreatePromises.push(oContext.created());
      });
      try {
        await this._oView.getModel().submitBatch('workflowGroup');

        // const aCreatedContexts = await Promise.all(aCreatePromises);
        // const data = aCreatedContexts.map((oContext) => oContext.getObject());
        return {
          status: 'Success',
          message: 'Workflow Updated Successfully!',
        };
      } catch (oError) {
        return {
          status: 'Error',
          message: oError?.message || 'Error during Workflow Updated!',
        };
      }
    }
    async deleteWorkflowDefinition(sQuotationComparison) {
      const oModel = this._oView.getModel();
      try {
        const oListBinding = oModel.bindList('/ApprovalDef', undefined, undefined, undefined, {
          $filter: `QuotationComparison eq '${sQuotationComparison}'`,
        });

        const aContexts = await oListBinding.requestContexts();

        // await Promise.all(aContexts.map((oContext) => oContext.delete('workflowDeleteGroup')));
        for (const oContext of aContexts) {
          oContext.delete('workflowDeleteGroup');
        }

        await oModel.submitBatch('workflowDeleteGroup');
        return {
          status: 'Success',
          message: 'Workflow Deleted Successfully!',
        };
      } catch (oError) {
        return {
          status: 'Error',
          message: oError?.message || 'Error during Workflow Updated!',
        };
      }
    }
    async saveWorkflowTransaction(oWorflowContextToSave) {
      const aCreatePromises = [];
      const oListBinding = this._oView.getModel().bindList('/ApprovalTxn');

      // determine the next steps also here from the defination table assuming next step is determined
      const nextStep = 0;
      aRecords.forEach((oRecord) => {
        if (oRecord.SeqNo === currentStep) {
          oRecord.Action = action;
          if (action === 'APPROVE' || action === 'REJECT') {
            oRecord.IsCompleted = true;
          }
        }
        oRecord.IsCurrentStep = oRecord.SeqNo === nextStep ? 'X' : '';
        oListBinding.create(oRecord);
      });
      try {
        await this._oView.getModel().submitBatch('workflowGroup');

        await Promise.all(aCreatePromises);

        return {
          status: 'Success',
          message: 'Workflow Updated Successfully!',
        };
      } catch (oError) {
        return {
          status: 'Error',
          message: oError?.message || 'Error during Workflow Updated!',
        };
      }
    }
  }
  return QuotationHelper;
});
