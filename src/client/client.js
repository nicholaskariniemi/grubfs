var _ = require('mori');
var React = require('react');
var Bacon = require('baconjs');

var View = require('./view/view');
var Util = require('./util.js');
var State = require('./state');
var Fsio = require('./fsio');

function render(state){
  View.render(state);
}

function isEventType(eventType, event){
  return _.equals(_.get(event, 'eventType'), eventType);
}

function combineSignInAndDownload(signedInData, downloadedData) {
    return _.conj(signedInData, downloadedData);
}

function handleSignUpEvents(events){
  var signUpEvents = events.filter(isEventType, 'signUp');
  var signedUpEvents = signUpEvents.flatMap(Fsio.signUp);
  return signedUpEvents;
}

function handleSignInEvents(events){
  var signInEvents = events.filter(isEventType, 'signIn');
  var signedInEvents = signInEvents.flatMap(Fsio.signIn);
  var downloadAllFilesEvent = signedInEvents.flatMap(Fsio.downloadFileList);
  var signInAndDownloadEvent = Bacon.combineWith(combineSignInAndDownload,
                                                 signedInEvents,
                                                 downloadAllFilesEvent).changes();
  return signInAndDownloadEvent;
}

function initialize(){
  var initialState = State.getInitialState();
  render(initialState);

  var viewEvents = View.outgoingEvents;

  var signedUpEvents = handleSignUpEvents(viewEvents);
  var signedInEvents = handleSignInEvents(viewEvents);

  var stateEvents = Bacon.mergeAll(viewEvents, signedUpEvents, signedInEvents, State.outgoingEvents);
  var changedStates = State.handleStateChanges(initialState, stateEvents);

  changedStates.onValue(render);
}

initialize();

