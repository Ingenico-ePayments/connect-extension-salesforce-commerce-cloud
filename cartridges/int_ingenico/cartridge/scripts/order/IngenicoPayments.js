/**
 * @file Orchestrator between requests to Ingenico and updates on Demandware
 * @module int_ingenico/scripts/order/IngenicoPayments
 */

/* API Includes */
var OrderMgr = dw.order.OrderMgr;
var Transaction = dw.system.Transaction;
var Logger = dw.system.Logger.getLogger("Ingenico");

/* Script Modules */
var Payloads = require('../service/Payloads');
var IngenicoSvc = require('../service/IngenicoSvc');
var UpdateOrder = require('../order/UpdateOrder');
var IngenicoOrderHelper = require('../utils/IngenicoOrderHelper');

 /**
 * @typedef OrderStatusUpdateResponse
 * @type {Object}
 * @property {Boolean} error Is there an error
 * @property {String} errorMessage Text describing the error
 * @property {Boolean} paymentAuthSuccess Was payment authorisation successful
 * @property {Boolean} paymentReceived Was payment received
 * @property {String} status Gateway transaction status response
 * @property {Boolean} [actionRequired] Is there action required
 * @property {String} [hostedCheckoutId] Hosted transaction Id
 * @property {String} [token] Token representation of the payment used
 * @property {Object} [merchantAction] 
 * @property {String} merchantAction.actionType Type of action required to perform
 * @property {Object} merchantAction.redirectData 
 * @property {String} merchantAction.redirectData.redirectURL URL to redirect the user to complete trasanction
 * @property {String} merchantAction.redirectData.RETURNMAC Code used to validate response when user returns to merchant site
 * 
 */


 /**
 * @typedef CardDetails
 * @type {Object}
 * @property {String} cardnum Full PAN/Card number
 * @property {String} cvv CVV/CVC for the card
 * @property {String} token Token representation of the PAN if available
 * 
 */

/**
 * @typedef CardType
 * @type {Object}
 * @property {String} countryCode Country code associated with the card
 * @property {String} paymentProductId Product id associated with the card
 * 
 */



/**
 * Creates payment request, sends it to Ingenico and updates the order and returns result.
 * @param {dw.order.Order} systemOrder Demandware Order
 * @param {dw.order.OrderPaymentInstrument} paymentInstrument Order Payment Instrument
 * @param {CardDetails} cardDetails
 * @param {Boolean} apiOrder Order through the OCAPI used by Customer Service Center
 * @returns {OrderStatusUpdateResponse} Object with information used to present the correct message to the user.
 */
function CreatePayment(order, paymentInstrument, cardDetails, apiOrder) {
    var payload = Payloads.createPaymentPayload(order,paymentInstrument,cardDetails,false);
    
    if(apiOrder == true && payload){
        if(payload.cardPaymentMethodSpecificInput){
            payload.cardPaymentMethodSpecificInput.skipAuthentication = true;
            payload.cardPaymentMethodSpecificInput.transactionChannel = "MOTO";
        }
        if(order.getCustomerLocaleID() == "default" || !order.getCustomerLocaleID() ){
            payload.order.customer.locale = "en_GB"
        }
    }

    var response = IngenicoSvc.createPayment(payload);
    var updatePayload = null;

    if(!response){
        return {
            error: true,
            errorMessage: "There was no response from the server",
            paymentAuthSuccess: false,
            paymentReceived: false,
            payload: {}
        };
    }

    if(response.id && response.statusOutput){
        updatePayload = response;
    }else if(response.payment){
        updatePayload = response.payment;
    }else if(response.paymentResult && response.paymentResult.payment){
        updatePayload = response.paymentResult.payment;
    }else if(response.response && response.response.paymentResult && response.response.paymentResult.payment){
        updatePayload = response.response.paymentResult.payment;
    }

    if(response.errors && !updatePayload){
        return {
            error: true,
            errorMessage: "There were errors during the payment transaction.",
            paymentAuthSuccess: false,
            paymentReceived: false,
            payload: response
        };
    }

    var updatedOrderOK = UpdateOrder.createPaymentOrderUpdate(order,paymentInstrument,updatePayload,apiOrder);

    if(updatePayload && updatePayload.status == "REJECTED"){
        return {
            error: true,
            errorMessage: "There were errors during the payment transaction.",
            paymentAuthSuccess: false,
            paymentReceived: false,
            payload: updatePayload
        };
    }

    if(response && response.creationOutput && response.creationOutput.token){
        updatedOrderOK.token = response.creationOutput.token
    }

    if(response.merchantAction){
        updatedOrderOK.actionRequired = true;
        updatedOrderOK.merchantAction = response.merchantAction;
        return updatedOrderOK;
    }

    return updatedOrderOK;
}

/**
 * Create Hosted Payment request to obtain URL to show in iframe
 * @param {dw.order.Order} order 
 * @param {dw.order.OrderPaymentInstrument} paymentInstrument
 * @returns {OrderStatusUpdateResponse}
 */
function CreateHostedPayment(order, paymentInstrument){
    var payload = Payloads.createPaymentPayload(order,paymentInstrument,null,true);
    var response = IngenicoSvc.createHostedPayment(payload);

    if(response.error){
        return {error:true, errors: response.errors};
    }

    if(response && response.partialRedirectUrl){
        var updatedOrderOK = {
            error: false,
            errorMessage: null,
            paymentAuthSuccess: false,
            paymentReceived: false,
            status: null
        };
        updatedOrderOK.actionRequired = true;
        updatedOrderOK.merchantAction = {
            actionType: "REDIRECT",
            redirectData: {
                redirectURL: "https://payment." + response.partialRedirectUrl,
                RETURNMAC: response.RETURNMAC,
            }
        };
        updatedOrderOK.hostedCheckoutId = response.hostedCheckoutId
        return updatedOrderOK
    }

    Logger.error("CREATE_HOSTED_PAYMENT: Error getting hosted URL: " + JSON.stringify(response));
    return {error: true, errorMessage: "Unknown error"};
}

/**
 * Get card product type based on first 6 numbers of the card or the complete card number.
 * @param {String} cardNum 
 * @returns {CardType}
 */
function GetCardType(cardNum){
	var payload = {
		bin: cardNum
    }
    var response = IngenicoSvc.getCardType(payload);
    
    if(!response || !response.paymentProductId){
        return null;
    }

    return response;
}

/**
 * Create token based on card details.
 * @param {dw.order.Order} systemOrder Demandware Order
 * @param {dw.order.OrderPaymentInstrument} paymentInstrument Order Payment Instrument
 * @returns {String} Token
 */
function CreateToken(order, paymentInstrument){
    var payload = Payloads.createTokenPayload(order,paymentInstrument, null, true);
    var response = IngenicoSvc.createToken(payload);
    
    if(!response || !response.token){
        return null;
    }

    return response.token;
}

/**
 * Return payment status for a payment transaction id
 * @param {String} paymentId 
 * @returns {Object} Raw response from the API
 */
function GetPaymentStatus(paymentId){
    var payload = {
        paymentID: paymentId
    }
    var response = IngenicoSvc.getPaymentStatus(payload);
    if(response.error){
        return response;
    }else if(!response.paymentOutput){
        return {error: true, errorMessage: "Missing payment information"};
    }
    return response;
}

/**
 * Return payment status for an HPP id
 * @param {String} hostedPaymentId
 * @param {Boolean} complete Return complete payload
 * @returns {Object} Raw response from the API
 */
function GetHostedPaymentStatus(hostedPaymentId, complete){
    var payload = {
        hostedID: hostedPaymentId
    }

    var response = IngenicoSvc.getHostedPaymentStatus(payload);
    if(response.error){
        return response;
    }else if(!response.createdPaymentOutput){
        return {error: true, errorMessage: "Missing payment information"};
    }
    
    return complete ? response : response.createdPaymentOutput.payment;
}

/**
 * Cancel payment
 * @param {String} orderNo
 * @param {String} paymentId 
 * @returns {OrderStatusUpdateResponse}
 */
function CancelPayment(orderNo, paymentId){
    var payload = {
        paymentID: paymentId
    }
    var response = IngenicoSvc.cancelPaymentTransaction(payload);
    if(response.error){
        return response;
    }else if(!response.payment && !response.payment.paymentOutput){
        return {error: true, errorMessage: "Missing payment information"};
    }
    
    var updateOrderOK = UpdateOrder.updateOrderFromCallback(orderNo, response.payment);
    
    return updateOrderOK;
}

/**
 * Sends approval request for challenged transaction
 * @param {String} orderNo
 * @param {String} paymentId Payment transaction id
 * @returns {OrderStatusUpdateResponse}
 */
function ApproveTransactionPendingFraudApproval(orderNo, paymentId){
    var payload = {
        paymentID: paymentId
    }

    var response = IngenicoSvc.approveFraudPending(payload);    

    if(response.error){
        if(response.response.errors){
            var errorCodes = {};
            
            response.response.errors.filter(function(err){
                errorCodes[err.code] = err.message;
            });

            var order = OrderMgr.getOrder(orderNo);        
            if(!order){
                return {error: true, errorMessage:"Could not find order"}
            }        

            if(errorCodes["1100000"]){
                return RetrieveAndUpdateOrderPaymentStatus(order);
            }
        }
        return response;
    }else if(!response.paymentOutput){
        return {error: true, errorMessage: "Missing payment information - ATPFA"};
    }

    var updateOrderOK = UpdateOrder.updateOrderFromCallback(orderNo, response);

    return updateOrderOK;
}

/**
 * Sends approval request for challenged transaction
 * @param {dw.order.Order} order Order
 * @param {dw.order.OrderPaymentInstrument} paymentInstrument Payment instrument
 * @returns {OrderStatusUpdateResponse}
 */
function ApprovePaymentTransactionPendingApproval(order, paymentInstrument){
    var payload = {
        paymentID: paymentInstrument.getPaymentTransaction().getTransactionID(),
        reqData: Payloads.createApprovePaymentPayload(order,paymentInstrument.getPaymentTransaction())
    }

    var response = IngenicoSvc.approvePaymentPending(payload);    

    if(response.error){
        return response;
    }else if(!response || !response.payment || !response.payment.paymentOutput){
        Logger.warn("Missing payment information - APTPA >> " + JSON.stringify(response,null,4));
        return {error: true, errorMessage: "Missing payment information - APTPA"};
    }

    var updateOrderOK = UpdateOrder.createPaymentOrderUpdate(order, paymentInstrument, response.payment);
    
    return updateOrderOK;
}

/**
 * Retrieves payment status from server and updates Demandware
 * @param {dw.order.Order} order 
 * @returns {OrderStatusUpdateResponse}
 */
function RetrieveAndUpdateOrderPaymentStatus(order){
    var pi = IngenicoOrderHelper.getIngenicoPaymentInstrument(order);
    
    if(!pi) return;

	var hostedId = pi.getPaymentTransaction().getCustom().ING_hostedCheckoutId;
	var transactionId = pi.paymentTransaction.transactionID;
	if(transactionId){
		result = GetPaymentStatus(transactionId);
	}else{
        result = GetHostedPaymentStatus(hostedId, true);
	}

	if(result.error){
		Logger.warn("RetrieveAndUpdateOrderPaymentStatus Error: " + JSON.stringify(result));
		return result;
    }
    
    if(!result.paymentOutput){
        if(!result.createdPaymentOutput){
            Logger.warn("Missing INFO: " + JSON.stringify(result, null, 4));
            return {error:true,errorMessage: "Missing information in the response."};    
        }

        // if("tokens" in result.createdPaymentOutput){
        //     IngenicoOrderHelper.updateCustomerTokens(order.getCustomer(), result.createdPaymentOutput.tokens);                
        // }
    
        result = result.createdPaymentOutput.payment;
    }

    return UpdateOrder.updateOrderFromCallback(order.getOrderNo(), result);
}

/**
 * 
 * @param {dw.order.Order} order 
 * @param {String} transactionID 
 * @param {Number} amount
 * @param {String} reason 
 * @returns {OrderStatusUpdateResponse}
 */
function CreatePaymentRefund(order, transactionID, amount, reason){
    if(!(order && transactionID && amount && reason)){
        return {error:true,errorMessage: "Missing parameters."};
    }

    var payload = Payloads.createRefundPayload(order, amount);
    var result = IngenicoSvc.refundPayment({
        paymentID: transactionID,
        reqData: payload
    });

    if(result.error){
        return result;
    }

    if(!result.refundOutput){
        return {error:true,errorMessage: "Missing information in the response."};
    }

    var updateOK = UpdateOrder.updateOrderFromCallback(order.getOrderNo(),result);

    if(updateOK.error){
        return updateOK;
    }

    try{
        Transaction.wrap(function () {
            order.trackOrderChange("Refund of " + dw.util.Currency.getCurrency(order.getCurrencyCode()).getSymbol() + "" + amount + ". Reason:" + reason);
        });
    }catch(e){
        return {error:true,errorMessage: "Refund OK but could not log the refund in the history"};
    }
    return updateOK;
}

/**
 * Retrieve the lastest status for a given refund and update the order.
 * @param {String} orderNo 
 * @param {String} refundId 
 * @returns {OrderStatusUpdateResponse}
 */
function GetRefundStatus(orderNo, refundId){
    if(!(orderNo && refundId)){
        return {error: true, errorMessage: "Missing parameters"};
    }

    var payload = {
        refundID: refundId        
    }
    
    var response = IngenicoSvc.getRefundStatus(payload);    
    
    if(response.error){
        return response;
    }else if(!response || !response.refundOutput){
        return {error: true, errorMessage: "Missing refund information - GRS"};
    }

    var updateOrderOK = UpdateOrder.updateOrderFromCallback(orderNo,response);
    
    return updateOrderOK;
}

/**
 * Cancel a given refund for an order
 * @param {dw.order.Order} order
 * @param {String} refundId 
 * @returns {OrderStatusUpdateResponse}
 */
function CancelRefund(order, refundId){
    if(!(order && refundId)){
        return {error: true, errorMessage: "Missing parameters"};
    }

    var payload = {
        refundID: refundId        
    }

    var response = IngenicoSvc.cancelRefund(payload);    

    if(response.error){
        return response;
    }

    var updateOrderOK = GetRefundStatus(order.getOrderNo(), refundId);
    
    var refundPayload = IngenicoOrderHelper.getRefundPaymentStatus(order, refundId);

    try{
        Transaction.wrap(function () {
            order.trackOrderChange("Refund of " + dw.util.Currency.getCurrency(order.getCurrencyCode()).getSymbol() + "" + refundPayload.refund.amount + " cancelled.");
        });
    }catch(e){
        return {error:true,errorMessage: "Refund OK but could not log the refund in the history"};
    }


    return updateOrderOK;
}

/*
 * Module exports
 */

/*
 * Local methods
 */
/**
 * Exported function to create a payment
 * @see {@link CreatePayment}
 */
exports.createPayment = CreatePayment;

/**
 * Exported function to create a payment using hosted pages
 * @see {@link CreateHostedPayment}
 */
exports.createHostedPayment = CreateHostedPayment;

/**
 * Exported function to get card type
 * @see {@link GetCardType}
 */
exports.getCardType = GetCardType;

/**
 * Exported function to create a token for a card number
 * @see {@link CreateToken}
 */
exports.createToken = CreateToken;

/**
 * Exported function to retrieve the payment status from the gateway
 * @see {@link GetPaymentStatus}
 */
exports.getPaymentStatus = GetPaymentStatus

/**
 * Exported function to retrieve the payment status during the hosted process
 * @see {@link GetHostedPaymentStatus}
 */
exports.getHostedPaymentStatus = GetHostedPaymentStatus;

/**
 * Exported function to cancel a payment transaction
 * @see {@link CancelPayment}
 */
exports.cancelPayment = CancelPayment;

/**
 * Exported function to approve a transaction in fraud pending approval status
 * @see {@link ApproveTransactionPendingFraudApproval}
 */
exports.approveTransactionPendingFraudApproval = ApproveTransactionPendingFraudApproval;

/**
 * Exported function to approve a transaction in pending approval status
 * @see {@link ApprovePaymentTransactionPendingApproval}
 */
exports.approvePaymentTransactionPendingApproval = ApprovePaymentTransactionPendingApproval;

/**
 * Exported function to retrieve and update the transaction status for an order
 * @see {@link RetrieveAndUpdateOrderPaymentStatus}
 */
exports.retrieveAndUpdateOrderPaymentStatus = RetrieveAndUpdateOrderPaymentStatus

/**
 * Exported function to create a refund for a payment
 * @see {@link CreatePaymentRefund}
 */
exports.createPaymentRefund = CreatePaymentRefund;

/**
 * Exported function to retrieve refund status of a transaction
 * @see {@link GetRefundStatus}
 */
exports.getRefundStatus = GetRefundStatus;

/**
 * Exported function to cancel a refund
 * @see CancelRefund
 */
exports.cancelRefund = CancelRefund;

