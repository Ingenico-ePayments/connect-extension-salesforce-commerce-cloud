'use strict';

/**
 * Handles admin actions against orders that use the Ingenico Payment Gateway
 *
 * @module controllers/IngenicoActions
 */

/* API Includes */
var OrderMgr = dw.order.OrderMgr;
var Logger = dw.system.Logger.getLogger("Ingenico");

/* Site Genesis imports */
var app = require('sitegenesis_storefront_controllers/cartridge/scripts/app');
var guard = require('sitegenesis_storefront_controllers/cartridge/scripts/guard');

/* Script Modules */
var Order = app.getModel('Order');
var ReturnStatus = require('../../../int_ingenico/cartridge/scripts/config').ReturnStatus;
var IngenicoPayments = require('../../../int_ingenico/cartridge/scripts/order/IngenicoPayments');
var UpdateOrder = require('../../../int_ingenico/cartridge/scripts/order/UpdateOrder');
var EmailOrderStatusNotifications = require('../../../int_ingenico/cartridge/scripts/order/EmailOrderStatusNotifications');
var IngenicoOrderHelper = require('../../../int_ingenico/cartridge/scripts/utils/IngenicoOrderHelper');

var getOrdersByINGStatus = 'status != ' + dw.order.Order.ORDER_STATUS_CANCELLED + ' and status != ' + dw.order.Order.ORDER_STATUS_FAILED + ' and custom.ING_status = {0}'

function Start(){
    var counts = {
        fraud_approval:0,
        approval:0,
        refund_approval:0
    }

    var pendingFraud = OrderMgr.searchOrders(getOrdersByINGStatus, null, ReturnStatus.PENDING_FRAUD_APPROVAL);
    counts.fraud_approval = pendingFraud.getCount();
    pendingFraud.close();
    
    var pendingApproval = OrderMgr.searchOrders(getOrdersByINGStatus, null, ReturnStatus.PENDING_APPROVAL);
    counts.approval = pendingApproval.getCount();
    pendingApproval.close();

    var refundApproval = OrderMgr.searchOrders('custom.ING_status = {0}', null, ReturnStatus.REFUND_REQUESTED);
    counts.refund_approval = refundApproval.getCount();
    refundApproval.close();

    app.getView({counts:counts}).render("ingenico-actions/start");
}


/**
 * Approve payment transaction in Pending Fraud Approval status
 */
function ApproveOrderPendingFraud(){
    var orderNo = request.httpParameterMap.get("orderNo").stringValue;
    var UUID = request.httpParameterMap.get("UUID").stringValue;

    var verifiedRequest = VerifyAndRetrieveTransactionId(orderNo, UUID);
    if(verifiedRequest.error){
        return SendJSONErrorResponse(verifiedRequest.errorMessage);
    }

    var order = verifiedRequest.order;
    var transactionId = verifiedRequest.transactionId;

    var result = IngenicoPayments.approveTransactionPendingFraudApproval(orderNo, transactionId);

    if(result.error){
        SendJSONErrorResponse(result.errorMessage);
        return;
    }

    SendJSONResponse(result);
    return;
}

/**
 * Approve payment transaction in Pending Fraud Approval status
 */
function ApproveOrderPaymentPendingApproval(){
    var orderNo = request.httpParameterMap.get("orderNo").stringValue;
    var UUID = request.httpParameterMap.get("UUID").stringValue;

    var verifiedRequest = VerifyAndRetrieveTransactionId(orderNo, UUID);
    if(verifiedRequest.error){
        return SendJSONErrorResponse(verifiedRequest.errorMessage);
    }

    var order = verifiedRequest.order;
    var transactionId = verifiedRequest.transactionId;
    var paymentInstrument = verifiedRequest.paymentInstrument;
    
    var result = IngenicoPayments.approvePaymentTransactionPendingApproval(order, paymentInstrument);
    
    if(result.error){
        switch(result.errorCode){
            case 404:
                return SendJSONErrorResponse("Transaction ID not found");
                break;
            case 402:
                var updateOK = IngenicoPayments.retrieveAndUpdateOrderPaymentStatus(order);
                if(updateOK.error){
                    return SendJSONErrorResponse("General Error: " + resultupdateOK.errorMessage);
                }
                return SendJSONResponse({error:false, message:"Could not approve transaction as was not in the correct status: " + updateOK.status, result: updateOK});
                break;
            default:
                var errorCodes = {};
            
                if(result.response && result.response.errors){
                    result.response.errors.filter(function(err){
                        errorCodes[err.code] = err.message;
                    })
                }

                if(errorCodes["410140"]){
                    var updateOK = IngenicoPayments.retrieveAndUpdateOrderPaymentStatus(order);
                    return SendJSONResponse({error:true, errorMessage:"Amount was too large. Order transaction has been udpated with the correct authorized amount. ", result: result});
                }
                return SendJSONResponse({error:true, errorMessage:"General Error: " + result.errorMessage, result: result});
        }
        return;
    }

    SendJSONResponse(result);
    return;
}

/**
 * Cancel a transaction id
 * @param {String} orderNo 
 * @param {String} UUID 
 */
function CancelTransaction(orderNo, UUID){
    var orderNo = request.httpParameterMap.get("orderNo").stringValue;
    var UUID = request.httpParameterMap.get("UUID").stringValue;
    var transactionIdParam = request.httpParameterMap.get("tid").stringValue;

    var verifiedRequest = VerifyAndRetrieveTransactionId(orderNo, UUID);
    if(verifiedRequest.error){
        return SendJSONErrorResponse(verifiedRequest.errorMessage);
    }

    if(transactionIdParam && verifiedRequest.transactionId != transactionIdParam){
        SendJSONErrorResponse("ID mismatch");
        return;
    }

    var order = verifiedRequest.order;
    var transactionId = verifiedRequest.transactionId;

    var result = IngenicoPayments.cancelPayment(order.getOrderNo(), transactionId);
    if(!result || result.error){
        if(result.response && result.response.errors){
            var errorCodes = {};
            
            result.response.errors.filter(function(err){
                errorCodes[err.code] = err.message;
            })
            return SendJSONErrorResponse((errorCodes["400210"]?"Payment not found or not cancellable.":"Unknown error."), errorCodes);
        }
        return SendJSONErrorResponse(result.errorMessage);
    }

    SendJSONResponse(result);
}


/**
 * Send JSON response
 * @param {Object} payload 
 */
function SendJSONResponse(payload){
    response.addHttpHeader("Content-Type", "application/json"); 
    response.getWriter().print(JSON.stringify(payload,null,4));      
}

/**
 * Build and send JSON error response
 * @param {String} message
 * @param {Object} errorCodes
 */
function SendJSONErrorResponse(message,errorCodes){
    var error = {
        error:true,
        errorMessage: message
    };

    if(errorCodes){
        error.errors = errorCodes;
    }
    SendJSONResponse(error);
}


/**
 * Retrieves all orders matching the Pending_Fraud_Approval state
 * @returns {[Object]} Returns an array of orders details
 */
function ShowPendingFraudApproval(){
    var reply = ShowOrdersWithStatus(ReturnStatus.PENDING_FRAUD_APPROVAL);
    SendJSONResponse(reply);
}

/**
 * Retrieves all orders matching the Pending_Approval state
 * @returns {[Object]} Returns an array of orders details
 */
function ShowPendingApproval(){
    var reply = ShowOrdersWithStatus(ReturnStatus.PENDING_APPROVAL);
    SendJSONResponse(reply);
}

/**
 * Returns array of objects representing an order
 * @param {String} status Ingenico payment status
 * @returns {[{UUID: String, id: String, date: String, total: String, producs:[{id: String, name: String, qty: String, price: String}], customer:{name:String, email:String}, shippingAddress: String, billingAddress: String}]}
 */
function ShowOrdersWithStatus(status){
    /** @type [{{UUID: String, id: String, date: String, total: String, producs:[{id: String, name: String, qty: String, price: String}], customer:{name:String, email:String}, shippingAddress: String, billingAddress: String}}] */
    var reply = [];
    
    /** @type {dw.order.Order} */
    var dwOrder;
    
    /** @type {dw.customer.Profile} */
    var customer;

    /** @type {[dw.order.Shipment]} */
    var shipments;

    /** @type {[dw.order.ProductLineItem]} */
    var products;

    var shipmentAddresses;

    var pendingApproval = OrderMgr.searchOrders(getOrdersByINGStatus, "creationDate asc", status);
    while(pendingApproval.hasNext()) {
        dwOrder = pendingApproval.next();
        customer = dwOrder.getCustomer().getProfile();
        shipments = dwOrder.getShipments().toArray()
        products = dwOrder.getAllProductLineItems().toArray();

        shipmentAddresses = shipments.map(function(shpment){
            return CreateStringFromAddress(shpment.getShippingAddress());
        });

        var order = {
            UUID: dwOrder.getUUID(),
            id:dwOrder.getOrderNo(),
            date: dw.util.StringUtils.formatCalendar(dw.util.Calendar(dwOrder.getCreationDate()),"EEE, d MMM yyyy HH:mm"),
            total: dw.util.Currency.getCurrency(dwOrder.getTotalGrossPrice().getCurrencyCode()).getSymbol()+ " " + dwOrder.getTotalGrossPrice().valueOf(), 
            products:[], 
            customer:{name:"not set", email:"not set"},
            shippingAddress:shipmentAddresses, 
            billingAddress:CreateStringFromAddress(dwOrder.getBillingAddress())
        }
        if(customer){
            order.customer = {name:customer.getFirstName() + " " + customer.getLastName(), email:customer.getEmail()}
        }else{
            order.customer = {name:dwOrder.getBillingAddress().getFirstName() + " " + dwOrder.getBillingAddress().getLastName(), email:"(Not registered)"}
        }

        products.filter(function(product){
            order.products.push({
                id: product.getProductID(), 
                name: product.getProductName(),
                qty: product.getQuantity().valueOf(), 
                price: product.getGrossPrice().valueOf()
            })
        })
        
        reply.push(order);
        
	}
    pendingApproval.close();
    return reply;
}

/**
 * Given a shipment, return an address string
 * @param {dw.order.OrderAddress} orderAddress 
 * @returns {String}
 */
function CreateStringFromAddress(orderAddress){    
    return [
        orderAddress.getAddress1(),
        orderAddress.getAddress2(),
        orderAddress.getCity(),
        orderAddress.getPostalCode(),
        orderAddress.getCountryCode()
    ].join(", ")
}

/**
 * Verifies that the order and UUID match
 * @param {dw.order.Order} orderNo
 * @param {String} UUID
 * @returns {{error:Boolean, errorMessage:String, order:dw.order.Order}}
 */
function AreOrderUUIDValid(orderNo, UUID){
    if(!(orderNo && UUID)){
        return {error: true, errorMessage: "Missing request paramanters"};
    }

    var order = OrderMgr.getOrder(orderNo);        
    if(!order){
        return {error: true, errorMessage: "Could not retrieve order with No:" + orderNo};
    }
    if(order.getUUID() != UUID){
        Logger.warn("Request parameter mismatch " + orderNo + " >> " + order.getUUID() + "!=" + UUID);
        return {error: true, errorMessage: "Request parameter mismatch"};
    }

    return {error:false, order: order};
}

/**
 * Verifies that the order and UUID match
 * @param {dw.order.Order} order 
 * @param {String} UUID
 * @returns {{error:Boolean, errorMessage:String, transactionId: String, order: dw.order.Order, paymentInstrument: dw.order.OrderPaymentInstrument, hostedId: String}}
 */
function VerifyAndRetrieveTransactionId(orderNo, UUID){
    var verified = AreOrderUUIDValid(orderNo, UUID);

    if(verified.error) return verified;

    var paymentInstrument = IngenicoOrderHelper.getIngenicoPaymentInstrument(verified.order);
    var transactionId = null;
    var hostedId = null;
    if(paymentInstrument.getPaymentTransaction()){
        transactionId = paymentInstrument.getPaymentTransaction().getTransactionID();
        hostedId = paymentInstrument.getPaymentTransaction().getCustom().ING_hostedCheckoutId;
    }

    if(!transactionId && !hostedId){
        return {error: true, errorMessage: "Missing transaction id for order"};
    }

    return {error:false, order: verified.order, transactionId: transactionId, paymentInstrument: paymentInstrument, hostedId: hostedId};

}

/**
 * Web request to update order and redirect back
 */
function UpdateOrderRequest(){
    var orderNo = request.httpParameterMap.get("orderNo").stringValue;
    var UUID = request.httpParameterMap.get("UUID").stringValue;
    var transactionIdParam = request.httpParameterMap.get("tid").stringValue;

    var verifiedRequest = VerifyAndRetrieveTransactionId(orderNo, UUID);

    if(verifiedRequest.error){
        return SendJSONErrorResponse(verifiedRequest.errorMessage);
    }

    var order = verifiedRequest.order;
    var transactionId = verifiedRequest.transactionId;

    if(transactionIdParam && transactionId != transactionIdParam){
        SendJSONErrorResponse("ID mismatch");
        return;
    }
    
    var updateOK = IngenicoPayments.retrieveAndUpdateOrderPaymentStatus(order);

    SendJSONResponse(updateOK);
}

/**
 * Web request to create a refund for a given order
 */
function CreateRefund(){
    var orderNo = request.httpParameterMap.get("orderNo").stringValue;
    var UUID = request.httpParameterMap.get("UUID").stringValue;
    var transactionIdParam = request.httpParameterMap.get("tid").stringValue;
    var amount = request.httpParameterMap.get("amount").stringValue;
    var reason = request.httpParameterMap.get("reason").stringValue;

    var verifiedRequest = VerifyAndRetrieveTransactionId(orderNo, UUID);
    if(verifiedRequest.error){
        return SendJSONErrorResponse(verifiedRequest.errorMessage);
    }

    if(transactionIdParam && verifiedRequest.transactionId != transactionIdParam){
        SendJSONErrorResponse("ID mismatch");
        return;
    }

    // get latest status and update
    var updateOK = IngenicoPayments.retrieveAndUpdateOrderPaymentStatus(verifiedRequest.order);

    if(updateOK.error){
        return SendJSONErrorResponse(updateOK.errorMessage);
    }

    // get latest version of the order after update
    var order = OrderMgr.getOrder(orderNo);

    var paymentStatus = IngenicoOrderHelper.getStoredPaymentStatus(order);
    
    var availableToRefund = paymentStatus.payment.amount;

    paymentStatus.refunds.filter(function(rfd){
        if(rfd.statusOutput.statusCategory == "UNSUCCESSFUL"){
            return false;
        }

        availableToRefund -= rfd.amount;
    });

    if(availableToRefund < amount){
        return SendJSONErrorResponse("Amount to refund is greater than the amount available to refund");
    }
    
    var result = IngenicoPayments.createPaymentRefund(order, verifiedRequest.transactionId, Number(amount), reason);
    if(result.error){
        var errorCodes = {};
    
        if(result.response && result.response.errors){
            result.response.errors.filter(function(err){
                errorCodes[err.code] = err.message;
            })
        }

        if(errorCodes["300430"]){
            return SendJSONResponse({error:true, errorMessage:"Refund amount was too large.", result: result});
        }
        return SendJSONErrorResponse("Error creating refund: " + result.errorMessage,result);
    }
    return SendJSONResponse({error:false, message: "Refund created"});

}

/**
 * Web request to retrieve refund status and update
 */
function GetRefundStatus(){
    var orderNo = request.httpParameterMap.get("orderNo").stringValue;
    var UUID = request.httpParameterMap.get("UUID").stringValue;
    var refundIdParam = request.httpParameterMap.get("rid").stringValue;

    var verifiedRequest = VerifyAndRetrieveTransactionId(orderNo, UUID);
    if(verifiedRequest.error){
        return SendJSONErrorResponse(verifiedRequest.errorMessage);
    }

    var paymentStatus = IngenicoOrderHelper.getStoredPaymentStatus(verifiedRequest.order);
    if(!paymentStatus || !paymentStatus.payment){
        return SendJSONErrorResponse("Could not retrieve payment status");
    }

    var result = IngenicoPayments.getRefundStatus(orderNo, refundIdParam);

    if(result.error){
        return SendJSONErrorResponse("Error getting refund status",result);
    }
    return SendJSONResponse({error:false, message: "Refund status updated"});
}

/**
 * Web request to cancel payment
 */
function CancelRefund(){
    var orderNo = request.httpParameterMap.get("orderNo").stringValue;
    var UUID = request.httpParameterMap.get("UUID").stringValue;
    var refundIdParam = request.httpParameterMap.get("rid").stringValue;

    var verifiedRequest = VerifyAndRetrieveTransactionId(orderNo, UUID);
    if(verifiedRequest.error){
        return SendJSONErrorResponse(verifiedRequest.errorMessage);
    }

    var paymentStatus = IngenicoOrderHelper.getStoredPaymentStatus(verifiedRequest.order);
    if(!paymentStatus || !paymentStatus.payment){
        return SendJSONErrorResponse("Could not retrieve payment status");
    }

    var result = IngenicoPayments.cancelRefund(verifiedRequest.order, refundIdParam);

    if(result.error){
        return SendJSONErrorResponse("Error getting refund status",result);
    }
    return SendJSONResponse({error:false, message: "Refund cancelled"});
}

/*
* Web exposed methods
*/

/** Start for Ingenico Payments order actions
 * @see module:controllers/IngenicoActions~Start */
 exports.Start = guard.ensure(['https'], Start);

/** Approve pending fraud approval order
 * @see module:controllers/IngenicoActions~ApproveOrderPendingFraud */
 exports.ApproveOrderPendingFraud = guard.ensure(['https'], ApproveOrderPendingFraud); 

/** Retrieve orders in Pending Fraud Approval status
 * @see module:controllers/IngenicoActions~ShowPendingFraudApproval */
 exports.ShowPendingFraudApproval = guard.ensure(['https'], ShowPendingFraudApproval);

/** Retrieve orders in Pending Fraud Approval status
 * @see module:controllers/IngenicoActions~ApproveOrderPaymentPendingApproval */
 exports.ApproveOrderPaymentPendingApproval = guard.ensure(['https'], ApproveOrderPaymentPendingApproval);

/** Retrieve orders in Pending Fraud Approval status
 * @see module:controllers/IngenicoActions~ShowPendingApproval */
 exports.ShowPendingApproval = guard.ensure(['https'], ShowPendingApproval);

/** Cancel payment
 * @see module:controllers/IngenicoActions~ShowPendingApproval */
 exports.CancelTransaction = guard.ensure(['https'], CancelTransaction);

/** Update payment for a given order
 * @see module:controllers/IngenicoActions~UpdateOrder */
 exports.UpdateOrder = guard.ensure(['https'], UpdateOrderRequest);

/** Create refund for a given order
 * @see module:controllers/IngenicoActions~CreateRefund */
 exports.Refund = guard.ensure(['https'], CreateRefund);

/** Create refund for a given order
 * @see module:controllers/IngenicoActions~GetRefundStatus */
 exports.RefundStatus = guard.ensure(['https'], GetRefundStatus);

/** Create refund for a given order
 * @see module:controllers/IngenicoActions~CancelRefund */
 exports.CancelRefund = guard.ensure(['https'], CancelRefund);
 