sap.ui.define(
  [
    'sap/fe/core/PageController',
    'sap/ui/core/BusyIndicator',
    'sap/m/ColumnListItem',
    'nlab/ai/comparequotation/ext/utils/utils',
    'nlab/ai/comparequotation/ext/utils/oDataServiceUtil',
    'nlab/ai/comparequotation/ext/utils/workflowUtils',
  ],
  function (PageController, BusyIndicator, ColumnListItem, Utils, ODataServiceUtil, WorkflowUtils) {
    'use strict';

    return PageController.extend('nlab.ai.comparequotation.ext.controller.ManageCompareQuotation', {
      /**
       * Called when a controller is instantiated and its View controls (if available) are already created.
       * Can be used to modify the View before it is displayed, to bind event handlers and do other one-time initialization.
       * @memberOf nlab.ai.comparequotation.ext.view.ManageCompareQuotation
       */
      onInit: function () {
        PageController.prototype.onInit.apply(this, arguments); // needs to be called to properly initialize the page controller
        const oView = this.editFlow.getView();
        // const oRouter = this.editFlow.getAppComponent().getRouter();
        this._oDataServiceUtil = new ODataServiceUtil(this.getView());
        this.getRouter().getRoute('QuotationComparisonObjectPage').attachPatternMatched(this.onObjectMatched, this);
      },

      getRouter: function () {
        return this.editFlow.getAppComponent().getRouter();
      },
      getView: function () {
        return this.editFlow.getView();
      },
      hideBusyIndicator: function () {
        BusyIndicator.hide();
      },

      showBusyIndicator: function () {
        BusyIndicator.show(0);
      },
      resetLocalModel: async function () {
        const oModel = this.getView().getModel('LocalModel');
        const oTable = this.getView().byId('_IDGenQCFormFragmentDynamicUITable');
        oTable?.removeAllColumns();
        const localModelData = await this._readLocalMOdelJSONFile();
        oModel.setData(localModelData);
      },
      _readLocalMOdelJSONFile: function () {
        const sUrl = sap.ui.require.toUrl('nlab/ai/comparequotation/model/localModel.json');
        return new Promise((resolve, reject) => {
          jQuery
            .getJSON(sUrl)
            .done(function (oData) {
              // oModel.setData(oData);
              resolve(oData);
            })
            .fail(reject);
        });
      },

      onObjectMatched: async function (oEvent) {
        console.log('App router clled');
        this.showBusyIndicator();
        try {
          await this.resetLocalModel();
          const oArgs = oEvent.getParameter('arguments');
          let sCompareQuotationId = oArgs.key;
          sCompareQuotationId = sCompareQuotationId ? sCompareQuotationId.replace(/^'|'$/g, '') : '';
          const oQuery = oArgs['?query'];
          this._loadViewONMode(sCompareQuotationId, oQuery);
        } catch (error) {
          this.hideBusyIndicator();
        }
      },
      _checkLoggedInUserIsValidApprover: async function (oWorkFlowCotext) {
        //await this._oDataServiceUtil.saveWorkflowApprover();
        const loggedInUser = await this._oDataServiceUtil.getLoggedInUser();
        const currentTxnVersion = oWorkFlowCotext?.CurrentTransactionVersion;

        const currentTxn = oWorkFlowCotext?.CurrentTransactionApproverStep;

        if (!oWorkFlowCotext?.CurrentTransactionApproverStep) {
          return false;
        }
        const aApprovers = await this._oDataServiceUtil.getWorkflowApprover(currentTxn.StageCode);

        const sLoggedInEmail = loggedInUser?.email?.trim().toLowerCase();

        return aApprovers?.some((approver) => approver?.Email?.trim().toLowerCase() === sLoggedInEmail);
      },
      _loadViewONMode: async function (sCompareQuotationId, oQuery = {}) {
        if (oQuery && oQuery?.Mode === 'CREATE') {
          // if (oQuery?.Mode === "CREATE") {
          // const aSupplierQuotation = await ODataServiceUtil.getSupplierQuotationForRFQ(oQuery?.RequestForQuotation, this.getView());
          const aSupplierQuotation = await this._oDataServiceUtil.getSupplierQuotationForRFQ(oQuery?.RequestForQuotation);

          const aSupplierQuotationData = Array.isArray(aSupplierQuotation) ? aSupplierQuotation : aSupplierQuotation?.value || [];

          const aSupplierQuotationItems = aSupplierQuotationData.flatMap((quotation) =>
            (quotation._SupplierQuotationItem || []).map((item) => ({
              ...item,
              SupplierCode: quotation.SupplierCode,
              SupplierName: quotation.SupplierName,
            })),
          );
          this.getView()
            .getModel('LocalModel')
            .setProperty('/ActualSupplierQuotationItem', aSupplierQuotationItems || []);
          // const oSelectedRFQForComparison = await ODataServiceUtil.getRequestForQuotation(oQuery?.RequestForQuotation, this.getView());
          const oSelectedRFQForComparison = await this._oDataServiceUtil.getRequestForQuotation(oQuery?.RequestForQuotation);
          const oCompareQuotationHeader = this.getView().getModel('LocalModel').getProperty('/CompareQuotationHeader');
          oCompareQuotationHeader.QuotationComparison = '';
          oCompareQuotationHeader.RequestForQuotation = oQuery?.RequestForQuotation || '';
          oCompareQuotationHeader.RequisitionNumber = oSelectedRFQForComparison?.to_RequestForQuotationItem[0]?.PurchaseRequisition || '';
          oCompareQuotationHeader.CompativeStatementTitle = 'New Quotation Comparison';
          oCompareQuotationHeader.CompanyCode = aSupplierQuotation[0]?.CompanyCode || '';
          oCompareQuotationHeader.CompanyName = aSupplierQuotation[0]?.CompanyCodeName || '';
          this.getView().getModel('LocalModel').setProperty('/Mode', 'CREATE');

          this.getView().getModel('LocalModel').setProperty('/IsEditCompareQuotation', true);
          this.getView().getModel('LocalModel').setProperty('/RequestForQuotation', oSelectedRFQForComparison);
          this.getView().getModel('LocalModel').setProperty('/RequestForQuotationItem', oSelectedRFQForComparison?.to_RequestForQuotationItem);
          this.getView().getModel('LocalModel').setProperty('/CompareQuotationHeader', oCompareQuotationHeader);
          this.getView().getModel('LocalModel').setProperty('/SupplierQuotation', aSupplierQuotationData);
          this.getView().getModel('LocalModel').setProperty('/SupplierQuotationItem', aSupplierQuotationItems);
          await this.checkWorkflowAndUpdateSection(oCompareQuotationHeader?.QuotationComparison);
        } else {
          // const oSelectedCompareQuotation = await ODataServiceUtil.getCompareQuotation(sCompareQuotationId, this.getView());
          const oSelectedCompareQuotation = await this._oDataServiceUtil.getCompareQuotation(sCompareQuotationId);
          const { _CompareQuotationItem, _TermsAndConditions, ...oCompareQuotationHeader } = oSelectedCompareQuotation;
          oCompareQuotationHeader.ComparisonDate = oCompareQuotationHeader.ComparisonDate
            ? oCompareQuotationHeader.ComparisonDate instanceof Date
              ? oCompareQuotationHeader.ComparisonDate
              : new Date(oCompareQuotationHeader.ComparisonDate)
            : null;
          oCompareQuotationHeader.RequisitionDate = oCompareQuotationHeader.RequisitionDate
            ? oCompareQuotationHeader.RequisitionDate instanceof Date
              ? oCompareQuotationHeader.RequisitionDate
              : new Date(oCompareQuotationHeader.RequisitionDate)
            : null;
          const oSelectedRFQForComparison = await this._oDataServiceUtil.getRequestForQuotation(oCompareQuotationHeader?.RequestForQuotation);
          this.getView().getModel('LocalModel').setProperty('/IsEditCompareQuotation', false);
          this.getView().getModel('LocalModel').setProperty('/RequestForQuotation', oSelectedRFQForComparison);
          this.getView().getModel('LocalModel').setProperty('/RequestForQuotationItem', oSelectedRFQForComparison?.to_RequestForQuotationItem);
          this.getView().getModel('LocalModel').setProperty('/CompareQuotationHeader', oCompareQuotationHeader);
          const aMergersItemsAndTerms = Utils.mergeTermsAndConditonTOCompareQuotationITem(_CompareQuotationItem, _TermsAndConditions);
          this.getView().getModel('LocalModel').setProperty('/CompareQuotationItemData', aMergersItemsAndTerms);
          this.getView().getModel('LocalModel').setProperty('/CompareQuotationTermsConditionData', _TermsAndConditions);
          this.getView().getModel('LocalModel').setProperty('/Mode', 'DISPLAY');
          const aPreDefinedTerms = this.getView().getModel('LocalModel').getProperty('/TermsAndConditionDialog/PreDefinedTermsAndCondition');

          const updatedPredefineTerms = Utils.updatePredefinedTermsSelectable(aPreDefinedTerms, _TermsAndConditions);
          this.getView().getModel('LocalModel').setProperty('/TermsAndConditionDialog/PreDefinedTermsAndCondition', updatedPredefineTerms);
          const aExistingKeys = Array.from(new Set(_TermsAndConditions.map((oTerm) => oTerm.KeyField)));
          const aCompareQuotationRowsData = Utils.transformDataforComparisonTable(aMergersItemsAndTerms, aExistingKeys);
          this.getView().getModel('LocalModel').setProperty('/CompareQuotationActualRowsData', aCompareQuotationRowsData?.actualRows);
          this.getView().getModel('LocalModel').setProperty('/CompareQuotationRowsData', aCompareQuotationRowsData?.filterRows);
          Utils.generateCOlumnsForComparisonTable(this.getView(), aCompareQuotationRowsData?.filterRows);
          const aSupplierQuotation = await this._oDataServiceUtil.getSupplierQuotationForRFQ(oCompareQuotationHeader?.RequestForQuotation);
          const aSupplierQuotationData = Array.isArray(aSupplierQuotation) ? aSupplierQuotation : aSupplierQuotation?.value || [];

          const aSupplierQuotationItems = aSupplierQuotationData.flatMap((quotation) =>
            (quotation._SupplierQuotationItem || []).map((item) => ({
              ...item,
              SupplierCode: quotation.SupplierCode,
              SupplierName: quotation.SupplierName,
            })),
          );
          this.getView()
            .getModel('LocalModel')
            .setProperty('/ActualSupplierQuotationItem', aSupplierQuotationItems || []);
          await this.checkWorkflowAndUpdateSection(oCompareQuotationHeader?.QuotationComparison);
        }
        this.hideBusyIndicator();
      },
      onCQDynamicAddItemPress: async function () {
        const oCompareQuotationHeader = this.getView().getModel('LocalModel').getProperty('/CompareQuotationHeader');
        // const aSupplierQuotation = await ODataServiceUtil.getSupplierQuotationForRFQ(oCompareQuotationHeader?.RequestForQuotation, this.getView());
        const aSupplierQuotation = await this._oDataServiceUtil.getSupplierQuotationForRFQ(oCompareQuotationHeader?.RequestForQuotation);
        const aSupplierQuotationData = Array.isArray(aSupplierQuotation) ? aSupplierQuotation : aSupplierQuotation?.value || [];

        const aSupplierQuotationItems = aSupplierQuotationData.flatMap((quotation) =>
          (quotation._SupplierQuotationItem || []).map((item) => ({
            ...item,
            SupplierCode: quotation.SupplierCode,
            SupplierName: quotation.SupplierName,
          })),
        );
        const aCompareQuotationItemData = this.getView().getModel('LocalModel').getProperty('/CompareQuotationItemData');
        const aFinalSupplierQuotationItemData = this.removeSelectedSupplierQuotationItemData(aSupplierQuotationItems, aCompareQuotationItemData);
        this.getView().getModel('LocalModel').setProperty('/SupplierQuotation', aSupplierQuotationData);
        this.getView().getModel('LocalModel').setProperty('/SupplierQuotationItem', aFinalSupplierQuotationItemData);
        this.oSQItemDialog ??= await this.loadFragment({
          name: 'nlab.ai.comparequotation.ext.fragment.SupplierQuotationSelection',
        });
        // this.setSelectedSupplierQuotationItemRow(aCompareQuotationItemData);
        this.getView().addDependent(this.oSQItemDialog);
        this.oSQItemDialog?.open();
      },
      onCQDynamicAddTermsAndConditionPress: async function () {
        this.oTermsAndConditionDialog ??= await this.loadFragment({
          name: 'nlab.ai.comparequotation.ext.fragment.AddTermsAndCondtion',
        });
        // this.setSelectedSupplierQuotationItemRow(aCompareQuotationItemData);
        this.getView().addDependent(this.oTermsAndConditionDialog);
        this.oTermsAndConditionDialog?.open();
      },
      checkWorkflowAndUpdateSection: async function (quotationComparison) {
        const sMode = this.getView().getModel('LocalModel').getProperty('/Mode');
        let oWorflowContext = this.getView().getModel('LocalModel').getProperty('/WorkflowDefination');
        const aWrokflowDef = await this._oDataServiceUtil.getWorkflowDefination(quotationComparison);
        const aWrokflowTrans = await this._oDataServiceUtil.getWorkflowTransaction(quotationComparison);
        const oWorkflowData = await this._arrangeWorkflowData(aWrokflowDef, aWrokflowTrans);
        const isUserValidApprover = await this._checkLoggedInUserIsValidApprover(oWorkflowData);
        this.getView().getModel('LocalModel').setProperty('/hasWorkflowApprovalEditAccess', false);
        this.getView().getModel('LocalModel').setProperty('/hasWorkflowApprovalAccess', false);
        if (isUserValidApprover) {
          this.getView().getModel('LocalModel').setProperty('/hasWorkflowApprovalAccess', true);
        }
        if (oWorkflowData?.CurrentTransactionVersion === 1) {
          this.getView().getModel('LocalModel').setProperty('/hasWorkflowApprovalEditAccess', true);
        }
        this.getView().getModel('LocalModel').setProperty('/Workflow', oWorkflowData);

        this.getView()
          .getModel('LocalModel')
          .setProperty('/WorkflowDefination', aWrokflowDef.length ? aWrokflowDef : oWorflowContext);
      },
      _arrangeWorkflowData: function (aWrokflowDef, aWrokflowTrans) {
        // let workflowDefSingleRow = null;
        const workflowComparison = this.getView().getModel('LocalModel').getProperty('/Workflow');
        workflowComparison.WorkFlowTransacationData = aWrokflowTrans && aWrokflowTrans.length > 0 ? aWrokflowTrans : [];
        workflowComparison.CurrentWorkflowDefination = aWrokflowDef;
        if (aWrokflowDef && aWrokflowDef.length) {
          const workflowDefSingleRow = aWrokflowDef[0];
          //get the quotationNo and current version to get only that version data
          const versionNo = workflowDefSingleRow?.versionNo;
          workflowComparison.CurrentDefinationVersion = versionNo;
          if (aWrokflowTrans && aWrokflowTrans.length) {
            // workflowComparison.workFlowTransacationData = aWrokflowTrans;
            const aCurrentDefTxn = aWrokflowTrans.filter((o) => o.Defversion === versionNo);
            const iLatestTxnVersion = Math.max(...aCurrentDefTxn.map((o) => o.VersionNo));
            workflowComparison.CurrentTransactionVersion = iLatestTxnVersion;
            const aLatestTxn = aCurrentDefTxn.filter((o) => o.VersionNo === iLatestTxnVersion).sort((a, b) => a.SeqNo - b.SeqNo);
            //Current WorkflowTransaction version
            workflowComparison.CurrentWorkflowTransaction = aLatestTxn.map((oTxn, index, aArray) => ({
              ...oTxn,
              id: String(oTxn.SeqNo),
              children: index + 1 < aArray.length ? [String(aArray[index + 1].SeqNo)] : null,
            }));
            //Current Transaction Steps
            workflowComparison.CurrentTransactionApproverStep = workflowComparison?.CurrentWorkflowTransaction?.find(
              (txn) => txn.VersionNo === iLatestTxnVersion && txn.Action === 'INPROGRESS',
            );
          }
        }
        return workflowComparison;
      },
      onAddSQFragmentAddPress: function () {
        const aSelectedSupplierQuotationItems = this.getSelectedSupplierQuotationItemData();
        console.log('Selected Quotation Items:', aSelectedSupplierQuotationItems);
        this.getView().getModel('LocalModel').setProperty('/supplierQuotationItemSelected', aSelectedSupplierQuotationItems);
        const oCompareQuotationHeader = this.getView().getModel('LocalModel').getProperty('/CompareQuotationHeader');
        const sMode = this.getView().getModel('LocalModel').getProperty('/Mode');
        const aCompareQuotationItemData = this.prepareCompareQuotationItemData();
        this.getView().getModel('LocalModel').setProperty('/CompareQuotationItemData', aCompareQuotationItemData);

        const aCompareQuotationRowsData = Utils.transformDataforComparisonTable(aCompareQuotationItemData);
        this.getView().getModel('LocalModel').setProperty('/CompareQuotationActualRowsData', aCompareQuotationRowsData?.actualRows);
        this.getView().getModel('LocalModel').setProperty('/CompareQuotationRowsData', aCompareQuotationRowsData?.filterRows);
        Utils.generateCOlumnsForComparisonTable(this.getView(), aCompareQuotationRowsData?.filterRows);

        this.oSQItemDialog?.close();
      },
      onAddSQFragmentCancelPress: function () {
        this.oSQItemDialog?.close();
      },

      onSaveMCQPress: async function () {
        this.showBusyIndicator();
        try {
          const oCompareQuotation = this.prepareCompareQuotationDataForSave();
          const aCompareQuotationRowsData = this.getView().getModel('LocalModel').getProperty('/CompareQuotationRowsData');
          const aCompareQuotationActualRowsData = this.getView().getModel('LocalModel').getProperty('/CompareQuotationActualRowsData');
          //merge all the columns
          const finalCompareQuotaionItemRows = Utils.mergeActualAndFilterRowData(aCompareQuotationActualRowsData, aCompareQuotationRowsData);
          const aTransFormedCompareQuotationItem = Utils.reverseTransformCompareQuotationItemData(oCompareQuotation, finalCompareQuotaionItemRows);
          this.getView().getModel('LocalModel').setProperty('/CompareQuotationItemData', aTransFormedCompareQuotationItem);
          // const aTermsAndConditoin = Utils.generateTermsAndConditions(oCompareQuotation, finalCompareQuotaionItemRows, aPreDefinedTermsAndCondition);
          const aTermsAndConditoin = this.prepareTermsAndConditionDataForSave();
          // aTransFormedCompareQuotationItem
          const aCompareQuotationItem = this.prepareCompareQuotationItemDataForSave();

          oCompareQuotation.ComparisonDate = oCompareQuotation.ComparisonDate
            ? oCompareQuotation.ComparisonDate instanceof Date
              ? oCompareQuotation.ComparisonDate.toISOString().split('T')[0]
              : oCompareQuotation.ComparisonDate
            : null;
          oCompareQuotation.RequisitionDate = oCompareQuotation.RequisitionDate
            ? oCompareQuotation.RequisitionDate instanceof Date
              ? oCompareQuotation.RequisitionDate.toISOString().split('T')[0]
              : oCompareQuotation.RequisitionDate
            : null;
          var sMode = this.getView().getModel('LocalModel').getProperty('/Mode');
          // const oResult = await this.callActionUpsertCompareQuotation(oCompareQuotation, aCompareQuotationItem, aTermsAndConditoin, sMode);
          const oResult = await this._oDataServiceUtil.saveQuotationComparison(oCompareQuotation, aCompareQuotationItem, aTermsAndConditoin, sMode);
          if (oResult?.status === 'Error') {
            sap.m.MessageToast.show(`Error on Create Quotation Comparison ${oResult?.message || oResult?.error}`);
            this.hideBusyIndicator();
          } else {
            this.getView().getModel('LocalModel').setProperty('/IsEditCompareQuotation', false);
            // this.hideBusyIndicator();
            await this.updateWorkflowDefAndTransaction(oResult?.quotationComparison, sMode);
            if (sMode === 'CREATE') {
              sap.m.MessageToast.show('Quotation Created successfully');
              // this.hideBusyIndicator();
              this.getRouter().navTo(
                'QuotationComparisonObjectPage',
                {
                  key: oResult?.quotationComparison,
                },
                true, // replace
              );
            } else {
              sap.m.MessageToast.show('Quotation Created successfully');
              this._loadViewONMode(oResult?.quotationComparison);
            }
          }
        } catch (error) {
          console.error('Error occurred:', error);
          // this.getView().setBusy(false);
          this.hideBusyIndicator();
          // this.oDialog.close();
        }
      },
      updateWorkflowDefAndTransaction: async function (quotationComparison, sMode) {
        try {
          const oWorflowContextToSave = this.getView().getModel('LocalModel').getProperty('/WorkflowDefination');
          await this._oDataServiceUtil.deleteWorkflowDefinition(quotationComparison);
          await this._oDataServiceUtil.saveWorkflowDefination(oWorflowContextToSave, quotationComparison);
          const aWFTransactionToSave = await this.prepareWorkflowTransaction(1, 'INPROGRESS');
          //Make sure only for defVersion one we are calling this delete
          const iCurrentDefinationVersion = this.getView().getModel('LocalModel').getProperty('/Workflow/CurrentDefinationVersion');
          if (iCurrentDefinationVersion === 1) {
            await this._oDataServiceUtil.deleteWorkflowTransaction(quotationComparison, 1, 1);
          }
          await this._oDataServiceUtil.saveWorkflowTransaction(aWFTransactionToSave);
        } catch (error) {
          console.log('Error during workflow Save', error?.message);
        }
      },
      prepareWorkflowTransaction: async function (currentStep, action, comment = '', reasonCode = '', approvedBy = '') {
        let aTransactionData = [];
        const aWorflowDefination = this.getView().getModel('LocalModel').getProperty('/WorkflowDefination');
        const aWorkflowTransaction = this.getView().getModel('LocalModel').getProperty('/WorkflowTransaction');
        // const loggedInUser = await this._oDataServiceUtil.getLoggedInUser();
        aWorflowDefination.forEach((oDef, index) => {
          let currentAction = 'ISPENDING';
          if (oDef.SeqNo <= currentStep) {
            currentAction = action;
          }
          if ((action === 'APPROVED' || action === 'REJECTED') && currentStep + 1 === oDef.SeqNo) {
            currentAction = 'INPROGRESS';
          }
          const eachTransaction = {
            QuotationComparison: oDef?.QuotationComparison,
            Defversion: oDef.versionNo ?? oDef.versionNo ?? 0,
            VersionNo: action === 'APPROVED' || action === 'REJECTED' ? currentStep + 1 : currentStep,
            SeqNo: oDef.SeqNo ?? index + 1,
            StageCode: oDef.StageCode ?? '',
            AssignedTo: oDef.ApproverValue ?? '',
            ApprovedBy: oDef.SeqNo === currentStep ? approvedBy : '',
            // ApprovedBy: loggedInUser?.email || '',
            Action: currentAction,
            Comments: oDef.SeqNo === currentStep ? comment : '',
            ReasonCode: reasonCode,
          };
          aTransactionData.push(eachTransaction);
        });
        // }
        return aTransactionData;
      },
      getSelectedSupplierQuotationItemData: function () {
        // const oTable = this.getView().byId("_IDGenQCManageFragmentTable");
        const oTable = this.getView().byId('_IDGenSQFragmentTable');
        const aSelectedIndices = oTable.getSelectedIndices();
        const aRows = oTable.getRows();

        const aSelectedObjects = aSelectedIndices
          .map((iIndex) => {
            const oRow = aRows[iIndex];
            if (oRow) {
              const oContext = oRow.getBindingContext('LocalModel');
              return oContext ? oContext.getObject() : null;
            }
            return null;
          })
          .filter((obj) => obj !== null);

        console.log('Selected Supplier Quotations', aSelectedObjects);
        return aSelectedObjects;
      },
      removeSelectedSupplierQuotationItemData: function (aSupplierItem, aItemToBeRemoved) {
        return aSupplierItem.filter((oRow) => {
          return !aItemToBeRemoved.some(
            (oItem) => oRow.SupplierQuotation === oItem.Supplierquotation && oRow.ItemNumber === oItem.Supplierquotationitem,
          );
        });
      },
      setSelectedSupplierQuotationItemRow: function (aItemToBeSelected) {
        if (!aItemToBeSelected || aItemToBeSelected.length === 0) {
          return;
        }
        // const oTable = this.getView().byId("_IDGenQCManageFragmentTable");
        const oTable = this.getView().byId('_IDGenSQFragmentTable');
        const oModel = oTable.getModel('LocalModel');
        const sPath = oTable.getBindingInfo('rows').path;
        const aTableData = oModel.getProperty(sPath);

        const aSelectedIndices = [];

        aItemToBeSelected.forEach((oItem) => {
          const iIndex = aTableData.findIndex((oRow) => {
            // Match by a unique key — adjust "SupplierQuotationID" to your actual key field
            return oRow.SupplierQuotation === oItem.Supplierquotation && oRow.ItemNumber === oItem.Supplierquotationitem;
          });
          if (iIndex !== -1) {
            // aSelectedIndices.push(iIndex);
            oTable.addSelectionInterval(iIndex, iIndex);
          }
        });

        // oTable.setSelectedIndices(aSelectedIndices);
      },
      prepareCompareQuotationDataForSave: function () {
        const oCompareQuotation = this.getView().getModel('LocalModel').getProperty('/CompareQuotationHeader');
        const oCompareQuotationToSave = {
          QuotationComparison: oCompareQuotation?.QuotationComparison || '',
          RequestForQuotation: oCompareQuotation?.RequestForQuotation || '',
          CompanyCode: oCompareQuotation?.CompanyCode || '',
          CompanyName: oCompareQuotation?.CompanyName || '',
          CompativeStatementTitle: oCompareQuotation?.CompativeStatementTitle || '',
          NameOfRequester: oCompareQuotation?.NameOfRequester || '',
          AccountAssignment: oCompareQuotation?.AccountAssignment || '',
          RequisitionNumber: oCompareQuotation?.RequisitionNumber || '',
          RequisitionDate: oCompareQuotation?.RequisitionDate || null,
          Purpose: oCompareQuotation?.Purpose || '',
          ComparisonDate: oCompareQuotation?.ComparisonDate || null,
        };
        return oCompareQuotationToSave;
      },
      prepareTermsAndConditionDataForSave: function () {
        const aCompareQuotationItems = this.getView().getModel('LocalModel').getProperty('/CompareQuotationItemData') || [];
        const aPreDefinedTerms = this.getView().getModel('LocalModel').getProperty('/TermsAndConditionDialog/PreDefinedTermsAndCondition');

        const aTermsAndConditions = [];
        // const aTermsAndConditions = [];

        // const aTermsAndConditions = [];

        aCompareQuotationItems.forEach((oCompareQuotationItem) => {
          let iItemNo = 1;

          aPreDefinedTerms.forEach((oTerm) => {
            const sKeyField = oTerm.KeyField;

            if (Object.prototype.hasOwnProperty.call(oCompareQuotationItem, sKeyField)) {
              aTermsAndConditions.push({
                QuotationComparison: oTerm?.Selectable ? '' : oCompareQuotationItem?.QuotationComparison,

                QuotationComparisonItem: oCompareQuotationItem?.SNo || '',

                ItemNo: String(iItemNo++).padStart(2, '0'),

                KeyField: sKeyField,

                ValueField:
                  oCompareQuotationItem[sKeyField] !== undefined && oCompareQuotationItem[sKeyField] !== null
                    ? String(oCompareQuotationItem[sKeyField])
                    : '',
              });
            }
          });
        });

        return aTermsAndConditions;
      },
      prepareCompareQuotationItemDataForSave: function () {
        const aSelectedItems = this.getView().getModel('LocalModel').getProperty('/CompareQuotationItemData') || [];
        const aCompareQuotationItem = [];

        aSelectedItems.forEach((item, index) => {
          var newQuotationComparisonItem = {
            QuotationComparison: item?.QuotationComparison || '',
            SNo: item?.SNo || '',
            Description: item?.Description || '',
            Material: item?.Material || '',
            Supplierquotation: item?.Supplierquotation || '',
            Supplierquotationitem: item?.Supplierquotationitem || '',
            Quantity: Number(item?.Quantity || 0).toFixed(2),
            // Quantity: item?.Quantity != null ? String(item.Quantity) : '0.00',
            Units: item?.Units || '',
            SupplierCode: item?.SupplierCode || '',
            SupplierName: item?.SupplierName || '',
            UnitRate: Number(item?.UnitRate || 0).toFixed(2),
            TotalAmount: Number(item?.TotalAmount || 0).toFixed(2),
            BcdPercent: Number(item?.BcdPercent || 0).toFixed(2),
            SwcPercentOnBcd: Number(item?.SwcPercentOnBcd || 0).toFixed(2),
            Gst: Number(item?.Gst || 0).toFixed(2),
            HsnCode: item?.HsnCode || '',
            // BcdPercent: item?.UnitRate != null ? String(item.UnitRate) : '0.00',
            // TotalAmount: item?.TotalAmount != null ? String(item.TotalAmount) : '0.00',
            Currency: item?.Currency || '',
            MaterialMake: item?.MaterialMake || '',
            Specifications: item?.Specifications || '',
            // ContactPerson: item?.ContactPerson || '',
            // PhoneNumber: item?.PhoneNumber || '',
            //ConversionRs: Number(item?.ConversionRs || 0).toFixed(2),
            ConvertedAmount: item?.ConvertedAmount || '',
            Specifications1: item?.Specifications1 || '',
            Specifications2: item?.Specifications2 || '',
            Specifications3: item?.Specifications3 || '',
            // AccountAssignment: item?.AccountingAssignment || '',
            // ModelNumber: item?.YY1_MaterialMake_PDI || '',
            // AccountAssignment:item?.AccountingAssignment || ''
          };

          aCompareQuotationItem.push(newQuotationComparisonItem);
        });

        return aCompareQuotationItem;
      },
      prepareCompareQuotationItemData: function () {
        const aSelectedItems = this.getView().getModel('LocalModel').getProperty('/supplierQuotationItemSelected') || [];
        const aCompareQuotationItem = [];
        const aCompareQuotationItemData = this.getView().getModel('LocalModel').getProperty('/CompareQuotationItemData');
        let snoIndex = 0;
        if (aCompareQuotationItemData && aCompareQuotationItemData.length) {
          snoIndex = aCompareQuotationItemData.length;
        }
        aSelectedItems.forEach((item, index) => {
          var newQuotationComparisonItem = {
            QuotationComparison: item?.QuotationComparison || '',
            SNo: ((snoIndex + 1) * 10).toString(),
            Description: item?.PurchasingDocumentItemText || '',
            Material: item?.Material || '',
            Supplierquotation: item?.SupplierQuotation || '',
            Supplierquotationitem: item?.ItemNumber || '',
            Quantity: item?.ScheduleLineOrderQuantity || 0,
            Units: item?.BaseUnit || '',
            SupplierCode: item?.SupplierCode || '',
            SupplierName: item?.SupplierName || '',
            UnitRate: item?.NetOrderPrice || 0,
            TotalAmount: item?.NetAmount || 0,
            Currency: item?.DocumentCurrency || '',
            MaterialMake: item?.YY1_MaterialMake_PDI || '',
            Specifications: item?.YY1_Specifications_PDI || '',
            //ModelNumber: item?.YY1_MaterialMake_PDI || '',
            ContactPerson: item?.ContactPerson || '',
            PhoneNumber: item?.PhoneNumber || '',
            ConvertedAmount: item?.PhoneNumber || '',
            Specifications1: item?.Specifications1 || '',
            Specifications2: item?.Specifications2 || '',
            Specifications3: item?.Specifications3 || '',
            // AccountAssignment: item?.AccountingAssignment || '',
          };

          aCompareQuotationItemData.push(newQuotationComparisonItem);
          snoIndex++;
        });

        return aCompareQuotationItemData;
      },
      prepareCQTermsAndConditionData: function (aCompareQuotationItem) {
        const aTermsAndCondition = [];
        aCompareQuotationItem.forEach((item, index) => {
          var newTermsAndCondtion = {
            QuotationComparison: item?.QuotationComparison || '',
            QuotationComparisonItem: item?.SNo || '',
            ItemNo: (index + 1).toString(),
            KeyField: '',
            KeyFieldDesc: '',
            ValueField: '',
            Field_Property: '',
          };
          aTermsAndCondition.push(newTermsAndCondtion);
        });

        return aTermsAndCondition;
      },
      callActionUpsertCompareQuotation: async function (oCompareQuotation, aCompareQuotationItem, aTermsAndCondition, sType) {
        try {
          console.log('quotationComparisontoSave', oCompareQuotation);
          console.log('quotationComparisonItemtoSave', aCompareQuotationItem);
          const oModel = this.editFlow.getView().getModel();
          const oAction = oModel.bindContext('/upsertCompareQuotation(...)');
          oAction.setParameter('quotationComparison', oCompareQuotation);
          oAction.setParameter('quotationComparisonItem', aCompareQuotationItem);
          oAction.setParameter('termsAndCondition', aTermsAndCondition);
          oAction.setParameter('type', sType);

          await oAction.execute();

          const oResult = oAction.getBoundContext().getObject();
          return oResult;
        } catch (oError) {
          console.error('Error calling action', oError);
          // this.oDialog.close();
          // this.getView().setBusy(false);
          this.hideBusyIndicator();
          throw oError;
        }
      },
      onCancelonMCQPress: function () {
        const sMode = this.getView().getModel('LocalModel').getProperty('/Mode');
        if (sMode === 'CREATE') {
          window.history.go(-1);
        } else {
          this.getView().getModel('LocalModel').setProperty('/IsEditCompareQuotation', false);
        }
      },
      onCompareQuotationEditPress: function () {
        this.getView().getModel('LocalModel').setProperty('/IsEditCompareQuotation', true);
      },
      onTCDialogAddPress: function () {
        this.getView().getModel('LocalModel').setProperty('/TermsAndConditionDialog/IsAddNewTC', true);
        this.getView().getModel('LocalModel').setProperty('/TermsAndConditionDialog/KeyFieldState', 'None');
        this.getView().getModel('LocalModel').setProperty('/TermsAndConditionDialog/KeyField', '');
        this.getView().getModel('LocalModel').setProperty('/TermsAndConditionDialog/KeyFieldValueState', 'None');
        this.getView().getModel('LocalModel').setProperty('/TermsAndConditionDialog/KeyFieldValue', '');
      },

      onTCDialogSavePress: function () {
        const oLocalModel = this.getView().getModel('LocalModel');

        const keyField = oLocalModel.getProperty('/TermsAndConditionDialog/KeyField');
        const keyFieldValue = oLocalModel.getProperty('/TermsAndConditionDialog/KeyFieldValue');

        let bValid = true;

        // Reset states
        oLocalModel.setProperty('/TermsAndConditionDialog/KeyFieldState', 'None');
        oLocalModel.setProperty('/TermsAndConditionDialog/KeyFieldValueState', 'None');

        // Check empty values
        if (!keyField?.trim()) {
          oLocalModel.setProperty('/TermsAndConditionDialog/KeyFieldState', 'Error');
          bValid = false;
        }

        if (!keyFieldValue?.trim()) {
          oLocalModel.setProperty('/TermsAndConditionDialog/KeyFieldValueState', 'Error');
          bValid = false;
        }

        // KeyField should NOT contain spaces or special characters
        const keyFieldRegex = /^[A-Za-z0-9_]+$/;

        if (keyField?.trim() && !keyFieldRegex.test(keyField)) {
          oLocalModel.setProperty('/TermsAndConditionDialog/KeyFieldState', 'Error');
          bValid = false;
        }

        if (bValid) {
          const aPreDefinedTermsAndCondition = this.getView()
            .getModel('LocalModel')
            .getProperty('/TermsAndConditionDialog/PreDefinedTermsAndCondition');
          aPreDefinedTermsAndCondition.push({
            KeyField: keyField,
            KeyFieldDesc: keyFieldValue,
          });
          this.getView().getModel('LocalModel').setProperty('/TermsAndConditionDialog/PreDefinedTermsAndCondition', aPreDefinedTermsAndCondition);
          this.getView().getModel('LocalModel').setProperty('/TermsAndConditionDialog/IsAddNewTC', false);
        }
      },
      onTCDialogCancelPress: function () {
        this.getView().getModel('LocalModel').setProperty('/TermsAndConditionDialog/IsAddNewTC', false);
        this.getView().getModel('LocalModel').setProperty('/TermsAndConditionDialog/KeyFieldState', 'None');
        this.getView().getModel('LocalModel').setProperty('/TermsAndConditionDialog/KeyField', '');
        this.getView().getModel('LocalModel').setProperty('/TermsAndConditionDialog/KeyFieldValueState', 'None');
        this.getView().getModel('LocalModel').setProperty('/TermsAndConditionDialog/KeyFieldValue', '');
      },
      onAddTCFragmentAddPress: function () {
        // TermsAndConditionSelectedkey
        const aSelectedKey = this.getView().getModel('LocalModel').getProperty('/TermsAndConditionDialog/TermsAndConditionSelectedkey');

        const aPreDefinedTermsAndCondition = this.getView()
          .getModel('LocalModel')
          .getProperty('/TermsAndConditionDialog/PreDefinedTermsAndCondition');

        const aSelectedTermsAndConditionToApply = aPreDefinedTermsAndCondition.filter((oItem) => aSelectedKey.includes(oItem.KeyField));

        const aCompareQuotationRowsData = this.getView().getModel('LocalModel').getProperty('/CompareQuotationRowsData');
        const aSupplierNames = Object.keys(aCompareQuotationRowsData[0]);
        aSelectedTermsAndConditionToApply.forEach((oTC) => {
          const oNewRow = {
            property: oTC.KeyField,
          };

          Object.keys(aCompareQuotationRowsData[0])
            .filter((sKey) => sKey !== 'property')
            .forEach((sSupplierColumn) => {
              oNewRow[sSupplierColumn] = oTC.KeyFieldValue;
            });

          aCompareQuotationRowsData.push(oNewRow);
        });
        // aSelectedTermsAndConditionToApply.forEach(oTC => {

        //     const oNewRow = {
        //         property: oTC.KeyField
        //     };

        //     aSupplierNames.forEach(sSupplier => {
        //         oNewRow[sSupplier] = oTC.KeyFieldValue;
        //     });

        //     aCompareQuotationRowsData.push(oNewRow);
        // });

        this.getView().getModel('LocalModel').setProperty('/CompareQuotationRowsData', aCompareQuotationRowsData);
        this.oTermsAndConditionDialog?.close();
      },
      onAddTCFragmentCancelPress: function () {
        this.oTermsAndConditionDialog?.close();
      },
      //WorkFlow methods
      onDropSelectedProductsTable: function (oEvent) {
        const oView = this.getView();
        var oDraggedItem = oEvent.getParameter('draggedControl');
        var oDraggedItemContext = oDraggedItem.getBindingContext('LocalModel');
        var findContextObject = oDraggedItemContext?.getObject();
        if (!oDraggedItemContext || findContextObject?.SeqNo === 1) {
          return;
        }

        var oRanking = WorkflowUtils.ranking;
        var iNewRank = oRanking.Default;
        var oDroppedItem = oEvent.getParameter('droppedControl');

        if (oDroppedItem instanceof ColumnListItem) {
          // get the dropped row data
          var sDropPosition = oEvent.getParameter('dropPosition');
          var oDroppedItemContext = oDroppedItem.getBindingContext('LocalModel');
          var iDroppedItemRank = oDroppedItemContext.getProperty('Rank');
          var oDroppedTable = oDroppedItem.getParent();
          var iDroppedItemIndex = oDroppedTable.indexOfItem(oDroppedItem);

          // find the new index of the dragged row depending on the drop position
          var iNewItemIndex = iDroppedItemIndex + (sDropPosition === 'After' ? 1 : -1);
          var oNewItem = oDroppedTable.getItems()[iNewItemIndex];
          if (!oNewItem) {
            // dropped before the first row or after the last row
            iNewRank = oRanking[sDropPosition](iDroppedItemRank);
          } else {
            // dropped between first and the last row
            var oNewItemContext = oNewItem.getBindingContext('LocalModel');
            iNewRank = oRanking.Between(iDroppedItemRank, oNewItemContext.getProperty('Rank'));
          }
        }

        // set the rank property and update the model to refresh the bindings
        var oSelectedProductsTable = WorkflowUtils.getSelectedProductsTable(oView);
        var oProductsModel = oSelectedProductsTable.getModel('LocalModel');
        oProductsModel.setProperty('Rank', iNewRank, oDraggedItemContext);
      },
      ResetSequenceWorkflowPress: async function (oEvent) {
        const oCompareQuotationHeader = this.getView().getModel('LocalModel').getProperty('/CompareQuotationHeader');
        const oLocalJSONModelData = await this._readLocalMOdelJSONFile();
        let aWrokflowDef = [];
        // if (oCompareQuotationHeader && oCompareQuotationHeader?.QuotationComparison) {
        //   aWrokflowDef = await this._oDataServiceUtil.getWorkflowDefination(oCompareQuotationHeader?.QuotationComparison);
        // }
        this.getView().getModel('LocalModel').setProperty('/WorkflowDefination', oLocalJSONModelData?.WorkflowDefination);
        // this.getView()
        //   .getModel('LocalModel')
        //   .setProperty('/WorkflowDefination', aWrokflowDef.length ? aWrokflowDef : oLocalJSONModelData?.WorkflowDefination);
      },

      onBeforeOpenContextMenu: function (oEvent) {
        oEvent.getParameters().listItem.setSelected(true);
      },

      ///Formatter************************************
      processFlowStateFormatter: function (sAction) {
        let stateValue = 'Neutral';
        switch (sAction) {
          case 'INPROGRESS':
            stateValue = 'Critical';
            break;
          case 'ISPENDING':
            stateValue = 'Neutral';
            break;
          case 'APPROVED':
            stateValue = 'Positive';
            break;
          case 'REJECTED':
            stateValue = 'Negative';
            break;

          default:
            break;
        }
        return stateValue;
      },

      processFlowIconSrcFormatter: function (sStageCode) {
        let stateValue = 'sap-icon://order-status';
        switch (sStageCode) {
          case 'INITIATOR_PURCHASE':
            stateValue = 'sap-icon://order-status';
            break;
          case 'REVIEWER_PURCHASE':
            stateValue = 'sap-icon://monitor-payments';
            break;
          case 'HOD_PURCHASE':
            stateValue = 'sap-icon://payment-approval';
            break;
          case 'TECH_APPROVAL':
            stateValue = 'sap-icon://money-bills';
            break;
          case 'COMM_APPROVAL':
            stateValue = 'sap-icon://payment-approval';
            break;
          case 'FINAL_HOD':
            stateValue = 'sap-icon://nurse';
            break;
          case 'MANAGING_DIRECTOR':
            stateValue = 'sap-icon://retail-store';
            break;

          default:
            break;
        }
        return stateValue;
      },
      processFlowStateTextFormatter: function (sAction) {
        let stateValue = 'Neutral';
        switch (sAction) {
          case 'INPROGRESS':
            stateValue = 'Critical';
            break;
          case 'ISPENDING':
            stateValue = 'Planned';
            break;
          case 'APPROVED':
            stateValue = 'Positive';
            break;
          case 'REJECTED':
            stateValue = 'Negative';
            break;

          default:
            break;
        }
        return sAction;
      },
      processFlowTextsFormatter: function (currentObject) {
        const text1 = currentObject?.ApprovedBy ? `Approved By: ${currentObject?.ApprovedBy}` : '';
        const text2 = currentObject?.Comments ? `Comment: ${currentObject?.Comments}` : '';
        return [text1, text2];
      },
      onCompareQuotationApprovePress: async function () {
        this.getView().getModel('LocalModel').setProperty('/Workflow/Action', 'APPROVED');
        this.getView().getModel('LocalModel').setProperty('/Workflow/Comment', '');
        this.getView().getModel('LocalModel').setProperty('/Workflow/CommentState', 'None');
        this.getView().getModel('LocalModel').setProperty('/Workflow/ReasonCode', '');
        this.getView().getModel('LocalModel').setProperty('/Workflow/ReasonCodeState', 'None');
        this.oApproveRejectDialog ??= await this.loadFragment({
          name: 'nlab.ai.comparequotation.ext.fragment.ApproveOrReject',
        });
        this.getView().addDependent(this.oApproveRejectDialog);
        this.oApproveRejectDialog?.open();
      },
      onCompareQuotationRejectPress: async function () {
        this.getView().getModel('LocalModel').setProperty('/Workflow/Action', 'REJECTED');
        this.getView().getModel('LocalModel').setProperty('/Workflow/Comment', '');
        this.getView().getModel('LocalModel').setProperty('/Workflow/CommentState', 'None');
        this.getView().getModel('LocalModel').setProperty('/Workflow/ReasonCode', '');
        this.getView().getModel('LocalModel').setProperty('/Workflow/ReasonCodeState', 'None');
        this.oApproveRejectDialog ??= await this.loadFragment({
          name: 'nlab.ai.comparequotation.ext.fragment.ApproveOrReject',
        });
        this.getView().addDependent(this.oApproveRejectDialog);
        this.oApproveRejectDialog?.open();
      },
      onAORFragmentApproveOrRejectPress: async function () {
        const oWorkflow = this.getView().getModel('LocalModel').getProperty('/Workflow');
        if (!oWorkflow.Comment) {
          this.getView().getModel('LocalModel').setProperty('/Workflow/CommentState', 'Error');
          return;
        }
        if (oWorkflow.Action === 'REJECTED' && !oWorkflow.ReasonCode) {
          this.getView().getModel('LocalModel').setProperty('/Workflow/ReasonCodeState', 'Error');
          return;
        }
        this.getView().getModel('LocalModel').setProperty('/Workflow/CommentState', 'None');
        this.getView().getModel('LocalModel').setProperty('/Workflow/ReasonCodeState', 'Error');
        const sCompareQuoationId = this.getView().getModel('LocalModel').getProperty('/CompareQuotationHeader/QuotationComparison');
        const oWorflowContextToSave = this.getView().getModel('LocalModel').getProperty('/WorkflowDefination');
        const loggedInUser = await this._oDataServiceUtil.getLoggedInUser();
        const aWFTransactionToSave = await this.prepareWorkflowTransaction(
          oWorkflow?.CurrentTransactionVersion,
          oWorkflow?.Action,
          oWorkflow?.Comment,
          oWorkflow?.ReasonCode,
          loggedInUser?.email,
        ); //REJECTED
        await this._oDataServiceUtil.saveWorkflowTransaction(aWFTransactionToSave);
        if (oWorkflow.Action === 'REJECTED') {
          oWorflowContextToSave.forEach((eachDef) => {
            eachDef.versionNo = eachDef.versionNo + 1;
          });
          this.getView().getModel('LocalModel').setProperty('/WorkflowDefination', oWorflowContextToSave);
          await this._oDataServiceUtil.saveWorkflowDefination(oWorflowContextToSave, sCompareQuoationId);
        }
        this.oApproveRejectDialog?.close();
        // await this._oDataServiceUtil.deleteWorkflowTransaction(quotationComparison, 1);
      },
      onAORFragmentCancelPress: function () {
        this.oApproveRejectDialog?.close();
      },
    });
  },
);
