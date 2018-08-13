/**
 * Payload expected for payments
 * https://epayments-api.developer-ingenico.com/s2sapi/v1/en_US/json/payments/get.html#payments-get-request
 * 
 * Payload expected for refunds
 * https://epayments-api.developer-ingenico.com/s2sapi/v1/en_US/json/refunds/get.html#refunds-get-request
 *
 * @file Process responses and update the order object based on responses
 * @module int_ingenico/scripts/order/UpdateOrder
 */

 /* API Includes */
var Transaction = dw.system.Transaction;
var Money = dw.value.Money;
var Site = dw.system.Site;
var Logger = dw.system.Logger.getLogger("Ingenico");

/* Site Genesis imports */
var app = require('sitegenesis_storefront_controllers/cartridge/scripts/app');

/* Script Modules */
var Order = app.getModel('Order');
var ReturnStatus = require("../config").ReturnStatus;
var SitePreferences = require("../config").SitePreferences;
var EmailOrderStatusNotifications = require('./EmailOrderStatusNotifications');
var IngenicoOrderHelper = require('../utils/IngenicoOrderHelper');

/*
 * @typedef {{ error: Boolean, errorMessage: String, paymentAuthSuccess: Boolean, paymentReceived: Boolean, status: String}} OrderStatusUpdateResponse
 */
/**
 * @typedef OrderStatusUpdateResponse
 * @type {object}
 * @property {Boolean} error Is there an error
 * @property {String} errorMessage Text describing the error
 * @property {Boolean} paymentAuthSuccess Was payment authorisation successfult
 * @property {Boolean} paymentReceived Was payment received
 * @property {String} status Gateway transaction status response
 * 
 */

/**
 * Updates order and payment instrument with the payload
 * @private
 * @param {dw.order.Order} order Order to update based on payload
 * @param {dw.order.OrderPaymentInstrument}
 * @param {statusUpdatePayload} payload Status Update Payload
 * @param {Boolean} skipTransaction Should update be wrapped inside a transaction
 * @returns {OrderStatusUpdateResponse} Response payload with error, errorMessage, paymentAuthSuccess, paymentReceived
 */
function orderStatusUpdate(order, paymentInstrument, payload, skipTransaction) {
    var returnObj = {
        error: false,
        errorMessage: null,
        paymentAuthSuccess: false,
        paymentReceived: false,
        status: null
    };

    if (!order || !paymentInstrument || !payload) {
        Logger.error("Missing Parameters - Update.Order.orderStatusUpdate");
        returnObj.error = true;
        returnObj.errorMessage = "Missing Parameters - Update.Order.orderStatusUpdate";
        return returnObj;
    }

    var paymentTransaction = paymentInstrument.getPaymentTransaction();
    if (!paymentTransaction) {
        Logger.error("Could not retrieve transaction for payment Instrument");
        returnObj.error = true;
        returnObj.errorMessage = "Could not retrieve payment instrument from order - Update.Order.orderStatusUpdate";
        return returnObj;        
    }

    var paymentProcessor = dw.order.PaymentMgr.getPaymentMethod(paymentInstrument.getPaymentMethod()).getPaymentProcessor();
    
    var orderStatusPayload = IngenicoOrderHelper.getStoredPaymentStatus(order);
    var dbTransactionStarted = false;
    var sendEmail = true;
    try{
        if(!skipTransaction){
            Transaction.begin();
            dbTransactionStarted = true;
        }
        
        var originalOrderStatus = order.getCustom().ING_status;

            if (payload.paymentOutput) {                
                switch(payload.status){
                    case ReturnStatus.CANCELLED:
                    case ReturnStatus.REJECTED:
                    case ReturnStatus.REJECTED_CAPTURE:
                        if(order.getStatus() == dw.order.Order.ORDER_STATUS_CREATED){
                            dw.order.OrderMgr.failOrder(order);
                        }else if(order.status != dw.order.Order.ORDER_STATUS_CANCELLED && order.status != dw.order.Order.ORDER_STATUS_FAILED){
                            order.setStatus(dw.order.Order.ORDER_STATUS_CANCELLED);
                        }
                        break;
                    case ReturnStatus.PAID:
                    case ReturnStatus.CAPTURED:
                        if(order.status == dw.order.Order.ORDER_STATUS_CREATED){
                            var placeOrderResult = Order.submit(order);
                            if(placeOrderResult.error){
                                throw placeOrderResult.PlaceOrderError;
                            }
                            order.setExportStatus(dw.order.Order.EXPORT_STATUS_READY);
                            order.setPaymentStatus(dw.order.Order.PAYMENT_STATUS_PAID);
                        }else if(order.status == dw.order.Order.ORDER_STATUS_NEW || order.status == dw.order.Order.ORDER_STATUS_OPEN){
                            if(order.getExportStatus() == order.EXPORT_STATUS_NOTEXPORTED){
                                order.setExportStatus(dw.order.Order.EXPORT_STATUS_READY);                            
                            }
                            if(order.getPaymentStatus() != dw.order.Order.PAYMENT_STATUS_PAID){
                                order.setPaymentStatus(dw.order.Order.PAYMENT_STATUS_PAID);
                            }
                        }

                        returnObj.paymentAuthSuccess = true;
                        returnObj.paymentReceived = true;
                        break;
                    case ReturnStatus.PENDING_FRAUD_APPROVAL:
                    case ReturnStatus.CAPTURE_REQUESTED:
                    case ReturnStatus.PENDING_APPROVAL:
                    case ReturnStatus.PENDING_CAPTURE:
                    case ReturnStatus.PENDING_PAYMENT:
                        returnObj.paymentAuthSuccess = true;
                    case ReturnStatus.REDIRECTED:
                    case ReturnStatus.AUTHORIZATION_REQUESTED:
                        order.setExportStatus(dw.order.Order.EXPORT_STATUS_NOTEXPORTED);                
                        break;
                }


                if (paymentTransaction.getTransactionID() == "") {
                    paymentTransaction.setTransactionID(payload.id);
                }
        
                if(paymentProcessor && !paymentTransaction.getPaymentProcessor()){
                    paymentTransaction.setPaymentProcessor(paymentProcessor);
                }
                    
                if (payload.paymentOutput.amountOfMoney) {
                    var authAmount = new Number(payload.paymentOutput.amountOfMoney.amount);
                    paymentTransaction.setAmount(new Money(authAmount / 100, payload.paymentOutput.amountOfMoney.currencyCode));
                }
        
                if (payload.paymentOutput.cardPaymentMethodSpecificOutput) {
                    if (payload.paymentOutput.cardPaymentMethodSpecificOutput.authorisationCode) {
                        orderStatusPayload.payment.authCode = payload.paymentOutput.cardPaymentMethodSpecificOutput.authorisationCode;
                    }
                }

                order.getCustom().ING_status = payload.status;

                if(payload.paymentOutput.cardPaymentMethodSpecificOutput){
                    orderStatusPayload.payment.method = payload.paymentOutput.cardPaymentMethodSpecificOutput.paymentProductId;                    
                }else if(payload.paymentOutput.cashPaymentMethodSpecificOutput){
                    orderStatusPayload.payment.method = payload.paymentOutput.cashPaymentMethodSpecificOutput.paymentProductId;                    
                }else if(payload.paymentOutput.redirectPaymentMethodSpecificOutput){
                    orderStatusPayload.payment.method = payload.paymentOutput.redirectPaymentMethodSpecificOutput.paymentProductId;                    
                }else if(payload.paymentOutput.mobilePaymentMethodSpecificOutput){
                    orderStatusPayload.payment.method = payload.paymentOutput.mobilePaymentMethodSpecificOutput.paymentProductId;                    
                }else if(payload.paymentOutput.invoicePaymentMethodSpecificOutput){
                    orderStatusPayload.payment.method = payload.paymentOutput.invoicePaymentMethodSpecificOutput.paymentProductId;                    
                }else if(payload.paymentOutput.bankTransferPaymentMethodSpecificOutput){
                    orderStatusPayload.payment.method = payload.paymentOutput.bankTransferPaymentMethodSpecificOutput.paymentProductId;                    
                }else if(payload.paymentOutput.directDebitPaymentMethodSpecificOutput){
                    orderStatusPayload.payment.method = payload.paymentOutput.directDebitPaymentMethodSpecificOutput.paymentProductId;                    
                }

                orderStatusPayload.payment.amount = payload.paymentOutput.amountOfMoney.amount / 100;
                orderStatusPayload.payment.date = Date.now();
                orderStatusPayload.payment.id = payload.id;
                orderStatusPayload.payment.statusOutput = payload.statusOutput;
                orderStatusPayload.payment.status = payload.status;
            }

            if(payload.refundOutput){
                sendEmail = false;
                var refund = null;
                var refPosition = -1;
                
                orderStatusPayload.refunds.filter(function(rfd,indx){
                    if(rfd.id == payload.id){
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
                        id: ""
                    }
                }

                refund.amount = payload.refundOutput.amountOfMoney.amount / 100;
                refund.date = Date.now();
                refund.id = payload.id;
                refund.statusOutput = payload.statusOutput;
                refund.status = payload.status;

                if(refPosition > -1){
                    orderStatusPayload.refunds[refPosition] = refund;
                }else{
                    orderStatusPayload.refunds.push(refund);
                }

                orderStatusPayload.refunds = IngenicoOrderHelper.removeRefundStatusDuplicates(orderStatusPayload.refunds);

                var refundIDs = order.getCustom().ING_refundIDs.slice();
                if(refundIDs.indexOf(payload.id) == -1){
                    refundIDs.push(payload.id);
                }
                order.getCustom().ING_refundIDs = refundIDs;
                
            }
    
            order.getCustom().ING_paymentStatus = JSON.stringify(orderStatusPayload);

            refundIDs = order.getCustom().ING_refundIDs.slice();
            if(orderStatusPayload.refunds.length > 0 && refundIDs.length != orderStatusPayload.refunds.length){
                orderStatusPayload.refunds.map(function(el){
                    return el.id;
                }).filter(function(el){
                    if(refundIDs.indexOf(el) == -1){
                        refundIDs.push(el);
                    }    
                });
                order.getCustom().ING_refundIDs = refundIDs;
            }

            if (Site.current.getCustomPreferenceValue(SitePreferences.ENABLE_TRANSACTION_LOGS)) {
                var orderTransactionLogs = order.getCustom().ING_transactionHistory.slice();
    
                var logData = {};
                logData.transactionDate = (new Date()).toUTCString();
                logData.status = payload.status;
                logData.statusLastChange = payload.statusOutput.statusCodeChangeDateTime;
                logData.raw = payload;
                orderTransactionLogs.push(JSON.stringify(logData));
                order.getCustom().ING_transactionHistory = orderTransactionLogs;
            }

        if(!skipTransaction){
            dbTransactionStarted = false;     
            Transaction.commit();
        }

        returnObj.status = payload.status;
    }catch(e){
        Logger.error("ERROR UPDATING ORDER:" + e.toString() + " payload: " + JSON.stringify(payload) + "order: " + order.getStatus() + " # " + order.getOrderNo());
        if(dbTransactionStarted){
            Transaction.rollback();
        }

        returnObj.error = true;
        returnObj.errorMessage = "Error updating database: " + e.toString();
        return returnObj;
    }

    if(sendEmail){
        try{
            if(payload.status == ReturnStatus.PENDING_FRAUD_APPROVAL && originalOrderStatus != ReturnStatus.PENDING_FRAUD_APPROVAL){
                EmailOrderStatusNotifications.sendFraudEmail(order.getOrderNo());
            }
        
            if(originalOrderStatus != payload.status){
                EmailOrderStatusNotifications.sendCustomerEmail(payload.status,order.getCustomerEmail(), order.getOrderNo());
            }
        }catch(e){
            Logger.error("ERROR SENDING EMAILS:" + e.toString() + " payload: " + JSON.stringify(payload) + "order: " + order.getStatus() + " # " + order.getOrderNo());
        }
    }
    returnObj.status = payload.status;
    return returnObj;

}

/**
 * Static method to return base log or the payload
 * @private
 * @param {Object} payload Check input payload or return empty payload
 */
function createUpdatePayload(payload) {
    var logPayload = {
        id: "",
        paymentOutput: {
            amountOfMoney: {
                amount: 0,
                currencyCode: ""
            },
            references: {
                merchantReference: "",
                paymentReference: ""
            },
            paymentMethod: "",
            cardPaymentMethodSpecificOutput: {
                paymentProductId: 0,
                authorisationCode: "",
                fraudResults: {},
                threeDSecureResults: {},
                card: {}
            }
        },
        refundOutput: {
            amountOfMoney : {
                amount : 0,
                currencyCode : ""
             },
             references : {
                merchantReference : "",
                paymentReference : ""
             },
             paymentMethod : "",
             cardRefundMethodSpecificOutput : {
                totalAmountPaid : 0,
                totalAmountRefunded : 0
             }
        },
        status: "",
        statusOutput: {
            isCancellable: false,
            statusCategory: "",
            statusCode: 0,
            statusCodeChangeDateTime: 0,
            isAuthorized: false,
            isRefundable: false
        },
        otherData: {}
    };

    if (!payload || !payload.status || !payload.statusOutput || !(payload.paymentOutput || payload.refundOutput)) return logPayload;

    return payload;
}


/**
 * Updates order and payment instrument based on payload from a createPayment request
 * @param {dw.order.Order} systemOrder 
 * @param {dw.order.OrderPaymentInstrument} paymentInstrument 
 * @param {Object} payload Response from createPayment service
 * @param {Boolean} skipTransaction Should the update skip using transactions
 * @returns {OrderStatusUpdateResponse} Returns order status update object
 */
function CreatePaymentOrderUpdate(order, paymentInstrument, payload, skipTransaction){
    if(!payload || !payload.statusOutput) {
        return {
            error: true,
            errorMessage: "Missing arguments: Payload",
            paymentAuthSuccess: false,
            paymentReceived: false,
            payload: payload
        };    
    }

    var updatePayload = createUpdatePayload(payload);
    if(!order || !order.orderNo){
        return {
            error: true,
            errorMessage: "Missing arguments: Order",
            paymentAuthSuccess: false,
            paymentReceived: false,
            payload: payload
        };    
    }
    if(!paymentInstrument){
        return {
            error: true,
            errorMessage: "Missing arguments: PaymentInstrument",
            paymentAuthSuccess: false,
            paymentReceived: false,
            payload: payload
        };            
    }

    var refreshedOrder = dw.order.OrderMgr.getOrder(order.orderNo);
    if(!refreshedOrder){
        return {
            error: true,
            errorMessage: "Could not refresh object: paymentInstrument",
            paymentAuthSuccess: false,
            paymentReceived: false,
            payload: payload
        };            
    }

    refreshedPaymentInstrument = IngenicoOrderHelper.getIngenicoPaymentInstrument(refreshedOrder, payload.id);
    if(!paymentInstrument){
        return {
            error: true,
            errorMessage: "Could not refresh object: paymentInstrument",
            paymentAuthSuccess: false,
            paymentReceived: false,
            payload: payload
        };            
    }
    // Logger.warn("ORDER STATUS: " + refreshedOrder.getCustom().ING_status + " STATUS_PAYLOAD: " + refreshedOrder.getCustom().ING_paymentStatus + " NEWPAYLOAD: " + JSON.stringify(payload) + " - OLDORDER: " + order.getCustom().ING_paymentStatus);
    return orderStatusUpdate(refreshedOrder, refreshedPaymentInstrument, updatePayload, skipTransaction);
}

/**
 * Updates order with payload from orderId
 * @param {String} orderId
 * @param {Object} payload
 * @returns {OrderStatusUpdateResponse} Returns order status update object
 */
function UpdateOrderFromCallback(orderId, payload){
    if(!payload || !payload.statusOutput || !orderId) {
        return {
            error: true,
            errorMessage: "Missing arguments",
            paymentAuthSuccess: false,
            paymentReceived: false,
            payload: payload
        };    
    }


    var order = dw.order.OrderMgr.getOrder(orderId);
    var paymentInstrument = null;
    if(!order){
        return {
            error: true,
            errorMessage: "Could not retrieve order",
            paymentAuthSuccess: false,
            paymentReceived: false
        };    
    }
    order.getPaymentInstruments().toArray().filter(function(pi){
        var paymentProcessor = dw.order.PaymentMgr.getPaymentMethod(pi.paymentMethod).getPaymentProcessor();
        if(paymentProcessor.getID() === "INGENICO_HOSTED" || paymentProcessor.getID() === "INGENICO_CREDIT"){
            var transaction = pi.getPaymentTransaction();
            if(transaction){
                var transactionId = transaction.getTransactionID();
                if(!payload.refundOutput && transactionId && payload.id && payload.id !=transactionId){
                    return;
                }    
            }
            paymentInstrument = pi;
        }
    });

    if(order && paymentInstrument){
        return CreatePaymentOrderUpdate(order, paymentInstrument, payload);
    }

    Logger.warn("Did not update order: order or payment instrument missing");
    return {
        error: true,
        errorMessage: "Could not retrieve order and/or paymentInstrument",
        paymentAuthSuccess: false,
        paymentReceived: false
    };
}

/*
 * Module exports
 */

/**
 * Local exports
 */
/**
 * Exported function to update order from a create payment transaction
 * @see {@link #CreatePaymentOrderUpdate}
 * @name createPaymentOrderUpdate
 */
exports.createPaymentOrderUpdate = CreatePaymentOrderUpdate;

/**
 * Exported local function {@link UpdateOrderFromCallback} to update order from a payment status payload. 
 * @see {@link #UpdateOrderFromCallback}
 * @name updateOrderFromCallback
 */
exports.updateOrderFromCallback = UpdateOrderFromCallback;