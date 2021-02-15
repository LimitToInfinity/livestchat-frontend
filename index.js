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
const chatForm = document.querySelector('#chat-form');
const chatInput = document.querySelector('input[name="message"]');
const chatSubmit = document.querySelector('#chat-submit');
const rooms = document.querySelector('#rooms');
const chatters = document.querySelector('#chatters');
const messages = document.querySelector('#messages');
const videos = document.querySelector('#videos');

document.querySelector('#enter-chat')
  .addEventListener('submit', handleEnteringChat);
rooms.addEventListener('click', handleEnteringRoom);
exitRoom.addEventListener('click', leaveRoom);
chatForm.addEventListener('submit', handleChatMessage);

function handleEnteringChat(event) {
  event.preventDefault();
  document.querySelector('#modal').classList.add('hidden');
  const { username } = getFormData(event.target, 'username');
  document.querySelector('#user').textContent = username;
  setupSocket(username);
}

function handleEnteringRoom(event) {
  const { classList, textContent, id } = event.target;
  const room = textContent.trim();

  if (id === 'video-chat') {
    startStream(room);
    enterRoom(room);
  } else if (classList.contains('room-selector')) {
    enterRoom(room);
  }
}

function startStream(room) {
  if (navigator.mediaDevices) {
    const userMediaParams = { 
      // audio: { echoCancellation: true },
      video: { facingMode: 'user' }
    };
    navigator.mediaDevices.getUserMedia(userMediaParams)
      .then(stream => handleUserMedia(stream, room))
      .catch(handleUserMediaError);
  } else {
    alert('User media is not supported in this browser.');
  }
}

function leaveRoom(_) {
  socket.emit('leave room', chatForm.dataset.room);
  chatForm.dataset.room = '';

  if (title.textContent.trim() === 'Video Chat') {
    stopVideo();
    closePeerConnections();
  }

  title.textContent = 'Choose room';

  disable(chatInput, chatSubmit);
  unhide(rooms);
  hide(exitRoom, messages, chatters, videos);
  clearHTML(messages, chatters);
}

function stopVideo() {
  document.querySelector('#user-video').srcObject = null;
  localStream.getVideoTracks().forEach(stopTrack);
}

function stopTrack(track) {
  track.stop();
  track.enabled = false;
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

function setupSocket(username) {
  socket = io(backendURL, { query: { username } });
  socket.on('connect', () => mySocketId = socket.id);

  socket.on('room message', (message, name) => displayMessage(message, name, false));
  socket.on('someone left', removePerson);
  socket.on('someone joined', displayPerson);

  socket.on('get users', connectToOtherUsers);
  socket.on('enter offer', handleOffer);
  socket.on('return offer', handleOffer);
  socket.on('offer candidate', (candidate, socketId) => {
    handleCandidate(candidate, socketId, remotePeerConnections, 'offer');
  });
  socket.on('answer', handleAnswer);
  socket.on('answer candidate', (candidate, socketId) => {
    handleCandidate(candidate, socketId, localPeerConnections, 'answer');
  });
  socket.on('disconnect video', handleDisconnectVideo);

  window.onunload = window.onbeforeunload = handleWindowUnload;
}

function connectToOtherUsers(otherUsers) {
  otherUsers.forEach(socketId => {
    handleLocalPeerConnection(socketId, 'enter offer')
  });
}

function handleLocalPeerConnection(socketId, offerType) {
  const localPeerConnection =
    createPeerConnection(socketId, localPeerConnections);

  addStreamTracks(localPeerConnection);

  localPeerConnection.onicecandidate = event => {
    emitCandidate(event, socketId, 'offer');
  };

  setupConnection(localPeerConnection, socketId, offerType);
}

function addStreamTracks(localPeerConnection) {
  localStream.getTracks()
    .forEach(track => localPeerConnection.addTrack(track, localStream));
}

function setupConnection(localPeerConnection, socketId, offerType) {
  localPeerConnection.createOffer()
    .then(sdp => localPeerConnection.setLocalDescription(sdp))
    .then(() => socket.emit(offerType, localPeerConnection.localDescription, socketId))
    .catch(error => console.error(`${offerType} error: ${error}`));
}

function handleOffer(offer, socketId, username, isInitiationOffer) {
  if (isInitiationOffer) {
    handleLocalPeerConnection(socketId, 'return offer');
  }

  handleRemotePeerConnection(offer, socketId, username);
}

function handleRemotePeerConnection(offer, socketId, username) {
  const remotePeerConnection = 
    createPeerConnection(socketId, remotePeerConnections);

  remotePeerConnection
    .setRemoteDescription(offer)
    .then(() => remotePeerConnection.createAnswer())
    .then(sdp => remotePeerConnection.setLocalDescription(sdp))
    .then(() => socket.emit('answer', remotePeerConnection.localDescription, socketId))
    .catch(error => console.error(`set remote peer connection error: ${error}`));

  remotePeerConnection.onicecandidate = (event) => {
    emitCandidate(event, socketId, 'answer')
  };

  remotePeerConnection.ontrack = (event) => {
    displayRemoteVideo(event, socketId, username);
  }
}

function createPeerConnection(socketId, peerConnections) {
  const peerConnection = new RTCPeerConnection(peerConnectionConfig);
  return peerConnections[socketId] = peerConnection;
}

function emitCandidate({ candidate }, socketId, offerOrReturn) {
  if (candidate) {
    socket.emit(`${offerOrReturn} candidate`, candidate, socketId);
  }
};

function handleAnswer(answer, receiverSocketId) {
  localPeerConnections[receiverSocketId]
    .setRemoteDescription(answer);
}

function handleCandidate(candidate, socketId, peerConnections, offerOrAnswer) {
  peerConnections[socketId]
    .addIceCandidate(new RTCIceCandidate(candidate))
    .catch(error => {
      console.error(`add ice candidate ${offerOrAnswer} error: ${error}`);
    });
}

function handleDisconnectVideo(anotherSocketId) {
  if (remotePeerConnections[anotherSocketId]) {
    localPeerConnections[anotherSocketId].close();
    delete localPeerConnections[anotherSocketId];
    remotePeerConnections[anotherSocketId].close();
    delete remotePeerConnections[anotherSocketId];
    findVideoContainer(anotherSocketId).remove();
  }
}

function findVideoContainer(socketId) {
  return document.querySelector(
    `.video-container[data-socket-id="${socketId}"]`
  );
}

function handleWindowUnload() {
  socket.close();
  closePeerConnections();
};

function closePeerConnections() {
  closeAndDeleteAll(localPeerConnections);
  closeAndDeleteAll(remotePeerConnections);
}

function closeAndDeleteAll(connections) {
  Object.values(connections).forEach(connection => connection.close());
  Object.keys(connections).forEach(socketId => delete connections[socketId]);

  clearHTML(videos);
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
};

function handleUserMedia(stream, room) {
  const userVideo = document.querySelector('#user-video');
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
  chatForm.dataset.room = room;
  title.textContent = room;
  hide(rooms);
  unhide(exitRoom, messages);
  enable(chatInput, chatSubmit);

  if (room === 'Video Chat') {
    unhide(videos);
  }
}

function displayPeople(people) {
  unhide(chatters);
  people.forEach(displayPerson);
}

function displayPerson(username) {
  const personDisplay = document.createElement('li');
  const personButton = document.createElement('button');
  personButton.classList.add('chatter');
  personButton.textContent = username;
  personDisplay.append(personButton);
  chatters.append(personDisplay);
}

function removePerson(username) {
  const leavingChatter = findChatter(username);
  leavingChatter.remove();
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

function findChatter(username) {
  const allChatterButtons = Array.from(document.querySelectorAll('.chatter'));
  return allChatterButtons
    .find(chatter => chatter.textContent === username)
    .parentNode;
}

function getFormData(form, ...inputs) {
  const formData = new FormData(form);
  return inputs.reduce((inputValues, input) => {
    inputValues[input] = formData.get(input);
    return inputValues;
  }, {});
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

function getCurrentTime() {
  const now = new Date();
  const hours = now.getHours();
  const minutes = formatMinutes(now.getMinutes());
  return formatTwelveHourTime(hours, minutes);
}

function formatMinutes(minutes) {
  if (minutes > 9) {
    return minutes;
  }
  return `0${minutes}`
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