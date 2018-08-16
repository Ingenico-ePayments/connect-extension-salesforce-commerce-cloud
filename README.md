# connect-extension-salesforce-commerce-cloud
Ingenico Connect based Shopping Cart Extension for Salesforce Commerce Cloud

This extension can also be found on the Salesforce Commerce Cloud marketplace athttps://www.demandware.com/link-marketplace/ingenico-epayment-globalcollect-platform.

For detailed documentation including screenshots please see https://github.com/Ingenico-ePayments/connect-extension-salesforce-commerce-cloud/tree/master/documentation.

## Introduction
The below instructions cover the basic steps required to get the Ingenico Salesforce Cloud Commerce SDK with the reference implementation for Site Genesis installed on a sandbox.

### Requirements
The details required from Ingenico’s Configuration Center are:
* Merchant IDs
* API key ID
* API Secret key
* Webhook key
* Webhooks Secret key

### Installation steps
1. **Import Site Genesis Demo site**

Navigate to _Administration > Site Development > Site Import & Export_, select _SiteGenesis Demo Site_ and click import and confirm.

2. **Upload SDK customisation**

Navigate to _Administration > Site Development > Site Import & Export_, choose the file to upload _site_import.zip_ located in the _metadata_ folder.
After upload completes, select _site_import.zip_ from the list and click import and confirm.
		
3. **Upload SDK cartridges**

The three cartridges that need to be uploaded into the sandbox are: 
* int_ingenico
* int_ingenico_feature
* bm_ingenico

The code can be uploaded using WebDav on _https://SANDBOX_URL/on/demandware.servlet/webdav/Sites/Cartridges_ and in the relevant version. If the version chosen is not the active one, it needs to be activated before it can be used. Activation is done through the Code Deployment screen found in _Administration > Site Development > Code Deployment_.

4. **Update cartridge path**

Prepend “int_ingenico_feature:int_ingenico:” to Cartridges path on _Administration > Sites > Manage Sites > SiteGenesis - Settings_ and _Administration > Sites > Manage Sites > SiteGenesisGlobal - Settings_. This will make sure that the plugin code will be used by the two sites in SiteGenesis.
 
The path once prepended should look like below in all lowercase.

	int_ingenico_feature:int_ingenico:sitegenesis_storefront_controllers:sitegenesis_storefront_core

 The business manager path in _Administration > Sites > Manage Sites > Business Manager_ - Settings also needs changing to include the business manager plugin as below.
 
	bm_ingenico:int_ingenico:int_ingenico_feature:sitegenesis_storefront_core

5. **Set API site preferences**

Select a website from the list on the top left to add the API details in the site custom preferences. Once selected, navigate to _Merchant Tools > Site Preferences > Custom Site Preference Groups > Ingenico API Credentials_ and fill in all the relevant fields, select the platform (GlobalCollect - WW only or Ogone - EU only) and the environment.

  When using webhooks to get status updates, the URL used to receive the updates is specific to each site and account. The format of the URL is as shown below.

	https:/**DOMAIN**/ on/demandware.store/Sites-**SITENAME**-Site/**LANGUAGE**/Ingenico-Feedback

The _DOMAIN_ is the one that links to the instance (sandbox, staging or production). _SITENAME_ refers to the name as shown in Business Manager for each site. _LANGUAGE_ is one of the locals that are allowed on the specific site as defined in _Merchant Tools > Site Preferences > Locales_.

NOTE: Both endpoints (WW and EU) will automatically failover to a second datacenter in case the main datacenter isn't available.

NOTE: There is a one to one mapping between webhook URL, Ingenico account, Demandware site and orders. Orders placed in one site, need to receive the update on the specific URL for that site.

6. **Update role permissions**

In order to manage the pending, a role needs to be given the permission _Orders (Action pending)_ to do so. The instructions below explain how to give the permission to the Admin role.
Navigate to _Administration > Organization > Roles > Administrator - Business Manager Modules_. When selecting the Business Manager module, select all sites from the pop-up window that will appear.

 Scroll until the Orders section where you will find _Orders (Action pending)_. Tick the box and save the settings.
