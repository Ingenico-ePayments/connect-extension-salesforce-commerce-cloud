/**
* config.js
* Holds all configuration, references and other API and Demandware information used throughout the integration cartridges.
*/

/* API Includes */
var Site = dw.system.Site;
var Logger = dw.system.Logger;
var System = dw.system.System;
var log = Logger.getLogger("config");

/*
 * BELOW THIS LINE, SHOULD NOT BE CHANGED OTHER THAN BY INGENICO.
 * IF THE CODE BELOW IS CHANGED, FUTURE UPGRADES MIGHT BREAK. 
 * --------------------------------------------------------------
 */

/**
 * Static object representing Integration SDK Version
 */
const VERSION = {
	"platformIdentifier" : "Salesforce Commerce Cloud",
	"sdkIdentifier" : "Demandware/v17.7.0",
	"sdkCreator" : "Ingenico",
	"integrator" : "Ingenico.Integrator",
	"shoppingCartExtension" : {
		"creator" : "Ingenico.Creator",
		"name" : "Extension",
		"version" : "1.0.0",
		"extensionID" : "INGCO170816"
	}
};

/**
 * Ingenico's API hosts. Maps key used in the custom preference to a server URL
 * https://epayments-api.developer-ingenico.com/s2sapi/v1/en_US/json/endpoints.html
 */
const ApiHosts = {
	PROD : "LOCATION.api-ingenico.com", //"api-prod.globalcollect.com",		// https://world.api-ingenico.com or https://eu.api-ingenico.com
	PREPROD : "LOCATION.preprod.api-ingenico.com", //"api-preprod.globalcollect.com", 	// https://eu.preprod.api-ingenico.com
	SANDBOX : "eu.sandbox.api-ingenico.com" //"api-sandbox.globalcollect.com"  	// https://eu.sandbox.api-ingenico.com
};

/**
 * Ingenico's API locations.
 * - EU: Data stored only in servers located in the European Union
 * - WW: Data stored in servers located throughout the world.
 * https://epayments-api.developer-ingenico.com/s2sapi/v1/en_US/json/endpoints.html
 */
const ApiLocations = {
	WW : "world",
	EU : "eu"
};

/**
 * Application environment options as used in the site custom preference
 * https://epayments-api.developer-ingenico.com/s2sapi/v1/en_US/json/environments.html
 */
const AppEnvironment = {
	PROD: 'PROD',
	PREPROD: 'PREPROD',
	SANDBOX: 'SANDBOX'
}

/**
 * Payment processors handled by this integration cartridge
 */
const PaymentProcessors = {
	INGENICO_HOSTED: "INGENICO_HOSTED",
	INGENICO_CREDIT: "INGENICO_CREDIT"
}

/**
 * Payment methods supported by this cartridge as defined in the Business Manager.
 */
const PaymentMethods = {
	CREDITCARD: dw.order.PaymentInstrument.METHOD_CREDIT_CARD,
	HOSTEDPAY: "HostedCreditCard",
	HOSTEDOTHER: "HostedOther",
	PAYPAL: "HostedPayPal",
	IDEAL: "HostediDeal"
}

/**
 * List of payment methods using the ID as the key
 */
const PaymentMethodsByID = {
	"3004": "A.T.U-Card",
	"3002": "Accor Business Account",
	"2": "American Express",
	"140": "Argencard",
	"146": "Aura",
	"3004": "Bancontact",
	"135": "Cabal",
	"130": "Carte Bancaire",
	"141": "Consumax",
	"123": "Dankort",
	"132": "Diners Club",
	"128": "Discover",
	"147": "ELO",
	"148": "Hipercard",
	"139": "Italcred",
	"125": "JCB",
	"117": "Maestro",
	"142": "Mas",
	"3": "MasterCard",
	"119": "MasterCard Debit",
	"136": "Naranja",
	"145": "Nativa",
	"137": "Nevada",
	"144": "Pyme Nacion",
	"149": "Tarjeta Shopping",
	"1": "Visa",
	"114": "Visa Debit",
	"122": "Visa Electron",
	"320": "Android Pay",
	"302": "Apple Pay",
	"819": "Aktia",
	"861": "AliPay",
	"3103": "CADO Carte",
	"845": "CashU",
	"3119": "CBC Online",
	"818": "Danske Bank Finland",
	"3104": "DEXIA NetBanking",
	"402": "eCard Poland",
	"810": "eNets",
	"3106": "Facily Pay 3X",
	"3107": "Facily Pay 3X NF",
	"3108": "Facily Pay 4X",
	"3109": "Facily Pay 4X NF",
	"3111": "Giftcard - Limonetik",
	"816": "Giropay",
	"809": "iDeal",
	"3112": "illicado",
	"801": "ING HomePay",
	"3120": "KBC Online",
	"802": "Nordea e-payment Finland",
	"805": "Nordea e-payment Sweden",
	"3113": "Pacifica",
	"840": "PayPal",
	"830": "PaySafeCard",
	"3124": "Przelewy24",
	"8580": "QIWI Wallet/Kiosk",
	"3114": "Seqr",
	"843": "Skrill",
	"836": "SOFORT",
	"3116": "Spirit Of Cadeau",
	"430": "UnionPay International (redirect)",
	"841": "WebMoney",
	"849": "Yandex",
	"770": "SEPA Direct Debit",
	"705": "Direct Debit UK",
	"11": "Bank Transfers",
	"53": "Bank Transfers Argentina",
	"500": "BPay",
	"51": "Deposito Identificado",
	"1503": "Boleto Bancario",
	"1504": "Konbini",
	"1506": "Pago Facil",
	"1501": "Western Union",
}

/**
 * Ingenico's payment statuses returned
 * https://epayments-api.developer-ingenico.com/s2sapi/v1/en_US/json/statuses.html
 */
const ReturnStatus = {
	AUTHORIZATION_REQUESTED: "AUTHORIZATION_REQUESTED",
	CANCELLED: "CANCELLED",
	CAPTURE_REQUESTED: "CAPTURE_REQUESTED",
	CAPTURED: "CAPTURED",
	CHARGEBACKED: "CHARGEBACKED",
	PAID: "PAID",
	PENDING_APPROVAL: "PENDING_APPROVAL",
	PENDING_CAPTURE: "PENDING_CAPTURE",
	PENDING_FRAUD_APPROVAL: "PENDING_FRAUD_APPROVAL",
	PENDING_PAYMENT: "PENDING_PAYMENT",	
	REDIRECTED: "REDIRECTED",
	REVERSED: "REVERSED",
	REFUNDED: "REFUNDED",
	REFUND_REQUESTED: "REFUND_REQUESTED",
	REJECTED: "REJECTED",
	REJECTED_CAPTURE: "REJECTED_CAPTURE"
}

/**
 * Mapping for Demandware's Ingenico Service Name
 */
const Services = {
	// Payments
	PAYMENT_APPROVE: 'Ingenico_Approve', // TODO: Rename service for consistency
	PAYMENT_APPROVE_FRAUD: 'Ingenico_ApproveFraud', // TODO: Rename service for consistency
	PAYMENT_CANCEL: 'Ingenico_Cancel', // TODO: Rename service for consistency
	PAYMENT_CAPTURE: 'Ingenico_Capture', // TODO: Rename service for consistency
	PAYMENT_CAPTURES: 'Ingenico_RetrieveCaptures', // TODO: Rename service for consistency
	PAYMENT_COMPLETE: 'Ingenico_Payment_Complete', // TODO: Not implemented
	PAYMENT_CREATE: 'Ingenico_Create', // TODO: Rename service for consistency
	PAYMENT_REFUND: 'Ingenico_Refund', // TODO: Rename service for consistency
	PAYMENT_STATUS: 'Ingenico_Retrieve', // TODO: Rename service for consistency
	PAYMENT_STATUS_3RD_PARTY: 'Ingenico_Payment_ThirdPartyStatus', // TODO: Not implemented
	PAYMENT_TOKENIZE: 'Ingenico_Payment_Tokenize',
	PAYMENT_UNDO_CAPTURE: 'Ingenico_UndoCapture', // TODO: Rename service for consistency
	// Captures
	CAPTURE_STATUS: 'Ingenico_Capture_Status', // TODO: Not Implemented
	// Payouts
	PAYOUT_APPROVE: 'Ingenico_Payout_Approve', // TODO: Not Implemented
	PAYOUT_CANCEL: 'Ingenico_Payout_Cancel', // TODO: Not Implemented
	PAYOUT_CREATE: 'Ingenico_Payout_Create', // TODO: Not Implemented
	PAYOUT_STATUS: 'Ingenico_Payout_Status', // TODO: Not Implemented
	PAYOUT_UNDO_APPROVAL: 'Ingenico_Payout_Undo_Approval', // TODO: Not Implemented
	// Products
	PRODUCT_LIST: 'Ingenico_Product_List',
	// Refunds
	REFUND_APPROVE: 'Ingenico_Refund_Approve',
	REFUND_CANCEL: 'Ingenico_Refund_Cancel',
	REFUND_STATUS: 'Ingenico_RetrieveRefund', // TODO: Rename service for consistency
	REFUND_UNDO_APPROVAL: 'Ingenico_Refund_Undo_Approval',
	// Tokens
	TOKEN_APPROVE_SEPA_MANDATE: '', // TODO: Not Implemented
	TOKEN_CREATE: 'Ingenico_CreateToken',
	TOKEN_DELETE: '', // TODO: Not Implemented
	TOKEN_GET: '', // TODO: Not Implemented
	TOKEN_UPDATE: '', // TODO: Not Implemented
	// Services
	CARD_DETAILS_GET: 'Ingenico_GetIINDetails', // TODO: Rename service for consistency
	// Hosted Checkout
	HOSTED_PAYMENT_CREATE: 'Ingenico_CreateHosted',	 // TODO: Rename service for consistency
	HOSTED_PAYMENT_STATUS: 'Ingenico_GetHostedStatus', // TODO: Rename service for consistency
}

/**
 * Stores Ingenico API endpoints.
 * https://epayments-api.developer-ingenico.com/s2sapi/v1/en_US/json/
 * IMPLEMENTED: Payments, Captures, Refunds, Services (Partially), Tokens (Partially), Hosted Checkouts
 * NOT IMPLEMENTED: Payouts, Products, Product Groups, Services (Partially), Sessions, Tokens (Partially)
 */
const API = {};
// Payments
API[Services.PAYMENT_APPROVE] = "/payments/{PAYMENTID}/approve"; // https://epayments-api.developer-ingenico.com/s2sapi/v1/en_US/json/payments/approve.html
API[Services.PAYMENT_APPROVE_FRAUD] = "/payments/{PAYMENTID}/processchallenged"; // https://epayments-api.developer-ingenico.com/s2sapi/v1/en_US/json/payments/processchallenged.html
API[Services.PAYMENT_CANCEL] = "/payments/{PAYMENTID}/cancel"; // https://epayments-api.developer-ingenico.com/s2sapi/v1/en_US/json/payments/cancel.html
API[Services.PAYMENT_CAPTURE] = "/payments/{PAYMENTID}/capture"; // https://epayments-api.developer-ingenico.com/s2sapi/v1/en_US/json/payments/capture.html
API[Services.PAYMENT_CAPTURES] = "/payments/{PAYMENTID}/captures"; // https://epayments-api.developer-ingenico.com/s2sapi/v1/en_US/json/payments/captures.html
API[Services.PAYMENT_COMPLETE] = "/payments/{PAYMENTID}/complete"; // https://epayments-api.developer-ingenico.com/s2sapi/v1/en_US/json/payments/complete.html
API[Services.PAYMENT_CREATE] = "/payments"; // https://epayments-api.developer-ingenico.com/s2sapi/v1/en_US/json/payments/create.html
API[Services.PAYMENT_REFUND] = "/payments/{PAYMENTID}/refund"; // https://epayments-api.developer-ingenico.com/s2sapi/v1/en_US/json/payments/refund.html
API[Services.PAYMENT_STATUS] = "/payments/{PAYMENTID}"; // https://epayments-api.developer-ingenico.com/s2sapi/v1/en_US/json/payments/get.html
API[Services.PAYMENT_STATUS_3RD_PARTY] = "/payments/{PAYMENTID}/thirdpartystatus"; // https://epayments-api.developer-ingenico.com/s2sapi/v1/en_US/json/payments/thirdPartyStatus.html
API[Services.PAYMENT_TOKENIZE] = "/payments/{PAYMENTID}/tokenize"; // https://epayments-api.developer-ingenico.com/s2sapi/v1/en_US/json/payments/tokenize.html
API[Services.PAYMENT_UNDO_CAPTURE] = "/payments/{PAYMENTID}/cancelapproval"; // https://epayments-api.developer-ingenico.com/s2sapi/v1/en_US/json/payments/cancelapproval.html
// Captures
API[Services.CAPTURE_STATUS] = "/captures/{CAPTUREID}"; // https://epayments-api.developer-ingenico.com/s2sapi/v1/en_US/json/captures/get.html
// Payouts
API[Services.PAYOUT_APPROVE] = "/payouts/{PAYOUTID}/approve"; // https://epayments-api.developer-ingenico.com/s2sapi/v1/en_US/json/payouts/approve.html
API[Services.PAYOUT_CANCEL] = "/payouts/{PAYOUTID}/cancel"; // https://epayments-api.developer-ingenico.com/s2sapi/v1/en_US/json/payouts/cancel.html
API[Services.PAYOUT_CREATE] = "/payouts"; // https://epayments-api.developer-ingenico.com/s2sapi/v1/en_US/json/payouts/create.html#payouts-create-request
API[Services.PAYOUT_STATUS] = "/payouts/{PAYOUTID}"; // https://epayments-api.developer-ingenico.com/s2sapi/v1/en_US/json/payouts/get.html
API[Services.PAYOUT_UNDO_APPROVAL] = "/payouts/{PAYOUTID}/cancelapproval"; // https://epayments-api.developer-ingenico.com/s2sapi/v1/en_US/json/payouts/cancelapproval.html
// Products
API[Services.PRODUCT_LIST] = "/products"; // https://epayments-api.developer-ingenico.com/s2sapi/v1/en_US/json/products/find.html
// Refunds
API[Services.REFUND_APPROVE] = "/refunds/{REFUNDID}/approve"; // https://epayments-api.developer-ingenico.com/s2sapi/v1/en_US/json/refunds/approve.html
API[Services.REFUND_CANCEL] = "/refunds/{REFUNDID}/cancel"; // https://epayments-api.developer-ingenico.com/s2sapi/v1/en_US/json/refunds/cancel.html
API[Services.REFUND_STATUS] = "/refunds/{REFUNDID}"; // https://epayments-api.developer-ingenico.com/s2sapi/v1/en_US/json/refunds/get.html
API[Services.REFUND_UNDO_APPROVAL] = "/refunds/{REFUNDID}/cancelapproval"; // https://epayments-api.developer-ingenico.com/s2sapi/v1/en_US/json/refunds/cancelapproval.html
// Tokens
API[Services.TOKEN_APPROVE_SEPA_MANDATE] = "/tokens/{TOKENID}/approvesepadirectdebit"; // https://epayments-api.developer-ingenico.com/s2sapi/v1/en_US/json/tokens/approvesepadirectdebit.html
API[Services.TOKEN_CREATE] = "/tokens"; // https://epayments-api.developer-ingenico.com/s2sapi/v1/en_US/json/tokens/create.html
API[Services.TOKEN_DELETE] = "/tokens/{TOKENID}"; // https://epayments-api.developer-ingenico.com/s2sapi/v1/en_US/json/tokens/delete.html
API[Services.TOKEN_GET] = "/tokens/{TOKENID}"; // https://epayments-api.developer-ingenico.com/s2sapi/v1/en_US/json/tokens/get.html
API[Services.TOKEN_UPDATE] = "/tokens/{TOKENID}"; // https://epayments-api.developer-ingenico.com/s2sapi/v1/en_US/json/tokens/update.html
// Services
API[Services.CARD_DETAILS_GET] = "/services/getIINdetails"; // https://epayments-api.developer-ingenico.com/s2sapi/v1/en_US/json/services/getIINdetails.html
// Hosted checkouts
API[Services.HOSTED_PAYMENT_CREATE] = "/hostedcheckouts"; // https://epayments-api.developer-ingenico.com/s2sapi/v1/en_US/json/hostedcheckouts/create.html
API[Services.HOSTED_PAYMENT_STATUS] = "/hostedcheckouts/{HOSTED_CHECKOUTID}"; // https://epayments-api.developer-ingenico.com/s2sapi/v1/en_US/json/hostedcheckouts/get.html

/**
 * Mapping for Custom Site Preferences
 */
const SitePreferences = {
	ENABLE_TRANSACTION_LOGS: 'ING_enableTransLogs',
	SOFT_DESCRIPTOR: 'ING_SoftDescriptor',
	CC_AUTHSETTLE: 'ING_CC_requireApproval',
	SKIP_3DS: 'ING_skip3DS',
	STORE_PAYMENT_TOKEN: 'ING_storeTokenInProfile',
	EMAIL_SEND_CUST_FRAUDAPPROVAL: 'ING_sendfraudCustEmail',
	EMAIL_SEND_CUST_APPROVAL: 'ING_sendPendingApprovalCustEmail',
	EMAIL_SEND_CUST_PAID: 'ING_sendPaidCustEmail',
	EMAIL_SEND_CUST_SLOW_3RDPARTY: 'ING_sendRedirectedCustEmail',
	EMAIL_SEND_CUST_UNSUCCESSFUL: 'ING_sendUnsuccessCustEmail',
	EMAIL_SEND_CUST_WAITING_PAYMENT: 'ING_sendWaitingForPayment',
	EMAIL_SEND_FRAUD_MANAGER: 'ING_sendfraudEmail',
	EMAIL_FRAUD_MANAGER: 'ING_fraudMgrEmail',
	API_MERCHANT_ID: 'ING_MerchantID',
	API_ENVIRONMENT: 'ING_API_Environment',
	API_SERVER_LOCATION: 'ING_API_Server_Location',
	API_KEY: 'ING_API_PrivateKey',
	API_CLIENT_ID: 'ING_API_ClientID',
	API_WEBHOOK_SECRET_KEY: 'ING_Webhook_SecretKey',
	WX_USER: 'ING_WX_User',
	WX_PASS: 'ING_WX_Password',
	WX_HOST: 'ING_WX_Host'
}

/**
 * Determines which is the correct API host based on envirnment and settings
 * @returns {String} Returns correct host based on environment and settings.
 */
function getAPIHost() {
	var environment = Site.current.getCustomPreferenceValue(SitePreferences.API_ENVIRONMENT) || AppEnvironment.PREPROD;
	var serverLocation = Site.current.getCustomPreferenceValue(SitePreferences.API_SERVER_LOCATION);

	if (environment == AppEnvironment.PROD && System.getInstanceHostname() != System.PRODUCTION_SYSTEM) {
		environment = AppEnvironment.PREPROD;
		log.warn("CONFIG ERROR: Environment set to production in a non-production environment");
	}

	if(serverLocation && (environment == AppEnvironment.PROD || environment == AppEnvironment.PREPROD) ){
		return (ApiHosts[environment] ? ApiHosts[environment] : ApiHosts[AppEnvironment.PREPROD]).replace("LOCATION",ApiLocations[serverLocation]);		
	}
	return (ApiHosts[environment] ? ApiHosts[environment] : ApiHosts[AppEnvironment.PREPROD]);	
}

/**
 * Determines which is the correct path given an action and id of relevant
 * @param {String} action 
 * @param {String} id 
 * @returns {String} Returns the correct path with the relevant replacements for the action requested.
 */
function getAPIPath(action, id) {
	var merchantId = Site.current.getCustomPreferenceValue(SitePreferences.API_MERCHANT_ID);
	if (!merchantId) {
		throw new TypeError("Missing Merchant ID - ING_MerchantID - custom preference");
	}
	var url = "/v1/" + merchantId;

	switch (action) {
		case Services.PAYMENT_APPROVE:
		case Services.PAYMENT_APPROVE_FRAUD:
		case Services.PAYMENT_CANCEL:
		case Services.PAYMENT_CAPTURE:
		case Services.PAYMENT_CAPTURES:
		case Services.PAYMENT_STATUS:
		case Services.PAYMENT_REFUND:
		case Services.PAYMENT_UNDO_CAPTURE:
		case Services.PAYMENT_TOKENIZE:
			return url + API[action].replace('{PAYMENTID}', id);
		case Services.PAYMENT_CREATE:
		case Services.HOSTED_PAYMENT_CREATE:
		case Services.TOKEN_CREATE:
		case Services.CARD_DETAILS_GET:
            return url + API[action];
		case Services.HOSTED_PAYMENT_STATUS:
			return url + API[action].replace('{HOSTED_CHECKOUTID}', id);
		case Services.REFUND_STATUS:
		case Services.REFUND_CANCEL:
		case Services.REFUND_APPROVE:
		case Services.REFUND_UNDO_APPROVAL:
			return url + API[action].replace('{REFUNDID}', id);
		case Services.PRODUCT_LIST:
			return url + API[action] + "?" + id;
		default:
			throw new TypeError("Not configured: " + action);
			return ""
	}
}

/**
 * Builds API request endpoint information
 * @param {String} action 
 * @param {String} id 
 * @returns {{URL:String, path:String, host: String, serviceHostName: String, servicePath: String}} Returns object representation of the API URL endpoint.
 */
function getAPIURL(action, id) {
	var host = getAPIHost();
	var path = getAPIPath(action, id);
	return {
		URL : "https://" + host + path,
		path : path,
        host : host,
        serviceHostName: host,
	    servicePath: path
	}
}

/*
 * Module exports
 */

/**
 * Local exports
 */
module.exports = {
	BASE_URL : ApiHosts,
	API : API,
	VERSION : VERSION,
	ReturnStatus: ReturnStatus,
	PaymentProcessors: PaymentProcessors,
	PaymentMethods: PaymentMethods,
	PaymentMethodsByID: PaymentMethodsByID,
	Services: Services,
	SitePreferences: SitePreferences,
	getAPIURL : getAPIURL
}
