/**
* Payloads.js
* Generates Ingenico's API payload data for Ingenico server requests
*/

/* API Includes */
var Site = dw.system.Site;
var Money = dw.value.Money;

/* Script Modules */
var IngenicoConfig = require("../config");
var SitePreferences = IngenicoConfig.SitePreferences;
var IngenicoOrderHelper = require('../utils/IngenicoOrderHelper');

/**
 * To create JSON object that will be sent in the API call as request data
 * @param {dw.order.Order} systemOrder Demandware Order
 * @param {dw.order.OrderPaymentInstrument} paymentInstrument Order Payment Instrument
 * @param {{cardnum: String, cvv: String, token: String}} cardDetails CC, CVV and token
 * @param {Boolean} hostedRequest Is this a HPP payment request
 * @returns {object} Returns payload un in Create Request. More info https://epayments-api.developer-ingenico.com/s2sapi/v1/en_US/json/payments/create.html
 */
function CreatePaymentPayload(systemOrder, paymentInstrument, cardDetails, hostedRequest){
	var hostedRequest = hostedRequest?true:false;

	var billingAddress = systemOrder.getBillingAddress();
	var shippingAddress = systemOrder.getDefaultShipment().getShippingAddress();
	var tokenPayload = {};
	
	// For more information regarding the payload to Create Payment Request visit
	// https://epayments-api.developer-ingenico.com/s2sapi/v1/en_US/nodejs/payments/create.html#payments-create-payload
	var payload = {
		// bankTransferPaymentMethodSpecificInput: {additionalReference:"",paymentProductId:0}, // Not used
		cardPaymentMethodSpecificInput: CreateCardPayload(paymentInstrument, cardDetails), 
		// cashPaymentMethodSpecificInput: {}, // Not implemented in default use-cases
		// directDebitPaymentMethodSpecificInput:{}, // Not implemented in default use-cases
		// encryptedCustomerInput: "" // Not implemented in default use-cases
		fraudFields: {
			// addressesAreIdentical: true, // Not implemented in default use-case
			// blackListData: "", // Not implemented in default use-case
			// cardOwnerAddress: {
			// 	additionalInfo: "",
			// 	city: "",
			// 	countryCode: "",
			// 	houseNumber: "",
			// 	state: "",
			// 	stateCode: "",
			// 	street: "",
			// 	zip: ""
			// },
			customerIpAddress: request.getHttpRemoteAddress(),
			// defaultFormFill: "", // "automatically", "automatically-but-modified" or "manually". Not implemented in default use-case
			// fingerPrintActivated: false, // Not implemented in default use-case
			// giftCardType: "", // Not implemented in default use-case
			// giftMessage: "", // Not implemented in default use-case
			// hasForgottenPwd: false, // Not implemented in default use-case
			// hasPassword: false, // Not implemented in default use-case
			// isPreviousCustomer: false, // Not implemented in default use-case
			// orderTimezone: "", // Not implemented in default use-case
			// shipComments: "", // Not implemented in default use-case
			// shipmentTrackingNumber: "", // Not implemented in default use-case
			// shippingDetails: {}, // Not implemented in default use-case
			// userData: "", // Not implemented in default use-case
			// website: "", // Not implemented in default use-case
		},
		// invoicePaymentMethodSpecificInput: {}, // Not implemented in default use-case
		// mobilePaymentMethodSpecificInput: {}, // Not implemented in default use-case
		order: {
			// additionalInput: {}, // Not implemented in default use-case
			amountOfMoney: {
				amount: paymentInstrument.getPaymentTransaction().getAmount().getValue().toFixed(2).replace('.', ""),
				currencyCode: systemOrder.getCurrencyCode()
			},
			customer: {
				billingAddress: CreateAddressPayload(billingAddress),
				// companyInformation: {name:""}, // Not implemented in default use-case
				contactDetails: {
					emailAddress: systemOrder.getCustomerEmail(),
					emailMessageType: "html", // "plain-text" or "html"
					// faxNumber: "", // Not implemented in default use-case
					phoneNumber: billingAddress.getPhone()
				},
				// fiscalNumber: "", // Not implemented in default use-case
				// locale: request.getHttpLocale(),
				locale: request.getLocale(),
				merchantCustomerId: CreateMerchantCustomerNo(systemOrder),
				personalInformation: {
					// dateOfBirth: "", // Not implemented in default use-case
					// gender: "", // Not implemented in default use-case
					name: {
						firstName: billingAddress.getFirstName(),
						surname: billingAddress.getLastName(),
						// surnamePrefix: "", // middle name // Not implemented in default use-case
						title: billingAddress.getTitle()
					}
				},
				shippingAddress: CreateAddressPayload(shippingAddress, true)
				// vatNumber: "", // Not implemented in default use-case
			}, // END CUSTOMER
			references: {
				descriptor: Site.getCurrent().getCustomPreferenceValue(SitePreferences.SOFT_DESCRIPTOR) || "",
				invoiceData: {
					// additionalData: "", // Not implemented in default use-case
					// invoiceDate: "", // Not implemented in default use-case. Invoice not created before payment.
					// invoiceNumber: "", // Not implemented in default use-case
					// textQualifiers: "" // Not implemented in default use-case
				},
				// merchantOrderId: "", // Not implemented in default use-case as Demandware can support alphanumeric chars in order ids
				merchantReference: systemOrder.getOrderNo()
			},
			shoppingCart: {
				amountBreakdown: [
					// {amount: 0, type: "AIRPORT_TAX"}, // Not implemented in default use-case
					// {amount: 0, type: "CONSUMPTION_TAX"}, // Not implemented in default use-case
					// {amount: 0, type: "DISCOUNT"}, // Not implemented in default use-case
					// {amount: 0, type: "DUTY"}, // Not implemented in default use-case
					{
						amount: systemOrder.getShippingTotalPrice().getValue().toFixed(2).replace('.', ""),
						type: "SHIPPING"
					},
					{
						amount: systemOrder.getTotalTax().getValue().toFixed(2).replace('.', ""),
						type: "VAT"
					}
				],
				items: CreateOrderItemsPayload(systemOrder),			
			}
		}, // END ORDER
		// sepaDirectDebitPaymentMethodSpecificInput: {} // Not implemented in default use-case
	}

	if(hostedRequest){
		payload.hostedCheckoutSpecificInput = CreateHostedPaymentPayload(systemOrder);
		delete payload.cardPaymentMethodSpecificInput; // remove card block as not relevant for hosted
	}
	
	var otherPaymentMethod = false;
	switch(paymentInstrument.getPaymentMethod()){
		case IngenicoConfig.PaymentMethods.HOSTEDPAY:
			payload.cardPaymentMethodSpecificInput = CreateCardPayload(paymentInstrument, cardDetails);
			otherPaymentMethod = false;
			break;
		case IngenicoConfig.PaymentMethods.PAYPAL:
			payload.redirectPaymentMethodSpecificInput = CreateRedirectPaymentPayload(840);
			otherPaymentMethod = true;
			break;
		case IngenicoConfig.PaymentMethods.IDEAL:
			payload.redirectPaymentMethodSpecificInput = CreateRedirectPaymentPayload(809);
			payload.redirectPaymentMethodSpecificInput.paymentProduct809SpecificInput = { 
				issuerId: "INGBNL2A" // TODO: This appears to get ignored and asked to choose one in the hosted screen.
			}
			otherPaymentMethod = true;
			break;
	}

	if(otherPaymentMethod){
		delete payload.cardPaymentMethodSpecificInput; // remove card block as not relevant for hosted
	}
	
	return payload;
}

/**
 * Creates HostedCheckout specific input payload
 * @param {dw.order.Order} systemOrder
 * @returns {Object}
 */
function CreateHostedPaymentPayload(systemOrder){
	var customer = systemOrder.getCustomer();
	var payload = {
		// isRecurring: false, // Not implemented in default use-case
		locale: request.getLocale(),
		// paymentProductFilters: {}, // Not implemented in default use-case
		returnUrl: dw.web.URLUtils.https("COVerification-Process").toString(), // Used when payer is sent to 3rd party for verification or to complete on Ingenico's server
		showResultPage: false,
		returnCancelState: true,
		tokens: (customer && customer.profile)?IngenicoOrderHelper.getTokensForCustomer(customer).join(","):"",
		// tokens: (customer && customer.profile)?customer.profile.custom.ING_paymentToken.join(","):"",
		// variant: "" // Not implemented in default use-case
	};
	return payload;
}

/**
 * Creates Redirected payment payloads like Paypal and iDeal
 * @param {String} productId 
 */
function CreateRedirectPaymentPayload(productId){
	return {
		expirationPeriod: 10, // max minutes to complete transaction
		isRecurring: false,
		// paymentProduct809SpecificInput: { // Dutch iDeal 816
		// 	issuerId: ""
		// },
		// paymentProduct882SpecificInput: {}, // not implemented. Indian Net Banking 882
		paymentProductId: productId, // 840 (Paypal), 809 (iDeal), ...
		// recurringPaymentSequenceIndicator: "", // "first" or "recurring"
		// returnUrl: dw.web.URLUtils.https("COVerification-Process").toString(), // Used when payer is sent to 3rd party for verification or to complete on Ingenico's server
		requiresApproval: Site.getCurrent().getCustomPreferenceValue(SitePreferences.CC_AUTHSETTLE) || false, // true AUTH with DELAYED settlement, false FINAL_AUTH/AUTHANDSETTLE
		token: ""
	}
}

/**
 * Returns either customer number for registered users or order number with prefix for guest users
 * @param {dw.order.Order} systemOrder
 */
function CreateMerchantCustomerNo(systemOrder){
    return systemOrder.getCustomerNo() || "GUEST#" + systemOrder.getOrderNo();
}

/**
 * Creates credit card object based on the payment instrument and the CVV
 * @param {dw.order.OrderPaymentInstrument} paymentInstrument 
 * @param {{cardnum: String, cvv: String, token: String}} cardDetails 
 * @returns {Object}
 */
function CreateCardPayload(paymentInstrument, cardDetails){
	if(paymentInstrument && paymentInstrument.getCreditCardExpirationMonth()){
		return {
			// authorizationMode: "FINAL_AUTHORISATION", // enum of "FINAL_AUTHORISATION" or "PRE_AUTHORISATION". Set within Ingenico's account setup.
			card: {
				cardNumber: (cardDetails.token?"":cardDetails.cardnum),
				cardholderName: paymentInstrument.getCreditCardHolder(),
				cvv: cardDetails.cvv,
				expiryDate: padMonth(paymentInstrument.getCreditCardExpirationMonth()) + "" + (paymentInstrument.getCreditCardExpirationYear() || "").toString().substring(2),
				// issueNumber: "" // Not implemented in default use-cases
			},
			customerReference: "", // Purchase Order
			// externalCardholderAuthenticationData: {cavv:"", cavvAlgorithm:"", eci: 0, validationResult: "", xid: ""} // Not used in default use-cases
			// isRecurring: false, // Not used in default implementation
			paymentProductId: paymentInstrument.getCreditCardType(),
			// recurringPaymentSequenceIndicator: "" // Not used in default implementation
			requiresApproval: Site.getCurrent().getCustomPreferenceValue(SitePreferences.CC_AUTHSETTLE) || false, // true AUTH with DELAYED settlement, false FINAL_AUTH/AUTHANDSETTLE
			returnUrl: dw.web.URLUtils.https("COVerification-Process").toString(), // Used when payer is sent to 3rd party for verification
			skipAuthentication: ( Site.getCurrent().getCustomPreferenceValue(SitePreferences.SKIP_3DS) == true ? true : false ), // Should transaction bypass 3DS verification
			skipFraudService: false, // Should transaction skip fraud check at Ingenico
			token: cardDetails.token, // token to use instead of CC
			tokenize: cardDetails.token?false:true, // return tokenized CC
			transactionChannel: "ECOMMERCE" // enum of "ECOMMERCE" or "MOTO"
		};
	}
	return {
		requiresApproval: Site.getCurrent().getCustomPreferenceValue(SitePreferences.CC_AUTHSETTLE) || false, // true AUTH with DELAYED settlement, false FINAL_AUTH/AUTHANDSETTLE		
		skipAuthentication: ( Site.getCurrent().getCustomPreferenceValue(SitePreferences.SKIP_3DS) == true ? true : false ) // Should transaction bypass 3DS verification
	};
}

/**
 * Creates an address object with or without the name from an OrderAddress object
 * @param {dw.order.OrderAddress} addressObj 
 * @param {Boolean} includeName
 */
function CreateAddressPayload(addressObj, includeName){
	if(!addressObj || !addressObj.address1){
		return {};
	}
	var addr = {
		additionalInfo: addressObj.getAddress2() || "",
		city: addressObj.getCity(),
		countryCode: addressObj.getCountryCode().getValue().toString().toUpperCase(),
		// houseNumber: "", // Not implemented in default use-case
		state: addressObj.getStateCode(), 
		// stateCode: "", // Not implemented in default use-case
		street: addressObj.getAddress1(),
		zip: addressObj.getPostalCode()
	}

	if(includeName === true){
		addr.name = {
			firstName: addressObj.getFirstName(),
			surname: addressObj.getLastName(),
			// surnamePrefix: "", // middle name // Not implemented in default use-case
			title: addressObj.getTitle()
		}
	}
	return addr;
}

/**
 * Creates payload to tokenize credit card
 * @param {dw.order.Order} systemOrder 
 * @param {dw.order.OrderPaymentInstrument} paymentInstrument 
 */
function CreateTokenPayload(systemOrder, paymentInstrument){
	if(paymentInstrument && paymentInstrument.getCreditCardExpirationMonth()){
        var billingAddress = systemOrder.getBillingAddress();
		return {
			card: {
				alias: "",
				customer:{
					billingAddress: CreateAddressPayload(billingAddress),
					// companyInformation: {name:""}, // Not implemented in default use-case
					merchantCustomerId: CreateMerchantCustomerNo(systemOrder),
					personalInformation: {
                        // dateOfBirth: "", // Not implemented in default use-case
                        // gender: "", // Not implemented in default use-case
                        name: {
                            firstName: billingAddress.getFirstName(),
                            surname: billingAddress.getLastName(),
                            // surnamePrefix: "", // middle name // Not implemented in default use-case
                            title: billingAddress.getTitle()
                        }
                    },
					// vatNumber: "", // Not implemented in default use-case
				},
				data: {
					cardWithoutCvv: {
						cardNumber: paymentInstrument.getCreditCardNumber(),
						cardholderName: paymentInstrument.getCreditCardHolder(),
						expiryDate: padMonth(paymentInstrument.getCreditCardExpirationMonth()) + "" + paymentInstrument.getCreditCardExpirationYear().toString().substring(2),
						// issueNumber: "" // Not implemented in default use-cases
					},
					// firstTransactionDate: "", // Not implemented in default use-cases
					// providerReference: "" // Not implemented in default use-cases
				}
			},
			// eWallet: {}, // Not implemented in default use-case
			// nonSepaDirectDebit: {}, // Not implemented in default use-case
			paymentProductId: paymentInstrument.getCreditCardType(),
			// sepaDirectDebit: {} // Not implemented in default use-case
		};
	}
	return {};
}

/**
 * Creates order items payload
 * @param {dw.order.Order} systemOrder 
 * @returns {Object}
 */
function CreateOrderItemsPayload(systemOrder){
	var prodLineItems = systemOrder.getAllProductLineItems().toArray();
    var items = [];
	prodLineItems.map(function(pLItem){
		var basePrice = pLItem.getBasePrice().getValue().toFixed(2).replace('.', "");
		var discountedUnitPrice = (pLItem.getAdjustedPrice().getValue() / pLItem.getQuantityValue().toFixed()).toFixed(2).replace('.', "");
		var item = {
			amountOfMoney: {
				amount: pLItem.getAdjustedPrice().getValue().toFixed(2).replace('.', ""),
				currencyCode: systemOrder.getCurrencyCode()
			},
			invoiceData: {
				description: pLItem.getProductName(),
				merchantLinenumber: pLItem.getPosition(),
				// merchantPagenumber: "", // Not implemented in default use-case
				nrOfItems: pLItem.getQuantityValue().toFixed(),
				pricePerItem: discountedUnitPrice
			},
			orderLineDetails:{
				discountAmount: basePrice - discountedUnitPrice,
				lineAmountTotal: pLItem.getAdjustedPrice().getValue().toFixed(2).replace('.', ""),
				productCode: pLItem.getProductID().substring(0,12),
				productPrice: basePrice,
				// productType: "", // Not implemented in default use-case
				quantity: pLItem.getQuantityValue().toFixed(),
				taxAmount: pLItem.getAdjustedTax().getValue().toFixed(2).replace('.', ""),
				// unit: "" // Not implemented in default use-case
			}
		}
		items.push(item);
	});
	return items;
}

/**
 * Creates Approve Payment Payload
 * https://epayments-api.developer-ingenico.com/s2sapi/v1/en_US/json/payments/approve.html#payments-approve-payload
 * @param {dw.order.Order} systemOrder 
 * @param {dw.order.PaymentTransaction} paymentTransaction
 * @returns {Object}
 */
function CreateApprovePaymentPayload(systemOrder, paymentTransaction){
	return {
		amount: paymentTransaction.getAmount().getValue().toFixed(2).replace('.', ""),
		// directDebitPaymentMethodSpecificInput: {
		// 	dateCollect: "", // YYYYMMDD
		// 	token: ""
		// },
		order: {
			// additionalInput: { airlineData: {}},
			references: {
				merchantReference: systemOrder.getOrderNo()
			}
		},
		// sepaDirectDebitPaymentMethodSpecificInput: {
		// 	dateCollect: "", // YYYYMMDD
		// 	token: ""
		// }
	}
}

/**
 * Create Refund payload based on an order and an amount to refund
 * https://epayments-api.developer-ingenico.com/s2sapi/v1/en_US/json/payments/refund.html#payments-refund-request
 * @param {dw.order.Order} systemOrder 
 * @param {Number} amount
 * @returns {Object}
 */
function CreateRefundPayload(systemOrder, amount){
	var billingAddress = systemOrder.getBillingAddress();
	return {
		amountOfMoney: {
			amount: amount.toFixed(2).replace('.', ""),
			currencyCode: systemOrder.getCurrencyCode()
		},
		// bankRefundMethodSpecificInput: {
		// 	bankAccountBban: {},
		// 	bankAccountIban: {},
		// 	countryCode: ""
		// },
		customer: {
			address: CreateAddressPayload(billingAddress),
			// companyInformation: {name:""}, // Not implemented in default use-case
			contactDetails: {
				emailAddress: systemOrder.getCustomerEmail(),
				emailMessageType: "html" // "plain-text" or "html"
			},
		},
		refundDate:  dw.util.StringUtils.formatCalendar( dw.util.Calendar(),"yyyyMMdd"), // YYYYMMDD
		refundReference: {
			merchantReference: systemOrder.getOrderNo() + "R"
		}
	}
}


/**
 * Pad month number with a 0
 * @param {Number} month 
 */
function padMonth(month){
	if(!month) return "";
	return ("0" + month).substring(month.toString().length-1)
}

/*
 * Local methods
 */
exports.createPaymentPayload = CreatePaymentPayload;
exports.createTokenPayload = CreateTokenPayload;
exports.createApprovePaymentPayload = CreateApprovePaymentPayload;
exports.createRefundPayload = CreateRefundPayload;

