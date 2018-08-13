'use strict';

/**
 * Handles processing the response from 3DS and Hosted redirects
 *
 * @module controllers/COVerification
 */

/* API Includes */
var ServiceRegistry = dw.svc.ServiceRegistry;
var OrderMgr = dw.order.OrderMgr;
var Site = dw.system.Site;
var Transaction = dw.system.Transaction;
var Status = dw.system.Status;
var URLUtils = dw.web.URLUtils;
var Logger = dw.system.Logger.getLogger("Ingenico");

/* Site Genesis imports */
var app = require('sitegenesis_storefront_controllers/cartridge/scripts/app');
var guard = require('sitegenesis_storefront_controllers/cartridge/scripts/guard');

/* Script Modules */
var Order = app.getModel('Order');
var IngenicoPayments = require('../../../int_ingenico/cartridge/scripts/order/IngenicoPayments');
var UpdateOrder = require('../../../int_ingenico/cartridge/scripts/order/UpdateOrder');
var EmailOrderStatusNotifications = require('../../../int_ingenico/cartridge/scripts/order/EmailOrderStatusNotifications');
var IngenicoOrderHelper = require('../../../int_ingenico/cartridge/scripts/utils/IngenicoOrderHelper');
var ReturnStatus = require("../../../int_ingenico/cartridge/scripts/config").ReturnStatus;

/**
 * COVerification-Process 
 * Retrives the status based on the data in the request from the 3rd party
 */
function Process() {
    var results = {};
    var arr = request.httpParameters.keySet().toArray();
    arr.filter(function (el) {
        results[el] = request.httpParameters.get(el).toLocaleString();
        return false;
    })

    var verificationObj = {
        ref: results.REF,
        returnmac: results.RETURNMAC,
        eci: results.ECI,
        amount: results.AMOUNT,
        currencycode: results.CURRENCYCODE,
        authorizationcode: results.AUTHORISATIONCODE,
        avsresult: results.AVSRESULT,
        cvsresult: results.CVVRESULT,
        fraudresult: results.FRAUDRESULT,
        externalreference: results.FRAUDRESULT,
        hostedCheckoutId: results.hostedCheckoutId

    }

    var order = session.getPrivacy().pendingOrder;
    var orderNo = session.getPrivacy().pendingOrderNo;
    var returnmac = session.getPrivacy().payment3DSCode;

    var cancelOrder = true;

    if (verificationObj.returnmac == returnmac) {
        var result = null;
        if(verificationObj.hostedCheckoutId != null){
            result = IngenicoPayments.getHostedPaymentStatus(verificationObj.hostedCheckoutId, true);
        }else if(verificationObj.ref){
            result = IngenicoPayments.getPaymentStatus(verificationObj.ref);
        }else{
            Logger.error("Missing verification reference - Params: " + JSON.stringify(results) + " VerificationObj: " + JSON.stringify(verificationObj))
        }

        if(!result || result.error){
            Logger.warn("Error getting payment status: " + JSON.stringify(result));
            app.getView({ redirect: URLUtils.url('COVerification-Confirmation', "error=400") }).render("checkout/3DSredirect");
            return;
        }

        if(result.createdPaymentOutput){
            if("tokens" in result.createdPaymentOutput && result.createdPaymentOutput && result.createdPaymentOutput.payment && result.createdPaymentOutput.payment.paymentOutput && result.createdPaymentOutput.payment.paymentOutput.cardPaymentMethodSpecificOutput){
                IngenicoOrderHelper.processHostedTokens(order.getCustomer(), result.createdPaymentOutput.tokens, result.createdPaymentOutput.payment.paymentOutput.cardPaymentMethodSpecificOutput)
            }
            result = result.createdPaymentOutput.payment;
        }
    
        var updatedOrderOK = UpdateOrder.updateOrderFromCallback(orderNo, result);

        if (result && result.status) {
            switch (result.status) {
                case ReturnStatus.REDIRECTED:
                case ReturnStatus.CAPTURE_REQUESTED:
                case ReturnStatus.PENDING_CAPTURE:
                case ReturnStatus.PENDING_PAYMENT:
                case ReturnStatus.AUTHORIZATION_REQUESTED: 
                case ReturnStatus.PAID:
                case ReturnStatus.CAPTURED:
                    cancelOrder = false;
                    app.getView({ redirect: URLUtils.url('COVerification-Confirmation') }).render("checkout/3DSredirect");
                    return;
                case ReturnStatus.PENDING_FRAUD_APPROVAL:
                case ReturnStatus.PENDING_APPROVAL:
                    cancelOrder = false;
                    app.getView({ redirect: URLUtils.url('COVerification-Confirmation') }).render("checkout/3DSredirect");
                    return;
                case ReturnStatus.REJECTED:
                case ReturnStatus.REVERSED:
                case ReturnStatus.REJECTED_CAPTURE:
                case ReturnStatus.CANCELLED:
                case ReturnStatus.CHARGEBACKED: // Should never get this status back during checkout process.
                    app.getView({ redirect: URLUtils.url('COVerification-COSummary') }).render("checkout/3DSredirect");
                    return;            
                default:
                    break;
            }            
        }
    }
}

/**
 * COVerification-Verify
 * Shows iframe for 3D secure or other card verification systems
 */
function Verify(){
    var url = session.getPrivacy().redirect3DS;
    var titleMsg = session.getPrivacy().titleMsg3DS;
    app.getView({
        redirectURL: url,
        titleMsg: titleMsg
    }).render('checkout/id-verification-3DS');
    session.getPrivacy().redirect3DS = null;
    session.getPrivacy().titleMsg3DS = null;
}


/**
 * COVerification-Confirmation 
 * Show order confirmation page with relevant message based on payment status
 */
function ShowConfirmation() {
    var order = session.getPrivacy().pendingOrder;
    var COSummary = app.getController('COSummary');
    COSummary.ShowConfirmation(order);
    session.getPrivacy().pendingOrder = null;
    session.getPrivacy().pendingOrderNo = null;
    session.getPrivacy().payment3DSCode = null;
}

/**
 * COVerification-COSummary 
 * Show checkout summary page with relevant message based on payment error
 */
function ShowCOSummary() {
    var COSummary = app.getController('COSummary');
    COSummary.Start({
        error: true,
        PlaceOrderError: new Status(Status.ERROR, 'confirm.error.declined')
    });

    session.getPrivacy().pendingOrder = null;
    session.getPrivacy().pendingOrderNo = null;
    session.getPrivacy().payment3DSCode = null;
}

/*
* Web exposed methods
*/

/** Starting point to verify payment transaction
 * @see module:controllers/COVerification~Process */
exports.Process = guard.ensure(['https'], Process);

/** Show order confirmation after successul transaction 
 * @see module:controllers/COVerification~ShowConfirmation */
exports.Confirmation = guard.ensure(['https'], ShowConfirmation);

/** Show CO Summary after a failed transaction
 * @see module:controllers/COVerification~ShowCOSummary */
exports.COSummary = guard.ensure(['https'], ShowCOSummary);

/** Show iframe for card user verification
 * @see module:controllers/COVerification~Verify */
exports.Verify = guard.ensure(['https'], Verify);

