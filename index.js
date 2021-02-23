const backendURL = 'https://livestchat.herokuapp.com/';

let localStream;
let socket;
let mySocketId;
const localPeerConnections = {};
const remotePeerConnections = {};
const peerConnectionConfig = {
  iceServers: [
    {
      urls: ["stun:stun.l.google.com:19302"]
    }
  ]
};

const title = document.querySelector('#title');
const exitRoom = document.querySelector('#exit-room');
const userVideoContainer = document.querySelector('#user-video-container');
const userVideoControls = document.querySelector('#user-video-controls');
const chatForm = document.querySelector('#chat-form');
const chatInput = document.querySelector('input[name="message"]');
const chatSubmit = document.querySelector('#chat-submit');
const rooms = document.querySelector('#rooms');
const chatters = document.querySelector('#chatters');
const messages = document.querySelector('#messages');
const videos = document.querySelector('#videos');

document.querySelector('#enter-app')
  .addEventListener('submit', enterApp);
rooms.addEventListener('click', handleEnteringRoom);
exitRoom.addEventListener('click', leaveRoom);
chatForm.addEventListener('submit', handleChatMessage);
userVideoControls.addEventListener('click', handleVideoToggle);

function handleVideoToggle(event) {
  const { classList } = event.target;
  const videoIcon = document.querySelector('.fa-video');
  const videoSlashIcon = document.querySelector('.fa-video-slash');
  const microphoneIcon = document.querySelector('.fa-microphone');
  const microphoneSlashIcon = document.querySelector('.fa-microphone-slash');

  if (classList.contains('fa-microphone')) {
    muteMicrophone();
    hide(microphoneIcon);
    unhide(microphoneSlashIcon);
  } else if (classList.contains('fa-microphone-slash')) {
    unmuteMicrophone();
    hide(microphoneSlashIcon);
    unhide(microphoneIcon);
  } else if (classList.contains('fa-video')) {
    pauseWebcam();
    hide(videoIcon);
    unhide(videoSlashIcon);
  } else if (classList.contains('fa-video-slash')) {
    unpauseWebcam();
    hide(videoSlashIcon);
    unhide(videoIcon);
  }
}

function muteMicrophone() {
  localStream.getAudioTracks().forEach(pauseTrack);
}

function pauseTrack(track) {
  track.enabled = false;
}

function unmuteMicrophone() {
  localStream.getAudioTracks().forEach(unpauseTrack);
}

function unpauseTrack(track) {
  track.enabled = true;
}

function pauseWebcam() {
  localStream.getVideoTracks().forEach(pauseTrack);
}

function unpauseWebcam() {
  localStream.getVideoTracks().forEach(unpauseTrack);
}

function enterApp(event) {
  event.preventDefault();
  const { username } = getFormData(event.target, 'username');
  document.querySelector('#modal').remove();
  document.querySelector('#user').textContent = username;
  setupSocket(username);
}

function setupSocket(username) {
  socket = io(backendURL, { query: { username } });
  socket.on('connect', () => mySocketId = socket.id);

  socket.on('room message', (message, name) => {
    displayMessage(message, name, false);
  });
  socket.on('someone left', removePerson);
  socket.on('someone joined', displayPerson);

  socket.on('get users', connectToOtherUsers);
  socket.on('offer', handleOffer);
  socket.on('answer', handleAnswer);
  socket.on('candidate', handleCandidate);
  socket.on('disconnect video', disconnectVideo);

  window.onunload = window.onbeforeunload = handleWindowUnload;
}

function displayMessage(message, username, isSender) {
  const messageDisplay = document.createElement('li');
  isSender
    ? messageDisplay.classList.add('sender')
    : messageDisplay.classList.add('receiver');

  const usernameDisplay = document.createElement('h6');
  usernameDisplay.textContent = username;
  usernameDisplay.classList.add('username');

  const messageText = document.createElement('p');
  messageText.textContent = message;
  messageText.classList.add('chat-message');

  const timestamp = document.createElement('p');
  timestamp.textContent = getCurrentTime();
  timestamp.classList.add('timestamp');

  messageDisplay.append(usernameDisplay, messageText, timestamp);
  messages.append(messageDisplay);
  messages.scrollTo(0, messages.scrollHeight);
}

function removePerson(username) {
  const leavingChatter = findChatter(username);
  leavingChatter.remove();
}

function findChatter(username) {
  const allChatterButtons = Array.from(document.querySelectorAll('.chatter'));
  return allChatterButtons
    .find(chatter => chatter.textContent === username)
    .parentNode;
}

function handleEnteringRoom(event) {
  const { classList, textContent, id } = event.target;
  const room = textContent.trim();
  const isStreamNotCapable = !navigator.mediaDevices ||
    !navigator.mediaDevices.getUserMedia ||
    !window.RTCPeerConnection;

  if (id === 'video-chat') {
    if (isStreamNotCapable) {
      alert('User media is not supported in this browser.')
    } else {
      startStream(room);
      enterRoom(room);
    }
  } else if (classList.contains('room-selector')) {
    enterRoom(room);
  }
}

function startStream(room) {
  const userMediaParams = { 
    audio: { echoCancellation: true },
    video: { facingMode: 'user' }
  };
  navigator.mediaDevices.getUserMedia(userMediaParams)
    .then(stream => handleUserMedia(stream, room))
    .catch(handleUserMediaError);
}

function handleUserMedia(stream, room) {
  const userVideo = document.querySelector('#user-video');
  userVideo.volume = 0;
  userVideo.srcObject = localStream = stream;
  userVideo.onloadedmetadata = _ => userVideo.play();

  socket.emit('ask for users', room);
}

function handleUserMediaError(error) {
  console.error(`get user media error: ${error}`);
  alert('Problem retrieving media streams, or did you disallow access?');
}

function enterRoom(room) {
  socket.emit('join room', room, displayPeople);
  setupChatRoom(room);
}

function displayPeople(people) {
  people.forEach(displayPerson);
  unhide(chatters);
}

function displayPerson(username) {
  const personDisplay = document.createElement('li');
  const personButton = document.createElement('button');
  personButton.classList.add('chatter');
  personButton.textContent = username;
  personDisplay.append(personButton);
  chatters.append(personDisplay);
}

function setupChatRoom(room) {
  chatForm.dataset.room = room;
  title.textContent = room;

  hide(rooms);
  unhide(exitRoom, messages);
  enable(chatInput, chatSubmit);

  if (room === 'Video Chat') {
    unhide(userVideoContainer, videos);
  }
}

function leaveRoom(_) {
  socket.emit('leave room', chatForm.dataset.room);

  if (title.textContent.trim() === 'Video Chat') {
    stopVideo();
    closePeerConnections();
    clearHTML(videos);
  }

  unsetupChatRoom();
}

function stopVideo() {
  document.querySelector('#user-video').srcObject = null;
  stopWebcam();
}

function stopWebcam() {
  localStream.getVideoTracks().forEach(stopTrack);
}

function stopTrack(track) {
  track.stop();
  track.enabled = false;
}

function unsetupChatRoom() {
  delete chatForm.dataset.room;
  title.textContent = 'Choose room';

  disable(chatInput, chatSubmit);
  unhide(rooms);
  hide(exitRoom, messages, chatters, userVideoContainer, videos);
  clearHTML(messages, chatters);
}

function handleChatMessage(event) {
  event.preventDefault();
  const { dataset: { room } } = event.target;

  const { message } = getFormData(event.target, 'message');
  if (message) {
    const { username } = socket.io.opts.query;
    socket.emit('room message', room, message);
    displayMessage(message, username, true);
    event.target.reset();
  }
}

function connectToOtherUsers(otherUsers) {
  otherUsers.forEach(socketId => {
    handleLocalPeerConnection(socketId, 'initiation');
  });
}

function handleLocalPeerConnection(socketId, offerType) {
  const localPeerConnection =
    createPeerConnection(socketId, localPeerConnections);

  addStreamTracks(localPeerConnection);

  setupLocalConnection(localPeerConnection, socketId, offerType);
  
  localPeerConnection.onicecandidate = event => {
    emitCandidate(event, socketId, 'offer');
  };

  localPeerConnection.onnegotiationneeded = _ => {
    if (localPeerConnection.signalingState !== 'stable') {
      handleLocalPeerConnection(socketId, 'initiation');
    }
  };
}

function createPeerConnection(socketId, peerConnections) {
  const peerConnection = new RTCPeerConnection(peerConnectionConfig);
  return peerConnections[socketId] = peerConnection;
}

function addStreamTracks(localPeerConnection) {
  localStream.getTracks()
    .forEach(track => localPeerConnection.addTrack(track, localStream));
}

function emitCandidate({ candidate }, socketId, offerOrAnswer) {
  if (candidate) {
    socket.emit('candidate', candidate, socketId, offerOrAnswer);
  }
}

function setupLocalConnection(localPeerConnection, socketId, offerType) {
  localPeerConnection.createOffer()
    .then(sdp => localPeerConnection.setLocalDescription(sdp))
    .then(() => {
      const sdp = localPeerConnection.localDescription;
      socket.emit('offer', sdp, socketId, offerType);
    })
    .catch(error => console.error(`${offerType} offer error: ${error}`));
}

function handleOffer(offer, socketId, username, offerType) {
  if (offerType === 'initiation') {
    handleLocalPeerConnection(socketId, 'return');
  }
  
  handleRemotePeerConnection(offer, socketId, username);
}

function handleRemotePeerConnection(offer, socketId, username) {
  const remotePeerConnection = 
    createPeerConnection(socketId, remotePeerConnections);

  setupRemoteConnection(remotePeerConnection, offer, socketId);

  remotePeerConnection.onicecandidate = (event) => {
    emitCandidate(event, socketId, 'answer')
  };

  remotePeerConnection.ontrack = (event) => {
    displayRemoteVideo(event, socketId, username);
  };
}

function setupRemoteConnection(remotePeerConnection, offer, socketId) {
  remotePeerConnection
    .setRemoteDescription(offer)
    .then(() => remotePeerConnection.createAnswer())
    .then(sdp => remotePeerConnection.setLocalDescription(sdp))
    .then(() => {
      const sdp = remotePeerConnection.localDescription;
      socket.emit('answer', sdp, socketId);
    })
    .catch(error => console.error(`answer error: ${error}`));
}

function displayRemoteVideo(event, senderSocketId, senderUsername) {
  const sameRemoteVideo = findVideoContainer(senderSocketId);

  if (!sameRemoteVideo) {
    const videoContainer = document.createElement('div');
    videoContainer.classList.add('video-container');
    videoContainer.dataset.socketId = senderSocketId;
  
    const newVideo = document.createElement('video');
    newVideo.classList.add('peer-video');
    newVideo.srcObject = event.streams[0];
    newVideo.play();
  
    const videoUsername = document.createElement('h6');
    videoUsername.textContent = senderUsername;

    videoContainer.append(newVideo, videoUsername);
    videos.append(videoContainer);
  }
}

function handleAnswer(answer, receiverSocketId) {
  localPeerConnections[receiverSocketId]
    .setRemoteDescription(answer);
}

function handleCandidate(candidate, socketId, offerOrAnswer) {
  const peerConnections = offerOrAnswer === 'offer'
    ? remotePeerConnections : localPeerConnections;

  peerConnections[socketId]
    .addIceCandidate(new RTCIceCandidate(candidate))
    .catch(error => {
      console.error(`add ice candidate ${offerOrAnswer} error: ${error}`);
    });
}

function disconnectVideo(anotherSocketId) {
  if (localPeerConnections[anotherSocketId]) {
    closePeerConnection(localPeerConnections, anotherSocketId);
  }
  if (remotePeerConnections[anotherSocketId]) {
    closePeerConnection(remotePeerConnections, anotherSocketId);
    const remoteVideo = findVideoContainer(anotherSocketId);
    remoteVideo.removeAttribute('src');
    remoteVideo.removeAttribute('srcObject');
    remoteVideo.remove();
  }
}

function closePeerConnection(peerConnections, socketId) {
  const peerConnection = peerConnections[socketId];

  peerConnection.ontrack = null;
  peerConnection.onremovetrack = null;
  peerConnection.onremovestream = null;
  peerConnection.onicecandidate = null;
  peerConnection.oniceconnectionstatechange = null;
  peerConnection.onsignalingstatechange = null;
  peerConnection.onicegatheringstatechange = null;
  peerConnection.onnegotiationneeded = null;

  peerConnection.close();
  delete peerConnections[socketId];
}

function findVideoContainer(socketId) {
  return document.querySelector(
    `.video-container[data-socket-id="${socketId}"]`
  );
}

function handleWindowUnload() {
  socket.close();
  closePeerConnections();
}

function closePeerConnections() {
  closeAndDeleteAll(localPeerConnections);
  closeAndDeleteAll(remotePeerConnections);
}

function closeAndDeleteAll(connections) {
  Object.values(connections).forEach(connection => connection.close());
  Object.keys(connections).forEach(socketId => delete connections[socketId]);
}

function getFormData(form, ...inputs) {
  const formData = new FormData(form);
  return inputs.reduce((inputValues, input) => {
    inputValues[input] = formData.get(input);
    return inputValues;
  }, {});
}

function getCurrentTime() {
  const now = new Date();
  const hours = now.getHours();
  const minutes = formatMinutes(now.getMinutes());
  return formatTwelveHourTime(hours, minutes);
}

function formatMinutes(minutes) {
  return minutes > 9 ? minutes : `0${minutes}`;
}

function formatTwelveHourTime(hours, minutes) {
  if (hours === 0) {
    return `12:${minutes} AM`
  } else if (hours < 12) {
    return `${hours}:${minutes} AM`
  } else if (hours === 12) {
    return `12:${minutes} PM`
  } else {
    return `${hours - 12}:${minutes} PM`
  }
}

function clearHTML(...elements) {
  elements.forEach(element => element.innerHTML = '');
}

function hide(...elements) {
  elements.forEach(element => element.classList.add('hidden'));
}

function unhide(...elements) {
  elements.forEach(element => element.classList.remove('hidden'));
}

function disable(...elements) {
  elements.forEach(element => element.disabled = true);
}

function enable(...elements) {
  elements.forEach(element => element.disabled = false);
}
