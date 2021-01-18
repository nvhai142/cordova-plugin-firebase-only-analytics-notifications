"use strict";

var path = require("path");
var AdmZip = require("adm-zip");
var process = require('process');

var utils = require("./utilities");

var constants = {
  googleServices: "google-services"
};

module.exports = function(context) {
  console.log(process.arv);
  console.log(context.opts.plugin.pluginInfo);

  var cordovaAbove8 = utils.isCordovaAbove(context, 8);
  var cordovaAbove7 = utils.isCordovaAbove(context, 7);
  var defer;
  if (cordovaAbove8) {
    defer = require("q").defer();
  } else {
    defer = context.requireCordovaModule("q").defer();
  }
  
  var platform = context.opts.plugin.platform;
  var platformConfig = utils.getPlatformConfigs(platform);
  if (!platformConfig) {
    utils.handleError("Invalid platform", defer);
  }

  var wwwPath = utils.getResourcesFolderPath(context, platform, platformConfig);
  var sourceFolderPath = utils.getSourceFolderPath(context, wwwPath);
  
  var googleServicesZipFile = utils.getZipFile(sourceFolderPath, constants.googleServices);
  if (!googleServicesZipFile) {
    utils.handleError("No zip file found containing google services configuration file", defer);
  }

  var zip = new AdmZip(googleServicesZipFile);

  var targetPath = path.join(wwwPath, constants.googleServices);
  zip.extractAllTo(targetPath, true);

  var files = utils.getFilesFromPath(targetPath);
  if (!files) {
    utils.handleError("No directory found", defer);
  }

  // Copy google-services.json or GoogleService-Info.plist
  var fileName = files.find(function (name) {
    return name.endsWith(platformConfig.firebaseFileExtension);
  });

  if (!fileName) {
    utils.handleError("No file found", defer);
  } else {
    console.log('Found: ' + fileName);
  }

  var sourceFilePath = path.join(targetPath, fileName);
  var destFilePath = path.join(context.opts.plugin.dir, fileName);

  utils.copyFromSourceToDestPath(defer, sourceFilePath, destFilePath);

  if (cordovaAbove7) {
    var destPath = path.join(context.opts.projectRoot, "platforms", platform, "app");
    if (utils.checkIfFolderExists(destPath)) {
      var destFilePath = path.join(destPath, fileName);
      utils.copyFromSourceToDestPath(defer, sourceFilePath, destFilePath);
    }
  }

  // Copy GTM-XXXXXX.json
  var gtmId = utils.getPreferenceValue('GTM_ID');
  if (gtmId != null && gtmId !== '' && typeof(gtmId) !== 'undefined') {
    var gtmFile = files.filter(x => path.basename(x) === platformConfig.gtmFileNamePrefix + gtmId + platformConfig.gtmFileNameSuffix)[0];

    if (!gtmFile) {
      console.log("No GTM-" + gtmId + ".json file found");
    } else {
      console.log('Found: ' + gtmFile);
    }
    
    sourceFilePath = path.join(targetPath, gtmFile);
    destFilePath = path.join(context.opts.plugin.dir, 'GTM.json');
  
    utils.copyFromSourceToDestPath(defer, sourceFilePath, destFilePath);
  
    if (cordovaAbove7) {
      var destPath = path.join(context.opts.projectRoot, "platforms", platform, "app");
      if (utils.checkIfFolderExists(destPath)) {
        var destFilePath = path.join(destPath, 'GTM.json');
        utils.copyFromSourceToDestPath(defer, sourceFilePath, destFilePath);
      }
    }
  } else {
    console.log("No GTM_ID preference specified.");
  }
      
  return defer.promise;
}
