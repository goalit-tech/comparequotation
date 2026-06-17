sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"nlab/ai/comparequotation/test/integration/pages/QuotationComparisonMain"
], function (JourneyRunner, QuotationComparisonMain) {
    'use strict';

    var runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('nlab/ai/comparequotation') + '/test/flp.html#app-preview',
        pages: {
			onTheQuotationComparisonMain: QuotationComparisonMain
        },
        async: true
    });

    return runner;
});

