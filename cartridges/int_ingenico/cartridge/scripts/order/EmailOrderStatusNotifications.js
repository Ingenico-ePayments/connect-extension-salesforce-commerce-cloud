/**
* EmailOrderStatusNotifications.js
* Send emails to customers and fraud manager based on payment transaction status
*
* https://epayments-api.developer-ingenico.com/s2sapi/v1/en_US/json/statuses.html
*
*/

/* API Includes */
var Mail = dw.net.Mail;
var Site = dw.system.Site;
var Template = dw.util.Template;
var HashMap = dw.util.HashMap;
var Resource = dw.web.Resource;
var OrderMgr = dw.order.OrderMgr;
var Logger = dw.system.Logger.getLogger("Ingenico");

/* Script Modules */
var SitePreferences = require('../config').SitePreferences;

/**
 * Decide what email to send based on configuration and payment transaction status
 * @param {String} transactionStatus 
 * @param {String} custEmailAddr 
 * @param {String} orderNo 
 */
function SendCustomerEmail(transactionStatus, custEmailAddr, orderNo) {
	switch (transactionStatus) {
		case 'PENDING_FRAUD_APPROVAL':
			var triggerEmail = Site.current.getCustomPreferenceValue(SitePreferences.EMAIL_SEND_CUST_FRAUDAPPROVAL);
			if (triggerEmail) {
				var subject = Resource.msgf('email.subject.payment.pending', 'ingenico', null, orderNo);
				SendEmail('mail/order_paymentpending', custEmailAddr, orderNo, subject);
			}
			break;
		case 'PENDING_APPROVAL':
		case 'PENDING_CAPTURE':
			var triggerEmail = Site.current.getCustomPreferenceValue(SitePreferences.EMAIL_SEND_CUST_APPROVAL);
			if (triggerEmail) {
				var subject = Resource.msgf('email.subject.payment.pending', 'ingenico', null, orderNo);
				SendEmail('mail/order_paymentpending', custEmailAddr, orderNo, subject);
			}
			break;
		case 'CAPTURED':
		case 'PAID':
			var triggerEmail = Site.current.getCustomPreferenceValue(SitePreferences.EMAIL_SEND_CUST_PAID);
			if (triggerEmail) {
				var subject = Resource.msgf('email.subject.payment.received', 'ingenico', null, orderNo);
				SendEmail('mail/order_paymentreceived', custEmailAddr, orderNo, subject);
			}
			break;
		case 'REDIRECTED':
			//this is slpw 3rd party scenario
			var triggerEmail = Site.current.getCustomPreferenceValue(SitePreferences.EMAIL_SEND_CUST_SLOW_3RDPARTY);			
			if (triggerEmail) {
				var subject = Resource.msgf('email.subject.payment.redirected', 'ingenico', null, orderNo);
				SendEmail('mail/order_paymentredirected', custEmailAddr, orderNo, subject);
			}
			break;
		case 'CAPTURE_REQUESTED': // TODO: Add new template and site preference to send order receipt email while wait for payment
		case 'PENDING_PAYMENT':
			var triggerEmail = Site.current.getCustomPreferenceValue(SitePreferences.EMAIL_SEND_CUST_WAITING_PAYMENT);			
			if (triggerEmail) {
				var subject = Resource.msgf('email.subject.payment.pending', 'ingenico', null, orderNo);
				SendEmail('mail/order_paymentpending', custEmailAddr, orderNo, subject);
			}
			break;
		case 'REJECTED':
		case 'CANCELLED':
		case 'REJECTED_CAPTURE':
			var triggerEmail = Site.current.getCustomPreferenceValue(SitePreferences.EMAIL_SEND_CUST_UNSUCCESSFUL);			
			if (triggerEmail) {
				var subject = Resource.msgf('email.subject.payment.rejected', 'ingenico', null, orderNo);
				SendEmail('mail/order_paymentrejected', custEmailAddr, orderNo, subject);
			}
			break;
		default:
			Logger.error('Unknown ING_Transaction Status Encountered, no emails were triggered . Transaction Status is: ' + transactionStatus);
	}
}

/**
 * Create email to customer using an asset ID
 * @param {String} template 
 * @param {String} custEmailAddr 
 * @param {String} orderNo 
 */
function SendEmail(template, custEmailAddr, orderNo, subject) {
	if(!(template && custEmailAddr && orderNo && subject)){
		return;
	}

	var order = OrderMgr.getOrder(orderNo);
	if(!order){
		return;
	}

	var template = new Template(template);
	var templateData = new HashMap();
	templateData.put('MailSubject',subject);
	templateData.put('Order',order);
	var content = template.render(templateData).text;
	var from = Site.getCurrent().getCustomPreferenceValue('customerServiceEmail');
	SendEmailFromContent(from,custEmailAddr,subject,content);
}

/**
 * Create email to fraud manager about a new order that is marked for fraud check
 * @param {String} orderNo 
 */
function SendFraudEmail(orderNo) {
	var fraudManager = Site.current.getCustomPreferenceValue(SitePreferences.EMAIL_FRAUD_MANAGER);
	if (fraudManager && Site.current.getCustomPreferenceValue(SitePreferences.EMAIL_SEND_FRAUD_MANAGER)) {
		var subject = 'Order with possible Fraud detected. Order ID - ' + orderNo;

		var template = new Template('mail/ingfrauddetectedemail');
		var templateData = new HashMap();
		templateData.put('orderID', orderNo);

		var content = template.render(templateData).text;
		var from = Site.getCurrent().getCustomPreferenceValue('customerServiceEmail');
		SendEmailFromContent(from,fraudManager,subject,content);
	}
}

/**
 * Sends email given a subject, content and recipient.
 * @param {String} from 
 * @param {String} to 
 * @param {String} subject 
 * @param {String} content 
 */
function SendEmailFromContent(from, to, subject, content){
	if(!(to && subject && content)) return;

	var mail = new Mail();
	mail.setFrom(from || 'no-reply@salesforce.com');
	mail.addTo(to);
	mail.setSubject(subject);
	mail.setContent(content, 'text/html', 'UTF-8');
	return mail.send();
}


/*
 * Module exports
 */

/*
 * Local methods
 */
exports.sendCustomerEmail = SendCustomerEmail;
exports.sendFraudEmail = SendFraudEmail;