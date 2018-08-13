/**
 * IngenicoSvc.js
 * Wrapper for Ingenico Service calls
 */

 /* API Includes */
var ServiceRegistry = dw.svc.ServiceRegistry;
var Logger = dw.system.Logger.getLogger("Ingenico");

/* Script Modules */
var IngenicoConfig = require('../config');

/**
 * Makes a Create payment request to the server and returns the transaction result
 * @param {Object} payload Ingenico Create payment payload https://epayments-api.developer-ingenico.com/s2sapi/v1/en_US/nodejs/payments/create.html#payments-create-request
 * @returns {Object}
 */
function CreatePayment(payload){
	var IngSvc = ServiceRegistry.get(IngenicoConfig.Services.PAYMENT_CREATE);
	var result = IngSvc.call(payload);
	return ProcessResults("CREATE_PAYMENT", result);
}

/**
 * Makes a Create Hosted Payment request to obtain URL to show in iframe
 * @param {Object} payload 
 * @returns {Object}
 */
function CreateHostedPayment(payload){
	var IngSvc = ServiceRegistry.get(IngenicoConfig.Services.HOSTED_PAYMENT_CREATE);
	var result = IngSvc.call(payload);
	return ProcessResults("CREATE_HOSTED_PAYMENT", result);
}


/**
 * Get card product type based on first 6 numbers of the card or the complete card number.
 * @param {Object} payload 
 */
function GetCardType(payload){
	var IngSvc = ServiceRegistry.get(IngenicoConfig.Services.CARD_DETAILS_GET);
	var result = IngSvc.call(payload);
	return ProcessResults("CARD_TYPE", result);
}

/**
 * Create token from card details
 * @param {Object} payload
 */
function CreateToken(payload){
	var IngSvc = ServiceRegistry.get(IngenicoConfig.Services.TOKEN_CREATE);
	var result = IngSvc.call(payload);
	return ProcessResults("CREATE_TOKEN", result);	
}

/**
 * Create token from payment transaction
 * @param {{paymentID: String, reqData:{alias: String}}} payload
 */
function TokenizePayment(payload){
	var IngSvc = ServiceRegistry.get(IngenicoConfig.Services.PAYMENT_TOKENIZE);
	var result = IngSvc.call(payload);
	return ProcessResults("PAYMENT_TOKENIZE", result);
}

/**
 * Returns payment status for an order
 * @param {Object} payload 
 */
function GetPaymentStatus(payload){
	var IngSvc = ServiceRegistry.get(IngenicoConfig.Services.PAYMENT_STATUS);
	var result = IngSvc.call(payload);
	return ProcessResults("ORDER_STATUS", result);		
}

/**
 * Returns payment status for an HPP order
 * @param {Object} payload 
 */
function GetHostedPaymentStatus(payload){
	var IngSvc = ServiceRegistry.get(IngenicoConfig.Services.HOSTED_PAYMENT_STATUS);
	var result = IngSvc.call(payload);
	return ProcessResults("HOSTED_STATUS", result);		
}

/**
 * Cancel payment transaction
 * @param {Object} payload 
 */
function CancelPaymentTransaction(payload){
	var IngSvc = ServiceRegistry.get(IngenicoConfig.Services.PAYMENT_CANCEL);
	var result = IngSvc.call(payload);
	return ProcessResults("PAYMENT_CANCEL", result);		
}

/**
 * Makes fraud approval request
 * @param {Object} payload 
 */
function ApproveFraudPending(payload){
	var IngSvc = ServiceRegistry.get(IngenicoConfig.Services.PAYMENT_APPROVE_FRAUD);
	var result = IngSvc.call(payload);
	return ProcessResults("PAYMENT_APPROVE_FRAUD", result);		
}

/**
 * Makes capture request
 * @param {{paymentID: String, reqData:{amount: String, isFinal: Boolean} }} payload 
 */
function Capture(payload){
	var IngSvc = ServiceRegistry.get(IngenicoConfig.Services.PAYMENT_CAPTURE);
	var result = IngSvc.call(payload);
	return ProcessResults("CAPTURE", result);		
}

/**
 * Retrieve captures list
 * @param {{paymentID: String}}} payload 
 */
function CapturesList(payload){
	var IngSvc = ServiceRegistry.get(IngenicoConfig.Services.PAYMENT_CAPTURES);
	var result = IngSvc.call(payload);
	return ProcessResults("GET CAPTURES", result);		
}

/**
 * Makes undo capture request
 * @param {Object} payload 
 */
function UndoCapture(payload){
	var IngSvc = ServiceRegistry.get(IngenicoConfig.Services.PAYMENT_UNDO_CAPTURE);
	var result = IngSvc.call(payload);
	return ProcessResults("UNDO_CAPTURE", result);		
}

/**
 * Makes payment approval request
 * @param {{paymentID: String, reqData: Object}} payload 
 */
function ApprovePaymentPending(payload){
	var IngSvc = ServiceRegistry.get(IngenicoConfig.Services.PAYMENT_APPROVE);
	var result = IngSvc.call(payload);
	return ProcessResults("PAYMENT_APPROVE", result);		
}

/**
 * Makes refund payment request
 * @param {Object} payload 
 */
function RefundPayment(payload){
	var IngSvc = ServiceRegistry.get(IngenicoConfig.Services.PAYMENT_REFUND);
	var result = IngSvc.call(payload);
	return ProcessResults("PAYMENT_REFUND", result);		
}

/**
 * Makes refund status request
 * @param {Object} payload 
 */
function GetRefundStatus(payload){
	var IngSvc = ServiceRegistry.get(IngenicoConfig.Services.REFUND_STATUS);
	var result = IngSvc.call(payload);
	return ProcessResults("REFUND_STATUS", result);		
}

/**
 * Makes approve refund request
 * @param {{paymentID: String, reqData: {amount: Number}}} payload 
 */
function RefundApproval(payload){
	var IngSvc = ServiceRegistry.get(IngenicoConfig.Services.REFUND_APPROVE);
	var result = IngSvc.call(payload);
	return ProcessResults("REFUND_APPROVE", result);		
}

/**
 * Makes undo refund approval request
 * @param {{paymentID: String}} payload 
 */
function UndoRefundApproval(payload){
	var IngSvc = ServiceRegistry.get(IngenicoConfig.Services.REFUND_UNDO_APPROVAL);
	var result = IngSvc.call(payload);
	return ProcessResults("REFUND_UNDO_APPROVAL", result);		
}

/**
 * Makes cancel refund request
 * @param {Object} payload 
 */
function CancelRefund(payload){
	var IngSvc = ServiceRegistry.get(IngenicoConfig.Services.REFUND_CANCEL);
	var result = IngSvc.call(payload);
	return ProcessResults("REFUND_CANCEL", result);		
}

/**
 * Makes request to return list of products based on currency and countrycode
 * @param {{currency:String, countrycode: String}} payload 
 */
function ProductList(payload){
	var IngSvc = ServiceRegistry.get(IngenicoConfig.Services.PRODUCT_LIST);
	var result = IngSvc.call(payload);
	return ProcessResults("PRODUCT_LIST", result);		
}

/**
 * Parses result object from the service call and returns a JSON object
 * @param {String} requestTypeLabel Label used in the logs to identify the request
 * @param {dw.svc.Result} result Result object from the service call
 */
function ProcessResults(requestTypeLabel, result){
	if(result.ok) {
		try{
			/**
			 * @type {dw.net.HTTPClient} HTTP client object
			 */
			var object = result.getObject();
			var statusCode = object.getStatusCode();
			if(statusCode == 204){
				return {}
			}
			return JSON.parse(object.getText().toString());
		}catch(e){
			Logger.warn("ERROR parsing JSON response:" + e.toString());
			return {error: "Error processing response from API", errorMessage: e.toString()};
		}
	}
	if(result.status == 'SERVICE_UNAVAILABLE'){
		return {
			error: true,
			timeout: true,
			errorCode: result.getError(), 
			errorMessage: result.getErrorMessage()
		}
	}
	Logger.error(requestTypeLabel + ": ERROR >> " +  result.error + " RESULT_STATUS");
	
	try{
		var errPayload = JSON.parse(result.getErrorMessage());
		return {error: true, response: errPayload, errorCode: result.getError(), errorMessage: result.getMsg()}
	}catch(e){
		return {error: result.errorMessage, errorCode: result.error, msg: result.getMsg()}		
	}
}

/*
 * Module exports
 */

/**
 * Local exports
 */
exports.createPayment = CreatePayment;
exports.createHostedPayment = CreateHostedPayment;
exports.createToken = CreateToken;
exports.getCardType = GetCardType;
exports.getPaymentStatus = GetPaymentStatus;
exports.getHostedPaymentStatus = GetHostedPaymentStatus;
exports.cancelPaymentTransaction = CancelPaymentTransaction;
exports.approveFraudPending = ApproveFraudPending;
exports.approvePaymentPending = ApprovePaymentPending;
exports.refundPayment = RefundPayment;
exports.getRefundStatus = GetRefundStatus;
exports.refundApproval = RefundApproval;
exports.undoRefundApproval = UndoRefundApproval;
exports.cancelRefund = CancelRefund;
exports.capturePayment = Capture;
exports.listCaptures = CapturesList;
exports.undoCapture = UndoCapture;
exports.tokenizePayment = TokenizePayment;
exports.listProducts = ProductList;