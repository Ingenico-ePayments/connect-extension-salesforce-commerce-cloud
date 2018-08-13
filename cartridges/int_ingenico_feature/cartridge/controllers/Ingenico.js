'use strict';

/**
 * Controller to handle webhook requests validation and processing
 * 
 * @module controllers/Ingenico
 */

// importPackage( dw.crypto );
// importPackage( dw.util );
// importPackage( dw.system );

/* API Includes */
var Logger = dw.system.Logger.getLogger("Ingenico-Feedback");
var OrderMgr = require('dw/order/OrderMgr');
var PaymentMgr = require('dw/order/PaymentMgr');
var Status = require('dw/system/Status');
var Transaction = require('dw/system/Transaction');
var Site = require('dw/system/Site');

/* Site Genesis imports */
var app = require('sitegenesis_storefront_controllers/cartridge/scripts/app');
var guard = require('sitegenesis_storefront_controllers/cartridge/scripts/guard');

/* Script Modules */
var UpdateOrder = require('../../../int_ingenico/cartridge/scripts/order/UpdateOrder');
var SitePreferences = require("../../../int_ingenico/cartridge/scripts/config").SitePreferences;
/**
 * Responsible for processing updates pushed from Ingenico's servers
 * 
 */
function feedback() {
	var headers = {};
	request.getHttpHeaders().keySet().toArray().filter(function(el){
		headers[el] = request.getHttpHeaders().get(el)
	});

	var body = request.getHttpParameterMap().getRequestBodyAsString();

	if(!body){
		Logger.error("ERROR[webhook update]: Missing payload");
		response.setStatus(400);
		return;	
	}

	var secretKey = Site.current.getCustomPreferenceValue(SitePreferences.API_WEBHOOK_SECRET_KEY);
	var signature = headers["x-gcs-signature"];

	if(!secretKey){
		Logger.error("ERROR[webhook update]: Could not retrieve secret key from Site Preferences");
		response.setStatus(500);
		return;
	}

	try{
		// Generate signature from payload using secret ket as defined in the settings.
		var newSignature = dw.crypto.Encoding.toBase64((new dw.crypto.Mac(dw.crypto.Mac.HMAC_SHA_256)).digest(body,secretKey));

		if(newSignature != signature){
			Logger.error("ERROR[webhook update]: Signature was not valid >> " + newSignature + " != " + signature);
			response.setStatus(400);
			return;	
		}
		var result = JSON.parse(body);
		if(!(result && 
			result.payment && 
			result.payment.paymentOutput && 
			result.payment.paymentOutput.references && 
			result.payment.paymentOutput.references.merchantReference)) {
				Logger.error("ERROR[webhook update]: Could not find merchant order reference.");
				response.setStatus(400);
				return;		
		}		
		var payload = result.payment;
		var orderNo = result.payment.paymentOutput.references.merchantReference
		var updatedOK = UpdateOrder.updateOrderFromCallback(orderNo, payload);

		if(updatedOK.error){
			Logger.error("ERROR[webhook update(1)]: " + orderNo + " - " + updatedOK.errorMessage);
			response.setStatus(400);
			return;					
		}
		Logger.info("Updated order[webhook]: " + orderNo + " JSON: " + JSON.stringify(payload));
	}catch(err){
		Logger.error("ERROR[webhook update(2)]: " + err.toString());
		response.setStatus(500);
		return;	
	}

		
		/*	Used in older webhook emulator version
		var publicKey = 'MFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBAJauOnVRuJOEZ7MrSufBiHkysCQsATbFKCC1Xf80+qecQV5u7PJZyKZdB+uyphGByQxYxiySqnpuQzDl+sevbTMCAwEAAQ==';
		var signature = headers["x-gcs-signature"];
		var signatureBytes = dw.crypto.Encoding.fromBase64(signature);
		var digest = dw.crypto.MessageDigest(dw.crypto.MessageDigest.DIGEST_SHA_256);
		var hash = dw.crypto.Encoding.toBase64(digest.digestBytes(dw.util.Bytes(body)));
		var hashBytes = dw.crypto.Encoding.fromBase64(dw.crypto.Encoding.toBase64(digest.digestBytes(dw.util.Bytes(body))));
	
		try{
			// var newSig = (new dw.crypto.Signature()).sign(dw.crypto.Encoding.toBase64(dw.util.Bytes(hash)) , publicKey, "SHA256withRSA")
			// Logger.warn("NEW SIG: " + newSig + " OLD SIG:" + signature);
			Logger.warn("PAYLOAD SIGNATURE:" + signature + "\n#VERIFIED#" + (new dw.crypto.Signature()).verifySignature(signature, dw.crypto.Encoding.toBase64(dw.util.Bytes(hash)) , publicKey, "SHA256withRSA"));	
		}catch(err){
			Logger.error("ERROR PROCESSING SIG:" + err.toString());
		}
		*/
		// (new dw.crypto.Signature()).sign(hash , "+PdyLwjZRO1wzW+OMTkwAOsvCBm5lrtF8zLGjEmENh4=", "SHA256withRSA"));

		// KeySpec spec = new X509EncodedKeySpec(Base64.decodeBase64(publicKeySpec));
		// PublicKey publicKey = KeyFactory.getInstance("RSA").generatePublic(spec);
		// Signature sig = Signature.getInstance("SHA256withRSA");
		// sig.initVerify(publicKey);
		// sig.update(bodyHash);
		// return sig.verify(Base64.decodeBase64(signature));
		
		// if(ValidateSignature.validateRSASignature(body, signature, publicKey)){
		// 	Logger.warn("VALID SIGNATURE:" + digest + "##" + hash + "##" + publicKey + "##" + signature);	
		// }else{
		// 	Logger.warn("NOT VALID SIGNATURE:" + digest + "##" + hash + "##" + publicKey + "##" + signature);	
		// }
	
		// var publicKeySplit = "-----BEGIN PUBLIC KEY-----\n" + publicKey.match(/.{1,64}/g).join("\n") + "\n-----END PUBLIC KEY-----";
		// var publicKeySplit = publicKey.match(/.{1,64}/g).join("\n");
		// var publicKeySplit = publicKey
		
		// var body = "{\"test\":\"this is a test of the signiture verification\"}";
		// var sig = "aoozda3BbFZDdbFqqFoMPAkb6JdwW/O/+jQtaPS0/7ODoguZw0GBVqJdH95XDlSz4PIaK9Dn98w2Cls0Qlx1vA==";
		// var key = "MFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBALtwWYcAGJ9gFFD92I8w1AxOY+nk8FRw1BrmlSKcMbJdH4n4q8kowpXr7Mn6zjVJhd3b3zt+UL4oyOCdbyfLc+0CAwEAAQ==";
		// var digest = dw.crypto.MessageDigest(dw.crypto.MessageDigest.DIGEST_SHA_256);
		// var hash = dw.crypto.Encoding.toBase64(digest.digestBytes(dw.util.Bytes(body)));
			
		// Logger.warn("\nHASH:" + hash + "\n" + (new dw.crypto.Signature()).verifySignature(sig, hash , key, "SHA256withRSA"));
	
		// if((new dw.crypto.Signature()).verifyBytesSignature(signatureBytes, hashBytes , publicKey, "SHA256withRSA")){
		// 	Logger.warn("VALID SIGNATURE BYTES:" + digest + "##" + hash + "##" + publicKey + "##" + signature);	
		// }else{
		// 	Logger.warn("NOT VALID SIGNATURE BYTES:\n" + digest + "##\n" + hash + "##\n" + publicKey + "##\n" + signature);	
		// }
	
		
	
		// try{
		// 	var payload = JSON.parse(request.getHttpParameterMap().getRequestBodyAsString());
		// 	// var payload = request.getHttpParameterMap().getRequestBodyAsString();
		// 	Logger.warn("GOT PAYLOAD:" + payload.name + "##" + typeof payload.time);
		// }catch(e){
		// 	Logger.warn("Error processing payload..." + e);
		// }
	response.setStatus(204);
}
/*
 * Module exports
 */

/*
 * Web exposed methods
 */
/** @see module:controllers/Ingenico~Feedback */
exports.Feedback = guard.ensure(['https'], feedback);
