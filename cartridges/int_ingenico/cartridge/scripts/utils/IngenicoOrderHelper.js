/**
 * IngenicoOrderHelper.js
 * Helper methods to work with orders and payment instruments
 */

/* API Includes */
var Site = dw.system.Site;
var Transaction = dw.system.Transaction;
var Logger = dw.system.Logger.getLogger("Ingenico");

/* Script Modules */
var IngenicoConfig = require('../config');

/**
 * Loops through all payment instruments associated with the order and returns the Ingenico one
 * @param {dw.order.Order} order Order object
 * @param {String} id Ingenico Payment Transaction ID
 * @returns {dw.order.OrderPaymentInstrument} Returns the payment instrument associated with an Ingenico Processor
 */
function GetIngenicoPaymentInstrument(order, id){
    if(!order || !order.getPaymentInstruments()) return;

    var paymentInstruments = order.getPaymentInstruments();
    if(!paymentInstruments) return;

    var paymentInstrument = null;

    paymentInstruments.toArray().filter(function(pi){
        var paymentProcessor = dw.order.PaymentMgr.getPaymentMethod(pi.paymentMethod).getPaymentProcessor();
        if(paymentProcessor.getID() === IngenicoConfig.PaymentProcessors.INGENICO_HOSTED || paymentProcessor.getID() === IngenicoConfig.PaymentProcessors.INGENICO_CREDIT){
            var transaction = pi.getPaymentTransaction();
            if(transaction){
                var transactionId = transaction.getTransactionID();
                if(transactionId && id && transactionId != id){
                    return;
                }    
            }
            paymentInstrument = pi;
        }
    });

    return  paymentInstrument;
}

/**
 * Process token response from a Hosted Payment transaction
 * @param {dw.customer.Customer} customer  Customer object that will be updated
 * @param {String} tokens String comma separated with list of tokens
 * @param {Object} cardOutput Object with card payload
 */
function ProcessHostedTokens(customer, tokens, cardOutput){
    if(!customer) return null;

    var newToken = ExtractNewTokensFromResult(customer, tokens);
    if(newToken && newToken.length > 0 && cardOutput && cardOutput.paymentProductId && cardOutput.card && cardOutput.card.cardNumber && cardOutput.card.expiryDate){
        var paymentObj = {
            productId: cardOutput.paymentProductId,
            maskedCardNumber: cardOutput.card.cardNumber,
            expiryMonth: Number(cardOutput.card.expiryDate.substr(0,2)),
            expiryYear: Number(("20" + cardOutput.card.expiryDate.substr(2,2))),
            token: newToken[0]
        }
        CreateUpdateCustomerTokens(customer, paymentObj);
    }
    return null;
}
/**
 * Return array of tokens that are not already stored
 * @param {dw.customer.Customer} customer 
 * @param {String} tokens 
 * @returns {[String]} An array of token strings that don't match the ones already stored
 */
function ExtractNewTokensFromResult(customer,tokens){
    if(!customer) return null;
    
    var currentTokens = GetTokensForCustomer(customer);
    var newTokens = tokens.split(",");
    if(newTokens.length == 0) return [];
    if(currentTokens.length == 0) return newTokens;

    return newTokens.filter(function(el,indx){
        if(currentTokens.indexOf(el) > -1) return false;
        return true;
    });
}

/**
 * Create or Update payment instrument with token
 * @param {dw.customer.Customer} customer 
 * @param {{productId: String, maskedCardNumber: String, expiryMonth: Number, expiryYear: Number, token: String}} paymentInstrument 
 */
function CreateUpdateCustomerTokens(customer, paymentInstrument){
    if(customer && customer.registered && paymentInstrument && paymentInstrument.token){
        Transaction.wrap(function () {
            var storedToken = false;
            /**
             * @type {dw.customer.Wallet}
             */
            var wallet = customer.profile.getWallet();

            /**
             * @type {[dw.customer.CustomerPaymentInstrument]}
             */
            var ccPaymentInstruments = wallet.getPaymentInstruments(dw.order.PaymentInstrument.METHOD_CREDIT_CARD).toArray();
            ccPaymentInstruments.filter(function(el){
                if(el.getMaskedCreditCardNumber() == paymentInstrument.maskedCardNumber && el.getCreditCardType() == paymentInstrument.productId){
                    storedToken = true;
                    if(el.getCreditCardToken()) return;
                    if(!el.getCreditCardToken() || el.getCreditCardToken() == undefined || el.getCreditCardToken() == "undefined"){
                        el.setCreditCardToken(paymentInstrument.token);
                    }
                }
            });

            if(!storedToken){
                /**
                 * @type {dw.customer.Wallet}
                 */
                var wallet = customer.profile.getWallet();
                
                /**
                 * @type {CustomerPaymentInstrument}
                 */
                var newPaymentInstrument = wallet.createPaymentInstrument(dw.order.PaymentInstrument.METHOD_CREDIT_CARD);
                newPaymentInstrument.setCreditCardHolder(customer.profile.firstName + " " + customer.profile.lastName);
                newPaymentInstrument.setCreditCardNumber(paymentInstrument.maskedCardNumber);
                newPaymentInstrument.setCreditCardExpirationMonth(paymentInstrument.expiryMonth);
                newPaymentInstrument.setCreditCardExpirationYear(paymentInstrument.expiryYear);
                newPaymentInstrument.setCreditCardType(paymentInstrument.productId);
                newPaymentInstrument.setCreditCardToken(paymentInstrument.token);
                
            }
        });
    }
}


/**
 * Extracts all tokens from stored card payment types
 * @param {dw.customer.Customer} customer 
 * @returns {[String]}
 */
function GetTokensForCustomer(customer){
    var wallet = customer.getProfile().getWallet();
    var ccPaymentInstruments = wallet.getPaymentInstruments(dw.order.PaymentInstrument.METHOD_CREDIT_CARD).toArray();
    return ccPaymentInstruments.map(function(el){
        return el.getCreditCardToken();
    }).filter(function(el){
        return el != "" && el != null;
    });
}

/**
 * Returns stored payment and refund status against an order
 * @param {dw.order.Order} order 
 * @returns {{originalAmount:Number, payment: { amount: Number, status: String, statusOutput: Object, date: Number, method: String, authCode: String, id: String}, refunds:[{ amount: Number, status: String, statusOutput: Object, date: Number, id: String}]}}
 */
function GetStoredPaymentStatus(order){
    var orderStatusPayload = order.getCustom().ING_paymentStatus;
    if(!orderStatusPayload){
        orderStatusPayload = {
            originalAmount: 0,
            payment: {
                amount: 0,
                status:"",
                statusOutput: {},
                date: "",
                method: "",
                authCode: "",
                id: ""
            },
            refunds: []
        };
    }else{
        try{
            orderStatusPayload = JSON.parse(orderStatusPayload);
        }catch(e){
            orderStatusPayload = {
                originalAmount: 0,
                payment: {
                    amount: 0,
                    status:"",
                    statusOutput: {},
                    date: "",
                    method: "",
                    authCode: "",
                    id: ""
                },
                refunds: []
            };
        }
    }
    return orderStatusPayload;
}

/**
 * Returns the refund payment status for a given id or a new object if one doesnt exist
 * @param {dw.order.Order} order 
 * @param {String} refundID 
 * @returns {{refund:{amount: Number, status: String, statusOutput: Object, date: Number, id: String},indx: Number}}
 */
function GetRefundPaymentStatus(order, refundID){
    var orderStatusPayload = GetStoredPaymentStatus(order);

    var refund = null;
    var refPosition = -1;
    orderStatusPayload.refunds.filter(function(rfd,indx){
        if(rfd.id == refundID){
            refund = rfd;
            refPosition = indx;
            return true;
        }
        return false;
    });
    if(!refund){
        refund = {
            amount: 0,
            status:"",
            statusOutput: {},
            date: "",
            id: refundID
        }
    }
    return {refund: refund, indx: refPosition};
}

/**
 * Removes duplicate statuses held in the payment status object
 * @param {[{amount: Number, status: String, statusOutput: Object, date: Number, id: String}]} refunds
 * @returns {[{amount: Number, status: String, statusOutput: Object, date: Number, id: String}]}
 */
function RemoveRefundStatusDuplicates(refunds){
    if(!refunds || refunds.length < 1){
        return [];
    }

    var processed = {};

    return refunds.sort(function(a,b){
        if (a.date < b.date) return 1;
        if (a.date > b.date) return -1;
        return 0;
    }).filter(function(rfd){
        if(processed[rfd.id] && processed[rfd.id] >= rfd.date){
            return false;
        }

        processed[rfd.id] = rfd.date;
        return true;
    });
}

/**
 * Remove existing payment instruments that are handled by the Ingenico integration
 * @param {dw.order.Basket} basket 
 */
function RemoveExistingPaymentMethods(basket){
    var PIs = basket.getPaymentInstruments();
    PIs.toArray().filter(
        /**
         * @param {dw.order.OrderPaymentInstrument} el
         */
        function(el){
            switch(el.getPaymentMethod()){
                case IngenicoConfig.PaymentMethods.CREDITCARD:
                case IngenicoConfig.PaymentMethods.HOSTEDPAY:
                case IngenicoConfig.PaymentMethods.PAYPAL:
                case IngenicoConfig.PaymentMethods.IDEAL:
                    basket.removePaymentInstrument(el);
                    break;
                default:
                    break;
            }
        }
    )

}

/*
 * Module exports
 */

/*
 * Local methods
 */
exports.getIngenicoPaymentInstrument = GetIngenicoPaymentInstrument;
exports.getStoredPaymentStatus = GetStoredPaymentStatus;
exports.getRefundPaymentStatus = GetRefundPaymentStatus;
exports.removeRefundStatusDuplicates = RemoveRefundStatusDuplicates;
exports.removeExistingPaymentMethods = RemoveExistingPaymentMethods;
exports.getTokensForCustomer = GetTokensForCustomer;
exports.processHostedTokens = ProcessHostedTokens;