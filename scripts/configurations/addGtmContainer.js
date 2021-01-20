'use strict';

// var xcode = require('xcode');
var fs = require('fs-extra');
var path = require('path');

var AdmZip = require("adm-zip");

var utils = require("./utilities");

var constants = {
  googleServices: "google-services"
};

module.exports = function(context) {
  var xcode = context.requireCordovaModule("xcode");

  function fromDir(startPath, filter, rec, multiple) {
    if (!fs.existsSync(startPath)) {
      console.log('no dir ', startPath);
      return;
    }
    
    const files = fs.readdirSync(startPath);
    var resultFiles = []
    for (var i = 0; i < files.length; i++) {
      var filename = path.join(startPath, files[i]);
      var stat = fs.lstatSync(filename);
      if (stat.isDirectory() && rec) {
        fromDir(filename, filter);
      }
      
      if (filename.indexOf(filter) >= 0) {
        if (multiple) {
          resultFiles.push(filename);
        } else {
          return filename;
        }
      }
    }
    if (multiple) {
      return resultFiles;
    }
  }

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
  } else {
    console.log("Found: " + googleServicesZipFile);
  }

  var zip = new AdmZip(googleServicesZipFile);

  var targetPath = path.join(wwwPath, constants.googleServices);
  zip.extractAllTo(targetPath, true);

  var files = utils.getFilesFromPath(targetPath);
  if (!files) {
    utils.handleError("No directory found", defer);
  }

  var gtmFile = files.filter(x => path.basename(x).startsWith(platformConfig.gtmFileNamePrefix) && path.basename(x).endsWith(platformConfig.gtmFileNameSuffix))[0];

  if (!gtmFile) {
    console.log("No GTM-*.json file found");
  } else {
    console.log('Found: ' + gtmFile);
  }

  var destinationPath;
  if (platform === 'android') {
    destinationPath = 'platforms/' + platform + '/app/src/main/assets/containers';
  } else if (platform === 'ios') {
    destinationPath = 'platforms/' + platform + '/container';
  }

  sourceFilePath = path.join(targetPath, gtmFile);

  if (cordovaAbove7) {
    var destPath = path.join(context.opts.projectRoot, destinationPath);
    if (utils.createOrCheckIfFolderExists(destPath)) {
      var destFilePath = path.join(destPath, gtmFile);
      utils.copyFromSourceToDestPath(defer, sourceFilePath, destFilePath);
    }
  }
  
  if (platform === 'ios') {
    var xcodeProjPath = fromDir('platforms/ios','.xcodeproj', false);
    var projectPath = xcodeProjPath + '/project.pbxproj';
    var myProj = xcode.project(projectPath);
    
    myProj.parseSync();
    
    var pbxGroupKey = myProj.findPBXGroupKey({ name: 'CustomTemplate' });
    
    var resourceFile = myProj.addResourceFile(
      path.join(context.opts.projectRoot, destinationPath),
      {},
      pbxGroupKey
      );
      
      if (resourceFile) {
        fs.writeFileSync(projectPath, myProj.writeSync());
        console.log('Successfully added the container as a resource to ios project');
      }
    }
  };
  