const backendURL = 'https://livestchat.herokuapp.com/';
// const backendURL = 'http://localhost:9000';

let socket;
let socketId;

const modal = document.querySelector('#modal');
const enterChat = document.querySelector('#enter-chat');
const title = document.querySelector('#title');
const exitRoom = document.querySelector('#exit-room');
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
  setupSocket(username);
}

function setupSocket(username) {
  socket = io(backendURL, { query: `name=${username}` });
  socket.on('connect', () => socketId = socket.id);
  socket.on('room message', message => displayMessage(message, false));
  socket.on('someone left', removePerson);
}

function removePerson(person) {
  const allChatterButtons = Array.from(document.querySelectorAll('.chatter'));
  const leavingChatter = allChatterButtons
    .find(chatter => chatter.textContent === person)
    .parentNode;
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

function displayPerson(person) {
  const personDisplay = document.createElement('li');
  const personButton = document.createElement('button');
  personButton.classList.add('chatter');
  personButton.textContent = person;
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

  const { chatMessage } = getFormData(event.target, 'message');
  if (chatMessage) {
    socket.emit('room message', room, chatMessage);
    displayMessage(chatMessage, true);
    event.target.reset();
  }
}

function displayMessage(message, isSender) {
  const messageDisplay = document.createElement('li');
  isSender
    ? messageDisplay.classList.add('sender')
    : messageDisplay.classList.add('receiver');
  messageDisplay.textContent = message;
  messages.append(messageDisplay);
  window.scrollTo(0, document.body.scrollHeight);
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
