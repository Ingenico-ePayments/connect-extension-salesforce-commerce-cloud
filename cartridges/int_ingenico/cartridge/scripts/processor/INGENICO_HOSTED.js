/**
 * INGENICO_HOSTED.js
 * Handle payment validation and authorization for hosted checkouts.
 *
 * https://epayments-api.developer-ingenico.com/s2sapi/v1/en_US/json/hostedcheckouts/create.html
 */
'use strict';

/* API Includes */
var PaymentMgr = dw.order.PaymentMgr;
var Transaction = dw.system.Transaction;
var ServiceRegistry = dw.svc.ServiceRegistry;
var Money = dw.value.Money;
var Logger = dw.system.Logger.getLogger("Ingenico");

/* Site Genesis imports */
var app = require('sitegenesis_storefront_controllers/cartridge/scripts/app');
var Cart = require('sitegenesis_storefront_controllers/cartridge/scripts/models/CartModel');

/* Script Modules */
var IngenicoPayments = require('../order/IngenicoPayments');
var IngenicoOrderHelper = require('../utils/IngenicoOrderHelper');

/**
 * Verifies a credit card against a valid card number and expiration date and possibly invalidates invalid form fields.
 * If the verification was successful a credit card payment instrument is created.
 * @param {{Basket: dw.order.Basket}} args Contains the basket object
 * @returns {Object} Returns either error:true or success:true
 */
function Handle(args) {
    var cart = Cart.get(args.Basket);
    var paymentMethod = session.forms.billing.paymentMethods.selectedPaymentMethodID.value
	Transaction.wrap(function () {
        IngenicoOrderHelper.removeExistingPaymentMethods(args.Basket);
        var paymentInstrument = cart.createPaymentInstrument(paymentMethod, cart.getNonGiftCertificateAmount());
    });
    return {success: true};
}

/**
 * Authorizes a payment using a credit card. The payment is authorized by using the BASIC_CREDIT processor
 * only and setting the order no as the transaction ID. Customizations may use other processors and custom
 * logic to authorize credit card payment.
 * @param {{Order: dw.order.Order, PaymentInstrument:dw.order.OrderPaymentInstrument}} args Contains Order and PaymentInstrument object used to complete payment authorization and submit the order or fail and return to checkout
 * @returns {Object} Returns either error:true (fails order) or end:true (waits for 3rd party verification)
 */
function Authorize(args) {
    var paymentProcessor = PaymentMgr.getPaymentMethod(args.PaymentInstrument.getPaymentMethod()).getPaymentProcessor();
    // Set paymentProcessor for this transaction
    Transaction.wrap(function() {
    	args.PaymentInstrument.getPaymentTransaction().setPaymentProcessor(paymentProcessor);
    });

    var result = IngenicoPayments.createHostedPayment(args.Order, args.PaymentInstrument);

    if(result.error){
    	return {error: true};
    }else{
        if (result.actionRequired === true ) {
            Transaction.wrap(function() {
                args.PaymentInstrument.getPaymentTransaction().getCustom().ING_hostedCheckoutId = result.hostedCheckoutId;
            });
            if(result.merchantAction.actionType === 'REDIRECT'){
                session.getPrivacy().payment3DSCode = result.merchantAction.redirectData.RETURNMAC;
                session.getPrivacy().pendingOrderNo = args.Order.getOrderNo();
                session.getPrivacy().pendingOrder = args.Order;
                session.getPrivacy().redirect3DS = result.merchantAction.redirectData.redirectURL;
                session.getPrivacy().titleMsg3DS = "payment.id.verification.title.hosted"
                response.redirect(dw.web.URLUtils.https("COVerification-Verify"));
                return { end: true };
            }
        }
    }

    Logger.error("Something went wrong with hosted authorization. Should never reach here: " + JSON.stringify(result));
    // Should not reach here if there is an error
    return {error: true};    
}

/*
 * Module exports
 */

/*
 * Local methods
 */
exports.Handle = Handle;
exports.Authorize = Authorize;