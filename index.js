const backendURL = 'https://livestchat.herokuapp.com/';
// const backendURL = 'http://localhost:9000';

let socket;
let socketId;

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

function setupSocket(username) {
  socket = io(backendURL, { query: { username } });
  socket.on('connect', () => socketId = socket.id);
  socket.on('room message', (message, name) => displayMessage(message, name, false));
  socket.on('someone left', removePerson);
  socket.on('someone joined', displayPerson);
}

function removePerson(username) {
  const leavingChatter = findChatter(username);
  leavingChatter.remove();
}

function handleEnteringRoom(event) {
  const { classList, textContent } = event.target;

  if (classList.contains('room-selector')) {
    socket.emit('join room', textContent, displayPeople);
  }
  
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
  window.scrollTo(0, document.body.scrollHeight);
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
    return `${hours}:${minutes} PM`
  } else {
    return `${hours - 12}:${minutes} PM`
  }
}