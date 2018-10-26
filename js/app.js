$(function(){
  var downloadCrxButton = $('.download-crx');
  var downloadCrxOkButton = $('.download-crx-ok');
  var downloadCrxInput = $('#crx-download-input');

  var downloadCrxError = $('.download-crx-err');

  function showCrxDownloadError(msg) {
    console.error(msg);
    downloadCrxError.find('p').html(msg);
    downloadCrxError.fadeIn('fast');
  }

  function hideCrxDownloadError() {
    downloadCrxError.fadeOut('fast');
  }

  function getExtensionIdFromLink(link) {
    var parser = document.createElement('a');
    parser.href = link;
    if (parser.host != 'chrome.google.com') {
      return;
    }

    var pathName = parser.pathname;
    if (pathName.slice(-1) == '/') {     // if ends with '/',
      pathName = pathName.slice(0, -1);  // cut it off
    }
    var pathChunks = pathName.split('/');

    // the last chunk is extension id
    return pathChunks.pop();
  }

  function buildDownloadLink(extensionId) {
    var baseUrl = 'https://clients2.google.com/service/update2/crx?response=redirect&prodversion=49.0&x=id%3D***%26installsource%3Dondemand%26uc';
    var replacer = '***';
    return baseUrl.replace(replacer, extensionId);
  }

  downloadCrxOkButton.click(function(){
    hideCrxDownloadError();

    var rawLink = downloadCrxInput.val();
    var extensionId = getExtensionIdFromLink(rawLink);
    var downloadLink = buildDownloadLink(extensionId);

    if (!extensionId || !downloadLink) {
      showCrxDownloadError('The provided link is not a Chrome Extension link from Chrome WebStore.');
      return;
    }

    downloadCrxButton.attr('href', downloadLink);
    downloadCrxButton.prop('download', 'extension.crx');
    downloadCrxOkButton.fadeOut('fast', function(){
      downloadCrxButton.fadeIn('fast');
    });
    return true;
  });

  downloadCrxButton.click(function(){
    downloadCrxButton.fadeOut('fast', function(){
      downloadCrxOkButton.fadeIn('fast');
      downloadCrxInput.val('');
    });
  });

});

var CRXFileParser = function(file) {
  var self = this;

  self.file = file;

  this._formatUint32 = function (uint) {
    var s = uint.toString(16);
    while (s.length < 8) {
      s = '0' + s;
    }
    return '0x' + s;
  };

  this._formatCharString = function (uint) {
    var s = this._formatUint32(uint);
    s = s.substr(2, 8);
    var o = '';
    for (var i = 0; i < 4; i++) {
      o += String.fromCharCode(parseInt(s.substr(i << 1, 2), 16));
    }
    return o;
  }

  this.parse = function (dataView, arrayBuffer) {
    var magic = dataView.getUint32(0);

    if (magic == 0x43723234) { // Cr24
      console.info('Magic is OK: ' + this._formatUint32(magic) + ' ' + this._formatCharString(magic));
    } else {
      console.error('Magic is broken: ' + this._formatUint32(magic) + ' ' + this._formatCharString(magic));
      return;
    }

    var version = dataView.getUint32(4);
    console.info('Version is: ' + this._formatUint32(version));

    var publicKeyLength = dataView.getUint32(8, true);
    console.info('Public key length: ' + publicKeyLength);

    var signatureLength = dataView.getUint32(12, true);
    console.info('Signature length: ' + signatureLength);

    var publicKeyBuffer = arrayBuffer.slice(16, 16 + publicKeyLength);
    var signatureBuffer = arrayBuffer.slice(16 + publicKeyLength, 16 + publicKeyLength + signatureLength);

    var zipArchiveBuffer = arrayBuffer.slice(16 + publicKeyLength + signatureLength);

    return [zipArchiveBuffer, publicKeyBuffer, signatureBuffer];
  }

  this.load = function (handler) {
    var resultHandler = handler;

    var reader = new FileReader();

    reader.onload = function(event) {
      var buffer = event.target.result;
      var view = new DataView(buffer);
      resultHandler(self.parse(view, buffer));
    };

    reader.onerror = function(event) {
      resultHandler(undefined);
    };

    reader.readAsArrayBuffer(this.file);
  }
};

$(function () {
  var dropZoneId = "drop-zone";
  var mouseOverClass = "mouse-over";

  var dropZone = $("#" + dropZoneId);
  var inputFile = dropZone.find("input");

  var downloadSourceBtn = $(dropZone).find('.download');
  var thanks = $(dropZone).find('.thanks');

  var dropZoneUiWrapper = $(dropZone).find('.ui-wrapper');
  var downloadSourceError = $('.download-source-err');

  function getFileExtension(file) {
    return file.name.substr(file.name.length-4).toUpperCase();
  };

  function getFilename(file) {
    var chunks = file.name.split('.');
    chunks.pop();
    return chunks.join('.');
  };

  function showErrorMessage(msg) {
    console.error("User error message: " + msg);

    downloadSourceError.find('p').html(msg);
    downloadSourceError.fadeIn('fast');
  };

  function hideErrorMessage() {
    downloadSourceError.fadeOut('fast');
  };

  function showDownloadButton() {
    downloadSourceBtn.fadeIn('fast');
    dropZoneUiWrapper.fadeOut('fast');
  };

  function showSourceDownloadDropzone(e) {
    downloadSourceBtn.fadeOut('fast', function(){
      thanks.fadeIn('slow', function(){
        thanks.fadeOut('slow', function(){
          dropZoneUiWrapper.fadeIn('slow');
        });
      });
    });
  };

  $(downloadSourceBtn).click(showSourceDownloadDropzone);

  function checkFileAndParse(file) {
    if (file.type != 'application/x-chrome-extension' ||
      getFileExtension(file) != '.CRX') {
      showErrorMessage('This file seems to be of different file format. Please provide valid .CRX file.');
      return;
    }

    var parser = new CRXFileParser(file);
    parser.load(function(parsingResult){
      if (!parsingResult) {
        showErrorMessage('Unable to parse this file. The file may be broken or unknown error has occured.');
        return;
      }

      var zipArchiveBuffer = parsingResult[0];
      var outputFile = new Blob([zipArchiveBuffer], {type: 'application/zip'});

      showDownloadButton();
      downloadSourceBtn.attr('href', URL.createObjectURL(outputFile));
      downloadSourceBtn.prop('download', getFilename(file) + '.zip');
    });
  };

  $(dropZone).on("dragover", function (e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.addClass(mouseOverClass);
  });

  $(dropZone).on("dragleave", function (e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.removeClass(mouseOverClass);
  });

  $(inputFile).on("change", function(e){
    hideErrorMessage();

    var files = $(inputFile).prop('files');
    if (files.length > 1 || files.length == 0) {
      showErrorMessage('You should put only one .CRX file a time.');
      return;
    }
    checkFileAndParse(files[0]);
  });

  $('html').on("drop", function (e) {
    e.preventDefault();
    e.stopPropagation();

    hideErrorMessage();

    dropZone.removeClass(mouseOverClass);

    if (typeof e.originalEvent.dataTransfer !== undefined &&
      e.originalEvent.dataTransfer.files.length > 0) {
      if (e.originalEvent.dataTransfer.files.length == 1) {
        var file = e.originalEvent.dataTransfer.files[0];
        checkFileAndParse(file);
      } else {
        showErrorMessage('You should put only one .CRX file a time.');
      }
    } else {
      showErrorMessage('Only .CRX files supported!');
    }
  });
});

$(function(){
  var ctaButton = $('.cta-button');
  var welcomePane = $('.welcome');
  var tool = $('.tool');

  var suggestionName = $('#crx-suggestion .name');
  var suggestionLink = $('#crx-suggestion .link');
  var newSuggestionBtn = $('#crx-suggestion i');

  var crxExamples = [
    ['AdBlock Plus', 'https://chrome.google.com/webstore/detail/adblock-plus/cfhdojbkjhnklbpkdaibdccddilifddb'],
    ['Blur', 'https://chrome.google.com/webstore/detail/blur/epanfjkfahimkgomnigadpkobaefekcd'],
    ['LastPass Free Password Manager', 'https://chrome.google.com/webstore/detail/lastpass-free-password-ma/hdokiejnpimakedhajhdlcegeplioahd'],
    ['Mercury Reader', 'https://chrome.google.com/webstore/detail/mercury-reader/oknpjjbmpnndlpmnhmekjpocelpnlfdi'],
    ['Pixlr', 'https://chrome.google.com/webstore/detail/pixlr-editor/icmaknaampgiegkcjlimdiidlhopknpk'],
    ['Pushbullet', 'https://chrome.google.com/webstore/detail/pushbullet/chlffgpmiacpedhhbkiomidkjlcfhogd/'],
    ['Awesome Screenshot', 'https://chrome.google.com/webstore/detail/awesome-screenshot-screen/nlipoenfbbikpbjkfpfillcgkoblgpmj'],
    ['ColorZilla', 'https://chrome.google.com/webstore/detail/colorzilla/bhlhnicpbhignbdhedgjhgdocnmhomnp'],
  ];

  var suggestion = 0;

  function nextSuggestion() {
    suggestion = suggestion + 1;
    var ex = crxExamples[suggestion % crxExamples.length];
    $(suggestionName).html(ex[0]);
    $(suggestionLink).html(ex[1]);
  }

  $(newSuggestionBtn).click(function(){
    nextSuggestion();
  });

  $(suggestionLink).click(function(){
    $('#crx-download-input').val($(suggestionLink).html());
  });

  ctaButton.click(function(){
    welcomePane.fadeOut('fast', function(){
      tool.fadeIn('fast');
    });
  });

  nextSuggestion();
});
