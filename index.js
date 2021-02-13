const backendURL = 'https://livestchat.herokuapp.com/';

let localStream;
let socket;
let socketId;
const localPeerConnections = {};
const remotePeerConnections = {};
const peerConnectionConfig = {
  iceServers: [
    {
      urls: ["stun:stun.l.google.com:19302"]
    }
  ]
};

const modal = document.querySelector('#modal');
const enterChat = document.querySelector('#enter-chat');
const title = document.querySelector('#title');
const exitRoom = document.querySelector('#exit-room');
const user = document.querySelector('#user');
const chatForm = document.querySelector('#chat-form');
const chatSubmit = document.querySelector('#chat-submit');
const rooms = document.querySelector('#rooms');
const chatters = document.querySelector('#chatters');
const messages = document.querySelector('#messages');

enterChat.addEventListener('submit', handleEnteringChat);
rooms.addEventListener('click', handleEnteringRoom);
exitRoom.addEventListener('click', leaveRoom);
chatForm.addEventListener('submit', handleChatMessage);

function handleEnteringChat(event) {
  event.preventDefault();
  modal.classList.add('hidden');
  const { username } = getFormData(event.target, 'username');
  user.textContent = username;
  setupSocket(username);
}

function handleEnteringRoom(event) {
  const { classList, textContent, id } = event.target;

  if (classList.contains('room-selector')) {
    enterRoom(textContent);
  } else if (id === 'video-chat') {
    const userMediaParams = { 
      // audio: { echoCancellation: true },
      video: { facingMode: 'user' }
    };
    navigator.mediaDevices.getUserMedia(userMediaParams)
      .then(handleUserMedia)
      .catch(handleUserMediaError);
  }
}

function leaveRoom(_) {
  socket.emit('leave room', chatForm.dataset.room);
  chatForm.dataset.room = '';

  title.textContent = 'Choose room';

  disable(chatSubmit);
  unhide(rooms);
  hide(exitRoom, messages, chatters);
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

function setupSocket(username) {
  socket = io(backendURL, { query: { username } });
  socket.on('connect', () => socketId = socket.id);

  socket.on('room message', (message, name) => displayMessage(message, name, false));
  socket.on('someone left', removePerson);
  socket.on('someone joined', displayPerson);

  socket.on('get users', connectToOtherUsers);
  socket.on('offer', handleOffer);
  socket.on('offer candidate', handleOfferCandidate);
  socket.on('answer', handleAnswer);
  socket.on('answer candidate', handleAnswerCandidate);
  socket.on('disconnect video', handleDisconnectVideo);

  window.onunload = window.onbeforeunload = handleWindowUnload;
}

function connectToOtherUsers(otherUsers) {
  console.log('other users', otherUsers);
  otherUsers.forEach(handlePeerConnection);
}

function handlePeerConnection(userSocketId) {
  const localPeerConnection = new RTCPeerConnection(peerConnectionConfig);
  localPeerConnections[userSocketId] = localPeerConnection;

  localStream.getTracks().forEach(track => localPeerConnection.addTrack(track, localStream));

  localPeerConnection.onicecandidate = emitOfferCandidate;

  localPeerConnection.createOffer()
    .then(sdp => localPeerConnection.setLocalDescription(sdp))
    .then(() => socket.emit('offer', localPeerConnection.localDescription, userSocketId))
    .catch(error => console.log(`create offer error: ${error}`));
}

function emitOfferCandidate({ candidate }) {
  if (candidate) {
    socket.emit('offer candidate', candidate, socketId);
  }
};

function handleOffer(offer, senderSocketId, senderUsername) {
  console.log('offer', offer);
  const remotePeerConnection = new RTCPeerConnection(peerConnectionConfig);
  remotePeerConnections[senderSocketId] = remotePeerConnection;
  remotePeerConnection.onicecandidate = (event) => {
    emitAnswerCandidate(event, senderSocketId)
  };

  remotePeerConnection
    .setRemoteDescription(offer)
    .then(() => remotePeerConnection.createAnswer())
    .then(sdp => remotePeerConnection.setLocalDescription(sdp))
    .then(() => socket.emit('answer', remotePeerConnection.localDescription, senderSocketId))
    .catch(error => console.error(`set remote description error: ${error}`))

  remotePeerConnection.ontrack = (event) => {
    displayRemoteVideo(event, senderSocketId, senderUsername);
  }
}

function emitAnswerCandidate({ candidate }, senderSocketId) {
  if (candidate) {
    socket.emit('answer candidate', candidate, senderSocketId);
  }
};

function handleAnswer(answer, receiverSocketId) {
  console.log('answer', answer);
  localPeerConnections[receiverSocketId]
    .setRemoteDescription(answer);
}

function handleOfferCandidate(candidate, senderSocketId) {
  console.log('offer candidate', candidate);
  remotePeerConnections[senderSocketId]
    .addIceCandidate(new RTCIceCandidate(candidate))
    .catch(error => console.error(`add ice candidate error: ${error}`));
}

function handleAnswerCandidate(candidate, receiverSocketId) {
  console.log('answer candidate', candidate);
  localPeerConnections[receiverSocketId]
    .addIceCandidate(new RTCIceCandidate(candidate))
    .catch(error => console.error(`add ice candidate error: ${error}`));
}

function handleDisconnectVideo(anotherSocketId) {
  if (remotePeerConnections[anotherSocketId]) {
    remotePeerConnections[anotherSocketId].close();
    delete remotePeerConnections[anotherSocketId];
    const videoToDisconnect = document.querySelector(
      `.video-container[data-socket-id="${anotherSocketId}"]`
    );
    videoToDisconnect.remove();
  }
}

function handleWindowUnload() {
  socket.close();
  Object.values(localPeerConnections)
    .forEach(localPeerConnection => localPeerConnection.close());
};

function displayRemoteVideo(event, senderSocketId, senderUsername) {
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
  document.body.append(videoContainer);
};

function handleUserMedia(stream) {
  const userVideo = document.querySelector('#user-video');
  userVideo.srcObject = localStream = stream;
  userVideo.onloadedmetadata = _ => userVideo.play();

  socket.emit('ask for users');
}

function handleUserMediaError(error) {
  console.error(`get user media error: ${error}`);
}

function enterRoom(textContent) {
  socket.emit('join room', textContent, displayPeople);
  chatForm.dataset.room = textContent;
  title.textContent = textContent;
  hide(rooms);
  unhide(exitRoom, messages);
  enable(chatSubmit);
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