var Bacon = require('baconjs');
var $ = require('jquery');
var jsSHA = require('jssha');
var _ = require('mori');

var FsioAPI = require('../shared/fsio_api');

function signUp(event){
  var email = _.get(event, 'email');
  var password = _.get(event, 'password');
  
  var authCredentials = _signUp(email, password);

  var signedUpEvents = authCredentials.skipErrors().map(_.js_to_clj)
    .map(addUserInfoToCredentials, email, password)
    .map(makeSignedUpEvent);
  
  var signUpFailedEvents = 
    authCredentials.errors()
                   .mapError(_.js_to_clj)
                   .map(function(){
                     return _.hash_map('eventType', 'signInStatusChange',
                                       'signUpError', true);
                   });

  return Bacon.mergeAll(signedUpEvents, signUpFailedEvents);
}

function _signUp(email, password){
  var serverUrl = document.location.origin;
  var url = serverUrl + '/event';
  var requestData = {email: email, password: password};

  var request = {
    url: url,
    type: 'POST',
    dataType: 'json',
    data: requestData
  };

  return Bacon.fromPromise($.ajax(request));
}

function signIn(event){
  var email = _.get(event, 'email');
  var password = _.get(event, 'password');

  var token = FsioAPI.signIn(email, password, false);

  var signedInEvents = token.skipErrors().map(_.hash_map, 'token')
  .map(addUserInfoToCredentials, email, password)
  .map(makeSignedInEvent);

  var signInFailedEvents = token.errors()
                                .mapError(_.js_to_clj)
                                .map(function(){
                                  return _.hash_map('eventType', 'signInStatusChange',
                                                    'signInError', true);
                                });

  return Bacon.mergeAll(signedInEvents, signInFailedEvents);
}

function checkSignIn(token) {
  return (_.get(token, 'credentials') !== null);
}

function addUserInfoToCredentials(email, password, credentials){
  return _.assoc(credentials,
                 'email', email,
                 'password', password);
}

function makeSignedUpEvent(credentials){
  return _.hash_map('eventType', 'signedUp',
                    'credentials', credentials);
}

function makeSignedInEvent(credentials){
  return _.hash_map('eventType', 'signedIn',
                    'credentials', credentials);
}

function syncStateWithFsio(event){
  var eventHandler = getEventHandler(event);

  if(eventHandler){
    // Trigger handler but do nothing with result
    eventHandler(event).onEnd();
  }

  return Bacon.never();
}

function getEventHandler(event){
  var eventHandlers = _.hash_map('addItem', handleAddItem,
                                 'completeItem', handleCompleteItem,
                                 'updateItem', handleUpdateItem,
                                 'deleteItem', handleDeleteItem);
  var eventType = _.get(event, 'eventType');
  var handler = _.get(eventHandlers, eventType);
  return handler;
}

function handleAddItem(event){
  return handleAddedOrUpdatedItem(event);
}

function handleCompleteItem(event){
  return handleAddedOrUpdatedItem(event);
}

function handleUpdateItem(event){
  return handleAddedOrUpdatedItem(event);
}

function handleAddedOrUpdatedItem(event){
  var email = _.get_in(event, ['state', 'credentials', 'email']);
  var password = _.get_in(event, ['state', 'credentials', 'password']);
  var updatedItem = getItemById(_.get_in(event, ['state', 'items']), _.get(event, 'id'));
  return uploadItem(email, password, _.clj_to_js(updatedItem));
}

function handleDeleteItem(event){
  var email = _.get_in(event, ['state', 'credentials', 'email']);
  var password = _.get_in(event, ['state', 'credentials', 'password']);
  var itemId = _.get(event, 'id');
  var filename = 'items/' + itemId;

  var response = FsioAPI.deleteFile(email, password, filename);
  return response;
}

function getItemById(items, id){
  return _.first(_.filter(function(item){
    return _.equals(_.get(item, 'id'), id);
  }, items));
}

function syncItemToServer(email, password, item){
  return uploadItem(email, password, item);
}

function saveNewUserState(state){
  var items = _.clj_to_js(_.get(state, 'items'));
  var email = _.get_in(state, ['credentials', 'email']);
  var password = _.get_in(state, ['credentials', 'password']);

  var result = Bacon.fromArray(items).flatMap(uploadItem, email, password);

  return result;
}

function uploadItem(email, password, item){
  var filename = 'items/' + item.id;
  return FsioAPI.uploadFile(email, password, filename, item);
}


function downloadFileList(signedInEvents) {
  var credentials = _.get(signedInEvents, "credentials");
  var username = _.get(credentials, "email");
  var password = _.get(credentials, "password");
  var fileStream = FsioAPI.downloadFileList(username, password);
  var remoteAddItemEvents = fileStream.map(makeRemoteAddItemEvent);

  return remoteAddItemEvents;
}

function makeRemoteAddItemEvent(item){
  var itemData = _.js_to_clj(item);
  var event = _.assoc(itemData, 'eventType', 'remoteAddItem');
  return event;
}

function clearItems(email, password){
  var itemsFile = 'items';
  return FsioAPI.deleteFile(email, password, itemsFile);
}

module.exports = {
  signIn: signIn,
  signUp: signUp,
  syncItemToServer: syncItemToServer,
  clearItems: clearItems,
  saveNewUserState: saveNewUserState,
  downloadFileList: downloadFileList,
  syncStateWithFsio: syncStateWithFsio,
  test: {
    FsioAPI: FsioAPI
  }
};
