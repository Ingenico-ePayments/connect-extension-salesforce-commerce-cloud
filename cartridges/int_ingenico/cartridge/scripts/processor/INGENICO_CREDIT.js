/**
 * INGENICO_CREDIT.js
 * Handle payment validation and authorization for credit cards in a server to server configuration.
 *
 * https://epayments-api.developer-ingenico.com/s2sapi/v1/en_US/json/payments/create.html
 */
'use strict';

/* API Includes */
var PaymentMgr = dw.order.PaymentMgr;
var Transaction = dw.system.Transaction;
var ServiceRegistry = dw.svc.ServiceRegistry;
var Money = dw.value.Money;
var Logger = dw.system.Logger.getLogger("Ingenico");
var Site = dw.system.Site;
var URLUtils = dw.web.URLUtils;

/* Site Genesis imports */
var app = require('sitegenesis_storefront_controllers/cartridge/scripts/app');
var Cart = require('sitegenesis_storefront_controllers/cartridge/scripts/models/CartModel');
var InvalidatePaymentCardFormElements = require('sitegenesis_storefront_core/cartridge/scripts/checkout/InvalidatePaymentCardFormElements');

/* Script Modules */
var IngenicoPayments = require('../order/IngenicoPayments');
var IngenicoOrderHelper = require('../utils/IngenicoOrderHelper');
var SitePreferences = require("../config").SitePreferences;
var PaymentMethods = require("../config").PaymentMethods;

/**
 * Verifies a credit card against a valid card number and expiration date and possibly invalidates invalid form fields.
 * If the verification was successful a credit card payment instrument is created.
 * @param {{Basket: dw.order.Basket}} args Contains the basket object
 * @returns {Object} Returns either error:true or success:true
 */
function Handle(args) {
    var cart = Cart.get(args.Basket);
    var creditCardForm = app.getForm('billing.paymentMethods.creditCard');

    var creditCardHolder = creditCardForm.get('owner').value();
    var cardNumber = creditCardForm.get('number').value();
    var cardSecurityCode = creditCardForm.get('cvn').value();
    var cardType = creditCardForm.get('type').value();
    var expirationMonth = creditCardForm.get('expiration.month').value();
    var expirationYear = creditCardForm.get('expiration.year').value();
    var paymentCard = PaymentMgr.getPaymentCard(cardType);

    if(cardSecurityCode.length < 3 || cardSecurityCode.length > 4){
        Logger.warn("card error: invalid cvv");
        creditCardForm.get('cvn').invalidateFormElement();
        return {error: true};
    }

    var cardToken = null;

    var selectedCreditCard = request.httpParameterMap.creditCardUUID.value || request.httpParameterMap.dwfrm_billing_paymentMethods_creditCardList.stringValue;
    if(selectedCreditCard){
        /**
         * @type {dw.customer.Wallet}
         */
        var wallet = customer.profile.getWallet();
        
        /**
         * @type {[dw.customer.CustomerPaymentInstrument]}
         */
        var ccPaymentInstruments = wallet.getPaymentInstruments(dw.order.PaymentInstrument.METHOD_CREDIT_CARD).toArray();

        ccPaymentInstruments.filter(function(el){
            var id = el.getUUID();

            if(id == selectedCreditCard){                
                cardToken = el.getCreditCardToken();
                
                if(el.isPermanentlyMasked()){
                    if(!cardToken){
                        creditCardForm.get('number').invalidateFormElement();
                        return {error: true};
                    }
                }else{
                    cardNumber = el.getCreditCardNumber();
                }
            }
        });
    }
    
    var cardTypeDetails = null;
    var creditCardStatus = new dw.system.Status(dw.system.Status.OK);

    if(!cardToken){
        creditCardStatus = paymentCard.verify(expirationMonth, expirationYear, cardNumber, cardSecurityCode);
    }
    
    if (creditCardStatus.error) {
        InvalidatePaymentCardFormElements.invalidatePaymentCardForm(creditCardStatus, session.forms.billing.paymentMethods.creditCard);
        return {error: true};
    }else if(!cardToken){
        cardTypeDetails = IngenicoPayments.getCardType(cardNumber.substring(0, 6));
        if(cardTypeDetails){
            creditCardForm.setValue('type',cardTypeDetails.paymentProductId);
        }
    }

    Transaction.wrap(function () {
        IngenicoOrderHelper.removeExistingPaymentMethods(args.Basket);
        var paymentInstrument = cart.createPaymentInstrument(dw.order.PaymentInstrument.METHOD_CREDIT_CARD, cart.getNonGiftCertificateAmount());

        paymentInstrument.creditCardHolder = creditCardHolder;
        paymentInstrument.creditCardNumber = cardNumber;
        paymentInstrument.creditCardType = cardTypeDetails ? cardTypeDetails.paymentProductId : cardType;
        paymentInstrument.creditCardExpirationMonth = expirationMonth;
        paymentInstrument.creditCardExpirationYear = expirationYear;
        if(cardToken){
            paymentInstrument.setCreditCardToken(cardToken);
        }
    });

    return {success: true};
}

/**
 * Authorizes a payment using a credit card. The payment is authorized by using the BASIC_CREDIT processor
 * only and setting the order no as the transaction ID. Customizations may use other processors and custom
 * logic to authorize credit card payment.
 * @param {{Order: dw.order.Order, PaymentInstrument:dw.order.OrderPaymentInstrument}} args Contains Order and PaymentInstrument object used to complete payment authorization and submit the order or fail and return to checkout
 * @returns {Object} with either error:true (fails order), authorized:true (places order) or end:true (waits for 3rd party verification)
 */
function Authorize(args) {
    
    var paymentProcessor = PaymentMgr.getPaymentMethod(args.PaymentInstrument.getPaymentMethod()).getPaymentProcessor();
    // Set paymentProcessor for this transaction
    Transaction.wrap(function() {
        args.PaymentInstrument.getPaymentTransaction().setPaymentProcessor(paymentProcessor);
    });

    var cardToken = args.PaymentInstrument.getCreditCardToken();
    if(args.PaymentInstrument.creditCardNumber.match(/^\*+/) && !cardToken){
        return { error: true };
    }

    // Extract number as sometimes it returns masked number
    var cardNum = args.PaymentInstrument.creditCardNumber;
    
    // Extract CVV from the form
    var creditCardForm = app.getForm('billing.paymentMethods.creditCard');
    var cardSecurityCode = creditCardForm.get('cvn').value();
    var saveToken = creditCardForm.get('saveCard').value();
    var cardToken = args.PaymentInstrument.getCreditCardToken();

    var cardDetails = {
        cardnum: cardNum,
        cvv: cardSecurityCode,
        token: cardToken
    }

    var result = IngenicoPayments.createPayment(args.Order, args.PaymentInstrument, cardDetails);

    // Copy Ogone's token in the response to the card details
    if(result && result.token){
        cardDetails.token = result.token;
    }
    
    if(result && result.timeout === 'true'){
        Logger.error('INGENICO service timed out: ' + result.errorMessage);
        return { error: true };
    }

    if(result && result.error){
        if (result.payload && result.payload.status == "REJECTED") {
            response.redirect(URLUtils.url('COVerification-COSummary'));
            return {end: true};
        }
        Logger.error('INGENICO request error: ' + result.errorMessage + "");
        return { error: true };
    }

    // Only store card if transaction wasn't refused in the first instance and there is no token associated with the card
    if (Site.current.getCustomPreferenceValue(SitePreferences.STORE_PAYMENT_TOKEN) && saveToken) {
        if(!cardDetails.token){
            var token = IngenicoPayments.createToken(args.Order, args.PaymentInstrument);
            cardDetails.token = token;
        }
        
        if(cardDetails.token){
            Transaction.wrap(function () {
                if(!args.PaymentInstrument.getCreditCardToken()){
                    args.PaymentInstrument.setCreditCardToken(cardDetails.token);                    
                }
                if (customer.registered) {
                    /**
                     * @type {dw.customer.Wallet}
                     */
                    var wallet = customer.profile.getWallet();

                    /**
                     * @type {[dw.customer.CustomerPaymentInstrument]}
                     */
                    var ccPaymentInstruments = wallet.getPaymentInstruments(dw.order.PaymentInstrument.METHOD_CREDIT_CARD).toArray();
                    ccPaymentInstruments.filter(function(el){
                        if(el.getMaskedCreditCardNumber() == args.PaymentInstrument.getMaskedCreditCardNumber() && el.getCreditCardType() == args.PaymentInstrument.getCreditCardType()){
                            if(!el.getCreditCardToken() || el.getCreditCardToken() == undefined || el.getCreditCardToken() == "undefined"){
                                el.setCreditCardToken(cardDetails.token);
                            }
                        }
                    });
                }
            });
        }
    }

    if (result.actionRequired === true ) {
        if(result.merchantAction.actionType === 'REDIRECT'){
            session.getPrivacy().payment3DSCode = result.merchantAction.redirectData.RETURNMAC;
            session.getPrivacy().pendingOrderNo = args.Order.getOrderNo();
            session.getPrivacy().pendingOrder = args.Order;
            session.getPrivacy().redirect3DS = result.merchantAction.redirectData.redirectURL;
            response.redirect(dw.web.URLUtils.https("COVerification-Verify"));
            return {end: true};
        }
    }

    return {authorized: true};
}

/*
 * Module exports
 */

/*
 * Local methods
 */
exports.Handle = Handle;
exports.Authorize = Authorize;
