/**
 * INGENICO_PROCESSOR.js
 * Handle payment validation and authorization for credit cards in a server to server configuration for transactions via API.
 *
 * https://epayments-api.developer-ingenico.com/s2sapi/v1/en_US/json/payments/create.html
 */
'use strict';

/* API Includes */
var PaymentMgr = dw.order.PaymentMgr;
var Logger = dw.system.Logger.getLogger("Ingenico");
var Status = dw.system.Status;


/* Site Genesis imports */

/* Script Modules */
var IngenicoPayments = require('../order/IngenicoPayments');
var PaymentProcessors = require('../config').PaymentProcessors;

/**
 * 
 * @param {dw.order.Order} order 
 * @param {dw.order.OrderPaymentInstrument} paymentInstrument 
 * @param {String} cvv 
 * @returns {dw.system.Status}
 */
function authorizeCreditCard(order, paymentInstrument, cvv){
    if(!cvv){
        return new Status(Status.ERROR,"MISSING_DETAILS","Missing CVV details. Please check and submit again.");
    }

    if(paymentInstrument.creditCardNumber.match(/^\*+/)){
        return new Status(Status.ERROR,"MISSING_DETAILS","Please check the complete card number and CVV and try again.");
    }

    var paymentProcessor = PaymentMgr.getPaymentMethod(paymentInstrument.getPaymentMethod()).getPaymentProcessor();
    paymentInstrument.getPaymentTransaction().setPaymentProcessor(paymentProcessor);
    var cardDetails = {
        cardnum: paymentInstrument.getCreditCardNumber(),
        cvv: cvv
    }

    var result = IngenicoPayments.createPayment(order,paymentInstrument,cardDetails,true);
    if(result.error){
        return new Status(Status.ERROR);
    }
    return new Status(Status.OK);
}

/**
 * Removes HPP payment methods
 * @param {Object} paymentMethodResultWO https://documentation.demandware.com/DOC1/topic/com.demandware.dochelp/OCAPI/17.7/shop/Documents/PaymentMethodResult.html?cp=0_12_5_75 
 */
function modifyGETResponse(paymentMethodResultWO) {
    var applicable_payment_methods = paymentMethodResultWO.applicable_payment_methods.toArray();
    paymentMethodResultWO.applicable_payment_methods = applicable_payment_methods.filter(function(el){
        var paymentProcessor = PaymentMgr.getPaymentMethod(el.id).getPaymentProcessor();
        if(!paymentProcessor) return true;
        if(paymentProcessor.getID() == PaymentProcessors.INGENICO_HOSTED){
            return false;
        }
        return true;
    });
    return new Status(Status.OK);
}

/*
 * Module exports
 */

/*
 * Local methods
 */
exports.authorizeCreditCard = authorizeCreditCard;
exports.modifyGETResponse = modifyGETResponse;