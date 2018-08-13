/**
* IngenicoSvcInit.js
* To trigger Ingenico API calls using SFCC SVC framework
*
* https://documentation.demandware.com/DOC2/topic/com.demandware.dochelp/WebServices/CreatingAServiceRegistry.html
*
*/

/* API Includes */
var Site = dw.system.Site;
var ServiceRegistry = dw.svc.ServiceRegistry;
var Mac = dw.crypto.Mac;
var Encoding = dw.crypto.Encoding;

/* Script Modules */
var IngenicoConfig = require('../config');

//the configure method creates payment in Ingenico with passed card details
ServiceRegistry.configure(IngenicoConfig.Services.PAYMENT_CREATE, {
     /**
     * @param {dw.svc.HTTPService} svc HTTP Service instance
     * @param {Object} params Payload to be used for the request
     */
    createRequest: function(svc, params) {
        PrepareRequest(svc,'POST',null)
		return JSON.stringify(params);
    },
    parseResponse : function(svc, response) {
        return response;
    },
    filterLogMessage: function(msg) {
        return msg.replace(/cardNumber":"(\d{4})\d{8}/,'cardNumber":"$1********')
                  .replace(/cvv":"(\d{3,4})/,'cvv":"[PROVIDED]');
    }
});

//the configure method creates a Ingenico payment token 
ServiceRegistry.configure(IngenicoConfig.Services.TOKEN_CREATE, {
    /**
     * @param {dw.svc.HTTPService} svc HTTP Service instance
     * @param {Object} params Payload to be used for the request
     */
    createRequest: function(svc, params) {
		PrepareRequest(svc,'POST',null)
		return JSON.stringify(params);
    },
    parseResponse : function(svc, response) {
        return response;
    },
    filterLogMessage: function(msg) {
        return msg.replace(/cardNumber":"(\d{4})\d{8}/,'cardNumber":"$1********') // mask credit card
                  .replace(/"(.{8})-.{4}-.{4}-.{4}-.{4}(.{8})"/,'"$1-****-****-****-****$2"'); // mask credit card token
    }

});

//the configure method approves payment using Ingenico
ServiceRegistry.configure(IngenicoConfig.Services.PAYMENT_APPROVE, {
     /**
     * @param {dw.svc.HTTPService} svc HTTP Service instance
     * @param {Object} params Payload to be used for the request
     */
    createRequest: function(svc, params) {
		PrepareRequest(svc,'POST',params.paymentID)
		return JSON.stringify(params.reqData);
    },
    parseResponse : function(svc, response) {
        return response;
    }
});

//the configure method retrieves payment data using Ingenico
ServiceRegistry.configure(IngenicoConfig.Services.PAYMENT_STATUS, {
     /**
     * @param {dw.svc.HTTPService} svc HTTP Service instance
     * @param {Object} params Payload to be used for the request
     */
    createRequest: function(svc, params) {
		PrepareRequest(svc,'GET',params.paymentID)
		return;
    },
    parseResponse : function(svc, response) {
        return response;
    }
});

//the configure method cancels payment using Ingenico
ServiceRegistry.configure(IngenicoConfig.Services.PAYMENT_CANCEL, {
     /**
     * @param {dw.svc.HTTPService} svc HTTP Service instance
     * @param {Object} params Payload to be used for the request
     */
    createRequest: function(svc, params) {
		PrepareRequest(svc,'POST',params.paymentID)
		return;
    },
    parseResponse : function(svc, response) {
        return response;
    }
});

//the configure method refunds payment using Ingenico
ServiceRegistry.configure(IngenicoConfig.Services.PAYMENT_REFUND, {
     /**
     * @param {dw.svc.HTTPService} svc HTTP Service instance
     * @param {Object} params Payload to be used for the request
     */
    createRequest: function(svc, params) {
		PrepareRequest(svc,'POST',params.paymentID)
		return JSON.stringify(params.reqData);
    },
    parseResponse : function(svc, response) {
        return response;
    }
});

//the configure method refunds payment using Ingenico
ServiceRegistry.configure(IngenicoConfig.Services.REFUND_STATUS, {
      /**
     * @param {dw.svc.HTTPService} svc HTTP Service instance
     * @param {Object} params Payload to be used for the request
     */
    createRequest: function(svc, params) {
		PrepareRequest(svc,'GET',params.refundID)
		return;
    },
    parseResponse : function(svc, response) {
        return response;
    }
});

//the configure method to approve refund using Ingenico
ServiceRegistry.configure(IngenicoConfig.Services.REFUND_APPROVE, {
      /**
     * @param {dw.svc.HTTPService} svc HTTP Service instance
     * @param {Object} params Payload to be used for the request
     */
    createRequest: function(svc, params) {
        PrepareRequest(svc,'POST',params.refundID)
        return JSON.stringify(params.reqData);
    },
    parseResponse : function(svc, response) {
        return response;
    }
});

//the configure method to undo refund approval using Ingenico
ServiceRegistry.configure(IngenicoConfig.Services.REFUND_UNDO_APPROVAL, {
      /**
     * @param {dw.svc.HTTPService} svc HTTP Service instance
     * @param {Object} params Payload to be used for the request
     */
    createRequest: function(svc, params) {
		PrepareRequest(svc,'POST',params.refundID)
		return;
    },
    parseResponse : function(svc, response) {
        return response;
    }
});

//the configure method refunds payment using Ingenico
ServiceRegistry.configure(IngenicoConfig.Services.REFUND_CANCEL, {
    /**
   * @param {dw.svc.HTTPService} svc HTTP Service instance
   * @param {Object} params Payload to be used for the request
   */
  createRequest: function(svc, params) {
      PrepareRequest(svc,'POST',params.refundID)
      return;
  },
  parseResponse : function(svc, response) {
      return response;
  }
});


//the configure method creates Hosted partial URL for Ingenico Hosted
ServiceRegistry.configure(IngenicoConfig.Services.HOSTED_PAYMENT_CREATE, {
    /**
     * @param {dw.svc.HTTPService} svc HTTP Service instance
     * @param {Object} params Payload to be used for the request
     */
    createRequest: function(svc, params) {
		PrepareRequest(svc,'POST',null)
		return JSON.stringify(params);
    },
    parseResponse : function(svc, response) {
        return response;
    }
});

//the configure method get status of hosted pay ID
ServiceRegistry.configure(IngenicoConfig.Services.HOSTED_PAYMENT_STATUS, {
     /**
     * @param {dw.svc.HTTPService} svc HTTP Service instance
     * @param {Object} params Payload to be used for the request
     */
    createRequest: function(svc, params) {
		PrepareRequest(svc,'GET',params.hostedID)
		return;
    },
    parseResponse : function(svc, response) {
        return response;
    }
});

//the configure method to capture payment
ServiceRegistry.configure(IngenicoConfig.Services.PAYMENT_CAPTURE, {
     /**
     * @param {dw.svc.HTTPService} svc HTTP Service instance
     * @param {Object} params Payload to be used for the request
     */
    createRequest: function(svc, params) {
        PrepareRequest(svc,'POST',params.paymentID)
        return JSON.stringify(params.reqData);
    },
    parseResponse : function(svc, response) {
        return response;
    }
});

//the configure method to create token from an existing payment transaction
ServiceRegistry.configure(IngenicoConfig.Services.PAYMENT_TOKENIZE, {
     /**
     * @param {dw.svc.HTTPService} svc HTTP Service instance
     * @param {Object} params Payload to be used for the request
     */
    createRequest: function(svc, params) {
        PrepareRequest(svc,'POST',params.paymentID)
        return JSON.stringify(params.reqData);
    },
    parseResponse : function(svc, response) {
        return response;
    }
});

//the configure method to list captures
ServiceRegistry.configure(IngenicoConfig.Services.PAYMENT_CAPTURES, {
     /**
     * @param {dw.svc.HTTPService} svc HTTP Service instance
     * @param {Object} params Payload to be used for the request
     */
    createRequest: function(svc, params) {
        PrepareRequest(svc,'GET',params.paymentID)
        return;
    },
    parseResponse : function(svc, response) {
        return response;
    }
});

//the configure method to undo payment capture
ServiceRegistry.configure(IngenicoConfig.Services.PAYMENT_UNDO_CAPTURE, {
     /**
     * @param {dw.svc.HTTPService} svc HTTP Service instance
     * @param {Object} params Payload to be used for the request
     */
    createRequest: function(svc, params) {
        PrepareRequest(svc,'POST',params.paymentID)
		return;
    },
    parseResponse : function(svc, response) {
        return response;
    }
});

//the configure method to approve challenged payment (fraud approve)
ServiceRegistry.configure(IngenicoConfig.Services.PAYMENT_APPROVE_FRAUD, {
     /**
     * @param {dw.svc.HTTPService} svc HTTP Service instance
     * @param {Object} params Payload to be used for the request
     */
    createRequest: function(svc, params) {
        PrepareRequest(svc,'POST',params.paymentID)
        return;
    },
    parseResponse : function(svc, response) {
        return response;
    }
});

//the configure method to approve challenged payment (fraud approve)
ServiceRegistry.configure(IngenicoConfig.Services.PRODUCT_LIST, {
     /**
     * @param {dw.svc.HTTPService} svc HTTP Service instance
     * @param {Object} params Payload to be used for the request
     */
    createRequest: function(svc, params) {
        var queryString = Object.keys(params).map(function(key){
            return encodeURIComponent(key) + '=' + encodeURIComponent(params[key])
        }).join('&');
        PrepareRequest(svc,'GET',queryString);
        return;
    },
    parseResponse : function(svc, response) {
        return response;
    }
});

//the configure method to retrieve product type for a credit/debit card
ServiceRegistry.configure(IngenicoConfig.Services.CARD_DETAILS_GET, {
     /**
     * @param {dw.svc.HTTPService} svc HTTP Service instance
     * @param {Object} params Payload to be used for the request
     */
    createRequest: function(svc, params) {
        PrepareRequest(svc,'POST',null)
        return JSON.stringify(params);
    },
    parseResponse : function(svc, response) {
        return response;
    },
    filterLogMessage: function(msg) {
        return msg.replace(/bin":"(\d{6})\d+/,'cardNumber":"$1**********');
    }
});

/**
 * 
 * @param {dw.svc.HTTPService} svc 
 * @param {String} method 
 * @param {Object} replacements
 */
function PrepareRequest(svc, method, replacements){
        var targetURL = IngenicoConfig.getAPIURL(svc.getConfiguration().getID(),replacements);
		var serviceUserAgent = "Demandware";
		var curDate = new Date();
	    var httpDate = curDate.toUTCString();
	    var authKey = GenerateIngenicoSHA(httpDate, targetURL.servicePath, method);
		svc.addHeader('Path', targetURL.servicePath);
		svc.addHeader('User-Agent',serviceUserAgent);
		svc.addHeader('Content-Type','application/json');
		svc.addHeader('Date',httpDate);
		svc.addHeader('Authorization', authKey);
		svc.addHeader('Version', JSON.stringify(IngenicoConfig.VERSION));
		svc.setRequestMethod(method);
		svc.setURL(targetURL.URL);
}

/**
 * Generate SHA signature for an Ingenico request
 * @param {String} httpDate 
 * @param {String} servicePath 
 * @param {String} method 
 * @returns {String} String with signature
 */
function GenerateIngenicoSHA(httpDate, servicePath, method){
    var serviceClientID = Site.current.getCustomPreferenceValue(IngenicoConfig.SitePreferences.API_CLIENT_ID);
	var servicePrivateKey = Site.current.getCustomPreferenceValue(IngenicoConfig.SitePreferences.API_KEY);
    var contentType = "application/json";
    var headers = '';
    var publicKey = method + "\n" + contentType + "\n" + httpDate + "\n" + headers + servicePath + "\n";
	var encryptor = new Mac(Mac.HMAC_SHA_256);
	var authDataByte = encryptor.digest(publicKey, servicePrivateKey);
	var authData = Encoding.toBase64(authDataByte);
	var authKey = "GCS v1HMAC:" + serviceClientID + ":" + authData;
	return authKey;
}

