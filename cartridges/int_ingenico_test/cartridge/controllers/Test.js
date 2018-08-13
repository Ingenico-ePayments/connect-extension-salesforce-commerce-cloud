/**
* Description of the Controller and the logic it provides
*
* @module  controllers/Test
*/

'use strict';

/* API Includes */
var ServiceRegistry = dw.svc.ServiceRegistry;
var OrderMgr = dw.order.OrderMgr;
var Site = dw.system.Site;
var Transaction = dw.system.Transaction;
var Status = dw.system.Status;
var URLUtils = dw.web.URLUtils;
var Logger = dw.system.Logger.getLogger("Ingenico-Test");
let isml = dw.template.ISML;

/* Site Genesis imports */
var app = require('sitegenesis_storefront_controllers/cartridge/scripts/app');
var guard = require('sitegenesis_storefront_controllers/cartridge/scripts/guard');

/* Script Modules */
var Config = require('../../../int_ingenico/cartridge/scripts/config');
var Ingenico = require('../../../int_ingenico/cartridge/scripts/service/IngenicoSvc');

// HINT: do not put all require statements at the top of the file
// unless you really need them for all functions

/**
* Test-Start - Loads forms
*/
function Start() {
    isml.renderTemplate("teststart", {
        VERSION: Config.VERSION.shoppingCartExtension.version,
        BUILD: Config.VERSION.shoppingCartExtension.extensionID,
        ContinueURL: URLUtils.https('Test-HandleCC'),
        CurrentForms: session.forms,
        CONFIG: Config
    });
}

/**
 * Handle CC form 
 */
function HandleForm(info) {
	response.setHttpHeader(response.ACCESS_CONTROL_ALLOW_ORIGIN,"http://" + Site.getCurrent().getHttpHostName());
	var form = request.getTriggeredForm();
	var formId = null;

	if (!request.triggeredForm) {
		var fields = request.httpParameters.keySet().toArray().toString().split(',');
		sendJSON(request.httpParameters.keySet().toArray(), { error: "Missing action" });
		return;
	}

	formId = request.triggeredForm.formId;

	switch (formId) {
		case 'newCreditCard':
			app.getForm(formId).handleAction({
				create: function () {
					auth();
				},
				card_type: function(){
					cardType();
				}
			});
			break;
		case 'captureFromAuth':
			app.getForm(formId).handleAction({
				capture: function () {
					capturePayment();
				},
				captureslist: function () {
					listCapturePayment();
				},
				status: function () {
					paymentStatus();
				},
				cancel: function () {
					cancelPayment();
				},
				approvefraud: function () {
					approveFraud();
				},
				approvepending: function () {
					approvePending();
				},
				undocapture: function () {
					undoCapture();
				},
				tokenize: function () {
					tokenizePayment();
				}

			});
			break;
		case 'refundPayment':
			app.getForm(formId).handleAction({
				refund: function () {
					refundPayment();
				},
				view: function () {
					viewRefund()
				},
				approve: function () {
					refundApprove()
				},
				undoapproval: function () {
					refundUndoApproval()
				},
				cancel: function () {
					cancelRefund();
				}
			});
            break;
        case 'products':
            app.getForm(formId).handleAction({
                productlist: function () {
                    productList();
                }
            });
            break;
        default:
            var fields = request.httpParameters.keySet().toArray().toString().split(',');
            sendJSON(request.httpParameters.keySet().toArray(), { error: "Missing form", form: formId });
            break;

	}


}

function auth() {
    var form = app.getForm('newCreditCard');
    var params = {
		customerID: form.get('customerID').value(),
		basket: form.get('basket').value(),
		amount: Number(form.get('amount').value()) * 100,
		currency: form.get('currency').value(),
		productID: form.get('productID').value(),
		cc_name: form.get('cc_name').value(),
		cc_number: form.get('cc_number').value(),
		cc_expiry: form.get('cc_expiry').value(),
		cc_cvv: form.get('cc_cvv').value(),
		cc_Skip3DS: form.get('cc_Skip3DS').value()
	}

    var payload = {
        "order" : {
            "amountOfMoney" : {
                "currencyCode" : params.currency,
                "amount" : params.amount
            },
            "customer" : {
                "merchantCustomerId" : params.customerID,
                "personalInformation" : {
                    "name" : {
//							"title" : "Mr.",
                        "firstName" : "Fixed",
//							"surnamePrefix" : "P.",
                        "surname" : "Name"
                    },
//						"dateOfBirth" : "19710130"
                },
                "locale" : "en_US",
                "billingAddress" : {
                    "street" : "Desertroad",
                    "houseNumber" : "13",
                    "additionalInfo" : "b",
                    "zip" : "84536",
                    "city" : "Monument Valley",
                    "state" : "Utah",
                    "countryCode" : "US"
                },
                "shippingAddress" : {
                    "name" : {
//							"title" : "Miss",
                        "firstName" : "Road",
                        "surname" : "Runner"
                    },
                    "street" : "Desertroad",
                    "houseNumber" : "1",
                    "additionalInfo" : "Suite II",
                    "zip" : "84536",
                    "city" : "Monument Valley",
                    "state" : "Utah",
                    "countryCode" : "US"
                },
                "contactDetails" : {
                    "emailAddress" : "t.test@test.com",
//						"phoneNumber" : "+1234567890",
//						"faxNumber" : "+1234567891",
                },
            },
            "references" : {
                "merchantOrderId" : Math.round(Date.now() / 100000),
                "merchantReference" : params.basket,
                "invoiceData" : {
                    "invoiceNumber" : "000000123",
                    "invoiceDate" : "20170723191500"
                },
                "descriptor" : "Test description"
            },
            "items" : [
                {
                    "amountOfMoney" : {
                        "currencyCode" : params.currency,
                        "amount" : params.amount
                    },
                    "invoiceData" : {
                        "nrOfItems" : "12",
                        "pricePerItem" : Math.round(Number(params.amount) / 12),
                        "description" : "Aspirin"
                    }
                }
            ]
        },
        "cardPaymentMethodSpecificInput" : {
            // "authorizationMode": ,
            "paymentProductId" : params.productID,
            "skipAuthentication" : params.cc_Skip3DS,
            "returnUrl": "https://www.google.com",
            "card" : {
                "cvv" : params.cc_cvv,
                "cardNumber" : params.cc_number,
                "expiryDate" : params.cc_expiry,
                "cardholderName" : params.cc_name
            }
        },
        "externalCardholderAuthenticationData": params.externalVerification
	}

	try {
		var result = Ingenico.createPayment(payload);
	} catch (e) {
		var result = { error: e.toString(), typeError: e instanceof TypeError, apiError: e instanceof APIException };
	}

	sendJSON(payload, result);
}

function cardType() {
	var form = app.getForm('newCreditCard');
	var payload = {
		bin: form.get('cc_number').value()
    }
    
	try {
		var result = Ingenico.getCardType(payload);
	} catch (e) {
		var result = { error: e.toString(), typeError: e instanceof TypeError, apiError: e instanceof APIException };
	}

    sendJSON(payload, result);
}

function paymentStatus() {
	var form = app.getForm('captureFromAuth');
	var payload = {
		paymentID: form.get('paymentID').value(),
	}

	var result = Ingenico.getPaymentStatus(payload);
    sendJSON(payload, result);
}


function cancelPayment() {
	var form = app.getForm('captureFromAuth');
	var payload = {
		paymentID: form.get('paymentID').value(),
	}

	var result = Ingenico.cancelPaymentTransaction(payload);

    sendJSON(payload, result);
}

function approveFraud() {
	var form = app.getForm('captureFromAuth');
	var payload = {
		paymentID: form.get('paymentID').value(),
	}

	var result = Ingenico.approveFraudPending(payload);

	sendJSON(payload, result);
}

function approvePending() {
	var form = app.getForm('captureFromAuth');
	var payload = {
        paymentID: form.get('paymentID').value(),
        reqData: {}
	}

	var result = Ingenico.approvePaymentPending(payload);

	sendJSON(payload, result);
}

function tokenizePayment() {
	var form = app.getForm('captureFromAuth');
	var payload = {
        paymentID: form.get('paymentID').value(),
        reqData: {
            alias: ""
        }
	}

	var result = Ingenico.tokenizePayment(payload);

	sendJSON(payload, result);
}

function capturePayment() {
	var form = app.getForm('captureFromAuth');
	var payload = {
        paymentID: form.get('paymentID').value(),
        reqData: {
            amount: Number(form.get('amount').value()) * 100,
            isFinal: true
        }
	}

	var result = Ingenico.capturePayment(payload);

	sendJSON(payload, result);
}

function listCapturePayment() {
	var form = app.getForm('captureFromAuth');
	var payload = {
        paymentID: form.get('paymentID').value()
	}

	var result = Ingenico.listCaptures(payload);

	sendJSON(payload, result);
}

function undoCapture() {
	var form = app.getForm('captureFromAuth');
	var payload = {
		paymentID: form.get('paymentID').value(),
	}

	var result = Ingenico.undoCapture(payload);

	sendJSON(payload, result);
}

function refundPayment() {
    var form = app.getForm('refundPayment');
        
    var payload = {
        paymentID: form.get('paymentID').value(),
        reqData: {
            "refundReferences" : {
                "merchantReference" : form.get('reference').value()
            },
            "amountOfMoney" : {
                "currencyCode" : form.get('currency').value(),
                "amount" : Number(form.get('amount').value()) * 100
            },
            "refundDate" : dw.util.StringUtils.formatDate(new Date(),"YYYYMMdd")
        }
    };

	var result = Ingenico.refundPayment(payload);

	sendJSON(payload, result);
}

function viewRefund() {
	var form = app.getForm('refundPayment');
	var payload = {
		refundID: form.get('refundID').value(),
	}

	var result = Ingenico.getRefundStatus(payload);

	sendJSON(payload, result);
}

function refundApprove() {
	var form = app.getForm('refundPayment');
	var payload = {
        refundID: form.get('refundID').value(),
        reqData:{
            amount: (form.get('amount').value()?Number(form.get('amount').value()) * 100:"")
        }
	}

	var result = Ingenico.refundApproval(payload);

	sendJSON(payload, result);
}

function refundUndoApproval() {
	var form = app.getForm('refundPayment');
	var payload = {
        refundID: form.get('refundID').value()
	}

	var result = Ingenico.undoRefundApproval(payload);

	sendJSON(payload, result);
}

function cancelRefund() {
	var form = app.getForm('refundPayment');
	var payload = {
		refundID: form.get('refundID').value(),
	}

	var result = Ingenico.cancelRefund(payload);

	sendJSON(payload, result);
}

function productList(){
	var form = app.getForm('products');
	var payload = {
		currencyCode: form.get('currency').value(),
		countryCode: form.get('countrycode').value(),
		hide: form.get('hide').value(),
	}

    var result = Ingenico.listProducts(payload);
	sendJSON(payload, result);    
}

function sendJSON(payload, result){
    response.addHttpHeader("Content-Type", "application/json"); 
    response.getWriter().print(JSON.stringify({ payload: payload, result: result }, null, 4));
}

/*
* Web exposed methods
*/

/** Starting point to verify payment transaction
 * @see module:controllers/Test~Start */
exports.Start = guard.ensure(['get','https'], Start);

/** Starting point to verify payment transaction
 * @see module:controllers/Test~HandleCC */
 exports.HandleCC = guard.ensure(['post','https'], HandleForm);
